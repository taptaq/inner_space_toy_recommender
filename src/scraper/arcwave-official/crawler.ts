import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ORIGIN = 'https://www.arcwave.com';
export const LIST_URL = `${ORIGIN}/us/sex-toys-for-men`;
export const BUFFER_PATH = path.resolve(__dirname, '../../data/arcwave-official-review-buffer.json');
export const MAX_ITEMS = Number(process.env.ARCWAVE_OFFICIAL_MAX_ITEMS || '120');
const REQUEST_TIMEOUT_MS = 30_000;
const CLEANER_MODULE_PATH = './cleaner.ts';

const REQUEST_HEADERS: HeadersInit = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  pragma: 'no-cache',
  'cache-control': 'no-cache',
};

export type ArcwaveListItem = {
  sourceUrl: string;
  name: string;
  subtitle: string;
  coverImage: string;
  priceSourceAmount: number | null;
  originalPriceSourceAmount: number | null;
  priceCurrency: 'USD';
  categoryHints: string[];
  genderHint: 'male';
  listPosition: number | null;
  stock: string;
};

export type ArcwaveProductDetail = {
  title: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  priceSourceAmount: number | null;
  originalPriceSourceAmount: number | null;
  priceCurrency: 'USD';
  coverImage: string;
  galleryImages: string[];
  rawDescription: string;
  productCode: string;
};

export type ArcwaveReviewBufferItem = ArcwaveListItem &
  ArcwaveProductDetail & {
    isReviewed: false;
  };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function decodeHtmlEntities(value: string): string {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripTags(value: string): string {
  return decodeHtmlEntities(String(value || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '));
}

function normalizeWhitespace(value: string): string {
  return stripTags(value)
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

function parseNumber(value: unknown): number | null {
  const numeric = Number(String(value ?? '').replace(/[^\d.]+/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function uniqueStrings(values: Array<string | null | undefined>, limit = 50): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeWhitespace(String(value || ''));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function resolveUrl(input: string): string {
  const trimmed = decodeHtmlEntities(String(input || '').trim());
  if (!trimmed) return '';
  try {
    return new URL(trimmed, ORIGIN).toString();
  } catch {
    return '';
  }
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(/([:@\w-]+)\s*=\s*"([^"]*)"/g)) {
    attrs[match[1]] = decodeHtmlEntities(match[2]);
  }
  return attrs;
}

function normalizeProductUrl(input: string): string {
  const resolved = resolveUrl(input);
  if (!resolved) return '';
  try {
    const url = new URL(resolved);
    if (!/\/us\//i.test(url.pathname)) {
      url.pathname = `/us${url.pathname.startsWith('/') ? url.pathname : `/${url.pathname}`}`;
    }
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

export function shouldKeepArcwaveCandidate(input: Record<string, unknown>): boolean {
  const haystack = [
    String(input.name || ''),
    String(input.subtitle || ''),
    String(input.rawDescription || ''),
    ...(Array.isArray(input.categoryHints) ? input.categoryHints.map((value) => String(value || '')) : []),
  ]
    .join(' ')
    .toLowerCase();

  if (!haystack) return false;

  const hardBlocked = [
    /\bgift\s*card\b/i,
    /\bcharger\b/i,
    /\bcharging\s*cable\b/i,
    /\breplacement\b/i,
    /\bcleaner\b/i,
    /\blube\b/i,
  ];
  if (hardBlocked.some((pattern) => pattern.test(haystack))) return false;

  const categoryHints = Array.isArray(input.categoryHints)
    ? input.categoryHints.map((value) => String(value || '').toLowerCase())
    : [];

  if (categoryHints.some((hint) => hint.includes('sex toys for men'))) return true;
  if (categoryHints.some((hint) => hint.includes('sex toy sets'))) return true;

  const allowed = [
    'masturbator',
    'penis',
    'male toy',
    'male pleasure',
    'stroker',
    'thrust',
    'air pulse',
    'anal',
    'prostate',
    'toy set',
    'bundle',
  ];

  return allowed.some((term) => haystack.includes(term));
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  return await response.text();
}

function extractMetaContent(html: string, key: string): string {
  const match = html.match(new RegExp(`<meta[^>]+(?:property|name)="${key}"[^>]+content="([^"]*)"`, 'i'));
  return normalizeWhitespace(match?.[1] || '');
}

function extractJsonLdProduct(html: string): Record<string, unknown> | null {
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === 'object' && (parsed['@type'] === 'Product' || parsed.type === 'Product')) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function extractBalancedJsonAfterMarker(source: string, marker: string): string | null {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return null;
  const start = source.indexOf('{', markerIndex + marker.length);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }

  return null;
}

function extractSwatchJsonConfig(html: string): Record<string, unknown> {
  const jsonConfigRaw = extractBalancedJsonAfterMarker(html, '"jsonConfig":');
  if (!jsonConfigRaw) return {};
  try {
    return JSON.parse(jsonConfigRaw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function extractGalleryImagesFromJsonConfig(jsonConfig: Record<string, unknown>): string[] {
  const images = Object.values((jsonConfig.images as Record<string, unknown>) || {})
    .flatMap((items) => (Array.isArray(items) ? items : []))
    .flatMap((item: any) => [item?.full, item?.img, item?.thumb]);

  return uniqueStrings(images.map((value) => resolveUrl(String(value || ''))), 30).filter(Boolean);
}

function extractVisibleValueBlock(html: string, blockClassFragment: string): string {
  const blockRegex = new RegExp(
    `<div[^>]+class="[^"]*${blockClassFragment}[^"]*"[^>]*>[\\s\\S]*?<div[^>]+class="[^"]*value[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`,
    'i',
  );
  return normalizeWhitespace(html.match(blockRegex)?.[1] || '');
}

export function extractListItems(html: string): ArcwaveListItem[] {
  const items: ArcwaveListItem[] = [];
  const seen = new Set<string>();

  const listBlockMatch = html.match(/<ol[^>]+class="[^"]*product__items[^"]*row[^"]*"[^>]*>([\s\S]*?)<\/ol>/i);
  const listBlock = listBlockMatch?.[1] || html;

  for (const match of listBlock.matchAll(/<a\b[^>]*class="[^"]*(?:product__photo\s+photo|product__link)[^"]*"[^>]*>/gi)) {
    const tag = match[0];
    const attrs = parseAttributes(tag);
    const href = normalizeProductUrl(attrs.href || '');
    const name = normalizeWhitespace(attrs['data-name'] || attrs.title || '');
    if (!href || !name || !href.startsWith(`${ORIGIN}/us/`)) continue;
    if (seen.has(href)) continue;
    seen.add(href);

    const categoryHints = uniqueStrings(
      String(attrs['data-category'] || '')
        .split('|')
        .map((segment) => segment.trim()),
      20,
    );

    const item: ArcwaveListItem = {
      sourceUrl: href,
      name,
      subtitle: normalizeWhitespace(attrs['data-type'] || ''),
      priceSourceAmount: parseNumber(attrs['data-price']),
      originalPriceSourceAmount: null,
      priceCurrency: 'USD',
      coverImage: resolveUrl(attrs['data-image'] || ''),
      genderHint: 'male',
      stock: normalizeWhitespace(attrs['data-dimension10'] || ''),
      categoryHints,
      listPosition: parseNumber(attrs['data-position']),
    };

    if (shouldKeepArcwaveCandidate(item)) items.push(item);
  }

  return items;
}

function parseFeatureContent(html: string): string[] {
  const featureItems: string[] = [];

  for (const match of html.matchAll(/<section[^>]+class="[^"]*product__features[^"]*"[\s\S]*?<\/section>/gi)) {
    const block = match[0];
    const sectionTitle = normalizeWhitespace(
      block.match(/<div[^>]+class="[^"]*product__features--title[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '',
    );
    const sectionTitleKey = sectionTitle.toLowerCase();
    if (['shipping', 'returns', 'warranty', 'delivery', 'refund'].some((hint) => sectionTitleKey.includes(hint))) {
      continue;
    }

    const featureTitles = Array.from(
      block.matchAll(/<div[^>]+class="[^"]*features__item--title[^"]*"[^>]*>([\s\S]*?)<\/div>/gi),
    ).map((item) => normalizeWhitespace(item[1] || ''));
    const featureDescriptions = Array.from(
      block.matchAll(/<div[^>]+class="[^"]*features__item--description[^"]*"[^>]*>([\s\S]*?)<\/div>/gi),
    ).map((item) => normalizeWhitespace(item[1] || ''));

    if (featureTitles.length > 0 && featureDescriptions.length > 0) {
      for (let index = 0; index < Math.max(featureTitles.length, featureDescriptions.length); index += 1) {
        const title = featureTitles[index] || sectionTitle;
        const description = featureDescriptions[index] || '';
        if (description) {
          featureItems.push([title, description].filter(Boolean).join('\n'));
        }
      }
    } else {
      const flatContent = normalizeWhitespace(
        block.match(/<div[^>]+class="[^"]*features__list[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '',
      );
      if (flatContent) {
        featureItems.push([sectionTitle, flatContent].filter(Boolean).join('\n'));
      }
    }
  }

  for (const match of html.matchAll(/<section[^>]+class="[^"]*widget--product-text-image[^"]*"[\s\S]*?<\/section>/gi)) {
    const block = match[0];
    const title = normalizeWhitespace(block.match(/<h2[^>]*class="[^"]*widget__title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || '');
    const text = normalizeWhitespace(block.match(/<div[^>]+class="[^"]*widget__text[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '');
    if (text) {
      featureItems.push([title, text].filter(Boolean).join('\n'));
    }
  }

  return uniqueStrings(featureItems, 50);
}

function extractProductDetail(html: string, fallback: ArcwaveListItem): ArcwaveProductDetail {
  const productJson = extractJsonLdProduct(html);
  const swatchJsonConfig = extractSwatchJsonConfig(html);

  const title =
    normalizeWhitespace(
      html.match(/<h1[^>]+class="[^"]*page-title[^"]*"[^>]*>[\s\S]*?<span[^>]+class="[^"]*base[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '',
    ) ||
    normalizeWhitespace(String(productJson?.name || '')) ||
    fallback.name;
  const subtitle =
    extractVisibleValueBlock(html, 'info__short body2 product__attribute') ||
    extractVisibleValueBlock(html, 'product__attribute short_description') ||
    normalizeWhitespace(String(productJson?.category || ''));
  const metaTitle = normalizeWhitespace(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || title);
  const metaDescription =
    extractMetaContent(html, 'description') ||
    extractMetaContent(html, 'og:description') ||
    normalizeWhitespace(String(productJson?.description || ''));
  const priceSourceAmount =
    parseNumber(extractMetaContent(html, 'product:price:amount')) ||
    parseNumber(
      String(
        (productJson?.offers as Record<string, unknown> | undefined)?.price ||
          html.match(/<meta itemprop="price" content="([^"]+)"/i)?.[1] ||
          html.match(/id="product-price-[^"]+"[^>]+data-price-amount="([^"]+)"/i)?.[1] ||
          '',
      ),
    ) ||
    parseNumber(((swatchJsonConfig.prices as Record<string, unknown> | undefined)?.finalPrice as Record<string, unknown> | undefined)?.amount) ||
    fallback.priceSourceAmount;
  const originalPriceSourceAmount =
    parseNumber(html.match(/id="old-price-[^"]+"[^>]+data-price-amount="([^"]+)"/i)?.[1] || '') ||
    parseNumber(((swatchJsonConfig.prices as Record<string, unknown> | undefined)?.oldPrice as Record<string, unknown> | undefined)?.amount) ||
    fallback.originalPriceSourceAmount;
  const galleryImages = uniqueStrings([
    resolveUrl(extractMetaContent(html, 'og:image')),
    resolveUrl(String(productJson?.image || '')),
    ...extractGalleryImagesFromJsonConfig(swatchJsonConfig),
  ], 30).filter(Boolean);
  const productCode =
    extractVisibleValueBlock(html, 'info__sku product__attribute') ||
    normalizeWhitespace(String(productJson?.sku || ''));
  const featureAccordion = parseFeatureContent(html);
  const rawDescription = uniqueStrings(
    [
      '[基础信息]',
      `商品名: ${title}`,
      subtitle ? `产品类型: ${subtitle}` : '',
      metaDescription,
      featureAccordion.length ? '[产品特性]' : '',
      ...featureAccordion,
      productCode ? `产品编码: ${productCode}` : '',
      fallback.stock ? `库存状态: ${fallback.stock}` : '',
      fallback.categoryHints.length ? `站内分类提示: ${fallback.categoryHints.join(' | ')}` : '',
    ],
    120,
  ).join('\n');

  return {
    title,
    subtitle,
    metaTitle,
    metaDescription,
    priceSourceAmount,
    originalPriceSourceAmount:
      originalPriceSourceAmount && priceSourceAmount && originalPriceSourceAmount > priceSourceAmount
        ? originalPriceSourceAmount
        : null,
    priceCurrency: 'USD',
    coverImage: galleryImages[0] || fallback.coverImage || '',
    galleryImages,
    rawDescription,
    productCode,
  };
}

function persistBuffer(bufferData: unknown[]) {
  ensureDir(BUFFER_PATH);
  fs.writeFileSync(BUFFER_PATH, JSON.stringify(bufferData, null, 2));
}

export async function runCrawler(): Promise<ArcwaveReviewBufferItem[]> {
  console.log('--- 启动 Arcwave 官方站抓取任务 ---');
  console.log(`[列表] 入口: ${LIST_URL}`);

  const listHtml = await fetchHtml(LIST_URL);
  const listItems = extractListItems(listHtml);
  console.log(`[列表] 原始商品卡片数: ${listItems.length}`);

  if (listItems.length === 0) {
    throw new Error('官方站列表页未解析到任何商品卡片。');
  }

  const targetItems = listItems.slice(0, MAX_ITEMS);
  console.log(`[列表] 本轮抓取上限: ${MAX_ITEMS}，实际处理: ${targetItems.length}`);

  const bufferData: ArcwaveReviewBufferItem[] = [];
  persistBuffer(bufferData);

  for (let index = 0; index < targetItems.length; index += 1) {
    const item = targetItems[index];
    console.log(`\n[详情] (${index + 1}/${targetItems.length}) ${item.name}`);
    console.log(`[详情] URL: ${item.sourceUrl}`);

    try {
      const detailHtml = await fetchHtml(item.sourceUrl);
      const detail = extractProductDetail(detailHtml, item);

      const record: ArcwaveReviewBufferItem = {
        ...item,
        ...detail,
        name: detail.title || item.name,
        subtitle: detail.subtitle || item.subtitle,
        priceSourceAmount: detail.priceSourceAmount ?? item.priceSourceAmount ?? null,
        originalPriceSourceAmount: detail.originalPriceSourceAmount ?? item.originalPriceSourceAmount ?? null,
        coverImage: detail.coverImage || item.coverImage || '',
        isReviewed: false,
      };

      bufferData.push(record);
      persistBuffer(bufferData);

      console.log(
        `[缓冲] 已写入 ${bufferData.length} 条 | 价格 USD=${record.priceSourceAmount ?? 'N/A'} | 图 ${record.galleryImages.length} 张`,
      );

      await sleep(350);
    } catch (error) {
      console.error(`[失败] ${item.name} 抓取失败:`, error);
    }
  }

  console.log(`\n--- Arcwave 官方站抓取结束，共写入 ${bufferData.length} 条 ---`);
  console.log(`[缓冲] ${BUFFER_PATH}`);
  await runCleaner();
  return bufferData;
}

export async function runCleaner() {
  const cleanerModule = await import(CLEANER_MODULE_PATH);
  return await cleanerModule.runCleaner();
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  runCrawler().catch((error) => {
    console.error('[致命错误] Arcwave 抓取流程失败:', error);
    process.exitCode = 1;
  });
}
