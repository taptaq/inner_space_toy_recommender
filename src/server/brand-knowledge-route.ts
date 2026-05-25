import type { Request, Response } from "express";

import { buildBrandSlug } from "../lib/brand-brief.js";
import {
  buildBrandKnowledgeSourceFromConfig,
  listDefaultBrandKnowledgeSources,
  type BrandKnowledgeSource,
} from "../lib/knowledge-nebula-brand-topic.js";
import {
  findCompetitorRegistryConfig,
} from "../scraper/shared/competitor-registry.js";

type CompetitorRow = {
  name: string | null;
  domain: string | null;
  country: string | null;
  founded_date: string | null;
  description: string | null;
  focus: string | null;
  philosophy: string[] | null;
  major_user_group_profile: string | null;
  is_domestic: boolean | null;
};

type Queryable = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: CompetitorRow[] }>;
};

function isTransientDatabaseReadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /Connection terminated|ECONNRESET|server closed the connection|terminating connection|P1001|P1017/i.test(
    message,
  );
}

async function queryWithRetry(pool: Queryable, sql: string, params: unknown[]) {
  try {
    return await pool.query(sql, params);
  } catch (error) {
    if (!isTransientDatabaseReadError(error)) throw error;
    return await pool.query(sql, params);
  }
}

function buildSourceFromRow(row: CompetitorRow): BrandKnowledgeSource | null {
  const brandName = String(row.name || "").trim();
  if (!brandName) return null;

  return {
    brandName,
    brandSlug: buildBrandSlug(brandName),
    country: row.country,
    description: row.description,
    focus: row.focus,
    philosophy: row.philosophy,
    majorUserGroupProfile: row.major_user_group_profile,
    domain: row.domain,
    foundedDate: row.founded_date,
    isDomestic: row.is_domestic,
  };
}

function findFallbackSource(brandSlug: string) {
  const direct = listDefaultBrandKnowledgeSources().find(
    (source) => source.brandSlug === brandSlug,
  );
  if (direct) return direct;

  const registryConfig = findCompetitorRegistryConfig(brandSlug);
  return registryConfig
    ? buildBrandKnowledgeSourceFromConfig(registryConfig)
    : null;
}

function buildSourceListFromRows(rows: CompetitorRow[]) {
  const sources = rows
    .map(buildSourceFromRow)
    .filter((source): source is BrandKnowledgeSource => Boolean(source));
  const sourceMap = new Map(sources.map((source) => [source.brandSlug, source]));

  for (const fallback of listDefaultBrandKnowledgeSources()) {
    if (!sourceMap.has(fallback.brandSlug)) {
      sourceMap.set(fallback.brandSlug, fallback);
    }
  }

  return Array.from(sourceMap.values()).sort((left, right) =>
    left.brandName.localeCompare(right.brandName, "zh-CN"),
  );
}

async function readAllBrandKnowledgeSources(pool: Queryable) {
  const result = await queryWithRetry(
    pool,
    `
      SELECT
        name,
        domain,
        country,
        founded_date,
        description,
        focus,
        philosophy,
        major_user_group_profile,
        is_domestic
      FROM public.competitors
    `,
    [],
  );

  return buildSourceListFromRows(result.rows);
}

export function createListBrandKnowledgeHandler({
  pool,
}: {
  pool: Queryable;
}) {
  return async (_req: Request, res: Response) => {
    try {
      const sources = await readAllBrandKnowledgeSources(pool);
      res.json({ brands: sources });
    } catch (error) {
      res.status(500).json({
        error: "Brand knowledge list failed",
        details: String(error),
      });
    }
  };
}

export function createGetBrandKnowledgeHandler({
  pool,
}: {
  pool: Queryable;
}) {
  return async (req: Request, res: Response) => {
    const brandSlug = String(req.params.brandSlug || "").trim().toLowerCase();
    if (!brandSlug) {
      res.status(400).json({ error: "brandSlug is required" });
      return;
    }

    try {
      const sources = await readAllBrandKnowledgeSources(pool);
      const matched =
        sources.find((source) => source.brandSlug === brandSlug) ??
        findFallbackSource(brandSlug);

      if (!matched) {
        res.status(404).json({ error: "Brand knowledge not found" });
        return;
      }

      res.json(matched);
    } catch (error) {
      res.status(500).json({
        error: "Brand knowledge fetch failed",
        details: String(error),
      });
    }
  };
}
