import dotenv from "dotenv";
import OpenAI from "openai";
import pg from "pg";
import { chromium, type BrowserContext, type Page } from "playwright";

import {
  extractParamPairsFromCompactText,
  extractParamPairsFromLooseJsonText,
  extractParamPairsFromPageHtml,
  isPlaceholderParamValue,
  mergeWhitelistParams,
} from "../scraper/darentang/param-extraction.ts";
import {
  classifyLibrarySubtypeCode,
  classifyLibraryTypeCode,
  resolveLibraryAudienceGender,
  type ResolvedLibraryAudienceGender,
} from "../lib/library-product-type-classifier.ts";
import { getParentLibraryTypeCodeForSubtype } from "../lib/library-product-types.ts";
import { buildRecommendationProductFeatures } from "../lib/recommendation-product-features.ts";
import type { Product } from "../data/mock.ts";

dotenv.config();

const { Pool } = pg;

const DEFAULT_LIMIT = Number(process.env.TMALL_FALLBACK_REFETCH_LIMIT || "120");
const DETAIL_WAIT_MS = Number(process.env.TMALL_FALLBACK_REFETCH_DETAIL_WAIT_MS || "4500");
const BETWEEN_ITEMS_MS = Number(process.env.TMALL_FALLBACK_REFETCH_BETWEEN_ITEMS_MS || "1200");
const MAX_OCR_IMAGES = Number(process.env.TMALL_FALLBACK_REFETCH_MAX_OCR_IMAGES || "8");
const DEFAULT_POWERED_MAX_DB = 50;
const DEFAULT_POWERED_WATERPROOF = 7;

type TargetRow = {
  id: string;
  original_id: string | null;
  name: string;
  brand: string | null;
  price: string | null;
  material: string | null;
  gender: string | null;
  physical_form: string | null;
  motor_type: string | null;
  appearance: string | null;
  image_url: string | null;
  link: string | null;
  product_name: string | null;
  product_price: string | null;
  product_tags: string[] | null;
};

type RefetchedFields = {
  rawDescription: string;
  price: number | null;
  material: string | null;
  gender: ResolvedLibraryAudienceGender;
  typeCode: string | null;
  subtypeCode: string | null;
  maxDb: number | null;
  waterproof: number | null;
  imageUrl: string | null;
  recommendationFeatures: unknown;
};

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hasText(value: unknown) {
  return normalizeText(value).length > 0;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePrice(value: unknown) {
  const source = normalizeText(value);
  const matches = Array.from(source.matchAll(/(?:¥|￥|价格|券后|到手价|售价)?\s*([1-9]\d{0,5}(?:\.\d{1,2})?)/g))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0 && value < 100000);
  if (!matches.length) return null;
  return Math.min(...matches);
}

function parseStoredPrice(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 20 ? parsed : null;
}

function normalizeRefetchedPrice(rawPriceText: string, row: TargetRow) {
  const parsed = parsePrice(rawPriceText);
  const currentPrice = parseStoredPrice(row.price);
  const productPrice = parseStoredPrice(row.product_price);
  const referencePrice = currentPrice ?? productPrice;

  if (!parsed) return productPrice ?? null;
  if (parsed < 20) return productPrice ?? null;
  if (referencePrice && parsed < referencePrice * 0.35) return productPrice ?? null;

  return parsed;
}

function parseTmallCookieHeader(cookieHeader: string) {
  return cookieHeader
    .split(";")
    .map((part) => {
      const index = part.indexOf("=");
      if (index <= 0) return null;
      const name = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if (!name || !value) return null;
      return [
        { name, value, domain: ".tmall.com", path: "/" },
        { name, value, domain: ".taobao.com", path: "/" },
      ];
    })
    .filter((value): value is Array<{ name: string; value: string; domain: string; path: string }> =>
      Boolean(value),
    )
    .flat();
}

async function injectTmallCookies(context: BrowserContext) {
  const cookieHeader = process.env.TMALL_COOKIE || "";
  if (!cookieHeader.trim()) return;
  const cookies = parseTmallCookieHeader(cookieHeader);
  if (!cookies.length) return;
  await context.addCookies(cookies);
  console.log(`[tmall-refetch] 已注入 TMALL_COOKIE: ${cookies.length} 条`);
}

async function ocrWithGLM(imageUrls: string[], prompt: string) {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) throw new Error("GLM_API_KEY 未配置");

  const client = new OpenAI({
    apiKey,
    baseURL: "https://open.bigmodel.cn/api/paas/v4/",
  });
  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    { type: "text", text: prompt },
  ];
  for (const url of imageUrls.slice(0, MAX_OCR_IMAGES)) {
    content.push({ type: "image_url", image_url: { url } });
  }

  const response = await client.chat.completions.create({
    model: "glm-4.6v",
    messages: [{ role: "user", content }],
    temperature: 0.1,
  });
  const message = response.choices[0]?.message as any;
  return normalizeText(message?.content || message?.reasoning_content || "");
}

function buildOcrPrompt(title: string) {
  return `你是商品详情图 OCR 和字段校准助手。请只根据图片中明确出现的信息，输出中文结构化文本，不要识别价格。

商品标题参考：${title}

重点提取：
1. 产品名称/型号
2. 材质/面料/成分
3. 产品类型与使用方式
4. 动力规格，如震动、吮吸、旋转、伸缩、加热、手动/电动
5. 防水等级、噪音分贝、电源/充电信息
6. 核心卖点

要求：不要编造；没看到就写“未提及”；不要输出 markdown 代码块。`;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map(normalizeText).filter(Boolean)));
}

function normalizeParamPairs(pairs: Array<[string, string]>) {
  const merged = new Map<string, string>();
  mergeWhitelistParams(merged, pairs);
  return Array.from(merged.entries()).filter(([, value]) => !isPlaceholderParamValue(value));
}

function buildRawDescription(paramPairs: Array<[string, string]>, ocrText: string) {
  const sections: string[] = [];
  if (paramPairs.length) {
    sections.push(`[参数信息]\n${paramPairs.map(([key, value]) => `${key}: ${value}`).join("\n")}`);
  }
  if (hasText(ocrText)) {
    sections.push(`[图文提取]\n${ocrText}`);
  }
  return sections.join("\n\n").trim();
}

function hasUsefulRawDescription(rawDescription: string) {
  const usefulText = normalizeText(rawDescription.replace(/未提及/g, "").replace(/\[图文提取\]|\[参数信息\]/g, ""));
  if (usefulText.length < 80) return false;

  return /产品|型号|材质|硅胶|abs|震动|振动|吮吸|吸吮|旋转|伸缩|加热|防水|分贝|充电|卖点|按摩|入体|跳蛋|飞机杯|安全套|润滑|内衣/i.test(
    usefulText,
  );
}

function inferMaterial(paramPairs: Array<[string, string]>, fallback: string | null) {
  const value = paramPairs.find(([key]) => key === "材质")?.[1];
  return hasText(value) ? normalizeText(value) : hasText(fallback) ? normalizeText(fallback) : null;
}

function isCareOrApparel(text: string, typeCode: string | null) {
  return (
    typeCode === "care_accessory" ||
    /润滑液|润滑剂|安全套|避孕套|延时喷剂|延时湿巾|护理液|按摩油|香水|香氛|内衣|睡衣|连体衣|蕾丝|网纱|制服|lube|condom|lingerie/i.test(text)
  );
}

function inferStrongTitleGender(text: string): ResolvedLibraryAudienceGender | null {
  if (/避孕套|安全套|保险套|condom/i.test(text)) return "unisex";
  if (/延时喷|延迟喷|喷剂|喷雾|神油|脱敏|降敏/i.test(text)) return "male";
  if (/润滑液|润滑剂|润滑油|润滑|水基|水溶|精油|油剂|护理液|lube/i.test(text)) {
    if (/情侣|夫妻|男女|伴侣/i.test(text)) return "unisex";
    if (/女性|女用|女生/i.test(text)) return "female";
    if (/男士|男性|男用|男用品/i.test(text)) return "male";
    return "unisex";
  }
  if (/飞机杯|自慰杯|男用杯|男用|男用品|男士|男性|阴茎|鸡鸡|龟头|包皮|前列腺|伪娘|gay|后庭|肛门|开肛|插屁股|名器|倒模|圣杯/i.test(text)) {
    return "male";
  }
  if (/女用|女性|女生|阴蒂|外阴|g点|g-spot|跳蛋|吮吸器|震动棒|自慰器|兔耳|兔子/i.test(text)) {
    return "female";
  }
  if (/情侣|夫妻|双人|伴侣|couples?/i.test(text)) {
    return "unisex";
  }
  return null;
}

function hasPoweredSignal(text: string) {
  return /电动|自动|全自动|震动|振动|加热|伸缩|旋转|充电|遥控|app|马达|powered|vibrat/i.test(text);
}

function inferStrongTypeFromTitle(
  text: string,
  gender: ResolvedLibraryAudienceGender,
): { typeCode: string; subtypeCode: string | null } | null {
  if (/避孕套|安全套|保险套|condom/i.test(text)) {
    return { typeCode: "care_accessory", subtypeCode: "condom" };
  }
  if (/润滑液|润滑剂|润滑油|润滑|水基|水溶|精油|油剂|延时喷|延迟喷|喷剂|喷雾|湿巾|神油|护理液|lube/i.test(text)) {
    return { typeCode: "care_accessory", subtypeCode: "lube_care" };
  }
  if (/内衣|睡衣|连体衣|丝袜|蕾丝|网纱|制服|lingerie/i.test(text)) {
    return { typeCode: "care_accessory", subtypeCode: "lingerie" };
  }
  if (gender !== "male") return null;
  if (/包皮|锁精环|阻复环|阴茎环|鸡鸡套|羊眼圈|cock\s*ring/i.test(text)) {
    return {
      typeCode: "cock_ring",
      subtypeCode: hasPoweredSignal(text) ? "vibrating_cock_ring" : "classic_cock_ring",
    };
  }
  if (/前列腺|后庭|肛门|开肛|插屁股|肛塞|gay|伪娘|马眼棒|prostate|p-spot/i.test(text)) {
    return {
      typeCode: "prostate",
      subtypeCode: hasPoweredSignal(text) ? "prostate_vibe" : "prostate_plug",
    };
  }
  if (/飞机杯|自慰杯|男用杯|名器|倒模|真实阴道|臀膜|圣杯|男性玩具|男用|男用品|masturbator|stroker/i.test(text)) {
    return {
      typeCode: "masturbator",
      subtypeCode: hasPoweredSignal(text) ? "vibrating_masturbator" : "manual_masturbator",
    };
  }
  return null;
}

function normalizeMaterialForType(material: string | null, text: string, subtypeCode: string | null) {
  const normalized = hasText(material) ? normalizeText(material) : null;
  if (subtypeCode === "condom" && (!normalized || !/天然|乳胶|胶乳|橡胶|聚氨酯|polyurethane/i.test(normalized))) {
    return "天然橡胶乳胶";
  }
  if (subtypeCode === "lube_care" && /硅基/i.test(text)) return "硅基润滑液";
  if (subtypeCode === "lube_care" && (!normalized || !/水基|水溶|润滑|护理|配方|精油|芦荟|湿巾|喷雾|喷剂|oil|lube/i.test(normalized))) {
    if (/精油|按摩油/i.test(text)) return "精油润滑液";
    if (/喷剂|喷雾|延时|延迟|神油/i.test(text)) return "延时护理配方";
    if (/湿巾/i.test(text)) return "湿巾护理配方";
    return "水基润滑液";
  }
  if (subtypeCode === "lingerie" && (!normalized || /硅胶|abs|tpe|亲肤/i.test(normalized))) {
    return "纺织面料";
  }
  return normalized;
}

function isPoweredToy(text: string, typeCode: string | null) {
  if (!typeCode || typeCode === "unknown" || typeCode === "care_accessory" || typeCode === "bdsm") return false;
  if (/手动|免电|manual|non[-\s]?powered/i.test(text)) return false;
  return /震动|振动|吮吸|吸吮|气脉冲|电动|加热|充电|遥控|app|马达|旋转|伸缩|rechargeable|remote|motor|powered|suction|vibrat/i.test(text);
}

function buildProductForFeatures(row: TargetRow, fields: Omit<RefetchedFields, "recommendationFeatures">): Product {
  return {
    id: row.id,
    originalId: row.original_id,
    name: row.name,
    price: fields.price ?? (Number(row.price) || 0),
    maxDb: fields.maxDb,
    waterproof: fields.waterproof,
    appearance: row.appearance === "high_disguise" ? "high_disguise" : "normal",
    physicalForm:
      row.physical_form === "internal" || row.physical_form === "composite"
        ? row.physical_form
        : "external",
    motorType: row.motor_type === "strong" ? "strong" : "gentle",
    gender: fields.gender,
    typeCode: fields.typeCode,
    subtypeCode: fields.subtypeCode,
    brand: row.brand ?? "",
    material: fields.material ?? "",
    imagePlaceholder: fields.imageUrl ?? row.image_url ?? "",
    rawDescription: fields.rawDescription,
    tags: Array.isArray(row.product_tags) ? row.product_tags.filter(Boolean) : [],
  };
}

function buildRecommendationFeatures(row: TargetRow, fields: Omit<RefetchedFields, "recommendationFeatures">) {
  const features = buildRecommendationProductFeatures(buildProductForFeatures(row, fields));
  return {
    featureVersion: "recommendation-product-features-v1",
    isSuctionLike: features.isSuctionLike,
    isInsertableLike: features.isInsertableLike,
    supportsAppOrRemote: features.supportsAppOrRemote,
    isCoupleOriented: features.isCoupleOriented,
    hasManyPatterns: features.hasManyPatterns,
    hasStrongSuctionSignal: features.hasStrongSuctionSignal,
    hasGentleSignal: features.hasGentleSignal,
    hasStrongIntensitySignal: features.hasStrongIntensitySignal,
    evidence: features.evidence,
  };
}

async function extractPageSignals(page: Page) {
  return page.evaluate(() => {
    const text = document.body?.innerText || "";
    const html = document.documentElement?.outerHTML || "";
    const imageUrls = Array.from(document.images)
      .map((image) => image.currentSrc || image.src || image.getAttribute("data-src") || "")
      .filter((url) => /alicdn|tbcdn|alicdn\.com/i.test(url));
    const priceText = Array.from(
      document.querySelectorAll('[class*="price"], [class*="Price"], [class*="promotion"], [class*="Promotion"]'),
    )
      .map((node) => (node.textContent || "").trim())
      .filter(Boolean)
      .slice(0, 20)
      .join(" ");
    return { text, html, imageUrls, priceText };
  });
}

async function refetchOne(page: Page, row: TargetRow): Promise<RefetchedFields | null> {
  const url = normalizeText(row.link);
  if (!url || !/^https?:\/\/(detail\.tmall\.com|login\.taobao\.com)/i.test(url)) return null;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(DETAIL_WAIT_MS);

  const signals = await extractPageSignals(page);
  const paramPairs = normalizeParamPairs([
    ...extractParamPairsFromPageHtml(signals.html),
    ...extractParamPairsFromLooseJsonText(signals.html),
    ...extractParamPairsFromCompactText(signals.text),
  ]);
  const imageUrls = uniqueStrings(signals.imageUrls).slice(0, MAX_OCR_IMAGES);
  const ocrText = imageUrls.length ? await ocrWithGLM(imageUrls, buildOcrPrompt(row.product_name || row.name)) : "";
  const rawDescription = buildRawDescription(paramPairs, ocrText);
  if (!hasText(rawDescription)) return null;
  if (!hasUsefulRawDescription(rawDescription)) {
    console.warn("  [质量门槛] OCR/参数内容过少，保留原字段等待后续重试");
    return null;
  }

  const titleText = `${row.name}\n${row.product_name || ""}`;
  const signalText = `${titleText}\n${rawDescription}\n${(row.product_tags || []).join("\n")}`;
  const gender = inferStrongTitleGender(titleText) ?? resolveLibraryAudienceGender({
    gender: row.gender,
    physicalForm: row.physical_form,
    name: row.name,
    rawDescription,
    tags: row.product_tags ?? [],
  });
  const classifiedTypeCode = classifyLibraryTypeCode({
    gender,
    physicalForm: row.physical_form,
    name: row.name,
    rawDescription,
    tags: row.product_tags ?? [],
  });
  const classifiedSubtypeCode = classifyLibrarySubtypeCode({
    gender,
    physicalForm: row.physical_form,
    name: row.name,
    rawDescription,
    tags: row.product_tags ?? [],
    typeCode: classifiedTypeCode,
  });
  const titleTypeOverride = inferStrongTypeFromTitle(titleText, gender);
  const subtypeCode = titleTypeOverride?.subtypeCode ?? classifiedSubtypeCode;
  const resolvedTypeCode =
    titleTypeOverride?.typeCode ??
    (subtypeCode ? getParentLibraryTypeCodeForSubtype(subtypeCode) || classifiedTypeCode : classifiedTypeCode);
  const material = normalizeMaterialForType(inferMaterial(paramPairs, row.material), titleText, subtypeCode);
  const price = normalizeRefetchedPrice(signals.priceText, row);
  const maxDbMatch = rawDescription.match(/([0-9]{2,3})\s*(?:d\s*b|分贝)/i);
  const explicitMaxDb = maxDbMatch ? Number(maxDbMatch[1]) : null;
  const ipxMatch = rawDescription.match(/ipx\s*([0-9])/i);
  const explicitWaterproof = ipxMatch ? Number(ipxMatch[1]) : /防水|waterproof/i.test(rawDescription) ? 7 : null;
  const nonToy = isCareOrApparel(signalText, resolvedTypeCode);
  const powered = isPoweredToy(signalText, resolvedTypeCode);
  const fields = {
    rawDescription,
    price,
    material,
    gender,
    typeCode: resolvedTypeCode,
    subtypeCode,
    maxDb: nonToy ? null : explicitMaxDb ?? (powered ? DEFAULT_POWERED_MAX_DB : null),
    waterproof: nonToy ? null : explicitWaterproof ?? (powered ? DEFAULT_POWERED_WATERPROOF : null),
    imageUrl: imageUrls[0] ?? row.image_url,
  };

  return {
    ...fields,
    recommendationFeatures: buildRecommendationFeatures(row, fields),
  };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  const client = await pool.connect();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });
  await injectTmallCookies(context);
  const page = await context.newPage();

  try {
    const result = await client.query<TargetRow>(
      `
        SELECT
          t.id,
          t.original_id,
          t.name,
          t.brand,
          t.price::text AS price,
          t.material,
          t.gender,
          t.physical_form,
          t.motor_type,
          t.appearance,
          t.image_url,
          p.link,
          p.name AS product_name,
          p.price::text AS product_price,
          p.tags AS product_tags
        FROM public.recommender_toys AS t
        LEFT JOIN public.products AS p ON p.id::text = t.original_id::text
        WHERE (
          t.raw_description LIKE '[本地字段摘要]%' OR
          t.raw_description LIKE '%建议后续结合官方详情页复核%'
        )
          AND p.link ~ '^https?://(detail\\.tmall\\.com|login\\.taobao\\.com)'
        ORDER BY t.brand, t.name
        LIMIT $1
      `,
      [DEFAULT_LIMIT],
    );

    let updated = 0;
    let failed = 0;
    console.log(`[tmall-refetch] 待处理 ${result.rows.length} 条 fallback Tmall 记录`);

    for (const [index, row] of result.rows.entries()) {
      console.log(`\n[tmall-refetch] (${index + 1}/${result.rows.length}) ${row.brand || ""} | ${row.name}`);
      try {
        const fields = await refetchOne(page, row);
        if (!fields) {
          console.warn("  [跳过] 未抽取到可用详情");
          failed += 1;
          continue;
        }

        await client.query(
          `
            UPDATE public.recommender_toys
            SET price = COALESCE($2::numeric, price),
                material = COALESCE($3::text, material),
                gender = $4::text,
                raw_description = $5::text,
                type_code = $6::text,
                subtype_code = $7::text,
                max_db = $8::integer,
                waterproof = $9::integer,
                image_url = COALESCE($10::text, image_url),
                recommendation_features = $11::jsonb,
                updated_at = NOW()
            WHERE id = $1::uuid
          `,
          [
            row.id,
            fields.price,
            fields.material,
            fields.gender,
            fields.rawDescription,
            fields.typeCode,
            fields.subtypeCode,
            fields.maxDb,
            fields.waterproof,
            fields.imageUrl,
            JSON.stringify(fields.recommendationFeatures),
          ],
        );

        if (row.original_id) {
          await client.query(
            `
              UPDATE public.products
              SET specs = jsonb_set(
                    COALESCE(specs::jsonb, '{}'::jsonb),
                    '{rawDescription}',
                    to_jsonb($2::text),
                    true
                  )
              WHERE id::text = $1::text
            `,
            [row.original_id, fields.rawDescription],
          );
        }

        updated += 1;
        console.log(
          `  [更新] price=${fields.price ?? "keep"} gender=${fields.gender} type=${fields.typeCode} subtype=${fields.subtypeCode ?? "null"} material=${fields.material ?? "keep"}`,
        );
      } catch (error: any) {
        failed += 1;
        console.warn(`  [失败] ${error?.message || error}`);
      }
      await sleep(BETWEEN_ITEMS_MS);
    }

    console.log(JSON.stringify({ scanned: result.rows.length, updated, failed }, null, 2));
  } finally {
    await browser.close().catch(() => {});
    client.release();
    await pool.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error("[tmall-refetch] 执行失败:", error);
  process.exitCode = 1;
});
