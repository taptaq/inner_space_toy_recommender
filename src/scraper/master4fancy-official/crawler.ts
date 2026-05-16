import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ORIGIN = 'https://master4fancy.com';
export const LIST_URL = `${ORIGIN}/collections/inventory`;
export const BUFFER_PATH = path.resolve(__dirname, '../../data/master4fancy-official-review-buffer.json');
export const DEFAULT_MAX_ITEMS = 200;
const CLEANER_MODULE_PATH = './cleaner.ts';
const MAX_OCR_IMAGES = Number(process.env.MASTER4FANCY_OFFICIAL_MAX_OCR_IMAGES || '6');
const DETAIL_OCR_PROMPT = `你是一个专业的成人用品详情图识别助手。你会收到同一款商品详情中的说明图片，请只提取图片里清晰可见、可确认的商品信息。

请使用中文输出，内容尽量结构化，重点包括：
1. 产品名称/系列
2. 尺寸或规格
3. 材质/硬度/工艺
4. 使用方式或定位
5. 视觉中出现的重点卖点

注意：
- 只提取图片里明确出现的信息，不要脑补。
- 如果某项没有写，就不要编造。
- 不要输出 markdown 代码块。`;

type EnvSource = Record<string, string | undefined>;
type Logger = (message: string) => void;

export type Master4FancyListItem = {
  sourceUrl: string;
  name: string;
  subtitle: string;
  coverImage: string;
  priceUsd: number | null;
  originalPriceUsd: number | null;
  priceCurrency: 'USD';
  categoryHints: string[];
  genderHint: 'female' | 'male' | 'unisex';
  stock: 'in_stock' | 'sold_out';
  listPosition: number | null;
};

export type Master4FancyCrawlerRuntimeOptions = {
  maxItems: number;
  listSettleMs: number;
  pageSettleMs: number;
  detailSettleMs: number;
  detailDelayMs: number;
  verbose: boolean;
};

export type Master4FancyProductDetail = {
  title: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  priceUsd: number | null;
  originalPriceUsd: number | null;
  coverImage: string;
  galleryImages: string[];
  rawDescription: string;
  descriptionImageUrls?: string[];
};

export type Master4FancyOcrImageFetchResult = {
  url: string;
  dataUrl: string | null;
  reachable: boolean;
  statusCode: number | null;
};

export type Master4FancyReviewBufferItem = Master4FancyListItem &
  Master4FancyProductDetail & {
    detailImageUrls: string[];
    isReviewed: false;
  };

function normalizeWhitespace(value: string): string {
  return decodeHtml(String(value || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
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

function stripTags(value: string): string {
  return normalizeWhitespace(value);
}

function parseIntegerEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === '') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  return fallback;
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

function normalizeInventoryPageUrl(input: string): string {
  const trimmed = String(input || '').trim();
  if (!trimmed) return LIST_URL;

  try {
    const url = new URL(trimmed, ORIGIN);
    url.protocol = 'https:';
    url.host = 'master4fancy.com';
    url.pathname = '/collections/inventory';
    const page = Number(url.searchParams.get('page') || '1');
    url.search = page > 1 ? `?page=${page}` : '';
    url.hash = '';
    return url.toString();
  } catch {
    return LIST_URL;
  }
}

function extractAttributeValue(tag: string, attributeName: string): string {
  const pattern = new RegExp(`\\b${attributeName}\\s*=\\s*(['"])([\\s\\S]*?)\\1`, 'i');
  return decodeHtml(tag.match(pattern)?.[2] || '').trim();
}

function parseSrcsetCandidates(value: string): string[] {
  return decodeHtml(String(value || ''))
    .split(',')
    .map((entry) => entry.trim().split(/\s+/)[0] || '')
    .filter(Boolean);
}

function parsePriceUsd(value: string): number | null {
  const match = decodeHtml(String(value || '')).match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function uniqueStrings(values: Array<string | null | undefined>, limit = Number.POSITIVE_INFINITY): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = stripTags(String(value || ''));
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }

  return result;
}

function sanitizeRawDescriptionText(text: string): string {
  return String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => !(line.trim() === '' && lines[index - 1]?.trim() === ''))
    .join('\n')
    .trim();
}

async function fetchImageAsDataUrl(url: string): Promise<Master4FancyOcrImageFetchResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
    if (!response.ok) {
      console.warn(`[master4fancy-official][OCR] 跳过说明图(${response.status}): ${url}`);
      return {
        url,
        dataUrl: null,
        reachable: false,
        statusCode: response.status,
      };
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      console.warn(`[master4fancy-official][OCR] 跳过空说明图: ${url}`);
      return {
        url,
        dataUrl: null,
        reachable: false,
        statusCode: response.status,
      };
    }
    return {
      url,
      dataUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
      reachable: true,
      statusCode: response.status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[master4fancy-official][OCR] 说明图下载失败: ${url}${message ? ` (${message})` : ''}`);
    return {
      url,
      dataUrl: null,
      reachable: false,
      statusCode: null,
    };
  }
}

async function ocrWithQwenVL(imageInputs: string[], prompt: string): Promise<string> {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) throw new Error('QWEN_API_KEY 未配置');

  const openai = new OpenAI({
    apiKey,
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  });

  const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
    { type: 'text', text: prompt },
  ];
  imageInputs.forEach((url) => {
    content.push({ type: 'image_url', image_url: { url } });
  });

  const response = await openai.chat.completions.create({
    model: 'qwen-vl-plus',
    messages: [{ role: 'user', content }],
    temperature: 0.1,
  });

  return String(response.choices[0]?.message?.content || '').trim();
}

async function ocrWithGLMV(imageInputs: string[], prompt: string): Promise<string> {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) throw new Error('GLM_API_KEY 未配置');

  const glm = new OpenAI({
    apiKey,
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
  });

  const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
    { type: 'text', text: prompt },
  ];
  imageInputs.slice(0, MAX_OCR_IMAGES).forEach((url) => {
    content.push({ type: 'image_url', image_url: { url } });
  });

  const response = await glm.chat.completions.create({
    model: 'glm-4.6v',
    messages: [{ role: 'user', content }],
    temperature: 0.1,
  });

  return String(response.choices[0]?.message?.content || '').trim();
}

export async function orchestrateMaster4FancyDetailOcr(
  imageUrls: string[],
  productName: string,
): Promise<{ ocrText: string; reachableImageUrls: string[] }> {
  const candidateUrls = uniqueStrings(imageUrls, MAX_OCR_IMAGES);
  if (candidateUrls.length === 0) {
    return {
      ocrText: '',
      reachableImageUrls: [],
    };
  }

  const imageFetchResults = await Promise.all(candidateUrls.map((url) => fetchImageAsDataUrl(url)));
  const reachableImageUrls = uniqueStrings(
    imageFetchResults.filter((result) => result.reachable).map((result) => result.url),
    MAX_OCR_IMAGES,
  );
  const imageInputs = imageFetchResults
    .map((result) => result.dataUrl)
    .filter((value): value is string => Boolean(value));
  if (!process.env.GLM_API_KEY && !process.env.QWEN_API_KEY) {
    return {
      ocrText: '',
      reachableImageUrls,
    };
  }
  if (imageInputs.length === 0) {
    return {
      ocrText: '',
      reachableImageUrls,
    };
  }

  const prompt = `${DETAIL_OCR_PROMPT}\n\n商品标题参考：${productName}`;

  try {
    const glmResult = await ocrWithGLMV(imageInputs, prompt);
    if (glmResult.length >= 20) {
      return {
        ocrText: glmResult,
        reachableImageUrls,
      };
    }
    throw new Error('GLM 返回内容过短或为空');
  } catch (error: any) {
    console.warn(`[master4fancy-official][OCR] GLM-4.6V 失败 (${error?.message || error})，尝试 Qwen-VL...`);
  }

  try {
    const qwenResult = await ocrWithQwenVL(imageInputs, prompt);
    if (qwenResult.length >= 20) {
      return {
        ocrText: qwenResult,
        reachableImageUrls,
      };
    }
    throw new Error('Qwen 返回内容过短或为空');
  } catch (error) {
    console.warn(`[master4fancy-official][OCR] Qwen-VL 失败: ${error}`);
    return {
      ocrText: '',
      reachableImageUrls,
    };
  }
}

export function buildMaster4FancyRawDescription({
  rawDescription,
  metaDescription,
  ocrText,
}: {
  rawDescription: string;
  metaDescription: string;
  ocrText?: string;
}): string {
  const normalizedOcrText = sanitizeRawDescriptionText(ocrText || '');
  const sections = uniqueStrings([
    rawDescription,
    metaDescription,
    normalizedOcrText ? `[图文OCR]\n${normalizedOcrText}` : null,
  ]);

  return sections.join('\n').trim();
}

function findFirstCapture(input: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const value = input.match(pattern)?.[1];
    if (value) {
      return stripTags(value);
    }
  }

  return '';
}

function extractProductGridHtml(html: string): string {
  const openMatch = html.match(/<(?<tag>[a-z0-9:-]+)[^>]*id="product-grid"[^>]*>/i);
  if (!openMatch || !openMatch.groups?.tag) {
    return '';
  }

  const openingTag = openMatch[0];
  const tagName = openMatch.groups.tag;
  const startIndex = (openMatch.index ?? 0) + openingTag.length;
  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tagPattern.lastIndex = startIndex;

  let depth = 1;
  let match: RegExpExecArray | null;

  while (depth > 0 && (match = tagPattern.exec(html))) {
    depth += match[0].startsWith(`</${tagName}`) ? -1 : 1;
    if (depth === 0) {
      return html.slice(startIndex, match.index);
    }
  }

  return html.slice(startIndex);
}

function extractGridItemBlocks(html: string): string[] {
  const openings = Array.from(html.matchAll(/<div[^>]*class="[^"]*\bgrid__item\b[^"]*"[^>]*>/gi));
  return openings.map((match, index) => {
    const start = match.index ?? 0;
    const end = openings[index + 1]?.index ?? html.length;
    return html.slice(start, end);
  });
}

function resolveListItemName(block: string, href: string): string {
  const directName =
    findFirstCapture(block, [
      /<h3[^>]*>([\s\S]*?)<\/h3>/i,
      /<h2[^>]*>([\s\S]*?)<\/h2>/i,
      /<img[^>]+alt="([^"]+)"/i,
    ]) || '';

  if (directName) {
    return directName;
  }

  const anchorText = stripTags(block);
  if (anchorText) {
    return anchorText
      .replace(/\b\d+\s+reviews?\b/gi, '')
      .replace(/\bno reviews?\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const slug = normalizeProductUrl(href).split('/products/')[1] || '';
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function sanitizeFallbackName(value: string): string {
  return stripTags(value)
    .replace(/\b\d+\s+reviews?\b/gi, '')
    .replace(/\bno reviews?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveFallbackName(anchors: Array<{ innerHtml: string }>, segment: string, href: string): string {
  for (const anchor of anchors) {
    const text = sanitizeFallbackName(anchor.innerHtml);
    if (text) {
      return text;
    }
  }

  const altText = sanitizeFallbackName(segment.match(/<img[^>]+alt=(['"])([\s\S]*?)\1/i)?.[2] || '');
  if (altText) {
    return altText;
  }

  return resolveListItemName(segment, href);
}

function resolveFallbackSubtitle(segment: string, name: string): string {
  const blockMatches = Array.from(segment.matchAll(/<(?:p|div|span)[^>]*>([\s\S]*?)<\/(?:p|div|span)>/gi));

  for (const match of blockMatches) {
    const text = stripTags(match[1] || '')
      .replace(/\b\d+\s+reviews?\b/gi, '')
      .replace(/\bno reviews?\b/gi, '')
      .replace(/\$\s*-?\d+(?:\.\d+)?/g, '')
      .replace(/~+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text || text === name) continue;
    return text;
  }

  return '';
}

function resolveListItemSubtitle(block: string, name: string): string {
  const subtitle = findFirstCapture(block, [/<p[^>]*>([\s\S]*?)<\/p>/i]);
  return subtitle && subtitle !== name ? subtitle : '';
}

function resolveListItemImage(block: string): string {
  const imageTag = block.match(/<img\b[^>]*>/i)?.[0] || '';
  if (!imageTag) return '';

  const preferredSources = [
    extractAttributeValue(imageTag, 'data-src'),
    parseSrcsetCandidates(extractAttributeValue(imageTag, 'data-srcset'))[0] || '',
    parseSrcsetCandidates(extractAttributeValue(imageTag, 'srcset'))[0] || '',
    extractAttributeValue(imageTag, 'src'),
  ];

  return normalizeAssetUrl(preferredSources.find(Boolean) || '');
}

function buildCandidateText(input: Record<string, unknown>): string {
  return [
    typeof input.name === 'string' ? input.name : '',
    typeof input.subtitle === 'string' ? input.subtitle : '',
    typeof input.rawDescription === 'string' ? input.rawDescription : '',
  ]
    .join(' ')
    .toLowerCase();
}

function isBlockedMaster4FancyCandidate(input: Record<string, unknown>): boolean {
  const haystack = buildCandidateText(input);
  if (!haystack) return false;

  const blockedPatterns = [
    /\blucky bag\b/i,
    /\bmystery bundle\b/i,
    /\bplay mat\b/i,
    /\bdecorative\b/i,
    /\bmerch\b/i,
    /\bsquish(?:y|ies)?\b/i,
    /\bpin\b/i,
    /\bsticker\b/i,
    /\bkeychain\b/i,
    /\bposter\b/i,
    /\bprint\b/i,
  ];
  return blockedPatterns.some((pattern) => pattern.test(haystack));
}

function toListItem(
  partial: Omit<Master4FancyListItem, 'categoryHints' | 'genderHint' | 'priceCurrency' | 'stock'> &
    Partial<Pick<Master4FancyListItem, 'categoryHints' | 'genderHint' | 'priceCurrency' | 'stock'>>,
): Master4FancyListItem {
  return {
    ...partial,
    priceCurrency: partial.priceCurrency || 'USD',
    categoryHints: partial.categoryHints || [],
    genderHint: partial.genderHint || 'unisex',
    stock: partial.stock || 'in_stock',
  };
}

function parseStructuredBlock(block: string, index: number): Master4FancyListItem | null {
  const href = findFirstCapture(block, [/<a[^>]+href="([^"]*\/products\/[^"]*)"/i]);
  const sourceUrl = normalizeProductUrl(href);
  if (!sourceUrl) return null;

  const name = resolveListItemName(block, href);
  const subtitle = resolveListItemSubtitle(block, name);
  const coverImage = resolveListItemImage(block);
  const priceUsd =
    parsePriceUsd(
      findFirstCapture(block, [
        /<(?:span|div)[^>]*class="[^"]*price-item--sale[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i,
        /<(?:span|div)[^>]*class="[^"]*price-item[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/i,
      ]),
    ) ?? null;
  const originalPriceUsd =
    parsePriceUsd(
      findFirstCapture(block, [/<(?:span|div|s)[^>]*class="[^"]*price-item--regular[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|s)>/i]),
    ) ?? null;

  return toListItem({
    sourceUrl,
    name,
    subtitle,
    coverImage,
    priceUsd,
    originalPriceUsd,
    listPosition: index + 1,
  });
}

function parseFallbackBlocks(gridHtml: string): Master4FancyListItem[] {
  const linkPattern = /<a\b[^>]*href=(['"])([^'"]*\/products\/[^'"]*)\1[^>]*>([\s\S]*?)<\/a>/gi;
  const fallbackAnchors = Array.from(gridHtml.matchAll(linkPattern)).map((match) => ({
    start: match.index ?? 0,
    href: match[2] || '',
    innerHtml: match[3] || '',
    sourceUrl: normalizeProductUrl(match[2] || ''),
  }));
  const byUrl = new Map<string, Master4FancyListItem>();
  const groupedAnchorsByUrl = new Map<string, Array<{ innerHtml: string }>>();

  for (const anchor of fallbackAnchors) {
    if (!anchor.sourceUrl) continue;
    const existing = groupedAnchorsByUrl.get(anchor.sourceUrl) || [];
    existing.push({ innerHtml: anchor.innerHtml });
    groupedAnchorsByUrl.set(anchor.sourceUrl, existing);
  }

  for (const [index, anchor] of fallbackAnchors.entries()) {
    if (!anchor?.sourceUrl) {
      continue;
    }

    const nextStart = fallbackAnchors[index + 1]?.start ?? gridHtml.length;
    const segment = gridHtml.slice(anchor.start, nextStart);
    const priceMatches = Array.from(segment.matchAll(/\$-?\d+(?:\.\d+)?/g)).map((entry) => parsePriceUsd(entry[0]));
    const cleanPrices = priceMatches.filter((value): value is number => value != null);
    const groupedAnchors = groupedAnchorsByUrl.get(anchor.sourceUrl) || [{ innerHtml: anchor.innerHtml }];
    const resolvedName = resolveFallbackName(groupedAnchors, segment, anchor.href);
    const candidate = toListItem({
      sourceUrl: anchor.sourceUrl,
      name: resolvedName,
      subtitle: resolveFallbackSubtitle(segment, resolvedName),
      coverImage: resolveListItemImage(segment),
      priceUsd: cleanPrices[0] ?? null,
      originalPriceUsd: cleanPrices[1] ?? null,
      listPosition: index + 1,
    });
    const existing = byUrl.get(anchor.sourceUrl);

    if (!existing) {
      byUrl.set(anchor.sourceUrl, candidate);
      continue;
    }

    const mergedOriginalPriceUsd =
      existing.originalPriceUsd ??
      candidate.originalPriceUsd ??
      (existing.priceUsd != null &&
      candidate.priceUsd != null &&
      candidate.priceUsd !== existing.priceUsd
        ? candidate.priceUsd
        : null);

    byUrl.set(anchor.sourceUrl, {
      ...existing,
      name: existing.name || candidate.name,
      subtitle: existing.subtitle || candidate.subtitle,
      coverImage: existing.coverImage || candidate.coverImage,
      priceUsd: existing.priceUsd ?? candidate.priceUsd,
      originalPriceUsd: mergedOriginalPriceUsd,
      listPosition: Math.min(existing.listPosition ?? Number.POSITIVE_INFINITY, candidate.listPosition ?? Number.POSITIVE_INFINITY),
    });
  }

  return Array.from(byUrl.values()).sort(
    (left, right) => (left.listPosition ?? Number.POSITIVE_INFINITY) - (right.listPosition ?? Number.POSITIVE_INFINITY),
  );
}

function reindexListPositions(items: Master4FancyListItem[]): Master4FancyListItem[] {
  return items.map((item, index) => ({ ...item, listPosition: index + 1 }));
}

function normalizeDetail(detail: Master4FancyProductDetail): Master4FancyProductDetail {
  return {
    ...detail,
    title: stripTags(detail.title),
    subtitle: stripTags(detail.subtitle),
    metaTitle: stripTags(detail.metaTitle),
    metaDescription: stripTags(detail.metaDescription),
    rawDescription: stripTags(detail.rawDescription),
    coverImage: normalizeAssetUrl(detail.coverImage),
    galleryImages: uniqueStrings(detail.galleryImages.map((value) => normalizeAssetUrl(value))),
    descriptionImageUrls: uniqueStrings((detail.descriptionImageUrls || []).map((value) => normalizeAssetUrl(value))),
  };
}

function ensureDir(filePath: string) {
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logProgress(runtime: Master4FancyCrawlerRuntimeOptions, message: string, logger: Logger = console.log) {
  if (runtime.verbose) {
    logger(`[master4fancy-official] ${message}`);
  }
}

async function createContext(): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 2200 },
    locale: 'en-US',
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  await context.route('**/*', async (route) => {
    const resourceType = route.request().resourceType();
    if (resourceType === 'media' || resourceType === 'font') {
      await route.abort();
      return;
    }

    await route.continue();
  });

  return { browser, context };
}

async function closeContext(session: { browser: Browser; context: BrowserContext } | null) {
  if (!session) return;
  await session.context.close().catch(() => {});
  await session.browser.close().catch(() => {});
}

export async function withClosablePage<T>(
  page: Pick<Page, 'close'>,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } finally {
    await page.close().catch(() => {});
  }
}

async function loadListPage(page: Page, url: string, settleMs: number) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(settleMs);
}

async function resolveDetailFromPage(page: Page): Promise<Master4FancyProductDetail> {
  const extracted = normalizeDetail((await page.evaluate(buildDetailExtractionScript())) as Master4FancyProductDetail);
  const { ocrText, reachableImageUrls } = await orchestrateMaster4FancyDetailOcr(
    extracted.descriptionImageUrls || [],
    extracted.title || extracted.metaTitle || 'Master4Fancy detail',
  );

  return {
    ...extracted,
    descriptionImageUrls: reachableImageUrls,
    rawDescription: buildMaster4FancyRawDescription({
      rawDescription: extracted.rawDescription,
      metaDescription: extracted.metaDescription,
      ocrText,
    }),
  };
}

async function runCleanerIfAvailable() {
  try {
    const cleanerModule = await import(CLEANER_MODULE_PATH);
    if (typeof cleanerModule.runCleaner === 'function') {
      return cleanerModule.runCleaner();
    }
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

export function normalizeProductUrl(input: string): string {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';

  let url: URL;
  try {
    url = new URL(trimmed, ORIGIN);
  } catch {
    return '';
  }

  url.protocol = 'https:';
  url.host = 'master4fancy.com';
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/collections\/[^/]+\/products\//i, '/products/').replace(/\/+$/, '') || '/';
  return url.toString();
}

export function shouldKeepMaster4FancyCandidate(input: Record<string, unknown>): boolean {
  const haystack = buildCandidateText(input);
  if (!haystack) return false;

  if (isBlockedMaster4FancyCandidate(input)) {
    return false;
  }

  const sourceUrl = normalizeProductUrl(String(input.sourceUrl || ''));
  const allowedPatterns = [
    /\bdildo\b/i,
    /\btoy\b/i,
    /\binsertable\b/i,
    /\begg\b/i,
    /\bmold\b/i,
    /\baccessory\b/i,
    /\bharness\b/i,
    /\bapparel\b/i,
    /\bwear\b/i,
    // Some Master4Fancy fallback links expose only the product name with no subtitle/body text.
    /\breaper\b/i,
  ];
  if (allowedPatterns.some((pattern) => pattern.test(haystack))) {
    return true;
  }

  // The inventory collection is mostly valid toy/apparel/accessory SKUs whose titles
  // are often universe-style proper nouns rather than generic category words.
  // After explicitly blocking weak merch, default to keeping remaining product cards.
  return Boolean(sourceUrl);
}

export function extractListItemsFromHtml(html: string): Master4FancyListItem[] {
  const gridHtml = extractProductGridHtml(html);
  if (!gridHtml) return [];

  const structuredBlocks = extractGridItemBlocks(gridHtml);
  if (structuredBlocks.length > 0) {
    const candidates = structuredBlocks
      .map((block, index) => parseStructuredBlock(block, index))
      .filter((item): item is Master4FancyListItem => item != null);

    return candidates.filter((item) => shouldKeepMaster4FancyCandidate(item));
  }

  return parseFallbackBlocks(gridHtml).filter((item) => shouldKeepMaster4FancyCandidate(item));
}

export function extractPaginationUrlsFromHtml(html: string): string[] {
  const pageNumbers = new Set<number>();
  const linkPattern = /<a\b[^>]*href=(['"])([^'"]*\/collections\/inventory[^'"]*)\1[^>]*>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[2] || '';
    try {
      const url = new URL(href, ORIGIN);
      if (!/\/collections\/inventory\/?$/.test(url.pathname)) continue;
      const page = Number(url.searchParams.get('page') || '1');
      if (Number.isFinite(page) && page > 0) {
        pageNumbers.add(Math.floor(page));
      }
    } catch {
      continue;
    }
  }

  if (pageNumbers.size === 0) {
    return [LIST_URL];
  }

  pageNumbers.add(1);

  return Array.from(pageNumbers)
    .sort((left, right) => left - right)
    .map((page) => normalizeInventoryPageUrl(page > 1 ? `${LIST_URL}?page=${page}` : LIST_URL));
}

export function mergeUniqueListItems(items: Master4FancyListItem[]): Master4FancyListItem[] {
  const byUrl = new Map<string, Master4FancyListItem>();

  for (const item of items) {
    const sourceUrl = normalizeProductUrl(item.sourceUrl);
    if (!sourceUrl) continue;

    const existing = byUrl.get(sourceUrl);
    if (!existing) {
      byUrl.set(sourceUrl, {
        ...item,
        sourceUrl,
        categoryHints: uniqueStrings(item.categoryHints || []),
      });
      continue;
    }

    const itemPosition = item.listPosition ?? Number.POSITIVE_INFINITY;
    const existingPosition = existing.listPosition ?? Number.POSITIVE_INFINITY;
    const preferred = itemPosition < existingPosition ? item : existing;

    byUrl.set(sourceUrl, {
      ...preferred,
      sourceUrl,
      subtitle: preferred.subtitle || existing.subtitle || item.subtitle,
      coverImage: preferred.coverImage || existing.coverImage || item.coverImage,
      priceUsd: preferred.priceUsd ?? existing.priceUsd ?? item.priceUsd,
      originalPriceUsd: preferred.originalPriceUsd ?? existing.originalPriceUsd ?? item.originalPriceUsd,
      stock: preferred.stock || existing.stock || item.stock,
      categoryHints: uniqueStrings([...(existing.categoryHints || []), ...(item.categoryHints || [])]),
    });
  }

  return Array.from(byUrl.values()).sort(
    (left, right) => (left.listPosition ?? Number.POSITIVE_INFINITY) - (right.listPosition ?? Number.POSITIVE_INFINITY),
  );
}

function normalizeSeriesText(value: string): string {
  return decodeURIComponent(String(value || ''))
    .toLowerCase()
    .replace(/[–—]+/g, '-')
    .replace(/[_-]+/g, ' ')
    .replace(/\b(?:副本|复制|copy)\b/g, ' ')
    .replace(/:.*$/g, '')
    .replace(/\b(?:small|medium|large)(?:\s+size)?\b.*$/i, '')
    .replace(/\b\d{2}(?:\s*[- ]\s*\d{2})\b.*$/i, '')
    .replace(/\bnc\s*\d+\b.*$/i, '')
    .replace(/\b\d+a\b.*$/i, '')
    .replace(/\bone size\b.*$/i, '')
    .replace(/\bsoft\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function deriveMaster4FancySeriesKey(input: Pick<Master4FancyListItem, 'name' | 'sourceUrl'>): string {
  const normalizedName = normalizeSeriesText(input.name || '');
  if (normalizedName) return normalizedName;

  const normalizedUrl = normalizeProductUrl(input.sourceUrl || '');
  const slug = decodeURIComponent(normalizedUrl.split('/products/')[1] || '');
  return normalizeSeriesText(slug);
}

export function collapseDuplicateMaster4FancySeries(items: Master4FancyListItem[]): Master4FancyListItem[] {
  const bySeries = new Map<string, Master4FancyListItem>();

  for (const item of items) {
    const seriesKey = deriveMaster4FancySeriesKey(item) || normalizeProductUrl(item.sourceUrl);
    if (!seriesKey) continue;

    const existing = bySeries.get(seriesKey);
    if (!existing) {
      bySeries.set(seriesKey, {
        ...item,
        categoryHints: uniqueStrings(item.categoryHints || []),
      });
      continue;
    }

    const itemPosition = item.listPosition ?? Number.POSITIVE_INFINITY;
    const existingPosition = existing.listPosition ?? Number.POSITIVE_INFINITY;
    const preferred = itemPosition < existingPosition ? item : existing;
    const fallback = preferred === item ? existing : item;

    bySeries.set(seriesKey, {
      ...preferred,
      sourceUrl: preferred.sourceUrl || fallback.sourceUrl,
      name: preferred.name || fallback.name,
      subtitle: preferred.subtitle || fallback.subtitle,
      coverImage: preferred.coverImage || fallback.coverImage,
      priceUsd: preferred.priceUsd ?? fallback.priceUsd,
      originalPriceUsd: preferred.originalPriceUsd ?? fallback.originalPriceUsd,
      stock: preferred.stock || fallback.stock,
      categoryHints: uniqueStrings([...(preferred.categoryHints || []), ...(fallback.categoryHints || [])]),
      listPosition: Math.min(existingPosition, itemPosition),
    });
  }

  return Array.from(bySeries.values()).sort(
    (left, right) => (left.listPosition ?? Number.POSITIVE_INFINITY) - (right.listPosition ?? Number.POSITIVE_INFINITY),
  );
}

export function resolveCrawlerRuntimeOptions(env: EnvSource = process.env): Master4FancyCrawlerRuntimeOptions {
  return {
    maxItems: parseIntegerEnv(env.MASTER4FANCY_OFFICIAL_MAX_ITEMS, DEFAULT_MAX_ITEMS),
    listSettleMs: parseIntegerEnv(env.MASTER4FANCY_OFFICIAL_LIST_SETTLE_MS, 1500),
    pageSettleMs: parseIntegerEnv(env.MASTER4FANCY_OFFICIAL_PAGE_SETTLE_MS, 1500),
    detailSettleMs: parseIntegerEnv(env.MASTER4FANCY_OFFICIAL_DETAIL_SETTLE_MS, 1500),
    detailDelayMs: parseIntegerEnv(env.MASTER4FANCY_OFFICIAL_DETAIL_DELAY_MS, 250),
    verbose: parseBooleanEnv(env.MASTER4FANCY_OFFICIAL_VERBOSE, true),
  };
}

export function shouldAutoRunCleaner(env: EnvSource = process.env): boolean {
  return !parseBooleanEnv(env.MASTER4FANCY_OFFICIAL_SKIP_CLEANER, false);
}

export function buildDetailExtractionScript(): string {
  return `(() => {
    const normalizeWhitespace = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const parsePriceUsd = (value) => {
      const match = String(value || '').match(/-?\\d+(?:\\.\\d+)?/);
      return match ? Number(match[0]) : null;
    };
    const uniqueStrings = (values) => {
      const result = [];
      const seen = new Set();
      for (const value of values) {
        const normalized = normalizeWhitespace(value);
        if (!normalized) continue;
        const key = normalized.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(normalized);
      }
      return result;
    };
    const parseSrcsetCandidates = (value) =>
      String(value || '')
        .split(',')
        .map((entry) => normalizeWhitespace(entry).split(/\\s+/)[0] || '')
        .filter(Boolean);
    const isPlaceholderAsset = (value) =>
      /(?:placeholder|blank|spacer|no-image|loader|loading)\\.(?:gif|svg|png|jpe?g)(?:$|[?#])|\\/placeholder(?:[/?#]|$)/i.test(
        String(value || ''),
      );
    const pickBestCandidate = (values) => {
      const normalized = values.map((value) => normalizeWhitespace(value)).filter(Boolean);
      return normalized.find((value) => !isPlaceholderAsset(value)) || normalized[0] || '';
    };
    const readImageUrl = (image) => {
      const dataSrcCandidates = [
        image?.getAttribute?.('data-src'),
        image?.getAttribute?.('data-original'),
        ...parseSrcsetCandidates(image?.getAttribute?.('data-srcset')),
      ];
      const bestLazyCandidate = pickBestCandidate(dataSrcCandidates);
      if (bestLazyCandidate) return bestLazyCandidate;
      const bestCurrentSrc = pickBestCandidate([image?.currentSrc]);
      if (bestCurrentSrc) return bestCurrentSrc;
      return pickBestCandidate([
        ...parseSrcsetCandidates(image?.getAttribute?.('srcset')),
        image?.getAttribute?.('src'),
        image?.src,
      ]);
    };
    const title = normalizeWhitespace(document.querySelector('h1')?.textContent || '');
    const subtitle = normalizeWhitespace(
      document.querySelector('.product__text, .product__subtitle')?.textContent || '',
    );
    const metaTitle = normalizeWhitespace(document.title || title);
    const metaDescription = normalizeWhitespace(
      document.querySelector('meta[name="description"]')?.getAttribute?.('content') || '',
    );
    const galleryImages = uniqueStrings(
      Array.from(document.querySelectorAll('.product__media img, .product__media-gallery img, .product-gallery img'))
        .map((image) => readImageUrl(image))
        .filter(Boolean),
    );
    const msoBlocks = Array.from(
      document.querySelectorAll('.product__description .MsoNormal, .rte .MsoNormal, .MsoNormal'),
    );
    const msoTexts = uniqueStrings(
      msoBlocks
        .map((node) => normalizeWhitespace(node?.textContent || ''))
        .filter(Boolean),
    );
    const descriptionImageUrls = uniqueStrings([
      ...Array.from(document.querySelectorAll('.product__description .MsoNormal img, .rte .MsoNormal img, .MsoNormal img'))
        .map((image) => readImageUrl(image))
        .filter(Boolean),
      ...Array.from(document.querySelectorAll('.product__description img, .rte img'))
        .map((image) => readImageUrl(image))
        .filter(Boolean),
    ]);
    const coverImage = galleryImages[0] || '';
    const priceUsd = parsePriceUsd(
      document.querySelector('.price .price-item--sale, .price__sale .price-item, .price-item--sale')?.textContent ||
        document.querySelector('.price .price-item, .product__info .price')?.textContent ||
        '',
    );
    const originalPriceUsd = parsePriceUsd(
      document.querySelector('.price .price-item--regular, .price__compare .price-item, .price-item--regular')
        ?.textContent || '',
    );
    const rawDescription = uniqueStrings([
      msoTexts.length === 0 ? document.querySelector('.product__description, .rte')?.textContent || '' : '',
      ...msoTexts,
      document.querySelector('.accordion, .product__accordion')?.textContent || '',
      metaDescription,
    ]).join('\\n');

    return {
      title,
      subtitle,
      metaTitle,
      metaDescription,
      priceUsd,
      originalPriceUsd,
      coverImage,
      galleryImages,
      rawDescription,
      descriptionImageUrls,
    };
  })()`;
}

export function buildReviewBufferItem(
  item: Master4FancyListItem,
  detail: Master4FancyProductDetail,
): Master4FancyReviewBufferItem | null {
  const normalizedDetail = normalizeDetail(detail);
  const title = normalizedDetail.title || item.name;
  const subtitle = normalizedDetail.subtitle || item.subtitle;
  const rawDescription = normalizedDetail.rawDescription || normalizedDetail.metaDescription || subtitle;

  if (
    !shouldKeepMaster4FancyCandidate({
      sourceUrl: item.sourceUrl,
      name: title,
      subtitle,
      rawDescription,
    })
  ) {
    return null;
  }

  const detailImageUrls = uniqueStrings([
    normalizedDetail.coverImage,
    ...normalizedDetail.galleryImages,
    ...(normalizedDetail.descriptionImageUrls || []),
  ]);

  return {
    ...item,
    ...normalizedDetail,
    name: title,
    subtitle,
    rawDescription,
    coverImage: normalizedDetail.coverImage || item.coverImage,
    priceUsd: normalizedDetail.priceUsd ?? item.priceUsd,
    originalPriceUsd: normalizedDetail.originalPriceUsd ?? item.originalPriceUsd,
    detailImageUrls,
    isReviewed: false,
  };
}

export function writeReviewBuffer(rows: Master4FancyReviewBufferItem[], bufferPath = BUFFER_PATH) {
  ensureDir(bufferPath);
  fs.writeFileSync(bufferPath, JSON.stringify(rows, null, 2), 'utf8');
}

export async function crawlListingPages({
  runtime,
  fetchPageHtml,
  log = console.log,
}: {
  runtime: Master4FancyCrawlerRuntimeOptions;
  fetchPageHtml: (url: string) => Promise<string>;
  log?: Logger;
}): Promise<Master4FancyListItem[]> {
  const firstHtml = await fetchPageHtml(LIST_URL);
  const pageUrls = extractPaginationUrlsFromHtml(firstHtml);
  let aggregatedItems = reindexListPositions(
    collapseDuplicateMaster4FancySeries(mergeUniqueListItems(extractListItemsFromHtml(firstHtml))),
  ).slice(0, runtime.maxItems);

  logProgress(runtime, `抓取列表页 1/${pageUrls.length}`, log);
  logProgress(runtime, `当前累计唯一商品数: ${aggregatedItems.length}`, log);

  for (let index = 1; index < pageUrls.length; index += 1) {
    if (aggregatedItems.length >= runtime.maxItems) break;

    const pageUrl = pageUrls[index] || LIST_URL;
    logProgress(runtime, `抓取列表页 ${index + 1}/${pageUrls.length}`, log);
    const html = await fetchPageHtml(pageUrl);
    const pageItems = extractListItemsFromHtml(html).map((item, itemIndex) => ({
      ...item,
      listPosition: aggregatedItems.length + itemIndex + 1,
    }));
    aggregatedItems = reindexListPositions(
      collapseDuplicateMaster4FancySeries(mergeUniqueListItems([...aggregatedItems, ...pageItems])),
    ).slice(0, runtime.maxItems);
    logProgress(runtime, `当前累计唯一商品数: ${aggregatedItems.length}`, log);
  }

  return aggregatedItems;
}

export async function crawlDetailItems({
  items,
  runtime,
  fetchDetail,
  bufferPath = BUFFER_PATH,
  autoRunCleaner = false,
  runCleaner,
  log = console.log,
}: {
  items: Master4FancyListItem[];
  runtime: Master4FancyCrawlerRuntimeOptions;
  fetchDetail: (item: Master4FancyListItem) => Promise<Master4FancyProductDetail>;
  bufferPath?: string;
  autoRunCleaner?: boolean;
  runCleaner?: () => Promise<unknown>;
  log?: Logger;
}): Promise<Master4FancyReviewBufferItem[]> {
  const reviewBuffer: Master4FancyReviewBufferItem[] = [];
  writeReviewBuffer(reviewBuffer, bufferPath);

  for (const [index, item] of items.entries()) {
    logProgress(runtime, `抓取详情 ${index + 1}/${items.length}: ${item.name}`, log);

    try {
      const detail = await fetchDetail(item);
      const row = buildReviewBufferItem(item, detail);
      if (!row) {
        logProgress(runtime, `详情过滤跳过: ${item.sourceUrl}`, log);
        continue;
      }

      reviewBuffer.push(row);
      writeReviewBuffer(reviewBuffer, bufferPath);
      logProgress(runtime, `已写入缓冲: ${row.name} | images=${row.detailImageUrls.length}`, log);

      if (runtime.detailDelayMs > 0 && index < items.length - 1) {
        await sleep(runtime.detailDelayMs);
      }
    } catch (error) {
      console.warn(`[master4fancy-official] 详情抓取失败，跳过 ${item.sourceUrl}:`, error);
    }
  }

  if (autoRunCleaner) {
    await (runCleaner || runCleanerIfAvailable)();
  }

  return reviewBuffer;
}

export async function runCrawler(env: EnvSource = process.env): Promise<Master4FancyReviewBufferItem[]> {
  const runtime = resolveCrawlerRuntimeOptions(env);
  const session = await createContext();
  const listPage = await session.context.newPage();

  try {
    logProgress(runtime, `启动抓取，目标列表页: ${LIST_URL}`);

    const listItems = await crawlListingPages({
      runtime,
      fetchPageHtml: async (url) => {
        const settleMs = url === LIST_URL ? runtime.listSettleMs : runtime.pageSettleMs;
        await loadListPage(listPage, url, settleMs);
        return listPage.content();
      },
    });

    const targetItems = listItems.slice(0, runtime.maxItems);
    logProgress(runtime, `列表抓取完成，待处理详情数: ${targetItems.length}`);

    const reviewBuffer = await crawlDetailItems({
      items: targetItems,
      runtime,
      autoRunCleaner: false,
      fetchDetail: async (item) => {
        const detailPage = await session.context.newPage();
        return withClosablePage(detailPage, async () => {
          await loadListPage(detailPage, item.sourceUrl, runtime.detailSettleMs);
          return resolveDetailFromPage(detailPage);
        });
      },
    });

    logProgress(runtime, `缓冲写入完成: ${BUFFER_PATH}`);

    if (shouldAutoRunCleaner(env)) {
      await runCleanerIfAvailable();
      logProgress(runtime, 'cleaner 交接完成');
    } else {
      logProgress(runtime, '已根据环境变量跳过 cleaner');
    }

    return reviewBuffer;
  } finally {
    await listPage.close().catch(() => {});
    await closeContext(session);
  }
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  runCrawler().catch((error) => {
    console.error('[致命错误] master4fancy 官方站抓取进程崩溃:', error);
    process.exitCode = 1;
  });
}
