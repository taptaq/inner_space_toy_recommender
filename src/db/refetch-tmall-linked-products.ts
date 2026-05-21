import dotenv from "dotenv";
import OpenAI from "openai";
import pg from "pg";
import { chromium, type Page } from "playwright";
import { pathToFileURL } from "node:url";

import type { Product } from "../data/mock.ts";
import { buildSafeDisplayName } from "../lib/product-display-name.ts";
import {
  classifyLibrarySubtypeCode,
  classifyLibraryTypeCode,
  resolveLibraryAudienceGender,
} from "../lib/library-product-type-classifier.ts";
import { buildRecommendationProductFeatures } from "../lib/recommendation-product-features.ts";
import {
  extractParamPairsFromCompactText,
  extractParamPairsFromLooseJsonText,
  extractParamPairsFromPageHtml,
  extractParamPairsFromOcrText,
  mergeWhitelistParams,
  scrapeParamPairsFromIceContext,
  scrapeParamPairsInPage,
} from "../scraper/darentang/param-extraction.ts";
import { tryRevealTmallParamTabs } from "../scraper/darentang/tmall-param-ui.ts";

dotenv.config();

const { Pool } = pg;

const DEFAULT_ITEM_IDS = [
  "937520398945",
  "865895556902",
  "1047754401305",
  "628484583512",
];

const DETAIL_IMAGE_LIMIT = 12;
const DETAIL_SCREENSHOT_LIMIT = 5;
const RAW_DESCRIPTION_LIMIT = 4000;
const DEFAULT_POWERED_MAX_DB = 50;
const DEFAULT_POWERED_WATERPROOF = 7;

const DETAIL_OCR_PROMPTS = {
  device: `你是一个专业的产品目录审计员。请针对提供的商业产品详情图片，提取该产品的核心规格参数。
这些图片用于企业内部库存管理系统，内容为商业商品展出。

请以结构化文本格式输出：
1. 产品名称/型号: 提取准确的商业名称。
2. 内部构造/材质: 如亲肤硅胶、ABS、TPE 等。
3. 动力规格: 包含震动、旋转、伸缩、吮吸、加温、充电、续航等。
4. 环境属性: 包含防水等级、静音分贝值；未明确时写未提及。
5. 使用特性: 概括产品形态、刺激方式、适用对象和核心功能。
6. 技术卖点: 概括该产品的核心技术优势。

注意：只提取详情信息内容，不要解析或输出价格。若图片中没有明确字段，请写未提及。`,
  care: `你是一个专业的个人护理耗材目录审计员。请针对提供的商业产品详情图片，提取该产品的核心规格参数。

请以结构化文本格式输出：
1. 产品名称: 提取商品主名称、系列名或型号。
2. 产品类型: 如润滑液、护理液、安全套、清洁用品等。
3. 材质/成分: 如水基配方、玻尿酸、芦荟、甘油、乳胶等。
4. 规格信息: 如容量、只数、包装数量、香型等。
5. 使用特性: 如易清洗、亲肤、滋润、便携等。
6. 核心卖点: 概括安全性、舒适度、材质特点。

注意：只提取详情信息内容，不要解析或输出价格。若图片中没有明确字段，请写未提及。`,
} as const;

type TargetRow = {
  toy_id: string;
  original_id: string | null;
  name: string;
  brand: string | null;
  current_price: string | null;
  current_raw_description: string | null;
  current_type_code: string | null;
  current_subtype_code: string | null;
  current_link: string | null;
  product_name: string | null;
  product_tags: string[] | null;
  product_image: string | null;
};

type DetailFetchResult = {
  itemId: string;
  finalUrl: string;
  title: string;
  price: number | null;
  coverImage: string | null;
  rawDescription: string;
  detailParamsText: string;
  ocrText: string;
  imageUrls: string[];
};

type Patch = {
  toyId: string;
  originalId: string | null;
  name: string;
  price: number | null;
  rawDescription: string;
  material: string;
  gender: "female" | "male" | "unisex";
  typeCode: string;
  subtypeCode: string | null;
  maxDb: number | null;
  waterproof: number | null;
  appearance: "high_disguise" | "normal";
  physicalForm: "external" | "internal" | "composite";
  motorType: "gentle" | "strong";
  recommendationFeatures: Record<string, unknown>;
  imageUrl: string | null;
  link: string;
  productTags: string[];
};

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hasText(value: unknown) {
  return normalizeText(value).length > 0;
}

function isTmallChallengeText(text: string) {
  return /unusual traffic|slide to verify|滑动验证|滑动一下|验证码|密码登录|短信登录|tmall\.com 版权所有/i.test(text);
}

function countMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

function isMeaningfulOcrText(text: string) {
  const normalized = normalizeText(text);
  if (isTmallChallengeText(normalized)) return false;
  if (normalized.length < 80) return false;

  const notMentionedCount = countMatches(normalized, /未提及|未知|暂无|不详/g);
  const fieldMarkerCount = countMatches(
    normalized,
    /产品名称|型号|材质|构造|动力|规格|环境属性|使用特性|核心卖点|技术卖点|产品类型|成分/g,
  );
  const concreteSignalCount = countMatches(
    normalized,
    /硅胶|TPE|软胶|水基|玻尿酸|润滑|震动|振动|伸缩|电动|加热|充电|防水|分贝|档|模式|飞机杯|G点|入体|容量|ml|mL|亲肤/g,
  );

  return concreteSignalCount >= 2 && notMentionedCount < Math.max(fieldMarkerCount, 4);
}

function parseArgs(argv: string[]) {
  const ids = new Set(DEFAULT_ITEM_IDS);

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--item-id" && argv[index + 1]) {
      ids.add(argv[index + 1]);
      index += 1;
      continue;
    }

    const idMatch = value.match(/(?:^|[?&])id=(\d+)/)?.[1] || value.match(/^\d{8,}$/)?.[0];
    if (idMatch) ids.add(idMatch);
  }

  return [...ids];
}

function shouldRunScript(importMetaUrl: string, argvEntry?: string) {
  return Boolean(argvEntry) && importMetaUrl === pathToFileURL(argvEntry).href;
}

function normalizeTmallUrl(url: string) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return trimmed;
}

function itemUrlFromId(itemId: string) {
  return `https://detail.tmall.com/item.htm?id=${encodeURIComponent(itemId)}`;
}

function extractTmallItemId(url: string | null | undefined) {
  const value = normalizeTmallUrl(url || "");
  if (!value) return "";
  try {
    return new URL(value).searchParams.get("id")?.trim() || "";
  } catch {
    return value.match(/[?&]id=(\d+)/)?.[1] || "";
  }
}

function parsePriceNumber(raw: unknown) {
  const match = String(raw ?? "").replace(/[,，\s]/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function normalizeAliImageUrl(rawUrl: string) {
  let url = normalizeTmallUrl(rawUrl).trim();
  if (!url || !/alicdn\.com/i.test(url)) return "";
  url = url.replace(/\\/g, "");

  // Prefer the original JPEG/PNG URL over Tmall's derived webp suffix because
  // Moonshot may reject the derived URL even when the source image is valid.
  const sourceMatch = url.match(/^(https?:\/\/[^"'?]+\.(?:jpe?g|png))/i);
  if (sourceMatch) {
    url = sourceMatch[1];
  }

  return url;
}

function isLikelyDetailImageUrl(rawUrl: string) {
  const url = normalizeAliImageUrl(rawUrl);
  if (!url) return false;
  if (/\.gif(?:$|[?_.])/i.test(url)) return false;
  if (/tfs\/TB1MaLKRXXXXXaWXFXXXXXXXXXX-480-260\.png/i.test(url)) return false;
  if (/sprite|icon|logo|avatar|loading|transparent|placeholder/i.test(url)) return false;
  if (/(?:^|[-_])(?:1[0-9]{1,2}|2[0-9]{1,2})-(?:1[0-9]{1,2}|2[0-9]{1,2})(?:\.|_|$)/i.test(url)) {
    return false;
  }

  return /\.(?:jpe?g|png)(?:$|[?_.])/i.test(url);
}

function filterDetailImageUrls(urls: string[]) {
  const seen = new Set<string>();
  const normalized = urls
    .map(normalizeAliImageUrl)
    .filter((url) => isLikelyDetailImageUrl(url))
    .filter((url) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });

  const jpgFirst = normalized.filter((url) => /\.jpe?g(?:$|[?_.])/i.test(url));
  const pngRest = normalized.filter((url) => !/\.jpe?g(?:$|[?_.])/i.test(url));
  return [...jpgFirst, ...pngRest].slice(0, DETAIL_IMAGE_LIMIT);
}

function buildPriceExtractionScript() {
  return () => {
    const candidates: Array<{ value: string; source: string }> = [];
    const push = (value: unknown, source: string) => {
      const text = String(value || "").trim();
      if (text) candidates.push({ value: text, source });
    };

    document
      .querySelectorAll(
        'meta[property="og:product:price"], meta[property="product:price:amount"], meta[name="twitter:data1"]',
      )
      .forEach((node) => push(node.getAttribute("content"), "meta"));

    document
      .querySelectorAll('[class*="price"], [class*="Price"], [data-price], [data-spm*="price"]')
      .forEach((node) => push(node.textContent, "dom"));

    const html = document.documentElement.innerHTML;
    const jsonMatches = [
      html.match(/"price"\s*:\s*"(\d+(?:\.\d{1,2})?)"/i),
      html.match(/"skuPrice"\s*:\s*"(\d+(?:\.\d{1,2})?)"/i),
      html.match(/"salePrice"\s*:\s*"(\d+(?:\.\d{1,2})?)"/i),
    ].filter(Boolean) as RegExpMatchArray[];

    for (const match of jsonMatches) {
      push(match[1], "source-json");
    }

    return candidates;
  };
}

async function extractDetailPrice(page: Page) {
  const candidates = await page.evaluate(buildPriceExtractionScript()).catch(() => []);

  for (const candidate of candidates) {
    const numeric = parsePriceNumber(candidate.value);
    if (numeric != null && numeric > 0 && numeric < 100000) {
      return numeric;
    }
  }

  return null;
}

async function collectDetailParams(page: Page) {
  const mergedParams = new Map<string, string>();

  const icePairs = await page.evaluate(scrapeParamPairsFromIceContext).catch(() => [] as Array<[string, string]>);
  mergeWhitelistParams(mergedParams, icePairs);

  for (const frame of page.frames()) {
    const pairs = await frame.evaluate(scrapeParamPairsInPage).catch(() => [] as Array<[string, string]>);
    mergeWhitelistParams(mergedParams, pairs);
  }

  const html = await page.content();
  mergeWhitelistParams(mergedParams, extractParamPairsFromPageHtml(html));
  mergeWhitelistParams(mergedParams, extractParamPairsFromLooseJsonText(html));

  const bodyText = await page.evaluate(() => document.body?.innerText || "").catch(() => "");
  mergeWhitelistParams(mergedParams, extractParamPairsFromCompactText(bodyText));

  const orderedKeys = ["材质", "品牌", "产地", "生产企业", "分类", "品名"];
  return {
    mergedParams,
    detailParamsText: orderedKeys
      .filter((key) => mergedParams.has(key))
      .map((key) => `${key}: ${mergedParams.get(key)}`)
      .join("\n"),
  };
}

async function collectDetailImages(page: Page) {
  const urls = new Set<string>();

  for (const frame of page.frames()) {
    const frameUrls = await frame
      .evaluate(() =>
        Array.from(document.querySelectorAll("img"))
          .map((img) => img.getAttribute("data-src") || img.getAttribute("src") || "")
          .map((url) => (url.startsWith("//") ? `https:${url}` : url))
          .filter((url) => /alicdn\.com/i.test(url) && url.length > 30),
      )
      .catch(() => [] as string[]);

    frameUrls.map(normalizeAliImageUrl).filter(Boolean).forEach((url) => urls.add(url));
  }

  return filterDetailImageUrls([...urls]);
}

function isCareLike(name: string) {
  return /润滑液|润滑剂|人体润滑|水基|玻尿酸|护理液|清洁液|安全套|避孕套|condom|lubricant|lube/i.test(name);
}

async function ocrWithKimiImageRefs(imageRefs: string[], prompt: string, options: { filterRemoteUrls?: boolean } = {}) {
  const apiKey = process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error("MOONSHOT_API_KEY/KIMI_API_KEY 未配置");

  const openai = new OpenAI({
    apiKey,
    baseURL: process.env.MOONSHOT_BASE_URL || "https://api.moonshot.cn/v1",
  });

  let remainingImageUrls = options.filterRemoteUrls === false ? imageRefs.filter(Boolean) : filterDetailImageUrls(imageRefs);
  if (remainingImageUrls.length === 0) {
    throw new Error("没有可提交给 Kimi 的详情图片 URL");
  }

  const createCompletion = (temperature: number, urls: string[]) => {
    const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
    urls.forEach((url) => {
      content.push({ type: "image_url", image_url: { url } });
    });

    return openai.chat.completions.create({
      model: "kimi-k2.6",
      messages: [{ role: "user", content: content as never }],
      temperature,
    });
  };

  const createCompletionWithTemperatureFallback = async (urls: string[]) => {
    try {
      return await createCompletion(0.6, urls);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/invalid temperature|only 1 is allowed/i.test(message)) {
        throw error;
      }

      console.warn("[refetch-tmall] Kimi k2.6 当前接口拒绝 temperature=0.6，按接口限制用 temperature=1 重试。");
      return createCompletion(1, urls);
    }
  };

  for (let attempt = 0; attempt < 5 && remainingImageUrls.length > 0; attempt += 1) {
    try {
      const response = await createCompletionWithTemperatureFallback(remainingImageUrls);
      const message = response.choices[0]?.message as { content?: string | null; reasoning_content?: string | null };
      return String(message?.content || message?.reasoning_content || "").trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const badUrl = message.match(/unsupported image url:\s*(https?:\/\/\S+)/i)?.[1]?.replace(/[,.，。]$/, "");
      if (!badUrl) throw error;

      const normalizedBadUrl = normalizeAliImageUrl(badUrl);
      remainingImageUrls = remainingImageUrls.filter((url) => normalizeAliImageUrl(url) !== normalizedBadUrl);
      console.warn(`[refetch-tmall] Kimi 拒绝图片，已剔除后重试: ${normalizedBadUrl}`);
    }
  }

  throw new Error("Kimi OCR 失败：可用详情图片均被接口拒绝");
}

async function ocrWithKimi(imageUrls: string[], prompt: string) {
  return ocrWithKimiImageRefs(imageUrls, prompt, { filterRemoteUrls: true });
}

async function ocrWithGlmVision(imageRefs: string[], prompt: string) {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) throw new Error("GLM_API_KEY 未配置");

  const glm = new OpenAI({
    apiKey,
    baseURL: "https://open.bigmodel.cn/api/paas/v4/",
  });

  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  imageRefs.slice(0, DETAIL_SCREENSHOT_LIMIT).forEach((url) => {
    content.push({ type: "image_url", image_url: { url } });
  });

  const response = await glm.chat.completions.create({
    model: "glm-4.6v",
    messages: [{ role: "user", content: content as never }],
    temperature: 0.1,
  });

  const message = response.choices[0]?.message as { content?: string | null; reasoning_content?: string | null };
  return String(message?.content || message?.reasoning_content || "").trim();
}

async function captureDetailScreenshots(page: Page) {
  const viewport = page.viewportSize() || { width: 1440, height: 900 };
  const metrics = await page
    .evaluate((height) => {
      const scroller = document.scrollingElement || document.documentElement || document.body;
      const maxOffset = Math.max(
        0,
        scroller.scrollHeight - height,
        document.body.scrollHeight - height,
        document.documentElement.scrollHeight - height,
      );
      const currentOffset = window.scrollY || scroller.scrollTop || 0;
      return { maxOffset, currentOffset };
    }, viewport.height)
    .catch(() => ({ maxOffset: 0, currentOffset: 0 }));
  const anchorOffset = Math.min(metrics.currentOffset, metrics.maxOffset);
  const preferredOffsets = [
    anchorOffset,
    anchorOffset + 900,
    anchorOffset + 1800,
    Math.max(0, anchorOffset - 900),
    0,
    1600,
    3200,
    5200,
    7600,
  ]
    .map((offset) => Math.min(Math.max(0, offset), metrics.maxOffset))
    .filter((offset, index, values) => values.indexOf(offset) === index)
    .slice(0, DETAIL_SCREENSHOT_LIMIT);

  const screenshots: string[] = [];
  for (const offset of preferredOffsets) {
    await page.evaluate((nextOffset) => window.scrollTo(0, nextOffset), offset).catch(() => {});
    await page.waitForTimeout(800);
    const buffer = await page.screenshot({ type: "png", fullPage: false });
    screenshots.push(`data:image/png;base64,${buffer.toString("base64")}`);
  }

  return screenshots;
}

async function ocrDetailScreenshots(page: Page, prompt: string, productName: string) {
  const screenshots = await captureDetailScreenshots(page);
  if (screenshots.length === 0) {
    throw new Error("未能生成详情页截图");
  }

  console.log(`[refetch-tmall] ${productName} 生成 ${screenshots.length} 张详情页截图，使用 GLM/Kimi OCR`);
  try {
    const glmText = await ocrWithGlmVision(screenshots, prompt);
    if (isMeaningfulOcrText(glmText)) {
      return glmText;
    }
    throw new Error("GLM 返回内容缺少有效详情信息");
  } catch (error) {
    console.warn(
      `[refetch-tmall] ${productName} GLM 截图 OCR 失败，改用 Kimi 截图 OCR: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const kimiText = await ocrWithKimiImageRefs(screenshots, prompt, { filterRemoteUrls: false });
  if (!isMeaningfulOcrText(kimiText)) {
    throw new Error("Kimi 截图 OCR 返回内容缺少有效详情信息");
  }

  return kimiText;
}

async function fetchTmallDetail(page: Page, row: TargetRow, itemId: string): Promise<DetailFetchResult> {
  const targetUrl = normalizeTmallUrl(row.current_link || "") || itemUrlFromId(itemId);
  const capturedImageUrls = new Set<string>();

  const onResponse = async (response: { url: () => string; text: () => Promise<string> }) => {
    const url = response.url();
    if (!/desc|v8|h5api|mtop/i.test(url)) return;

    try {
      const text = await response.text();
      const matches = text.match(/(\\\/\\\/|\/\/|https?:)[^"']+\.alicdn\.com\/[^"']+/g) || [];
      matches.map(normalizeAliImageUrl).filter(Boolean).forEach((url) => capturedImageUrls.add(url));
    } catch {}
  };

  page.on("response", onResponse);
  try {
    console.log(`[refetch-tmall] 打开 ${row.name}: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(4000);

    await page.evaluate(async () => {
      for (let index = 0; index < 6; index += 1) {
        window.scrollBy(0, 1600);
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    });

    await tryRevealTmallParamTabs(page);
    await page.waitForTimeout(1200);

    const pageTitle = await page.title().catch(() => "");
    const bodyTextBeforeOcr = await page.evaluate(() => document.body?.innerText || "").catch(() => "");
    const isLoginOrBlocked = await page
      .evaluate(() => {
        const title = document.title || "";
        const body = document.body?.innerText || "";
        return (
          title.includes("登录") ||
          body.includes("密码登录") ||
          body.includes("短信登录") ||
          title.includes("验证码") ||
          body.includes("滑动一下") ||
          body.includes("Sorry, we have detected unusual traffic") ||
          body.includes("Please slide to verify")
        );
      })
      .catch(() => false);

    if (isLoginOrBlocked || isTmallChallengeText(bodyTextBeforeOcr)) {
      throw new Error(`详情页疑似登录/风控页面: ${pageTitle || page.url()}`);
    }

    const price = await extractDetailPrice(page);
    const { mergedParams, detailParamsText } = await collectDetailParams(page);
    const domImages = await collectDetailImages(page);
    const imageUrls = filterDetailImageUrls([...domImages, ...capturedImageUrls]);
    const coverImage = imageUrls[0] || row.product_image || null;

    let ocrText = "";
    const prompt = isCareLike(row.name) ? DETAIL_OCR_PROMPTS.care : DETAIL_OCR_PROMPTS.device;
    if (imageUrls.length > 0) {
      console.log(`[refetch-tmall] ${row.name} 详情图 ${imageUrls.length} 张，使用 Kimi k2.6 OCR`);
      try {
        ocrText = await ocrWithKimi(imageUrls, prompt);
      } catch (error) {
        console.warn(
          `[refetch-tmall] ${row.name} 图片 URL OCR 失败，转详情页截图 OCR: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        try {
          ocrText = await ocrDetailScreenshots(page, prompt, row.name);
        } catch (screenshotError) {
          console.warn(
            `[refetch-tmall] ${row.name} 截图 OCR 也失败，最后转页面文本兜底: ${
              screenshotError instanceof Error ? screenshotError.message : String(screenshotError)
            }`,
          );
          ocrText = await page.evaluate(() => document.body?.innerText || "").catch(() => "");
        }
      }
    } else {
      console.warn(`[refetch-tmall] ${row.name} 未收集到详情图，使用详情页截图 OCR`);
      try {
        ocrText = await ocrDetailScreenshots(page, prompt, row.name);
      } catch (screenshotError) {
        console.warn(
          `[refetch-tmall] ${row.name} 截图 OCR 失败，最后转页面文本兜底: ${
            screenshotError instanceof Error ? screenshotError.message : String(screenshotError)
          }`,
        );
        ocrText = await page.evaluate(() => document.body?.innerText || "").catch(() => "");
      }
    }

    if (ocrText) {
      mergeWhitelistParams(mergedParams, extractParamPairsFromOcrText(ocrText));
    }

    const finalDetailParamsText = detailParamsText || ["材质", "品牌", "产地", "生产企业", "分类", "品名"]
      .filter((key) => mergedParams.has(key))
      .map((key) => `${key}: ${mergedParams.get(key)}`)
      .join("\n");

    const rawDescription = [
      finalDetailParamsText ? `[参数信息]\n${finalDetailParamsText}` : "",
      ocrText ? `[图文提取]\n${ocrText}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, RAW_DESCRIPTION_LIMIT);

    return {
      itemId,
      finalUrl: page.url() || targetUrl,
      title: pageTitle || row.product_name || row.name,
      price,
      coverImage,
      rawDescription,
      detailParamsText: finalDetailParamsText,
      ocrText,
      imageUrls,
    };
  } finally {
    page.off("response", onResponse);
  }
}

function inferMaterial(name: string, rawDescription: string) {
  const source = `${name}\n${rawDescription}`.toLowerCase();
  if (/水基|玻尿酸|甘油|芦荟|润滑液|lubricant|lube/i.test(source)) return "水基配方";
  if (/tpe|tpr|软胶|倒模|名器|飞机杯/i.test(source)) return "TPE/软胶";
  if (/abs/i.test(source) && /硅胶|silicone/i.test(source)) return "硅胶/ABS";
  if (/硅胶|silicone/i.test(source)) return "亲肤硅胶";
  if (/乳胶|latex/i.test(source)) return "天然乳胶";
  return isCareLike(name) ? "护理耗材配方" : "亲肤硅胶";
}

function inferMaxDb(rawDescription: string) {
  const match = rawDescription.match(/(\d{2})\s*(?:dB|db|分贝)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 20 && value <= 90 ? value : null;
}

function inferWaterproof(rawDescription: string) {
  const ipxMatch = rawDescription.match(/ipx\s*([0-9])/i);
  if (ipxMatch) return Number(ipxMatch[1]);
  if (/防水|水洗|可冲洗|全身水洗|waterproof/i.test(rawDescription)) return DEFAULT_POWERED_WATERPROOF;
  return null;
}

function inferAppearance(name: string, rawDescription: string): Patch["appearance"] {
  return /口红|迷你|小巧|便携|隐形|伪装|discreet|lipstick/i.test(`${name}\n${rawDescription}`)
    ? "high_disguise"
    : "normal";
}

function inferPhysicalForm(name: string, rawDescription: string): Patch["physicalForm"] {
  const source = `${name}\n${rawDescription}`;
  const hasInternal = /入体|插入|g点|阴道|飞机杯|倒模|名器|包裹|伸缩|internal|insert/i.test(source);
  const hasExternal = /阴蒂|外部|跳蛋|按摩棒|吮吸|吸吮|external|clitoral|suction/i.test(source);
  if (hasInternal && hasExternal) return "composite";
  if (hasInternal) return "internal";
  return "external";
}

function inferMotorType(name: string, rawDescription: string): Patch["motorType"] {
  return /强劲|强力|高频|暴风|伸缩|爆发|大吸力|强震|powerful|strong/i.test(`${name}\n${rawDescription}`)
    ? "strong"
    : "gentle";
}

function isPoweredToy(typeCode: string, rawDescription: string) {
  if (typeCode === "care_accessory" || typeCode === "bdsm" || typeCode === "unknown") return false;
  if (/手动|免电|非电动|manual|non[-\s]?powered/i.test(rawDescription)) return false;
  return /电动|震动|振动|伸缩|旋转|吮吸|加热|充电|遥控|远控|app|马达|automatic|vibrat|powered|recharge/i.test(rawDescription);
}

function buildPatch(row: TargetRow, detail: DetailFetchResult): Patch {
  const currentRawDescription = row.current_raw_description || "";
  const detailRawDescription = detail.rawDescription || "";
  const rawDescription =
    isMeaningfulOcrText(detailRawDescription) ||
    (!isTmallChallengeText(detailRawDescription) &&
      normalizeText(detailRawDescription).length > normalizeText(currentRawDescription).length)
      ? detailRawDescription
      : currentRawDescription || detailRawDescription;
  const classifierInput = {
    gender: row.brand === "雷霆暴风" ? "male" : null,
    physicalForm: inferPhysicalForm(row.name, rawDescription),
    name: row.name,
    rawDescription,
    tags: row.product_tags ?? [],
  };
  const inferredGender = resolveLibraryAudienceGender(classifierInput);
  const typeCode = classifyLibraryTypeCode({ ...classifierInput, gender: inferredGender });
  const classifiedSubtypeCode = classifyLibrarySubtypeCode({ ...classifierInput, gender: inferredGender, typeCode });
  const powered = isPoweredToy(typeCode, `${row.name}\n${rawDescription}`);
  const gender = typeCode === "care_accessory" ? "unisex" : inferredGender;
  const subtypeCode =
    typeCode === "masturbator" && !classifiedSubtypeCode
      ? powered
        ? "vibrating_masturbator"
        : "manual_masturbator"
      : classifiedSubtypeCode;
  const maxDb = powered ? inferMaxDb(rawDescription) ?? DEFAULT_POWERED_MAX_DB : null;
  const waterproof = powered ? inferWaterproof(rawDescription) ?? DEFAULT_POWERED_WATERPROOF : null;
  const material = inferMaterial(row.name, rawDescription);
  const physicalForm = inferPhysicalForm(row.name, rawDescription);
  const motorType = inferMotorType(row.name, rawDescription);
  const appearance = inferAppearance(row.name, rawDescription);
  const price = detail.price ?? parsePriceNumber(row.current_price);
  const imageUrl = detail.coverImage || row.product_image || null;
  const productTags = [
    ...(row.product_tags ?? []),
    typeCode,
    subtypeCode,
    material,
  ].filter((value): value is string => Boolean(value));

  const productForFeatures: Product = {
    id: row.toy_id,
    originalId: row.original_id,
    name: row.name,
    displayName: buildSafeDisplayName(row.name),
    safeDisplayName: buildSafeDisplayName(row.name),
    price: price ?? 0,
    maxDb,
    waterproof,
    appearance,
    physicalForm,
    motorType,
    gender,
    typeCode,
    subtypeCode,
    brand: row.brand ?? "",
    material,
    imagePlaceholder: imageUrl ?? "",
    rawDescription,
    tags: productTags,
  };
  const features = buildRecommendationProductFeatures(productForFeatures);

  return {
    toyId: row.toy_id,
    originalId: row.original_id,
    name: row.name,
    price,
    rawDescription,
    material,
    gender,
    typeCode,
    subtypeCode,
    maxDb,
    waterproof,
    appearance,
    physicalForm,
    motorType,
    recommendationFeatures: {
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
    },
    imageUrl,
    link: detail.finalUrl || row.current_link || itemUrlFromId(detail.itemId),
    productTags,
  };
}

async function readTargets(client: pg.PoolClient, itemIds: string[]) {
  const result = await client.query<TargetRow>(
    `
      SELECT
        t.id AS toy_id,
        t.original_id,
        t.name,
        t.brand,
        t.price::text AS current_price,
        t.raw_description AS current_raw_description,
        t.type_code AS current_type_code,
        t.subtype_code AS current_subtype_code,
        p.link AS current_link,
        p.name AS product_name,
        p.tags AS product_tags,
        p.image AS product_image
      FROM public.recommender_toys AS t
      JOIN public.products AS p ON p.id = t.original_id
      WHERE EXISTS (
        SELECT 1
        FROM unnest($1::text[]) AS ids(item_id)
        WHERE p.link LIKE '%' || ids.item_id || '%'
      )
      ORDER BY t.brand, t.name
    `,
    [itemIds],
  );

  return result.rows;
}

async function applyPatches(client: pg.PoolClient, patches: Patch[]) {
  for (const patch of patches) {
    await client.query(
      `
        UPDATE public.recommender_toys
        SET
          price = $2,
          max_db = $3,
          waterproof = $4,
          appearance = $5,
          physical_form = $6,
          motor_type = $7,
          gender = $8,
          material = $9,
          image_url = COALESCE($10, image_url),
          raw_description = $11,
          safe_display_name = $12,
          type_code = $13,
          subtype_code = $14,
          recommendation_features = $15::jsonb,
          updated_at = NOW()
        WHERE id = $1::uuid
      `,
      [
        patch.toyId,
        patch.price,
        patch.maxDb,
        patch.waterproof,
        patch.appearance,
        patch.physicalForm,
        patch.motorType,
        patch.gender,
        patch.material,
        patch.imageUrl,
        patch.rawDescription,
        buildSafeDisplayName(patch.name),
        patch.typeCode,
        patch.subtypeCode,
        JSON.stringify(patch.recommendationFeatures),
      ],
    );

    if (!patch.originalId) continue;

    await client.query(
      `
        UPDATE public.products
        SET
          price = $2,
          image = COALESCE($3, image),
          link = $4,
          gender = $5,
          tags = $6,
          specs = jsonb_strip_nulls(
            COALESCE(specs::jsonb, '{}'::jsonb)
            || jsonb_build_object(
              'rawDescription', $7::text,
              'material', $8::text,
              'max_db', $9::int,
              'waterproof', $10::int,
              'appearance', $11::text,
              'physical_form', $12::text,
              'motor_type', $13::text,
              'type_code', $14::text,
              'subtype_code', $15::text
            )
          )
        WHERE id = $1::uuid
      `,
      [
        patch.originalId,
        patch.price,
        patch.imageUrl,
        patch.link,
        patch.gender.charAt(0).toUpperCase() + patch.gender.slice(1),
        patch.productTags,
        patch.rawDescription,
        patch.material,
        patch.maxDb,
        patch.waterproof,
        patch.appearance,
        patch.physicalForm,
        patch.motorType,
        patch.typeCode,
        patch.subtypeCode,
      ],
    );
  }
}

async function refetchTmallLinkedProducts() {
  const itemIds = parseArgs(process.argv.slice(2));
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  let targets: TargetRow[] = [];
  try {
    targets = await readTargets(client, itemIds);
  } finally {
    client.release();
  }

  if (targets.length === 0) {
    await pool.end();
    console.log(JSON.stringify({ itemIds, targets: 0, updated: 0 }, null, 2));
    return;
  }

  const browser = await chromium.launch({
    headless: process.env.TMALL_HEADLESS !== "false",
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    ignoreDefaultArgs: ["--enable-automation"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const cookieStr = process.env.TMALL_COOKIE || "";
  if (cookieStr) {
    const parseCookies = (domain: string) =>
      cookieStr
        .split(";")
        .map((cookie) => {
          const [name, ...rest] = cookie.trim().split("=");
          return { name, value: rest.join("="), domain, path: "/" };
        })
        .filter((cookie) => cookie.name);

    await context.addCookies([...parseCookies(".tmall.com"), ...parseCookies(".taobao.com")]);
    console.log(`[refetch-tmall] 已注入 TMALL_COOKIE，长度 ${cookieStr.length}`);
  } else {
    console.warn("[refetch-tmall] TMALL_COOKIE 为空，详情页可能落入登录页");
  }

  const page = await context.newPage();
  const patches: Patch[] = [];
  const failures: Array<{ name: string; link: string | null; error: string }> = [];

  try {
    for (const target of targets) {
      const itemId = extractTmallItemId(target.current_link) || itemIds[0];
      try {
        const detail = await fetchTmallDetail(page, target, itemId);
        const patch = buildPatch(target, detail);
        patches.push(patch);
        console.log(
          `[refetch-tmall] 待写入 ${target.name}: price=${patch.price}, gender=${patch.gender}, type=${patch.typeCode}/${patch.subtypeCode}, material=${patch.material}`,
        );
      } catch (error) {
        failures.push({
          name: target.name,
          link: target.current_link,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const writer = await pool.connect();
  try {
    await writer.query("BEGIN");
    await writer.query("SET statement_timeout TO 0");
    await writer.query("SET lock_timeout TO '5s'");
    await applyPatches(writer, patches);
    await writer.query("COMMIT");
  } catch (error) {
    await writer.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    writer.release();
    await pool.end();
  }

  console.log(
    JSON.stringify(
      {
        itemIds,
        targets: targets.length,
        updated: patches.length,
        failures,
        updatedRows: patches.map((patch) => ({
          name: patch.name,
          price: patch.price,
          gender: patch.gender,
          type_code: patch.typeCode,
          subtype_code: patch.subtypeCode,
          material: patch.material,
          max_db: patch.maxDb,
          waterproof: patch.waterproof,
        })),
      },
      null,
      2,
    ),
  );
}

if (shouldRunScript(import.meta.url, process.argv[1])) {
  refetchTmallLinkedProducts().catch((error) => {
    console.error("[refetch-tmall-linked-products] 执行失败:", error);
    process.exitCode = 1;
  });
}
