import dotenv from "dotenv";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

dotenv.config();

const { Pool } = pg;
const RAW_DESCRIPTION_CANDIDATE_LIMIT = 500;
const RAW_DESCRIPTION_URL_FETCH_LIMIT = 40;

export type RawDescriptionCandidateRow = {
  id: string;
  name: string;
  brand: string | null;
  type_code: string | null;
  subtype_code: string | null;
  physical_form: string | null;
  gender: string | null;
  product_name: string | null;
  product_category: string | null;
  product_tags: string[] | null;
  product_link: string | null;
  product_raw_description: string | null;
};

export type RawDescriptionCandidate = {
  toyId: string;
  name: string;
  sourceType:
    | "product_raw_description"
    | "matched_url_page"
    | "local_metadata_summary";
  matchedUrl: string | null;
  proposedRawDescription: string;
  confidence: number;
  reason: string;
};

type RawDescriptionCandidatesReport = {
  generatedAt?: string;
  scanned?: number;
  candidates?: number;
  highConfidence?: number;
  lowConfidence?: number;
  fetchUrlPages?: boolean;
  items?: RawDescriptionCandidate[];
};

export type RawDescriptionRefetchItem = {
  toyId: string;
  name: string;
  matchedUrl: string;
  sourceType: RawDescriptionCandidate["sourceType"];
  confidence: number;
  reason: string;
};

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hasUsableText(value: unknown) {
  const normalized = normalizeText(value);
  return normalized.length > 0 && normalized !== "信息未获取";
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => normalizeText(value)).filter(Boolean)),
  );
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function extractMetaContent(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const value = normalizeText(decodeHtmlEntities(html.match(pattern)?.[1] ?? ""));
    if (hasUsableText(value)) return value;
  }

  return "";
}

function extractJsonLdDescriptions(html: string) {
  const descriptions: string[] = [];
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(decodeHtmlEntities(match[1] ?? ""));
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (
          item &&
          typeof item === "object" &&
          /product/i.test(String((item as Record<string, unknown>)["@type"] ?? ""))
        ) {
          const description = normalizeText(
            (item as Record<string, unknown>).description,
          );
          if (hasUsableText(description)) descriptions.push(description);
        }
      }
    } catch {
      // Ignore malformed embedded JSON-LD.
    }
  }

  return descriptions;
}

function extractProductDescriptionBlocks(html: string) {
  const blocks: string[] = [];
  const patterns = [
    /<div[^>]+class=["'][^"']*(?:product-description|product__description|description|rte)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    /<section[^>]+class=["'][^"']*(?:product-description|product__description|description|rte)[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi,
    /<p[^>]+itemprop=["']description["'][^>]*>([\s\S]*?)<\/p>/gi,
    /<div[^>]+itemprop=["']description["'][^>]*>([\s\S]*?)<\/div>/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const text = normalizeText(stripTags(match[1] ?? ""));
      if (hasUsableText(text)) blocks.push(text);
    }
  }

  return blocks;
}

function truncateRawDescription(value: string, limit = 600) {
  const normalized = normalizeText(value);
  return normalized.length > limit
    ? `${normalized.slice(0, limit).replace(/[，。,.!?！？；;]\S*$/, "")}。`
    : normalized;
}

export function extractRawDescriptionFromHtml(html: string) {
  const candidates = uniqueStrings([
    extractMetaContent(html, "description"),
    extractMetaContent(html, "og:description"),
    ...extractJsonLdDescriptions(html),
    ...extractProductDescriptionBlocks(html),
  ]);

  return truncateRawDescription(candidates.find((value) => value.length >= 24) ?? "");
}

function buildMetadataSummary(row: RawDescriptionCandidateRow) {
  const signals = uniqueStrings([
    row.gender === "female" ? "女性向" : null,
    row.gender === "male" ? "男性向" : null,
    row.gender === "unisex" ? "通用/双人场景" : null,
    row.physical_form === "external" ? "外部刺激" : null,
    row.physical_form === "internal" ? "入体刺激" : null,
    row.physical_form === "composite" ? "复合刺激" : null,
    row.type_code === "suction" ? "外部吮吸" : null,
    row.type_code === "external_vibe" ? "外部震动" : null,
    row.type_code === "masturbator" ? "男性自慰器" : null,
    row.type_code === "wearable_remote" ? "可穿戴/远控互动" : null,
    row.type_code === "dual_stimulation" ? "双刺激" : null,
    ...(row.product_tags ?? []),
  ]).slice(0, 6);

  if (signals.length < 2) {
    return null;
  }

  const displayName = normalizeText(row.product_name) || normalizeText(row.name);
  return `${displayName} 是一款${signals.join("、")}相关产品。该描述由本地商品字段和标签生成，建议后续结合官方详情页复核。`;
}

export function buildRawDescriptionCandidate(
  row: RawDescriptionCandidateRow,
): RawDescriptionCandidate | null {
  const productRawDescription = normalizeText(row.product_raw_description);
  if (hasUsableText(productRawDescription)) {
    return {
      toyId: row.id,
      name: row.name,
      sourceType: "product_raw_description",
      matchedUrl: row.product_link,
      proposedRawDescription: productRawDescription,
      confidence: 0.95,
      reason: "关联 products.specs.rawDescription 已有可用描述",
    };
  }

  const metadataSummary = buildMetadataSummary(row);
  if (metadataSummary) {
    return {
      toyId: row.id,
      name: row.name,
      sourceType: "local_metadata_summary",
      matchedUrl: row.product_link,
      proposedRawDescription: metadataSummary,
      confidence: 0.62,
      reason: "基于本地字段和标签生成，需要人工或官方来源复核",
    };
  }

  return null;
}

export function buildUrlRawDescriptionCandidate(
  row: RawDescriptionCandidateRow,
  extractedRawDescription: string,
): RawDescriptionCandidate | null {
  const proposedRawDescription = truncateRawDescription(extractedRawDescription);
  if (!hasUsableText(proposedRawDescription) || proposedRawDescription.length < 24) {
    return null;
  }

  return {
    toyId: row.id,
    name: row.name,
    sourceType: "matched_url_page",
    matchedUrl: row.product_link,
    proposedRawDescription,
    confidence: 0.82,
    reason: "matchedUrl 页面提取到可用商品描述，建议抽样复核后批量写入",
  };
}

export function selectHighConfidenceApplyCandidates(
  candidates: RawDescriptionCandidate[],
) {
  return candidates.filter(
    (candidate) =>
      candidate.sourceType === "matched_url_page" &&
      candidate.confidence >= 0.8 &&
      hasUsableText(candidate.proposedRawDescription),
  );
}

export function buildHighConfidenceRawDescriptionUpdateBatch(
  candidates: RawDescriptionCandidate[],
) {
  const placeholders = candidates
    .map(
      (_, index) =>
        `($${index * 2 + 1}::uuid, $${index * 2 + 2}::text)`,
    )
    .join(", ");
  const values = candidates.flatMap((candidate) => [
    candidate.toyId,
    candidate.proposedRawDescription,
  ]);

  return {
    sql: `
      UPDATE public.recommender_toys AS t
      SET raw_description = v.raw_description,
          updated_at = NOW()
      FROM (
        VALUES ${placeholders}
      ) AS v(id, raw_description)
      WHERE t.id = v.id
        AND NULLIF(BTRIM(COALESCE(t.raw_description, '')), '') IS NULL
    `,
    values,
  };
}

export function buildNeedsRefetchList(
  candidates: RawDescriptionCandidate[],
): RawDescriptionRefetchItem[] {
  return candidates
    .filter(
      (candidate) =>
        candidate.confidence < 0.8 &&
        /^https?:\/\//i.test(normalizeText(candidate.matchedUrl)),
    )
    .map((candidate) => ({
      toyId: candidate.toyId,
      name: candidate.name,
      matchedUrl: String(candidate.matchedUrl),
      sourceType: candidate.sourceType,
      confidence: candidate.confidence,
      reason: candidate.reason,
    }));
}

export function shouldRunRawDescriptionCandidatesScript(
  importMetaUrl: string,
  argvEntry?: string,
) {
  if (!argvEntry) {
    return false;
  }

  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function readMissingRawDescriptionRows(client: pg.PoolClient) {
  const result = await client.query<RawDescriptionCandidateRow>(
    `
      SELECT
        t.id,
        t.name,
        t.brand,
        t.type_code,
        t.subtype_code,
        t.physical_form,
        t.gender,
        p.name AS product_name,
        p.category AS product_category,
        p.tags AS product_tags,
        p.link AS product_link,
        COALESCE(p.specs::jsonb ->> 'rawDescription', NULL) AS product_raw_description
      FROM public.recommender_toys AS t
      LEFT JOIN public.products AS p ON t.original_id = p.id
      WHERE NULLIF(BTRIM(COALESCE(t.raw_description, '')), '') IS NULL
      ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC NULLS LAST
      LIMIT $1
    `,
    [RAW_DESCRIPTION_CANDIDATE_LIMIT],
  );

  return result.rows;
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "user-agent":
          "Mozilla/5.0 (compatible; InnerSpaceDataQualityBot/1.0; +https://localhost)",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function buildCandidatesWithOptionalUrlFetch(
  rows: RawDescriptionCandidateRow[],
  fetchUrlPages: boolean,
) {
  if (!fetchUrlPages) {
    return rows
      .map(buildRawDescriptionCandidate)
      .filter((candidate): candidate is RawDescriptionCandidate => Boolean(candidate));
  }

  const candidates: RawDescriptionCandidate[] = [];
  let fetched = 0;

  for (const row of rows) {
    const existingCandidate = buildRawDescriptionCandidate(row);
    if (existingCandidate?.sourceType === "product_raw_description") {
      candidates.push(existingCandidate);
      continue;
    }

    const url = normalizeText(row.product_link);
    if (/^https?:\/\//i.test(url) && fetched < RAW_DESCRIPTION_URL_FETCH_LIMIT) {
      fetched += 1;
      try {
        const extracted = extractRawDescriptionFromHtml(await fetchHtml(url));
        const urlCandidate = buildUrlRawDescriptionCandidate(row, extracted);
        if (urlCandidate) {
          candidates.push(urlCandidate);
          continue;
        }
      } catch (error) {
        console.warn(
          `[backfill-raw-description-candidates] URL 提取失败，回退本地摘要: ${url} (${error instanceof Error ? error.message : String(error)})`,
        );
      }
    }

    if (existingCandidate) {
      candidates.push(existingCandidate);
    }
  }

  return candidates;
}

async function generateRawDescriptionCandidatesReport() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    console.log(
      "[backfill-raw-description-candidates] 生成 raw_description dry-run 候选报告，不写库 ...",
    );

    const fetchUrlPages = process.argv.includes("--fetch-url-pages");
    const rows = await readMissingRawDescriptionRows(client);
    const candidates = await buildCandidatesWithOptionalUrlFetch(rows, fetchUrlPages);
    const outputPath = path.join(
      os.tmpdir(),
      `raw-description-candidates-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );

    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          scanned: rows.length,
          candidates: candidates.length,
          highConfidence: candidates.filter((item) => item.confidence >= 0.8).length,
          lowConfidence: candidates.filter((item) => item.confidence < 0.8).length,
          fetchUrlPages,
          items: candidates,
        },
        null,
        2,
      ),
    );

    console.log(
      JSON.stringify(
        {
          scanned: rows.length,
          candidates: candidates.length,
          highConfidence: candidates.filter((item) => item.confidence >= 0.8).length,
          lowConfidence: candidates.filter((item) => item.confidence < 0.8).length,
          fetchUrlPages,
          outputPath,
        },
        null,
        2,
      ),
    );
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

function getArgValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return "";
  return normalizeText(process.argv[index + 1]);
}

function loadCandidatesReport(reportPath: string): RawDescriptionCandidatesReport {
  return JSON.parse(fs.readFileSync(reportPath, "utf8")) as RawDescriptionCandidatesReport;
}

function writeNeedsRefetchReport(
  reportPath: string,
  candidates: RawDescriptionCandidate[],
) {
  const needsRefetch = buildNeedsRefetchList(candidates);
  const parsedPath = path.parse(reportPath);
  const outputPath = path.join(
    parsedPath.dir,
    `${parsedPath.name}-needs-refetch${parsedPath.ext || ".json"}`,
  );

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: needsRefetch.length,
        items: needsRefetch,
      },
      null,
      2,
    ),
  );

  return { outputPath, needsRefetch };
}

async function applyHighConfidenceRawDescriptionCandidates(reportPath: string) {
  const report = loadCandidatesReport(reportPath);
  const candidates = Array.isArray(report.items) ? report.items : [];
  const applyCandidates = selectHighConfidenceApplyCandidates(candidates);
  const refetchReport = writeNeedsRefetchReport(reportPath, candidates);

  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");

    let updated = 0;
    if (applyCandidates.length > 0) {
      const update = buildHighConfidenceRawDescriptionUpdateBatch(applyCandidates);
      const result = await client.query(update.sql, update.values);
      updated = result.rowCount ?? 0;
    }

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          reportPath,
          selectedHighConfidence: applyCandidates.length,
          updated,
          needsRefetch: refetchReport.needsRefetch.length,
          needsRefetchPath: refetchReport.outputPath,
          applied: applyCandidates.map((candidate) => ({
            toyId: candidate.toyId,
            name: candidate.name,
            matchedUrl: candidate.matchedUrl,
          })),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

if (shouldRunRawDescriptionCandidatesScript(import.meta.url, process.argv[1])) {
  const reportPath = getArgValue("--report");
  const applyHighConfidence = process.argv.includes("--apply-high-confidence");
  const command = applyHighConfidence && reportPath
    ? applyHighConfidenceRawDescriptionCandidates(reportPath)
    : generateRawDescriptionCandidatesReport();

  command.catch((error) => {
    console.error("[backfill-raw-description-candidates] 执行失败:", error);
    process.exitCode = 1;
  });
}
