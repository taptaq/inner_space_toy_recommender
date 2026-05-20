import { chromium, type Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runCleaner } from './cleaner.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORIGIN = 'https://www.lelo.com';
const TARGET_URLS = [
  `${ORIGIN}/zh-hant/sex-toys-for-women`,
  `${ORIGIN}/zh-hant/sex-toys-for-men`,
];
const MAX_ITEMS = Number(process.env.LELO_MAX_ITEMS || '200');
const DELAY_BETWEEN_PAGES = Number(process.env.LELO_DETAIL_DELAY_MS || '1800');

export const BUFFER_PATH = path.resolve(__dirname, '../../data/lelo-review-buffer.json');

type ListItem = {
  sourceUrl: string;
  name: string;
  subtitle: string;
  coverImage: string;
  priceText: string;
  genderHint: 'female' | 'male' | 'unisex';
  categoryHints: string[];
};

type DetailItem = {
  title: string;
  subtitle: string;
  priceText: string;
  coverImage: string;
  rawDescription: string;
  categoryHints: string[];
};

function normalizeLocalePathname(pathname: string): string {
  return pathname.replace(/^\/zh-hant\//, '/zh-hans/');
}

function isAllowedProductPath(pathname: string): boolean {
  const normalized = normalizeLocalePathname(pathname);
  return /^\/zh-hans\/[^/?#]+$/.test(normalized);
}

function normalizeWhitespace(value: string): string {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function uniqueStrings(values: Array<string | null | undefined>, limit = 20): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeWhitespace(String(value || ''));
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }

  return result;
}

function normalizeProductUrl(href: string): string {
  const trimmed = String(href || '').trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed, ORIGIN);
    url.protocol = 'https:';
    url.host = 'www.lelo.com';
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/\/$/, '');
    return url.toString();
  } catch {
    return '';
  }
}

export function extractLeloPriceTextFromHtml(html: string): string {
  const schemaMatch = html.match(
    /<script[^>]+id="schema_product"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (schemaMatch?.[1]) {
    try {
      const parsed = JSON.parse(schemaMatch[1]) as Record<string, unknown>;
      const offers =
        parsed.offers && typeof parsed.offers === 'object'
          ? (parsed.offers as Record<string, unknown>)
          : null;
      const currency = String(offers?.priceCurrency || '').trim();
      const price = String(offers?.price || '').trim();
      if (currency && price) {
        return `${currency} ${price}`;
      }
    } catch {
      // Ignore malformed schema JSON.
    }
  }

  const dataLayerMatch = html.match(/"ecommerce"\s*:\s*\{[\s\S]*?"currency"\s*:\s*"([A-Z]{3})"[\s\S]*?"items"\s*:\s*\[\s*\{[\s\S]*?"price"\s*:\s*([0-9.]+)/i);
  if (dataLayerMatch?.[1] && dataLayerMatch?.[2]) {
    return `${dataLayerMatch[1]} ${dataLayerMatch[2]}`;
  }

  return '';
}

function extractJsonLdListItems(html: string, genderHint: ListItem['genderHint']): ListItem[] {
  const results: ListItem[] = [];
  const seen = new Set<string>();
  const scripts = Array.from(
    html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi),
  );

  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1] || '{}') as Record<string, unknown>;
      const graph = Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed];

      for (const node of graph) {
        const mainEntity =
          typeof node === 'object' && node
            ? (node as Record<string, unknown>).mainEntity
            : null;
        const itemListElement = Array.isArray((mainEntity as Record<string, unknown> | null)?.itemListElement)
          ? ((mainEntity as Record<string, unknown>).itemListElement as Array<Record<string, unknown>>)
          : [];

        for (const entry of itemListElement) {
          const item =
            typeof entry.item === 'object' && entry.item
              ? (entry.item as Record<string, unknown>)
              : null;
          const name = normalizeWhitespace(String(item?.name || entry.name || ''));
          const sourceUrl = normalizeProductUrl(
            String(item?.url || item?.['@id'] || entry.url || entry['@id'] || ''),
          );
          const description = normalizeWhitespace(String(item?.description || entry.description || ''));
          const image =
            item?.image && !Array.isArray(item.image)
              ? String(item.image)
              : Array.isArray(item?.image)
                ? String(item.image[0] || '')
                : '';

          if (!name || !sourceUrl) continue;

          const pathname = new URL(sourceUrl).pathname;
          if (!isAllowedProductPath(pathname)) continue;
          if (seen.has(sourceUrl)) continue;
          seen.add(sourceUrl);

          results.push({
            sourceUrl,
            name,
            subtitle: '',
            coverImage: image,
            priceText: '',
            genderHint,
            categoryHints: uniqueStrings([
              genderHint === 'male' ? 'male collection' : 'female collection',
              description,
            ], 6),
          });
        }
      }
    } catch {
      // Ignore malformed JSON-LD.
    }
  }

  return results;
}

async function extractListItems(page: Page, targetUrl: string) {
  const genderHint: ListItem['genderHint'] = targetUrl.includes('for-men') ? 'male' : 'female';
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  const html = await page.content();
  return extractJsonLdListItems(html, genderHint);
}

async function extractDetailItem(page: Page) {
  await page.waitForTimeout(2200);
  const html = await page.content();

  const getMetaContent = (key: string) => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return normalizeWhitespace(match[1]);
    }

    return '';
  };

  const stripTags = (value: string) =>
    normalizeWhitespace(
      String(value || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>'),
    );

  const findFirst = (patterns: RegExp[]) => {
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return stripTags(match[1]);
    }
    return '';
  };

  const title = findFirst([
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  ]).replace(/\s*\|.*$/, '').trim();

  const subtitle = findFirst([
    /<p[^>]+class="[^"]*(?:subtitle|SubTitle)[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
    /<h1[^>]*>[\s\S]*?<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/i,
  ]);

  const priceText = extractLeloPriceTextFromHtml(html) || findFirst([
    /<[^>]+data-test-id="price"[^>]*>([\s\S]*?)<\/[^>]+>/i,
    /<[^>]+class="[^"]*(?:Price|price)[^"]*"[^>]*>(USD[\s\d.,]+)<\/[^>]+>/i,
    />(USD[\s\d.,]+)</i,
  ]);

  const coverImage = (() => {
    const match = html.match(/<img[^>]+src="([^"]+)"[^>]+(?:alt="[^"]*"[^>]*class="[^"]*(?:ProductImage|ImageWrapper)|class="[^"]*(?:ProductImage|ImageWrapper)[^"]*"[^>]*alt="[^"]*")[^>]*>/i)
      || html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
    return match?.[1] ? String(match[1]) : '';
  })();

  const detailBlocks = Array.from(
    html.matchAll(
      /<(?:section|div)[^>]+class="[^"]*(?:Summary|summary|Description|description|Accordion|accordion)[^"]*"[^>]*>([\s\S]*?)<\/(?:section|div)>/gi,
    ),
  )
    .map((match) => stripTags(match[1] || ''))
    .filter(Boolean);

  const metaDescription = getMetaContent('description') || getMetaContent('og:description');
  const rawDescription = uniqueStrings([metaDescription, ...detailBlocks], 12).join('\n\n');
  const categoryHints = uniqueStrings(
    (rawDescription.match(/\b(suction|sonic|rabbit|g-spot|prostate|couples|wearable|travel)\b/gi) || []).map(String),
    10,
  );

  return {
    title,
    subtitle,
    priceText,
    coverImage,
    rawDescription,
    categoryHints,
  };
}

export async function runCrawler() {
  console.log('--- 启动 Playwright 无头抓取引擎 [Target: LELO] ---');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'zh-TW',
  });
  const page = await context.newPage();

  const listMap = new Map<string, ListItem>();

  for (const targetUrl of TARGET_URLS) {
    console.log(`\n[列表] 抓取分类页: ${targetUrl}`);
    try {
      const items = await extractListItems(page, targetUrl);
      for (const item of items) {
        const normalizedUrl = normalizeProductUrl(item.sourceUrl);
        if (!normalizedUrl) continue;
        const existing = listMap.get(normalizedUrl);
        if (existing) {
          const normalizedGenderHint =
            existing.genderHint !== item.genderHint ? 'unisex' : existing.genderHint;
          listMap.set(normalizedUrl, { ...existing, ...item, sourceUrl: normalizedUrl, genderHint: normalizedGenderHint });
          continue;
        }
        listMap.set(normalizedUrl, { ...item, sourceUrl: normalizedUrl });
      }
      console.log(`[列表] 当前累计 ${listMap.size} 个唯一商品`);
    } catch (error) {
      console.error(`[列表] 抓取失败: ${targetUrl}`, error);
    }
  }

  const targetItems = Array.from(listMap.values()).slice(0, MAX_ITEMS);
  console.log(`\n[详情] 准备抓取 ${targetItems.length} 个 LELO 商品详情`);

  const bufferData: Array<Record<string, unknown>> = [];

  for (const [index, item] of targetItems.entries()) {
    try {
      console.log(`[详情] ${index + 1}/${targetItems.length}: ${item.sourceUrl}`);
      await page.goto(item.sourceUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const detail = await extractDetailItem(page);
      const finalName = normalizeWhitespace(detail.title || item.name);
      if (!finalName || /shopping cart|購物車/i.test(finalName)) continue;

      bufferData.push({
        sourceUrl: item.sourceUrl,
        name: finalName,
        subtitle: normalizeWhitespace(detail.subtitle || item.subtitle),
        priceText: normalizeWhitespace(detail.priceText || item.priceText),
        priceCurrency: 'USD',
        coverImage: detail.coverImage || item.coverImage,
        genderHint: item.genderHint,
        categoryHints: uniqueStrings([...(item.categoryHints || []), ...(detail.categoryHints || [])]),
        rawDescription: normalizeWhitespace(detail.rawDescription).slice(0, 12000),
        isReviewed: false,
      });
    } catch (error) {
      console.error(`[详情] 抓取失败: ${item.sourceUrl}`, error);
    }

    if (index < targetItems.length - 1) {
      await page.waitForTimeout(DELAY_BETWEEN_PAGES);
    }
  }

  await browser.close();

  const dir = path.dirname(BUFFER_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(BUFFER_PATH, JSON.stringify(bufferData, null, 2));

  console.log(`\n--- 抓取任务完成 ---`);
  console.log(`已写入 LELO review-buffer: ${BUFFER_PATH}`);

  try {
    await runCleaner();
  } catch (cleanerError) {
    console.error('[致命错误] LELO cleaner 执行失败:', cleanerError);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCrawler().catch(console.error);
}
