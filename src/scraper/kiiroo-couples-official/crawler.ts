import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { BrowserContext, Page } from 'playwright';
import {
  ORIGIN,
  collectAccordionTexts,
  extractShopifyAnalyticsMetaProducts,
  extractDetailFromHtml as extractSharedDetailFromHtml,
  extractDetailFromShopifyProduct as extractSharedDetailFromShopifyProduct,
  isShopifyErrorPage,
  normalizeProductUrl,
} from '../kiiroo-official/crawler.ts';
import {
  createKiirooContext,
  getOrCreateKiirooPage,
  prepareKiirooInteractiveGate,
  type KiirooContextBundle,
} from '../kiiroo-official/browser-session.ts';

export { collectAccordionTexts, isShopifyErrorPage };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const LIST_URL = `${ORIGIN}/collections/for-couples`;
export const COLLECTION_JSON_URL = `${ORIGIN}/collections/for-couples/products.json`;
export const BUFFER_PATH = path.resolve(__dirname, '../../data/kiiroo-couples-official-review-buffer.json');
export const MAX_ITEMS = Number(process.env.KIIROO_COUPLES_OFFICIAL_MAX_ITEMS || '200');
const REQUEST_TIMEOUT_MS = 30_000;
const CLEANER_MODULE_PATH = './cleaner.ts';

const REQUEST_HEADERS: HeadersInit = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
  'accept-language': 'en-US,en;q=0.9',
  pragma: 'no-cache',
  'cache-control': 'no-cache',
};

export type KiirooCouplesListItem = {
  sourceUrl: string;
  name: string;
  subtitle: string;
  coverImage: string;
  priceUsd: number | null;
  originalPriceUsd: number | null;
  priceCurrency: 'USD';
  categoryHints: string[];
  genderHint: 'unisex';
  listPosition: number | null;
};

export type ShopifyVariant = {
  title?: string | null;
  price?: string | number | null;
  compare_at_price?: string | number | null;
};

export type ShopifyImage = {
  src?: string | null;
  alt?: string | null;
};

export type ShopifyProduct = {
  title?: string | null;
  handle?: string | null;
  body_html?: string | null;
  description?: string | null;
  product_type?: string | null;
  tags?: string | string[] | null;
  variants?: ShopifyVariant[] | null;
  images?: ShopifyImage[] | null;
};

export type ShopifyCatalogResponse = {
  products?: ShopifyProduct[] | null;
};

export type KiirooCouplesProductDetail = ReturnType<typeof extractSharedDetailFromHtml>;

export type KiirooCouplesReviewBufferItem = KiirooCouplesListItem &
  KiirooCouplesProductDetail & {
    isReviewed: false;
  };

function decodeHtml(value: string): string {
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
  return decodeHtml(String(value || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '));
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

function uniqueStrings(values: Array<string | null | undefined>, limit = 160): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

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

function parsePriceUsd(value: unknown): number | null {
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function countAmpersands(value: string): number {
  return (String(value || '').match(/&/g) || []).length;
}

function scoreCanonicalCouplesName(value: string): number {
  const normalized = normalizeWhitespace(String(value || ''));
  if (!normalized) return -1;

  let score = 0;
  if (normalized.includes('&')) score += 5;
  if (/\bCouple Set\b/i.test(normalized)) score += 2;
  score += countAmpersands(normalized);
  if (normalized.length <= 80) score += 1;
  return score;
}

function normalizeAssetUrl(input: string): string {
  const trimmed = decodeHtml(String(input || '').trim());
  if (!trimmed) return '';

  try {
    return new URL(trimmed, ORIGIN).toString();
  } catch {
    return '';
  }
}

function normalizeTags(tags: ShopifyProduct['tags']): string[] {
  if (Array.isArray(tags)) {
    return uniqueStrings(tags.map((value) => String(value || '')), 40);
  }

  return uniqueStrings(
    String(tags || '')
      .split(',')
      .map((value) => value.trim()),
    40,
  );
}

function buildCandidateText(input: Record<string, unknown>): string {
  const tags = Array.isArray(input.tags)
    ? input.tags.map((value) => String(value || ''))
    : Array.isArray(input.categoryHints)
      ? input.categoryHints.map((value) => String(value || ''))
      : [];

  return [
    String(input.name || ''),
    String(input.subtitle || ''),
    String(input.rawDescription || ''),
    String(input.productType || ''),
    ...tags,
  ]
    .join(' ')
    .toLowerCase();
}

function buildCandidateCoreText(input: Record<string, unknown>): string {
  const tags = Array.isArray(input.tags)
    ? input.tags.map((value) => String(value || ''))
    : Array.isArray(input.categoryHints)
      ? input.categoryHints.map((value) => String(value || ''))
      : [];

  return [String(input.name || ''), String(input.subtitle || ''), String(input.productType || ''), ...tags]
    .join(' ')
    .toLowerCase();
}

export function shouldKeepKiirooCouplesCandidate(input: Record<string, unknown>): boolean {
  const haystack = buildCandidateText(input);
  const coreHaystack = buildCandidateCoreText(input);
  if (!haystack) return false;

  const hardBlockedPatterns = [
    /\bgift\s*card\b/i,
    /\bcharger\b/i,
    /\bcharging\s*cable\b/i,
    /\bcable\b/i,
    /\badapter\b/i,
    /\bcase\b/i,
    /\bmount\b/i,
    /\btable\s*clamp\b/i,
  ];
  if (hardBlockedPatterns.some((pattern) => pattern.test(coreHaystack))) {
    return false;
  }

  const allowedTerms = [
    'couples',
    'partner',
    'partner play',
    'shared pleasure',
    'interactive',
    'app',
    'sync',
    'dual stimulation',
    'dual-stimulation',
    'combo',
    'combo pack',
    'bundle',
    'wearable',
    'vibrator',
    'clitoral',
    'g-spot',
    'g spot',
    'suction',
    'rabbit',
    'stroker',
    'masturbator',
    'onyx',
    'onyx+',
    'keon',
    'pearl',
    'cliona',
    'fuse',
    'lumen',
    'ohmibod',
  ];

  return allowedTerms.some((term) => haystack.includes(term));
}

function extractElementById(html: string, id: string): string {
  const openTagPattern = new RegExp(`<([a-z0-9:-]+)\\b[^>]*\\bid=["']${id}["'][^>]*>`, 'i');
  const openMatch = html.match(openTagPattern);
  if (!openMatch?.[0] || openMatch.index === undefined) return '';

  const tagName = String(openMatch[1] || '').toLowerCase();
  const startIndex = openMatch.index;
  const tagPattern = new RegExp(`</?${tagName}\\b[^>]*>`, 'gi');
  tagPattern.lastIndex = startIndex;

  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html))) {
    if (!match[0].startsWith('</')) {
      depth += 1;
    } else {
      depth -= 1;
      if (depth === 0) {
        return html.slice(startIndex, tagPattern.lastIndex);
      }
    }
  }

  return html.slice(startIndex);
}

function extractGridItemBlocks(html: string): string[] {
  const result: string[] = [];
  const tagPattern = /<\/?(div|li)\b[^>]*>/gi;
  const classPattern = /\bclass\s*=\s*"[^"]*\bgrid__item\b[^"]*"/i;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html))) {
    const tag = match[0];
    const tagName = String(match[1] || '').toLowerCase();
    if (tag.startsWith('</') || !classPattern.test(tag)) continue;

    const startIndex = match.index;
    let depth = 1;
    let endIndex = tagPattern.lastIndex;
    let nestedMatch: RegExpExecArray | null;

    while (depth > 0 && (nestedMatch = tagPattern.exec(html))) {
      if (String(nestedMatch[1] || '').toLowerCase() !== tagName) continue;
      depth += nestedMatch[0].startsWith('</') ? -1 : 1;
      endIndex = tagPattern.lastIndex;
    }

    result.push(html.slice(startIndex, endIndex));
  }

  return result;
}

function extractAnchorBlocks(html: string): string[] {
  return Array.from(html.matchAll(/<a\b[\s\S]*?<\/a>/gi)).map((match) => match[0]);
}

function findFirstCapture(block: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = block.match(pattern)?.[1];
    if (match) return match;
  }
  return '';
}

function resolveListItemName(block: string): string {
  return normalizeWhitespace(
    findFirstCapture(block, [
      /<h3[^>]*>([\s\S]*?)<\/h3>/i,
      /<h2[^>]*>([\s\S]*?)<\/h2>/i,
      /<img[^>]+alt="([^"]+)"/i,
      /<a[^>]+aria-label="([^"]+)"/i,
    ]),
  );
}

function resolveListItemSubtitle(block: string, name: string): string {
  const candidates = [
    ...Array.from(block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)).map((match) => normalizeWhitespace(match[1] || '')),
    ...Array.from(block.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)).map((match) => normalizeWhitespace(match[1] || '')),
  ].filter(Boolean);

  return candidates.find((value) => value && value !== name && !/^\$/.test(value)) || '';
}

function resolveListItemImage(block: string): string {
  const srcset = block.match(/<img[^>]+srcset="([^"]+)"/i)?.[1] || '';
  const srcsetFirst = srcset.split(',')[0]?.trim().split(/\s+/)[0] || '';
  const src =
    block.match(/<img[^>]+data-src="([^"]+)"/i)?.[1] ||
    block.match(/<img[^>]+src="([^"]+)"/i)?.[1] ||
    srcsetFirst;

  return normalizeAssetUrl(src);
}

export function extractListItemsFromHtml(html: string): KiirooCouplesListItem[] {
  const gridHtml = extractElementById(html, 'ProductGridContainer') || html;
  const blocks = extractGridItemBlocks(gridHtml);
  const candidates = blocks.length > 0 ? blocks : extractAnchorBlocks(gridHtml);
  const items: KiirooCouplesListItem[] = [];

  for (const [index, block] of candidates.entries()) {
    const href = block.match(/<a[^>]+href="([^"]*\/products\/[^"]+)"/i)?.[1] || '';
    const sourceUrl = normalizeProductUrl(href);
    const name = resolveListItemName(block);
    const subtitle = resolveListItemSubtitle(block, name);
    const coverImage = resolveListItemImage(block);
    const priceUsd =
      parsePriceUsd(
        findFirstCapture(block, [
          /<(?:span|div)[^>]*class="[^"]*price-item--sale[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i,
          /<(?:span|div)[^>]*class="[^"]*price-item[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i,
          /<(?:span|div)[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i,
        ]),
      ) ?? null;
    const originalPriceUsd =
      parsePriceUsd(
        findFirstCapture(block, [
          /<(?:span|div|s)[^>]*class="[^"]*price-item--regular[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|s)>/i,
          /<(?:span|div|s)[^>]*class="[^"]*compare-at-price[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|s)>/i,
        ]),
      ) ?? null;

    const item: KiirooCouplesListItem = {
      sourceUrl,
      name,
      subtitle,
      coverImage,
      priceUsd,
      originalPriceUsd,
      priceCurrency: 'USD',
      categoryHints: [],
      genderHint: 'unisex',
      listPosition: index + 1,
    };

    if (sourceUrl && shouldKeepKiirooCouplesCandidate(item)) {
      items.push(item);
    }
  }

  return items;
}

function normalizeShopifyProducts(payload: ShopifyCatalogResponse | ShopifyProduct[] | null | undefined): ShopifyProduct[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.products)) return payload.products;
  return [];
}

function buildProductUrlFromHandle(handle: string): string {
  return normalizeProductUrl(`/products/${String(handle || '').trim()}`);
}

function resolveShopifyProductPrice(product: ShopifyProduct): { priceUsd: number | null; originalPriceUsd: number | null } {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const firstVariant = variants.find((variant) => parsePriceUsd(variant.price) !== null) || variants[0];

  return {
    priceUsd: parsePriceUsd(firstVariant?.price ?? null),
    originalPriceUsd: parsePriceUsd(firstVariant?.compare_at_price ?? null),
  };
}

export function extractListItemsFromShopifyJson(
  payload: ShopifyCatalogResponse | ShopifyProduct[],
  positionOffset = 0,
): KiirooCouplesListItem[] {
  const products = normalizeShopifyProducts(payload);

  return products
    .map((product, index) => {
      const sourceUrl = buildProductUrlFromHandle(String(product.handle || ''));
      const { priceUsd, originalPriceUsd } = resolveShopifyProductPrice(product);
      const subtitle =
        normalizeWhitespace(String(product.product_type || '')) || normalizeWhitespace(String(product.body_html || ''));
      const categoryHints = uniqueStrings([String(product.product_type || ''), ...normalizeTags(product.tags)], 40);

      return {
        sourceUrl,
        name: normalizeWhitespace(String(product.title || '')),
        subtitle,
        coverImage: normalizeAssetUrl(String(product.images?.[0]?.src || '')),
        priceUsd,
        originalPriceUsd,
        priceCurrency: 'USD' as const,
        categoryHints,
        genderHint: 'unisex' as const,
        listPosition: positionOffset + index + 1,
      };
    })
    .filter((item) => item.sourceUrl && shouldKeepKiirooCouplesCandidate(item));
}

export function mergeUniqueListItems(items: KiirooCouplesListItem[]): KiirooCouplesListItem[] {
  const byUrl = new Map<string, KiirooCouplesListItem>();

  for (const item of items) {
    const sourceUrl = normalizeProductUrl(item.sourceUrl);
    if (!sourceUrl) continue;

    const existing = byUrl.get(sourceUrl);
    if (!existing) {
      byUrl.set(sourceUrl, {
        ...item,
        sourceUrl,
        categoryHints: uniqueStrings(item.categoryHints || [], 40),
      });
      continue;
    }

    const currentPosition = item.listPosition ?? Number.POSITIVE_INFINITY;
    const existingPosition = existing.listPosition ?? Number.POSITIVE_INFINITY;
    const preferred = currentPosition < existingPosition ? item : existing;
    const existingNameScore = scoreCanonicalCouplesName(existing.name);
    const currentNameScore = scoreCanonicalCouplesName(item.name);
    const preferredName = currentNameScore > existingNameScore ? item.name : existing.name || item.name;

    byUrl.set(sourceUrl, {
      ...preferred,
      sourceUrl,
      name: preferredName,
      subtitle: preferred.subtitle || existing.subtitle || item.subtitle,
      coverImage: preferred.coverImage || existing.coverImage || item.coverImage,
      priceUsd: preferred.priceUsd ?? existing.priceUsd ?? item.priceUsd,
      originalPriceUsd: preferred.originalPriceUsd ?? existing.originalPriceUsd ?? item.originalPriceUsd,
      categoryHints: uniqueStrings([...(existing.categoryHints || []), ...(item.categoryHints || [])], 40),
    });
  }

  return Array.from(byUrl.values()).sort(
    (left, right) => (left.listPosition ?? Number.POSITIVE_INFINITY) - (right.listPosition ?? Number.POSITIVE_INFINITY),
  );
}

export function extractRelevantDetailTextFromHtml(html: string, accordionText = ''): string {
  return extractSharedDetailFromHtml(html, accordionText).rawDescription;
}

export function buildKiirooCouplesRawDescription(parts: Array<string | null | undefined>): string {
  return uniqueStrings(parts, 220).join('\n');
}

export function extractDetailFromHtml(html: string, accordionText = ''): KiirooCouplesProductDetail {
  return extractSharedDetailFromHtml(html, accordionText);
}

export function extractDetailFromShopifyProduct(product: ShopifyProduct): KiirooCouplesProductDetail {
  return extractSharedDetailFromShopifyProduct(product);
}

function normalizeDetail(detail: KiirooCouplesProductDetail): KiirooCouplesProductDetail {
  return {
    ...detail,
    coverImage: normalizeAssetUrl(detail.coverImage),
    galleryImages: uniqueStrings(detail.galleryImages.map((value) => normalizeAssetUrl(value)).filter(Boolean), 24),
  };
}

function buildReviewBufferItem(
  item: KiirooCouplesListItem,
  detail: KiirooCouplesProductDetail,
): KiirooCouplesReviewBufferItem | null {
  if (
    !shouldKeepKiirooCouplesCandidate({
      name: detail.title || item.name,
      subtitle: detail.subtitle || item.subtitle,
      rawDescription: detail.rawDescription,
      categoryHints: item.categoryHints,
    })
  ) {
    return null;
  }

  return {
    ...item,
    ...detail,
    sourceUrl: item.sourceUrl,
    coverImage: detail.coverImage || item.coverImage,
    priceUsd: detail.priceUsd ?? item.priceUsd,
    originalPriceUsd: detail.originalPriceUsd ?? item.originalPriceUsd,
    isReviewed: false,
  };
}

export async function crawlDetailItems(
  items: KiirooCouplesListItem[],
  fetchDetail: (item: KiirooCouplesListItem) => Promise<KiirooCouplesProductDetail>,
): Promise<KiirooCouplesReviewBufferItem[]> {
  const reviewBuffer: KiirooCouplesReviewBufferItem[] = [];

  for (const item of items) {
    try {
      const detail = normalizeDetail(await fetchDetail(item));
      const row = buildReviewBufferItem(item, detail);
      if (row) {
        reviewBuffer.push(row);
      }
    } catch (error) {
      console.warn(`[kiiroo-couples-official] 详情抓取失败，跳过 ${item.sourceUrl}:`, error);
    }
  }

  return reviewBuffer;
}

type CrawlListingPagesInput = {
  maxItems?: number;
  fetchCollectionHtml: () => Promise<string>;
  fetchCollectionJsonPage: (page: number) => Promise<ShopifyCatalogResponse>;
};

export async function crawlListingPages(input: CrawlListingPagesInput): Promise<KiirooCouplesListItem[]> {
  const { fetchCollectionHtml, fetchCollectionJsonPage } = input;
  const maxItems = input.maxItems ?? MAX_ITEMS;
  const mergedCandidates: KiirooCouplesListItem[] = [];

  try {
    const html = await fetchCollectionHtml();
    if (html && !isShopifyErrorPage(html)) {
      mergedCandidates.push(...extractListItemsFromHtml(html));
      mergedCandidates.push(...extractListItemsFromShopifyJson(extractShopifyAnalyticsMetaProducts(html)));
    }
  } catch (error) {
    console.warn('[kiiroo-couples-official] 列表 HTML 抓取失败，将继续尝试 Shopify JSON。', error);
  }

  const jsonItems: KiirooCouplesListItem[] = [];
  for (let page = 1; jsonItems.length < maxItems; page += 1) {
    try {
      const payload = await fetchCollectionJsonPage(page);
      const products = normalizeShopifyProducts(payload);
      if (products.length === 0) break;

      jsonItems.push(...extractListItemsFromShopifyJson(products, jsonItems.length));
      if (products.length < 250) break;
    } catch {
      break;
    }
  }

  mergedCandidates.push(...jsonItems);
  return mergeUniqueListItems(mergedCandidates).slice(0, maxItems);
}

async function fetchText(url: string, accept = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'): Promise<string> {
  const response = await fetch(url, {
    headers: { ...REQUEST_HEADERS, accept },
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  return await response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { ...REQUEST_HEADERS, accept: 'application/json,text/plain;q=0.9,*/*;q=0.8' },
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  return (await response.json()) as T;
}

async function fetchCollectionJsonPage(page: number): Promise<ShopifyCatalogResponse> {
  const url = new URL(COLLECTION_JSON_URL);
  url.searchParams.set('limit', '250');
  url.searchParams.set('page', String(page));
  return await fetchJson<ShopifyCatalogResponse>(url.toString());
}

async function fetchAllCollectionProducts(maxPages = 12): Promise<ShopifyProduct[]> {
  const products: ShopifyProduct[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    try {
      const payload = await fetchCollectionJsonPage(page);
      const pageProducts = normalizeShopifyProducts(payload);
      if (pageProducts.length === 0) break;
      products.push(...pageProducts);
      if (pageProducts.length < 250) break;
    } catch {
      break;
    }
  }

  return products;
}

async function fetchProductJson(handle: string): Promise<ShopifyProduct> {
  return await fetchJson<ShopifyProduct>(`${ORIGIN}/products/${handle}.js`);
}

async function loadAllListingCards(page: Page) {
  let lastCount = 0;

  for (let index = 0; index < 10; index += 1) {
    await page.mouse.wheel(0, 1800);
    await page.waitForTimeout(800);

    const currentCount = await page.locator('#ProductGridContainer a[href*="/products/"]').count().catch(() => 0);
    if (currentCount === lastCount) {
      break;
    }

    lastCount = currentCount;
  }

  await page.waitForTimeout(1200);
}

function extractProductHandle(sourceUrl: string): string {
  return normalizeProductUrl(sourceUrl).split('/products/')[1] || '';
}

async function fetchCouplesDetail(
  item: KiirooCouplesListItem,
  preloadedProduct: ShopifyProduct | null = null,
  context: BrowserContext | null = null,
): Promise<KiirooCouplesProductDetail> {
  const preloadedDetail = preloadedProduct ? extractSharedDetailFromShopifyProduct(preloadedProduct) : null;

  if (context) {
    const page = await context.newPage();
    try {
      await page.goto(item.sourceUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.waitForTimeout(2_500);
      const accordionText = await collectAccordionTexts(page).catch(() => '');
      const detail = extractSharedDetailFromHtml(await page.content(), accordionText);
      if (detail.rawDescription || detail.title) {
        return preloadedDetail
          ? {
              ...preloadedDetail,
              ...detail,
              galleryImages: uniqueStrings([...(detail.galleryImages || []), ...(preloadedDetail.galleryImages || [])], 24),
              rawDescription: buildKiirooCouplesRawDescription([detail.rawDescription, preloadedDetail.rawDescription]),
            }
          : detail;
      }
    } finally {
      await page.close().catch(() => {});
    }
  }

  try {
    const html = await fetchText(item.sourceUrl);
    if (html && !isShopifyErrorPage(html)) {
      const detail = extractSharedDetailFromHtml(html);
      if (detail.rawDescription || detail.title) {
        return preloadedDetail
          ? {
              ...preloadedDetail,
              ...detail,
              galleryImages: uniqueStrings([...(detail.galleryImages || []), ...(preloadedDetail.galleryImages || [])], 24),
              rawDescription: buildKiirooCouplesRawDescription([detail.rawDescription, preloadedDetail.rawDescription]),
            }
          : detail;
      }
    }
  } catch (error) {
    console.warn(`[kiiroo-couples-official] 商品页 HTML 解析失败，回退 JSON: ${item.sourceUrl}`, error);
  }

  if (preloadedDetail) {
    return preloadedDetail;
  }

  const handle = extractProductHandle(item.sourceUrl);
  if (!handle) {
    throw new Error(`无法从链接提取 handle: ${item.sourceUrl}`);
  }

  return extractSharedDetailFromShopifyProduct(await fetchProductJson(handle));
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function writeReviewBuffer(rows: KiirooCouplesReviewBufferItem[]) {
  ensureDir(BUFFER_PATH);
  fs.writeFileSync(BUFFER_PATH, JSON.stringify(rows, null, 2));
}

export async function runCrawler(): Promise<KiirooCouplesReviewBufferItem[]> {
  let session: KiirooContextBundle | null = null;
  let listHtml = '';

  try {
    session = await createKiirooContext();
    const page = await getOrCreateKiirooPage(session.context);
    try {
      if (session.runtime.interactive) {
        await prepareKiirooInteractiveGate(page, session.runtime, LIST_URL);
      } else {
        await page.goto(LIST_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
        await page.waitForTimeout(4_000);
      }
      await loadAllListingCards(page);
      listHtml = await page.content();
    } finally {
      if (!session.runtime.interactive) {
        await page.close().catch(() => {});
      }
    }
  } catch (error) {
    console.warn('[kiiroo-couples-official] Playwright 列表抓取失败，将尝试普通 HTML。', error);
  }

  const listItems = await crawlListingPages({
    maxItems: MAX_ITEMS,
    fetchCollectionHtml: async () => listHtml || (await fetchText(LIST_URL)),
    fetchCollectionJsonPage,
  });
  const catalogProducts = await fetchAllCollectionProducts();
  const catalogByUrl = new Map<string, ShopifyProduct>();

  for (const product of catalogProducts) {
    const sourceUrl = buildProductUrlFromHandle(String(product.handle || ''));
    if (!sourceUrl) continue;
    if (!catalogByUrl.has(sourceUrl)) {
      catalogByUrl.set(sourceUrl, product);
    }
  }

  try {
    const reviewBuffer = await crawlDetailItems(listItems, async (item) => {
      const preloadedProduct = catalogByUrl.get(normalizeProductUrl(item.sourceUrl)) || null;
      return fetchCouplesDetail(item, preloadedProduct, session?.context || null);
    });
    writeReviewBuffer(reviewBuffer);
    return reviewBuffer;
  } finally {
    await session?.cleanup();
  }
}

export async function runCleaner() {
  try {
    const cleanerModule = await import(CLEANER_MODULE_PATH);
    return cleanerModule.runCleaner();
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ERR_MODULE_NOT_FOUND' &&
      error.message.includes(CLEANER_MODULE_PATH)
    ) {
      return;
    }
    throw error;
  }
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  runCrawler()
    .then(() => runCleaner())
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
