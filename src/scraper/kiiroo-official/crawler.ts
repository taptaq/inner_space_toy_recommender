import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { BrowserContext, Page } from 'playwright';
import {
  createKiirooContext,
  getOrCreateKiirooPage,
  prepareKiirooInteractiveGate,
  type KiirooContextBundle,
} from './browser-session.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ORIGIN = 'https://www.kiiroo.com';
export const LIST_URL = `${ORIGIN}/collections/male-masturbators`;
export const COLLECTION_JSON_URL = `${ORIGIN}/collections/male-masturbators/products.json`;
export const BUFFER_PATH = path.resolve(__dirname, '../../data/kiiroo-official-review-buffer.json');
export const MAX_ITEMS = Number(process.env.KIIROO_OFFICIAL_MAX_ITEMS || '200');
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

export type KiirooListItem = {
  sourceUrl: string;
  name: string;
  subtitle: string;
  coverImage: string;
  priceUsd: number | null;
  originalPriceUsd: number | null;
  priceCurrency: 'USD';
  categoryHints: string[];
  genderHint: 'male';
  listPosition: number | null;
};

export type KiirooProductDetail = {
  title: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  priceUsd: number | null;
  originalPriceUsd: number | null;
  coverImage: string;
  galleryImages: string[];
  rawDescription: string;
};

export type KiirooReviewBufferItem = KiirooListItem &
  KiirooProductDetail & {
    isReviewed: false;
  };

export type ShopifyVariant = {
  title?: string | null;
  price?: string | number | null;
  compare_at_price?: string | number | null;
  available?: boolean | null;
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
  vendor?: string | null;
  product_type?: string | null;
  tags?: string | string[] | null;
  variants?: ShopifyVariant[] | null;
  images?: ShopifyImage[] | null;
  options?: Array<{ name?: string | null; values?: string[] | null }> | null;
};

export type ShopifyCatalogResponse = {
  products?: ShopifyProduct[] | null;
};

type ShopifyAnalyticsMetaVariant = {
  name?: string | null;
  public_title?: string | null;
  price?: string | number | null;
  compare_at_price?: string | number | null;
};

type ShopifyAnalyticsMetaProduct = {
  handle?: string | null;
  title?: string | null;
  type?: string | null;
  vendor?: string | null;
  variants?: ShopifyAnalyticsMetaVariant[] | null;
};

type ShopifyAnalyticsMetaPayload = {
  products?: ShopifyAnalyticsMetaProduct[] | null;
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

function parseMetaPriceUsd(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value / 100;
  }

  return parsePriceUsd(value);
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

export function normalizeProductUrl(input: string): string {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';

  let url: URL;
  try {
    url = new URL(trimmed, ORIGIN);
  } catch {
    return '';
  }

  const handleMatch = url.pathname.match(/\/products\/([^/?#]+)/i);
  if (!handleMatch?.[1]) return '';
  url.protocol = 'https:';
  url.host = 'www.kiiroo.com';
  url.pathname = `/products/${handleMatch[1]}`;
  url.search = '';
  url.hash = '';
  return url.toString();
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

export function shouldKeepKiirooCandidate(input: Record<string, unknown>): boolean {
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
    'masturbator',
    'male masturbator',
    'stroker',
    'sleeve',
    'interactive',
    'app sync',
    'sync',
    'handjob',
    'blowjob',
    'suction',
    'thrusting',
    'onyx',
    'keon',
    'feel',
    'blowjob machine',
    'combo',
    'combo pack',
    'bundle',
    'mouth stroker',
    'fleshlight',
    'male pleasure',
    'for him',
  ];

  return allowedTerms.some((term) => haystack.includes(term));
}

export function isShopifyErrorPage(html: string): boolean {
  const text = normalizeWhitespace(html).toLowerCase();
  if (!text) return true;

  return (
    (text.includes('something went wrong') && text.includes('shopify')) ||
    text.includes('there was an issue loading this page') ||
    text.includes('liquid error') ||
    text.includes('page you requested does not exist') ||
    text.includes('this store is unavailable')
  );
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

    if (depth === 0) {
      result.push(html.slice(startIndex, endIndex));
    }
  }

  return result;
}

function extractAnchorBlocks(html: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const anchorPattern = /<a\b[^>]+href="([^"]*\/products\/[^"]+)"[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html))) {
    const sourceUrl = normalizeProductUrl(match[1] || '');
    if (!sourceUrl || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    const start = Math.max(0, match.index - 240);
    const end = Math.min(html.length, anchorPattern.lastIndex + 1400);
    result.push(html.slice(start, end));
  }

  return result;
}

function findFirstCapture(input: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const value = input.match(pattern)?.[1];
    if (value) {
      return normalizeWhitespace(value);
    }
  }

  return '';
}

function resolveListItemName(block: string): string {
  return (
    findFirstCapture(block, [
      /<a[^>]*class="[^"]*full-unstyled-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
      /<h3[^>]*>([\s\S]*?)<\/h3>/i,
      /<h2[^>]*>([\s\S]*?)<\/h2>/i,
      /<a[^>]*href="[^"]*\/products\/[^"]*"[^>]*>\s*(?:<span[^>]*>)?([\s\S]*?)(?:<\/span>)?\s*<\/a>/i,
    ]) || normalizeWhitespace(block.match(/<img[^>]+alt="([^"]+)"/i)?.[1] || '')
  );
}

function resolveListItemSubtitle(block: string, name: string): string {
  const candidates = [
    findFirstCapture(block, [
      /<p[^>]*class="[^"]*card__caption[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
      /<span[^>]*class="[^"]*caption[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /<p[^>]*>([\s\S]*?)<\/p>/i,
    ]),
  ].filter(Boolean);

  return candidates.find((candidate) => candidate !== name) || '';
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

export function extractListItemsFromHtml(html: string): KiirooListItem[] {
  const gridHtml = extractElementById(html, 'ProductGridContainer') || html;
  const blocks = extractGridItemBlocks(gridHtml);
  const candidates = blocks.length > 0 ? blocks : extractAnchorBlocks(gridHtml);
  const items: KiirooListItem[] = [];

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

    const item: KiirooListItem = {
      sourceUrl,
      name,
      subtitle,
      coverImage,
      priceUsd,
      originalPriceUsd,
      priceCurrency: 'USD',
      categoryHints: [],
      genderHint: 'male',
      listPosition: index + 1,
    };

    if (sourceUrl && shouldKeepKiirooCandidate(item)) {
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

export function extractShopifyAnalyticsMetaProducts(html: string): ShopifyProduct[] {
  const metaMatch = html.match(/var meta = (\{[\s\S]*?"products"\s*:\s*\[[\s\S]*?\][\s\S]*?\});/i);
  if (!metaMatch?.[1]) return [];

  try {
    const payload = JSON.parse(metaMatch[1]) as ShopifyAnalyticsMetaPayload;
    const products = Array.isArray(payload.products) ? payload.products : [];

    return products
      .map((product) => {
        const variants = Array.isArray(product.variants) ? product.variants : [];
        const firstVariant = variants[0];

        return {
          title: normalizeWhitespace(String(product.title || firstVariant?.name || '')),
          handle: normalizeWhitespace(String(product.handle || '')),
          product_type: normalizeWhitespace(String(product.type || '')),
          vendor: normalizeWhitespace(String(product.vendor || '')),
          variants: variants.map((variant) => ({
            title: normalizeWhitespace(String(variant.public_title || variant.name || '')),
            price: parseMetaPriceUsd(variant.price),
            compare_at_price: parseMetaPriceUsd(variant.compare_at_price),
          })),
          images: [],
        } satisfies ShopifyProduct;
      })
      .filter((product) => Boolean(product.handle) && Boolean(product.title));
  } catch {
    return [];
  }
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
): KiirooListItem[] {
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
        genderHint: 'male' as const,
        listPosition: positionOffset + index + 1,
      };
    })
    .filter((item) => item.sourceUrl && shouldKeepKiirooCandidate(item));
}

export function mergeUniqueListItems(items: KiirooListItem[]): KiirooListItem[] {
  const byUrl = new Map<string, KiirooListItem>();

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

    byUrl.set(sourceUrl, {
      ...preferred,
      sourceUrl,
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

function extractMetaContent(html: string, name: string): string {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
  return normalizeWhitespace(html.match(pattern)?.[1] || '');
}

function collectTagText(html: string, tags: string[]): string[] {
  const result: string[] = [];

  for (const tag of tags) {
    const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html))) {
      result.push(normalizeWhitespace(match[1] || ''));
    }
  }

  return result;
}

export function extractRelevantDetailTextFromHtml(html: string, accordionText = ''): string {
  const mainHtml = extractElementById(html, 'MainContent') || html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || html;
  const rteMatches = Array.from(mainHtml.matchAll(/<[^>]*class="[^"]*\brte\b[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/gi)).map(
    (match) => normalizeWhitespace(match[1] || ''),
  );
  const genericText = collectTagText(mainHtml, ['h1', 'h2', 'h3', 'h4', 'p', 'li', 'summary']);

  return uniqueStrings([...rteMatches, accordionText, ...genericText], 160).join('\n');
}

export function buildKiirooRawDescription(parts: Array<string | null | undefined>): string {
  return uniqueStrings(parts, 220).join('\n');
}

export async function collectAccordionTexts(page: Page): Promise<string> {
  const accordionLocator = page.locator('.accordion');
  const count = await accordionLocator.count().catch(() => 0);

  for (let index = 0; index < count; index += 1) {
    const accordion = accordionLocator.nth(index);
    await accordion.scrollIntoViewIfNeeded().catch(() => {});

    const tagName = await accordion.evaluate((node) => node.tagName.toLowerCase()).catch(() => '');
    if (tagName === 'details') {
      const summary = accordion.locator('summary').first();
      await summary.click({ timeout: 1_000 }).catch(() => {});
    } else {
      await accordion.click({ timeout: 1_000 }).catch(() => {});
    }

    await page.waitForTimeout(120);
  }

  const collected = (await page.evaluate(`(() => {
    const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') === 0) {
        return false;
      }
      return true;
    };

    const pushText = (target, bucket) => {
      if (!target) return;
      const text = normalize(target.innerText || target.textContent || '');
      if (text) bucket.push(text);
    };

    const chunks = [];

    document.querySelectorAll('.accordion').forEach((node) => {
      const tagName = node.tagName.toLowerCase();
      if (tagName === 'details') {
        if (node.open) {
          pushText(node, chunks);
        }
        return;
      }

      pushText(node, chunks);
      const next = node.nextElementSibling;
      if (isVisible(next)) {
        pushText(next, chunks);
      }
    });

    return chunks;
  })()`)) as string[];

  return buildKiirooRawDescription(collected);
}

export function extractDetailFromHtml(html: string, accordionText = ''): KiirooProductDetail {
  const title =
    normalizeWhitespace(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '') ||
    extractMetaContent(html, 'og:title') ||
    normalizeWhitespace(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const subtitle = normalizeWhitespace(
    html.match(/<p\b[^>]*class="[^"]*(?:product__text|caption|subtitle)[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '',
  );
  const metaTitle = normalizeWhitespace(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || title);
  const metaDescription = extractMetaContent(html, 'description') || extractMetaContent(html, 'og:description');
  const galleryImages = uniqueStrings(
    Array.from(html.matchAll(/<img\b[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/gi)).map((match) =>
      normalizeAssetUrl(match[1] || ''),
    ),
    24,
  ).filter(Boolean);
  const coverImage = galleryImages[0] || '';
  const currentPriceMatch =
    html.match(/<(?:span|div)[^>]*class="[^"]*price-item--sale[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i) ||
    html.match(/<(?:span|div)[^>]*class="[^"]*price-item[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i) ||
    html.match(/<(?:span|div)[^>]*class="[^"]*price[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i);
  const originalPriceMatch = html.match(
    /<(?:span|div|s)[^>]*class="[^"]*(?:price-item--regular|compare-at-price)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|s)>/i,
  );
  const rawDescription = buildKiirooRawDescription([title, subtitle, metaDescription, extractRelevantDetailTextFromHtml(html, accordionText)]);

  return {
    title,
    subtitle,
    metaTitle,
    metaDescription,
    priceUsd: parsePriceUsd(currentPriceMatch?.[1] || null),
    originalPriceUsd: parsePriceUsd(originalPriceMatch?.[1] || null),
    coverImage,
    galleryImages,
    rawDescription,
  };
}

export function extractDetailFromShopifyProduct(product: ShopifyProduct): KiirooProductDetail {
  const { priceUsd, originalPriceUsd } = resolveShopifyProductPrice(product);
  const tags = normalizeTags(product.tags);
  const bodyHtml = String(product.body_html ?? product.description ?? '');
  const galleryImages = uniqueStrings(
    (product.images || []).map((image) => normalizeAssetUrl(String(image?.src || ''))).filter(Boolean),
    24,
  );
  const rawDescription = buildKiirooRawDescription([
    String(product.title || ''),
    String(product.product_type || ''),
    normalizeWhitespace(bodyHtml),
    ...tags,
    ...((product.options || []).flatMap((option) => [String(option.name || ''), ...((option.values || []).map((value) => String(value || '')))])),
    ...((product.variants || []).map((variant) => String(variant?.title || ''))),
    ...((product.images || []).map((image) => String(image?.alt || ''))),
  ]);

  return {
    title: normalizeWhitespace(String(product.title || '')),
    subtitle: normalizeWhitespace(String(product.product_type || '')),
    metaTitle: normalizeWhitespace(String(product.title || '')),
    metaDescription: normalizeWhitespace(bodyHtml),
    priceUsd,
    originalPriceUsd,
    coverImage: galleryImages[0] || '',
    galleryImages,
    rawDescription,
  };
}

function normalizeDetail(detail: KiirooProductDetail): KiirooProductDetail {
  return {
    ...detail,
    coverImage: normalizeAssetUrl(detail.coverImage),
    galleryImages: uniqueStrings(detail.galleryImages.map((value) => normalizeAssetUrl(value)).filter(Boolean), 24),
  };
}

function mergeDetailSources(primary: KiirooProductDetail, secondary: KiirooProductDetail): KiirooProductDetail {
  return {
    title: primary.title || secondary.title,
    subtitle: primary.subtitle || secondary.subtitle,
    metaTitle: primary.metaTitle || secondary.metaTitle,
    metaDescription: primary.metaDescription || secondary.metaDescription,
    priceUsd: primary.priceUsd ?? secondary.priceUsd,
    originalPriceUsd: primary.originalPriceUsd ?? secondary.originalPriceUsd,
    coverImage: primary.coverImage || secondary.coverImage,
    galleryImages: uniqueStrings([...(primary.galleryImages || []), ...(secondary.galleryImages || [])], 24),
    rawDescription: buildKiirooRawDescription([primary.rawDescription, secondary.rawDescription]),
  };
}

function buildReviewBufferItem(item: KiirooListItem, detail: KiirooProductDetail): KiirooReviewBufferItem | null {
  if (
    !shouldKeepKiirooCandidate({
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
  items: KiirooListItem[],
  fetchDetail: (item: KiirooListItem) => Promise<KiirooProductDetail>,
): Promise<KiirooReviewBufferItem[]> {
  const reviewBuffer: KiirooReviewBufferItem[] = [];

  for (const item of items) {
    try {
      const detail = normalizeDetail(await fetchDetail(item));
      const row = buildReviewBufferItem(item, detail);
      if (row) {
        reviewBuffer.push(row);
      }
    } catch (error) {
      console.warn(`[kiiroo-official] 详情抓取失败，跳过 ${item.sourceUrl}:`, error);
    }
  }

  return reviewBuffer;
}

type CrawlListingPagesInput = {
  maxItems?: number;
  fetchCollectionHtml: () => Promise<string>;
  fetchCollectionJsonPage: (page: number) => Promise<ShopifyCatalogResponse>;
};

export async function crawlListingPages(input: CrawlListingPagesInput): Promise<KiirooListItem[]> {
  const { fetchCollectionHtml, fetchCollectionJsonPage } = input;
  const maxItems = input.maxItems ?? MAX_ITEMS;
  const mergedCandidates: KiirooListItem[] = [];

  try {
    const html = await fetchCollectionHtml();
    if (html && !isShopifyErrorPage(html)) {
      mergedCandidates.push(...extractListItemsFromHtml(html));
      mergedCandidates.push(...extractListItemsFromShopifyJson(extractShopifyAnalyticsMetaProducts(html)));
    }
  } catch (error) {
    console.warn('[kiiroo-official] 列表 HTML 抓取失败，将继续尝试 Shopify JSON。', error);
  }

  const jsonItems: KiirooListItem[] = [];
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

function extractProductHandle(sourceUrl: string): string {
  return normalizeProductUrl(sourceUrl).split('/products/')[1] || '';
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

async function fetchKiirooDetail(
  item: KiirooListItem,
  preloadedProduct: ShopifyProduct | null = null,
  context: BrowserContext | null = null,
): Promise<KiirooProductDetail> {
  const preloadedDetail = preloadedProduct ? extractDetailFromShopifyProduct(preloadedProduct) : null;

  if (context) {
    const page = await context.newPage();

    try {
      await page.goto(item.sourceUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.waitForTimeout(2_500);
      const accordionText = await collectAccordionTexts(page).catch(() => '');
      const detail = extractDetailFromHtml(await page.content(), accordionText);
      if (detail.rawDescription || detail.title) {
        return preloadedDetail ? mergeDetailSources(detail, preloadedDetail) : detail;
      }
    } finally {
      await page.close().catch(() => {});
    }
  }

  try {
    const html = await fetchText(item.sourceUrl);
    if (html && !isShopifyErrorPage(html)) {
      const detail = extractDetailFromHtml(html);
      if (detail.rawDescription || detail.title) {
        return preloadedDetail ? mergeDetailSources(detail, preloadedDetail) : detail;
      }
    }
  } catch (error) {
    console.warn(`[kiiroo-official] 商品页 HTML 解析失败，回退 JSON: ${item.sourceUrl}`, error);
  }

  if (preloadedDetail) {
    return preloadedDetail;
  }

  const handle = extractProductHandle(item.sourceUrl);
  if (!handle) {
    throw new Error(`无法从链接提取 handle: ${item.sourceUrl}`);
  }

  return extractDetailFromShopifyProduct(await fetchProductJson(handle));
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function writeReviewBuffer(rows: KiirooReviewBufferItem[]) {
  ensureDir(BUFFER_PATH);
  fs.writeFileSync(BUFFER_PATH, JSON.stringify(rows, null, 2));
}

export async function runCrawler(): Promise<KiirooReviewBufferItem[]> {
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
    console.warn('[kiiroo-official] Playwright 列表抓取失败，将尝试普通 HTML。', error);
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
      return fetchKiirooDetail(item, preloadedProduct, session?.context || null);
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

export async function runBrandCrawlerSequence() {
  const [{ runKiirooCollectionSequence }, femaleModule, couplesModule] = await Promise.all([
    import('./orchestrator.ts'),
    import('../kiiroo-vibrators-official/crawler.ts'),
    import('../kiiroo-couples-official/crawler.ts'),
  ]);

  return runKiirooCollectionSequence([
    {
      code: 'male',
      runCrawler,
      runCleaner,
    },
    {
      code: 'female',
      runCrawler: femaleModule.runCrawler,
      runCleaner: femaleModule.runCleaner,
    },
    {
      code: 'couples',
      runCrawler: couplesModule.runCrawler,
      runCleaner: couplesModule.runCleaner,
    },
  ]);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  runBrandCrawlerSequence()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
