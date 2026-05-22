import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  normalizeOfficialAssetUrl,
  normalizeOfficialProductUrl,
  normalizeOfficialWhitespace,
  parseOfficialPrice,
  uniqueOfficialStrings,
} from '../shared/shopify-official-helpers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ORIGIN = 'https://www.funfactory.com';
export const LIST_URL = `${ORIGIN}/collections/alle-sextoys`;
export const COLLECTION_JSON_URL = `${LIST_URL}/products.json`;
export const BUFFER_PATH = path.resolve(__dirname, '../../data/funfactory-official-review-buffer.json');
export const MAX_ITEMS = Number(process.env.FUNFACTORY_OFFICIAL_MAX_ITEMS || '250');
const CLEANER_MODULE_PATH = './cleaner.ts';

const REQUEST_HEADERS: HeadersInit = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.7',
  'accept-language': 'de-DE,de;q=0.9,en;q=0.8,zh-CN;q=0.7',
  pragma: 'no-cache',
  'cache-control': 'no-cache',
};

export type FunFactoryListItem = {
  sourceUrl: string;
  name: string;
  subtitle: string;
  coverImage: string;
  priceSourceAmount: number | null;
  originalPriceSourceAmount: number | null;
  priceCurrency: 'EUR';
  categoryHints: string[];
  genderHint: 'unisex';
  listPosition: number | null;
};

export type FunFactoryProductDetail = {
  title: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  priceSourceAmount: number | null;
  originalPriceSourceAmount: number | null;
  priceCurrency: 'EUR';
  coverImage: string;
  galleryImages: string[];
  rawDescription: string;
};

export type FunFactoryReviewBufferItem = FunFactoryListItem &
  FunFactoryProductDetail & {
    isReviewed: false;
  };

export type ShopifyVariant = {
  price?: string | number | null;
  compare_at_price?: string | number | null;
};

export type ShopifyImage = {
  src?: string | null;
};

export type ShopifyProduct = {
  title?: string | null;
  handle?: string | null;
  body_html?: string | null;
  product_type?: string | null;
  tags?: string | string[] | null;
  variants?: ShopifyVariant[] | null;
  images?: ShopifyImage[] | null;
};

export type ShopifyCatalogResponse = {
  products?: ShopifyProduct[] | null;
};

export function normalizeShopifyMoneyValue(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Number.isInteger(value) && value >= 1000 ? value / 100 : value;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^-?\d+$/.test(raw)) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    return Math.abs(parsed) >= 1000 ? parsed / 100 : parsed;
  }
  const parsed = Number(raw.replace(',', '.'));
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function cleanFunFactoryProductName(input: string): string {
  return normalizeOfficialWhitespace(String(input || ''))
    .replace(/\s*online\s+kaufen\s*❤️?\s*\|\s*fun\s*factory\s*$/i, '')
    .replace(/\s*❤️\s*\|\s*fun\s*factory\s*$/i, '')
    .replace(/\s*\|\s*fun\s*factory\s*$/i, '')
    .replace(/\s+von\s+fun\s*factory\s*\|\s*/i, ' | ')
    .trim();
}

function decodeHtml(value: string): string {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function matchAllValues(pattern: RegExp, value: string): string[] {
  return Array.from(value.matchAll(pattern), (match) => String(match[1] || '')).filter(Boolean);
}

export function extractDetailTextFromHtmlBySelectors(html: string): string {
  const selectorBlocks = [
    ...matchAllValues(/<[^>]*class=["'][^"']*product__info-container[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/gi, html),
    ...matchAllValues(/<[^>]*class=["'][^"']*image-with-text__grid[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/gi, html),
    ...matchAllValues(/<[^>]*class=["'][^"']*product__description[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/gi, html),
    ...matchAllValues(/<[^>]*class=["'][^"']*product-description[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/gi, html),
    ...matchAllValues(/<[^>]*class=["'][^"']*multicolumn-card__info[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/gi, html),
    ...matchAllValues(/<[^>]*class=["'][^"']*icon-list-item[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/gi, html),
  ];

  return uniqueOfficialStrings(selectorBlocks.map(removeDetailNoise), 120).join('\n');
}

function sliceFromClass(html: string, className: string, length = 2400): string {
  const classPattern = new RegExp(`class=["'][^"']*${className}[^"']*["']`, 'i');
  const match = classPattern.exec(html);
  if (!match || match.index < 0) return '';
  return html.slice(match.index, match.index + length);
}

function extractFirstPrice(text: string): number | null {
  const eurMatch = text.match(/€\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
  if (eurMatch?.[1]) {
    return parseOfficialPrice(eurMatch[1].replace(',', '.'));
  }

  return parseOfficialPrice(text);
}

function removeDetailNoise(text: string): string {
  return sanitizeFunFactoryDetailText(text);
}

export function sanitizeFunFactoryDetailText(text: string): string {
  return normalizeOfficialWhitespace(text)
    .split('\n')
    .filter((line) => {
      const normalized = line.trim();
      if (!normalized) return false;
      return ![
        /shipping|returns|refund|delivery/i,
        /^menge$/i,
        /^verringere die menge/i,
        /^erhöhe die menge/i,
        /^in den warenkorb/i,
        /^verfügbarkeit für abholungen konnte nicht geladen werden$/i,
        /^normal price$/i,
        /^sale price$/i,
        /^base price$/i,
        /^inkl\.?\s*mwst/i,
        /^zzgl\.?\s*versand/i,
        /^sold out$/i,
        /^ausverkauft$/i,
        /^class=/i,
        /^<form/i,
        /^\/\s*per$/i,
      ].some((pattern) => pattern.test(normalized));
    })
    .join('\n')
    .trim();
}

function normalizeCollectionPageUrl(input: string): string {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed, ORIGIN);
    if (!/\/collections\/alle-sextoys/i.test(url.pathname)) return '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function normalizeShopifyProducts(
  payload: ShopifyCatalogResponse | ShopifyProduct[] | null | undefined,
): ShopifyProduct[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.products)) return payload.products;
  return [];
}

function normalizeTags(tags: ShopifyProduct['tags']): string[] {
  if (Array.isArray(tags)) {
    return uniqueOfficialStrings(tags.map((value) => String(value || '')), 40);
  }
  return uniqueOfficialStrings(
    String(tags || '')
      .split(',')
      .map((value) => value.trim()),
    40,
  );
}

function resolveShopifyProductPrice(product: ShopifyProduct) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const firstVariant =
    variants.find((variant) => normalizeShopifyMoneyValue(variant.price) !== null) || variants[0];

  return {
    priceSourceAmount: normalizeShopifyMoneyValue(firstVariant?.price ?? null),
    originalPriceSourceAmount: normalizeShopifyMoneyValue(firstVariant?.compare_at_price ?? null),
  };
}

export function normalizeProductUrl(input: string): string {
  return normalizeOfficialProductUrl(input, ORIGIN);
}

export function shouldKeepFunFactoryCandidate(input: Record<string, unknown>): boolean {
  const haystack = [
    String(input.name || ''),
    String(input.subtitle || ''),
    String(input.rawDescription || ''),
  ]
    .join(' ')
    .toLowerCase();

  if (!haystack) return false;

  const blockedPatterns = [/\bgift\s*card\b/i, /\baccessories\b/i, /\bersatzteil\b/i];
  if (blockedPatterns.some((pattern) => pattern.test(haystack))) {
    return false;
  }

  const allowedPatterns = [
    /\btoy\b/i,
    /\banal\b/i,
    /\bvibrator\b/i,
    /\bvibra/i,
    /\bplug\b/i,
    /\bdildo\b/i,
    /\bstimulator\b/i,
    /\bsilicone\b/i,
    /\bsex\b/i,
    /analplug/i,
    /penisvibrator/i,
    /auflegevibrator/i,
    /g-punkt/i,
    /druckwellen/i,
    /buttplug/i,
  ];

  return allowedPatterns.some((pattern) => pattern.test(haystack));
}

export function extractListItemsFromHtml(html: string): FunFactoryListItem[] {
  const gridIndex = html.search(/id=["']product-grid["']/i);
  const gridHtml = gridIndex >= 0 ? html.slice(gridIndex) : html;
  const cardBlocks = Array.from(
    gridHtml.matchAll(
      /<(div|li)\b[^>]*class=["'][^"']*(?:card-wrapper|grid__item|product-card)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi,
    ),
  );
  const items: FunFactoryListItem[] = [];
  const seen = new Set<string>();

  for (const [index, match] of cardBlocks.entries()) {
    const block = String(match[0] || '');
    const sourceUrl = normalizeProductUrl(
      block.match(/<a\b[^>]*href=["']([^"']*\/products\/[^"']+)["']/i)?.[1] || '',
    );
    if (!sourceUrl || seen.has(sourceUrl)) continue;

    const inner = String(match[2] || '');
    const name =
      normalizeOfficialWhitespace(
        inner.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] ||
          block.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] ||
          inner.match(/aria-label=["']([^"']+)["']/i)?.[1] ||
          block.match(/aria-label=["']([^"']+)["']/i)?.[1] ||
          inner.match(/alt=["']([^"']+)["']/i)?.[1] ||
          block.match(/alt=["']([^"']+)["']/i)?.[1] ||
          '',
      ) || normalizeOfficialWhitespace(decodeHtml(block));
    const subtitle = normalizeOfficialWhitespace(
      block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ||
        block.match(/<div[^>]*class=["'][^"']*card-information[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
        '',
    );
    const coverImage = normalizeOfficialAssetUrl(
      block.match(/<img[^>]*src=["']([^"']+)["']/i)?.[1] || '',
      ORIGIN,
    );
    const priceSourceAmount = extractFirstPrice(block);
    const candidate = {
      sourceUrl,
      name: cleanFunFactoryProductName(name),
      subtitle,
      coverImage,
      priceSourceAmount,
      originalPriceSourceAmount: null,
      priceCurrency: 'EUR' as const,
      categoryHints: [] as string[],
      genderHint: 'unisex' as const,
      listPosition: index + 1,
    };

    if (!shouldKeepFunFactoryCandidate(candidate)) continue;
    seen.add(sourceUrl);
    items.push(candidate);
  }

  return items;
}

export function extractListItemsFromShopifyJson(
  payload: ShopifyCatalogResponse | ShopifyProduct[],
  positionOffset = 0,
): FunFactoryListItem[] {
  const products = normalizeShopifyProducts(payload);
  return products
    .map((product, index) => {
      const sourceUrl = normalizeProductUrl(`/products/${String(product.handle || '').trim()}`);
      const { priceSourceAmount, originalPriceSourceAmount } = resolveShopifyProductPrice(product);
      const subtitle =
        normalizeOfficialWhitespace(String(product.product_type || '')) ||
        normalizeOfficialWhitespace(String(product.body_html || ''));
      const categoryHints = uniqueOfficialStrings(
        [String(product.product_type || ''), ...normalizeTags(product.tags)],
        40,
      );

      return {
        sourceUrl,
        name: cleanFunFactoryProductName(normalizeOfficialWhitespace(String(product.title || ''))),
        subtitle,
        coverImage: normalizeOfficialAssetUrl(String(product.images?.[0]?.src || ''), ORIGIN),
        priceSourceAmount,
        originalPriceSourceAmount:
          originalPriceSourceAmount && originalPriceSourceAmount > priceSourceAmount!
            ? originalPriceSourceAmount
            : null,
        priceCurrency: 'EUR' as const,
        categoryHints,
        genderHint: 'unisex' as const,
        listPosition: positionOffset + index + 1,
      };
    })
    .filter((item) => item.sourceUrl && shouldKeepFunFactoryCandidate(item));
}

export function extractPaginationUrls(html: string): string[] {
  const paginationMatch = sliceFromClass(html, 'pagination', 4000);
  const urls = Array.from(
    paginationMatch.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi),
    (match) => normalizeCollectionPageUrl(match[1] || ''),
  ).filter(Boolean);

  return Array.from(new Set(urls));
}

function mergeUniqueListItems(items: FunFactoryListItem[]): FunFactoryListItem[] {
  const byUrl = new Map<string, FunFactoryListItem>();
  for (const item of items) {
    const sourceUrl = normalizeProductUrl(item.sourceUrl);
    if (!sourceUrl) continue;
    const existing = byUrl.get(sourceUrl);
    if (!existing) {
      byUrl.set(sourceUrl, {
        ...item,
        sourceUrl,
        categoryHints: uniqueOfficialStrings(item.categoryHints || [], 40),
      });
      continue;
    }

    const currentPosition = item.listPosition ?? Number.POSITIVE_INFINITY;
    const existingPosition = existing.listPosition ?? Number.POSITIVE_INFINITY;
    const preferred = currentPosition < existingPosition ? item : existing;

    byUrl.set(sourceUrl, {
      ...preferred,
      sourceUrl,
      name: preferred.name || existing.name || item.name,
      subtitle: preferred.subtitle || existing.subtitle || item.subtitle,
      coverImage: preferred.coverImage || existing.coverImage || item.coverImage,
      priceSourceAmount:
        preferred.priceSourceAmount ?? existing.priceSourceAmount ?? item.priceSourceAmount,
      originalPriceSourceAmount:
        preferred.originalPriceSourceAmount ??
        existing.originalPriceSourceAmount ??
        item.originalPriceSourceAmount,
      categoryHints: uniqueOfficialStrings(
        [...(existing.categoryHints || []), ...(item.categoryHints || [])],
        40,
      ),
    });
  }

  return Array.from(byUrl.values()).sort(
    (a, b) => (a.listPosition ?? 1e9) - (b.listPosition ?? 1e9),
  );
}

export async function crawlCollectionPages(input: {
  maxItems?: number;
  fetchCollectionHtml: (url: string) => Promise<string>;
  fetchCollectionJsonPage: (page: number) => Promise<ShopifyCatalogResponse>;
}): Promise<FunFactoryListItem[]> {
  const maxItems = input.maxItems ?? MAX_ITEMS;
  const merged: FunFactoryListItem[] = [];

  try {
    const firstHtml = await input.fetchCollectionHtml(LIST_URL);
    merged.push(...extractListItemsFromHtml(firstHtml));

    const paginationUrls = extractPaginationUrls(firstHtml).filter((url) => url !== LIST_URL);
    for (const pageUrl of paginationUrls) {
      if (merged.length >= maxItems) break;
      try {
        const pageHtml = await input.fetchCollectionHtml(pageUrl);
        merged.push(...extractListItemsFromHtml(pageHtml));
      } catch {}
    }
  } catch {}

  const jsonItems: FunFactoryListItem[] = [];
  for (let page = 1; jsonItems.length < maxItems; page += 1) {
    try {
      const payload = await input.fetchCollectionJsonPage(page);
      const products = normalizeShopifyProducts(payload);
      if (products.length === 0) break;
      jsonItems.push(...extractListItemsFromShopifyJson(products, jsonItems.length));
      if (products.length < 250) break;
    } catch {
      break;
    }
  }

  merged.push(...jsonItems);
  return mergeUniqueListItems(merged).slice(0, maxItems);
}

export function extractDetailFromShopifyProduct(product: ShopifyProduct): FunFactoryProductDetail {
  const { priceSourceAmount, originalPriceSourceAmount } = resolveShopifyProductPrice(product);
  const rawDescription = uniqueOfficialStrings(
    [
      normalizeOfficialWhitespace(String(product.product_type || '')),
      normalizeOfficialWhitespace(String(product.body_html || '')),
    ],
    120,
  ).join('\n');

  return {
    title: cleanFunFactoryProductName(normalizeOfficialWhitespace(String(product.title || ''))),
    subtitle: normalizeOfficialWhitespace(String(product.product_type || '')),
    metaTitle: cleanFunFactoryProductName(normalizeOfficialWhitespace(String(product.title || ''))),
    metaDescription: '',
    priceSourceAmount,
    originalPriceSourceAmount:
      originalPriceSourceAmount && originalPriceSourceAmount > priceSourceAmount!
        ? originalPriceSourceAmount
        : null,
    priceCurrency: 'EUR',
    coverImage: normalizeOfficialAssetUrl(String(product.images?.[0]?.src || ''), ORIGIN),
    galleryImages: uniqueOfficialStrings(
      (product.images || []).map((image) =>
        normalizeOfficialAssetUrl(String(image?.src || ''), ORIGIN),
      ),
      30,
    ),
    rawDescription,
  };
}

export function extractDetailFromHtml(html: string, sourceUrl: string): FunFactoryProductDetail {
  const productInfoSlice = sliceFromClass(html, 'product__info-container');
  const rawDescription =
    extractDetailTextFromHtmlBySelectors(html) ||
    uniqueOfficialStrings([productInfoSlice].filter(Boolean).map(removeDetailNoise), 120).join('\n');
  const title =
    normalizeOfficialWhitespace(
      html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
        html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
        html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
        '',
    ) || sourceUrl;
  const metaTitle = normalizeOfficialWhitespace(
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || title,
  );
  const metaDescription = normalizeOfficialWhitespace(
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] || '',
  );
  const subtitle = normalizeOfficialWhitespace(
    html.match(/<div[^>]*class=["'][^"']*product__info-container[^"']*["'][^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ||
      '',
  );
  const coverImage = normalizeOfficialAssetUrl(
    html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<img[^>]*src=["']([^"']+)["']/i)?.[1] ||
      '',
    ORIGIN,
  );
  const galleryImages = uniqueOfficialStrings(
    matchAllValues(/<img[^>]*src=["']([^"']+)["']/gi, html).map((value) =>
      normalizeOfficialAssetUrl(value, ORIGIN),
    ),
    30,
  );
  const priceSourceAmount = extractFirstPrice(
    rawDescription || html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html,
  );

  return {
    title,
    subtitle,
    metaTitle,
    metaDescription,
    priceSourceAmount,
    originalPriceSourceAmount: null,
    priceCurrency: 'EUR',
    coverImage,
    galleryImages,
    rawDescription,
  };
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: REQUEST_HEADERS });
  if (!response.ok) {
    throw new Error(`[funfactory-official] 请求失败 ${response.status}: ${url}`);
  }
  return await response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { ...REQUEST_HEADERS, accept: 'application/json,text/plain;q=0.9,*/*;q=0.8' },
  });
  if (!response.ok) {
    throw new Error(`[funfactory-official] JSON 请求失败 ${response.status}: ${url}`);
  }
  return (await response.json()) as T;
}

async function fetchProductJson(handle: string): Promise<ShopifyProduct> {
  return await fetchJson<ShopifyProduct>(`${ORIGIN}/products/${handle}.js`);
}

async function crawlFunFactoryOfficial() {
  const listItems = await crawlCollectionPages({
    maxItems: MAX_ITEMS,
    fetchCollectionHtml: (url) => fetchText(url),
    fetchCollectionJsonPage: (page) =>
      fetchJson<ShopifyCatalogResponse>(`${COLLECTION_JSON_URL}?limit=250&page=${page}`),
  });
  const results: FunFactoryReviewBufferItem[] = [];

  for (const item of listItems) {
    const handle = item.sourceUrl.match(/\/products\/([^/?#]+)/i)?.[1] || '';
    let jsonDetail: FunFactoryProductDetail | null = null;
    if (handle) {
      try {
        jsonDetail = extractDetailFromShopifyProduct(await fetchProductJson(handle));
      } catch (error) {
        console.warn(
          `[funfactory-official] Shopify JSON 抓取失败，改用 HTML 兜底: ${item.sourceUrl}`,
          error,
        );
      }
    }
    let htmlDetail: FunFactoryProductDetail | null = null;
    try {
      const detailHtml = await fetchText(item.sourceUrl);
      htmlDetail = extractDetailFromHtml(detailHtml, item.sourceUrl);
    } catch (error) {
      console.warn(
        `[funfactory-official] 详情页抓取失败，改用 Shopify JSON 兜底: ${item.sourceUrl}`,
        error,
      );
    }
    const detail = {
      ...(htmlDetail || {
        title: item.name,
        subtitle: item.subtitle,
        metaTitle: item.name,
        metaDescription: '',
        priceSourceAmount: item.priceSourceAmount,
        originalPriceSourceAmount: item.originalPriceSourceAmount,
        priceCurrency: 'EUR' as const,
        coverImage: item.coverImage,
        galleryImages: [],
        rawDescription: '',
      }),
      ...jsonDetail,
      rawDescription: uniqueOfficialStrings(
        [jsonDetail?.rawDescription, htmlDetail?.rawDescription],
        120,
      ).join('\n'),
      galleryImages: uniqueOfficialStrings(
        [...(jsonDetail?.galleryImages || []), ...(htmlDetail?.galleryImages || [])],
        30,
      ),
      coverImage: jsonDetail?.coverImage || htmlDetail?.coverImage || item.coverImage,
      title: jsonDetail?.title || htmlDetail?.title || item.name,
      subtitle: jsonDetail?.subtitle || htmlDetail?.subtitle || item.subtitle,
      metaTitle: jsonDetail?.metaTitle || htmlDetail?.metaTitle || item.name,
      metaDescription: htmlDetail?.metaDescription || '',
      priceSourceAmount:
        jsonDetail?.priceSourceAmount ?? htmlDetail?.priceSourceAmount ?? item.priceSourceAmount,
      originalPriceSourceAmount:
        jsonDetail?.originalPriceSourceAmount ??
        htmlDetail?.originalPriceSourceAmount ??
        item.originalPriceSourceAmount,
      priceCurrency: 'EUR' as const,
    };
    results.push({
      ...item,
      ...detail,
      name: cleanFunFactoryProductName(detail.title || item.name),
      subtitle: detail.subtitle || item.subtitle,
      priceSourceAmount: detail.priceSourceAmount ?? item.priceSourceAmount,
      originalPriceSourceAmount:
        detail.originalPriceSourceAmount ?? item.originalPriceSourceAmount,
      coverImage: detail.coverImage || item.coverImage,
      isReviewed: false,
    });
  }

  fs.mkdirSync(path.dirname(BUFFER_PATH), { recursive: true });
  fs.writeFileSync(BUFFER_PATH, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  console.log(`[funfactory-official] 已写入 ${results.length} 条到 ${BUFFER_PATH}`);

  const { default: runCleaner } = await import(CLEANER_MODULE_PATH);
  if (typeof runCleaner === 'function') {
    await runCleaner();
  }
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  crawlFunFactoryOfficial().catch((error) => {
    console.error('[funfactory-official] 执行失败:', error);
    process.exitCode = 1;
  });
}

export default crawlFunFactoryOfficial;
