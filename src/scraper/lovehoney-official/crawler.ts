import fs from 'fs';
import path from 'path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'url';
import { chromium, type Browser, type BrowserContext, type Page, type Response } from 'playwright';
import { buildLovehoneyCookies } from './cookies.ts';
import {
  resolveLovehoneyRuntimeConfig,
  shouldReuseCurrentInteractivePage,
  type LovehoneyRuntimeConfig,
} from './runtime.ts';
import { resolveLovehoneySessionBootstrap } from './session.ts';
import { runCleaner } from './cleaner.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORIGIN = 'https://www.lovehoney.co.uk';
const MAX_ITEMS = Number(process.env.LOVEHONEY_OFFICIAL_MAX_ITEMS || '180');
const BUFFER_PATH = path.resolve(__dirname, '../../data/lovehoney-official-review-buffer.json');
const IMAGE_PLACEHOLDER = 'bg-gradient-to-br from-zinc-950/50 to-rose-900/30';

type GenderHint = 'female' | 'male' | 'unisex';
type CurrencyCode = 'GBP' | 'USD' | 'EUR' | 'UNKNOWN';

type ListPageConfig = {
  url: string;
  label: string;
  genderHint: GenderHint;
};

type ListItem = {
  sourceUrl: string;
  name: string;
  subtitle: string;
  coverImage: string;
  genderHint: GenderHint;
  categoryHints: string[];
  price: number | null;
  priceCurrency: CurrencyCode;
  originalPrice: number | null;
  originalPriceCurrency: CurrencyCode;
  listPosition: number | null;
};

type ProductDetail = {
  title: string;
  subtitle: string;
  metaTitle: string;
  metaDescription: string;
  price: number | null;
  priceCurrency: CurrencyCode;
  originalPrice: number | null;
  originalPriceCurrency: CurrencyCode;
  featureHeadlines: string[];
  specPairs: Array<{ key: string; value: string }>;
  bodySummary: string;
  coverImage: string;
  imageUrls: string[];
  productCode: string;
};

type PageState = {
  title: string;
  bodyText: string;
  status: number | null;
  finalUrl: string;
  server: string;
};

type ContextBundle = {
  context: BrowserContext;
  runtime: LovehoneyRuntimeConfig;
  cleanup: () => Promise<void>;
};

const LIST_PAGE_CONFIGS: ListPageConfig[] = [
  {
    url: 'https://www.lovehoney.co.uk/\x73ex-toys/\x73ex-toys-for-women/',
    label: 'Women',
    genderHint: 'female',
  },
  {
    url: 'https://www.lovehoney.co.uk/\x73ex-toys/male-\x73ex-toys/',
    label: 'Men',
    genderHint: 'male',
  },
  {
    url: 'https://www.lovehoney.co.uk/\x73ex-toys/\x73ex-toys-for-couples/',
    label: 'Couples',
    genderHint: 'unisex',
  },
];

function toPageScript<T>(script: string, payload?: T): string {
  if (payload === undefined) return `(() => {\n${script}\n})()`;
  return `((input) => {\n${script}\n})(${JSON.stringify(payload)})`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function waitForUserConfirmation(promptText: string) {
  const rl = readline.createInterface({ input, output });
  try {
    await rl.question(promptText);
  } finally {
    rl.close();
  }
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

function uniqueStrings(values: Array<string | null | undefined>, limit = 40): string[] {
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

function parseCurrencyCode(text: string): CurrencyCode {
  const value = String(text || '');
  if (value.includes('£')) return 'GBP';
  if (value.includes('$')) return 'USD';
  if (value.includes('€')) return 'EUR';
  return 'UNKNOWN';
}

function parseNumber(value: unknown): number | null {
  const normalized = String(value ?? '').replace(/,/g, '').replace(/[^\d.]+/g, '');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function parseMoney(value: string): { amount: number | null; currency: CurrencyCode } {
  return {
    amount: parseNumber(value),
    currency: parseCurrencyCode(value),
  };
}

function resolveUrl(input: string): string {
  const value = String(input || '').trim();
  if (!value) return '';
  try {
    return new URL(value, ORIGIN).toString();
  } catch {
    return '';
  }
}

function shouldSkipDetailUrl(url: string): boolean {
  const value = String(url || '').trim();
  if (!value.startsWith(ORIGIN)) return true;
  if (!/\/p\//.test(value)) return true;
  if (/\b(?:reviews?|delivery|returns|contact|blog|help)\b/i.test(value)) return true;
  return false;
}

function isBlockedPage(title: string, bodyText: string): boolean {
  const joined = `${title}\n${bodyText}`.toLowerCase();
  return (
    joined.includes('blocked request') ||
    joined.includes('technical difficulties with our website') ||
    joined.includes('reference number:') ||
    joined.includes('host: www.lovehoney.co.uk')
  );
}

async function createContext(): Promise<ContextBundle> {
  const runtime = resolveLovehoneyRuntimeConfig(process.env);
  const sessionBootstrap = resolveLovehoneySessionBootstrap(process.env);
  const contextOptions = {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 2200 },
    locale: 'en-GB' as const,
    ...(sessionBootstrap.storageStatePath ? { storageState: sessionBootstrap.storageStatePath } : {}),
    extraHTTPHeaders: {
      'accept-language': 'en-GB,en;q=0.9',
    },
  };

  let browser: Browser | null = null;
  let context: BrowserContext;

  if (runtime.mode === 'cdp') {
    console.log(`[CDP] 正在连接本机 Chrome: ${runtime.cdpEndpoint}`);
    browser = await chromium.connectOverCDP(runtime.cdpEndpoint);
    const existingContext = browser.contexts()[0];
    if (!existingContext) {
      throw new Error(`CDP 已连接，但未找到可复用的浏览器上下文: ${runtime.cdpEndpoint}`);
    }
    context = existingContext;
  } else if (runtime.mode === 'interactive') {
    ensureDir(path.join(runtime.persistentProfileDir, '.keep'));
    console.log(`[交互] 已启用 Lovehoney 有界面持久会话模式: ${runtime.persistentProfileDir}`);
    try {
      context = await chromium.launchPersistentContext(runtime.persistentProfileDir, {
        channel: 'chrome',
        headless: false,
        args: ['--no-sandbox'],
        ignoreDefaultArgs: ['--enable-automation'],
        ...contextOptions,
      });
    } catch (error) {
      console.warn('[交互] 启动系统 Chrome 失败，回退到 Playwright Chromium:', error);
      context = await chromium.launchPersistentContext(runtime.persistentProfileDir, {
        headless: false,
        args: ['--no-sandbox'],
        ignoreDefaultArgs: ['--enable-automation'],
        ...contextOptions,
      });
    }
  } else {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
      ignoreDefaultArgs: ['--enable-automation'],
    });

    context = await browser.newContext(contextOptions);
  }

  if (sessionBootstrap.source === 'storage-state') {
    const contextCookies = await context.cookies([ORIGIN]);
    const cookieNames = uniqueStrings(contextCookies.map((cookie) => cookie.name), 12);
    console.log(
      `[情报] 已载入 Lovehoney storageState: path=${sessionBootstrap.storageStatePath}, context=${contextCookies.length}, names=${cookieNames.join(', ') || 'none'}`,
    );
  }

  if (sessionBootstrap.source === 'cookie') {
    const cookies = buildLovehoneyCookies(sessionBootstrap.cookieHeader, ['.lovehoney.co.uk', 'www.lovehoney.co.uk']);
    if (cookies.length > 0) {
      await context.addCookies(cookies);
      const contextCookies = await context.cookies([ORIGIN]);
      const cookieNames = uniqueStrings(contextCookies.map((cookie) => cookie.name), 12);
      console.log(
        `[情报] 已注入 Lovehoney Cookie: raw=${sessionBootstrap.cookieHeader.length}, parsed=${cookies.length}, context=${contextCookies.length}, names=${cookieNames.join(', ') || 'none'}`,
      );
    }
  }

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  return {
    context,
    runtime,
    cleanup: async () => {
      if (runtime.mode === 'cdp') return;
      await context.close();
      if (browser) await browser.close();
    },
  };
}

async function getOrCreatePage(context: BrowserContext): Promise<Page> {
  const existingPage = context
    .pages()
    .find((candidate) => candidate.url().includes('lovehoney.co.uk') && !candidate.isClosed()) || context.pages()[0];
  if (existingPage) {
    await existingPage.bringToFront().catch(() => {});
    return existingPage;
  }
  return context.newPage();
}

async function prepareInteractiveGate(page: Page, runtime: LovehoneyRuntimeConfig) {
  if (runtime.mode === 'cdp') {
    console.log('[CDP] 已连接到你自己的 Chrome。请先在这个真实浏览器中手动打开并保持一个可正常访问的 Lovehoney 页面。');
    await waitForUserConfirmation('准备好后回到这里按回车开始抓取...');
  } else {
    await gotoAndSettle(page, runtime.interactiveStartUrl, 2500);
    console.log('[交互] 浏览器已打开。请在当前浏览器中完成 Lovehoney 验证，并确认页面可正常访问。');
    await waitForUserConfirmation('完成后回到这里按回车开始抓取...');
  }
  const state = await inspectPageState(page);
  console.log(
    `[交互] 当前页面状态: title=${state.title || 'N/A'} | finalUrl=${state.finalUrl || runtime.interactiveStartUrl}`,
  );
}

async function gotoAndSettle(page: Page, url: string, waitMs = 5000): Promise<Response | null> {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(waitMs);
  return response;
}

async function inspectPageState(page: Page, response?: Response | null): Promise<PageState> {
  const payload = await page.evaluate(
    toPageScript(`
      return {
        title: String(document.title || '').trim(),
        bodyText: String(document.body?.innerText || '').trim(),
      };
    `),
  );
  return {
    title: normalizeWhitespace(String((payload as { title?: string })?.title || '')),
    bodyText: normalizeWhitespace(String((payload as { bodyText?: string })?.bodyText || '')),
    status: response?.status() ?? null,
    finalUrl: page.url(),
    server: response?.headers()['server'] || '',
  };
}

async function tryOpenCategory(page: Page, url: string) {
  const firstResponse = await gotoAndSettle(page, url, 4500);
  let state = await inspectPageState(page, firstResponse);
  if (!isBlockedPage(String(state.title || ''), String(state.bodyText || ''))) {
    return { blocked: false, state };
  }

  await page.waitForTimeout(3500);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(2000);
  state = await inspectPageState(page, firstResponse);
  return { blocked: isBlockedPage(String(state.title || ''), String(state.bodyText || '')), state };
}

async function extractListItemsFromPage(page: Page, config: ListPageConfig, pageOffset: number): Promise<ListItem[]> {
  const payload = await page.evaluate(
    toPageScript(
      `
      const origin = String(input?.origin || '');
      const genderHint = String(input?.genderHint || 'unisex');
      const pageOffset = Number(input?.pageOffset || 0);
      const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const resolveUrl = (value) => {
        try {
          return new URL(String(value || '').trim(), origin).toString();
        } catch {
          return '';
        }
      };
      const parseCardPrice = (cardText) => {
        const lines = normalize(cardText)
          .split(/(?=£|\\$|€)/)
          .map((line) => normalize(line))
          .filter(Boolean);
        return lines.find((line) => /[£$€]\\s*\\d/.test(line)) || '';
      };
      const pickCard = (anchor) => {
        return (
          anchor.closest('article') ||
          anchor.closest('li') ||
          anchor.closest('[data-testid]') ||
          anchor.parentElement
        );
      };
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      const seen = new Set();
      const rows = [];
      for (const anchor of anchors) {
        const href = resolveUrl(anchor.getAttribute('href') || anchor.href || '');
        if (!href || !/\\/p\\//.test(href) || seen.has(href)) continue;
        seen.add(href);
        const card = pickCard(anchor);
        const cardText = normalize(card?.textContent || anchor.textContent || '');
        const title =
          normalize(anchor.getAttribute('aria-label') || '') ||
          normalize(anchor.getAttribute('title') || '') ||
          normalize(anchor.textContent || '');
        if (!title) continue;
        const image = card?.querySelector('img') || anchor.querySelector('img');
        const imageUrl = normalize(
          image?.getAttribute('src') ||
            image?.getAttribute('data-src') ||
            image?.getAttribute('srcset')?.split(',')[0]?.trim().split(/\\s+/)[0] ||
            '',
        );
        const priceText = parseCardPrice(cardText);
        const categoryHints = cardText
          .split('\\n')
          .map((line) => normalize(line))
          .filter(Boolean)
          .filter((line) => line !== title && !/[£$€]\\s*\\d/.test(line))
          .slice(0, 6);
        rows.push({
          sourceUrl: href,
          name: title,
          subtitle: categoryHints[0] || '',
          coverImage: imageUrl,
          genderHint,
          categoryHints,
          priceText,
          originalPriceText: '',
          listPosition: pageOffset + rows.length + 1,
        });
      }
      return rows.slice(0, 120);
      `,
      {
        origin: ORIGIN,
        genderHint: config.genderHint,
        pageOffset,
      },
    ),
  );

  const rows = Array.isArray(payload) ? payload : [];
  return rows
    .map((row) => {
      const primaryMoney = parseMoney(String(row.priceText || ''));
      const originalMoney = parseMoney(String(row.originalPriceText || ''));
      return {
        sourceUrl: resolveUrl(String(row.sourceUrl || '')),
        name: normalizeWhitespace(String(row.name || '')),
        subtitle: normalizeWhitespace(String(row.subtitle || '')),
        coverImage: resolveUrl(String(row.coverImage || '')),
        genderHint: config.genderHint,
        categoryHints: uniqueStrings(Array.isArray(row.categoryHints) ? row.categoryHints.map(String) : [], 8),
        price: primaryMoney.amount,
        priceCurrency: primaryMoney.currency,
        originalPrice: originalMoney.amount,
        originalPriceCurrency: originalMoney.currency,
        listPosition: parseNumber(row.listPosition),
      } satisfies ListItem;
    })
    .filter((item) => item.name && item.sourceUrl && !shouldSkipDetailUrl(item.sourceUrl));
}

async function extractNextPageUrl(page: Page): Promise<string> {
  const payload = await page.evaluate(
    toPageScript(`
      const nextLink = document.querySelector('a[rel="next"], a.pagination-next, a[aria-label="Next"]');
      return String(nextLink?.getAttribute('href') || nextLink?.href || '').trim();
    `),
  );
  return resolveUrl(String(payload || ''));
}

async function collectListItems(page: Page, runtime: LovehoneyRuntimeConfig): Promise<ListItem[]> {
  const seen = new Set<string>();
  const results: ListItem[] = [];

  for (const config of LIST_PAGE_CONFIGS) {
    console.log(`\n[列表] 进入分类: ${config.label} -> ${config.url}`);
    let currentUrl = config.url;
    let pageIndex = 0;

    while (currentUrl && results.length < MAX_ITEMS) {
      const reuseCurrentPage = shouldReuseCurrentInteractivePage(runtime.interactive, page.url(), currentUrl);
      const currentPageState = reuseCurrentPage ? await inspectPageState(page) : null;
      const { blocked, state } =
        reuseCurrentPage && currentPageState && !isBlockedPage(currentPageState.title, currentPageState.bodyText)
          ? { blocked: false, state: currentPageState }
          : await tryOpenCategory(page, currentUrl);

      if (reuseCurrentPage) {
        console.log(`[交互] 复用当前已打开类目页: ${currentUrl}`);
      }

      if (blocked) {
        console.warn(`[阻塞] ${config.label} 分类页被拦截: ${currentUrl}`);
        console.warn(
          `[阻塞] title=${String(state.title || '')} | status=${state.status ?? 'null'} | server=${state.server || 'unknown'} | finalUrl=${state.finalUrl || currentUrl}`,
        );
        break;
      }

      const pageItems = await extractListItemsFromPage(page, config, pageIndex * 100);
      console.log(`[列表] ${config.label} 第 ${pageIndex + 1} 页解析到 ${pageItems.length} 条候选商品`);
      if (pageItems.length === 0) break;

      for (const item of pageItems) {
        if (seen.has(item.sourceUrl)) continue;
        seen.add(item.sourceUrl);
        results.push(item);
        if (results.length >= MAX_ITEMS) break;
      }

      const nextUrl = await extractNextPageUrl(page);
      if (!nextUrl || nextUrl === currentUrl) break;
      currentUrl = nextUrl;
      pageIndex += 1;
      await sleep(600);
    }
  }

  return results.slice(0, MAX_ITEMS);
}

async function extractDetail(page: Page, fallback: ListItem): Promise<ProductDetail | null> {
  const state = await inspectPageState(page);
  if (isBlockedPage(String(state.title || ''), String(state.bodyText || ''))) {
    console.warn(
      `[阻塞] 详情页被拦截: ${fallback.sourceUrl} | status=${state.status ?? 'null'} | server=${state.server || 'unknown'} | finalUrl=${state.finalUrl || fallback.sourceUrl}`,
    );
    return null;
  }

  const payload = await page.evaluate(
    toPageScript(`
      const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const unique = (values) => Array.from(new Set(values.filter(Boolean)));
      const images = unique(
        Array.from(document.querySelectorAll('img'))
          .map((img) =>
            normalize(
              img.getAttribute('src') ||
                img.getAttribute('data-src') ||
                img.getAttribute('srcset')?.split(',')[0]?.trim().split(/\\s+/)[0] ||
                '',
            ),
          )
          .filter(Boolean),
      );
      const title =
        normalize(document.querySelector('h1')?.textContent || '') ||
        normalize(document.querySelector('[data-testid="product-title"]')?.textContent || '');
      const metaDescription = normalize(document.querySelector('meta[name="description"]')?.getAttribute('content') || '');
      const headings = Array.from(document.querySelectorAll('h2, h3'))
        .map((node) => normalize(node.textContent || ''))
        .filter(Boolean);
      const bodyText = normalize(document.body?.innerText || '');
      const priceLines = bodyText
        .split('\\n')
        .map((line) => normalize(line))
        .filter((line) => /[£$€]\\s*\\d/.test(line))
        .slice(0, 8);
      const specPairs = [];
      for (const node of Array.from(document.querySelectorAll('table tr, dl, .specifications li, .product-specifications li'))) {
        const text = normalize(node.textContent || '');
        if (!text) continue;
        if (text.includes(':')) {
          const [key, ...rest] = text.split(':');
          const value = normalize(rest.join(':'));
          if (key && value) specPairs.push({ key: normalize(key), value });
        }
      }
      return {
        title,
        metaTitle: normalize(document.title || ''),
        metaDescription,
        bodyText,
        priceLines,
        headings,
        specPairs,
        images,
      };
    `),
  ) as {
    title: string;
    metaTitle: string;
    metaDescription: string;
    bodyText: string;
    priceLines: string[];
    headings: string[];
    specPairs: Array<{ key: string; value: string }>;
    images: string[];
  };

  const title = normalizeWhitespace(payload?.title || fallback.name);
  if (!title) return null;

  const primaryMoney = parseMoney(payload?.priceLines?.[0] || '');
  const originalMoney = parseMoney(payload?.priceLines?.[1] || '');
  const specPairs = Array.isArray(payload?.specPairs)
    ? payload.specPairs
        .map((pair) => ({
          key: normalizeWhitespace(pair.key),
          value: normalizeWhitespace(pair.value),
        }))
        .filter((pair) => pair.key && pair.value)
    : [];
  const imageUrls = uniqueStrings((payload?.images || []).map((url) => resolveUrl(url)).filter(Boolean), 30);
  const productCode =
    normalizeWhitespace(payload?.bodyText.match(/\b[a-z]\d{4,}g\d+/i)?.[0] || '') ||
    normalizeWhitespace(payload?.bodyText.match(/\bsku\b[:\s]+([a-z0-9-]+)/i)?.[1] || '');

  return {
    title,
    subtitle: uniqueStrings(payload?.headings || [], 4).join(' | '),
    metaTitle: normalizeWhitespace(payload?.metaTitle || ''),
    metaDescription: normalizeWhitespace(payload?.metaDescription || ''),
    price: primaryMoney.amount ?? fallback.price,
    priceCurrency: primaryMoney.currency !== 'UNKNOWN' ? primaryMoney.currency : fallback.priceCurrency,
    originalPrice: originalMoney.amount ?? fallback.originalPrice,
    originalPriceCurrency:
      originalMoney.currency !== 'UNKNOWN' ? originalMoney.currency : fallback.originalPriceCurrency,
    featureHeadlines: uniqueStrings(payload?.headings || [], 8),
    specPairs,
    bodySummary: normalizeWhitespace(payload?.bodyText || '').slice(0, 14000),
    coverImage: fallback.coverImage || imageUrls[0] || '',
    imageUrls,
    productCode,
  };
}

function buildRawDescription(item: ListItem, detail: ProductDetail): string {
  const sections = [
    '[基础信息]',
    `商品名: ${detail.title || item.name}`,
    detail.subtitle ? `副标题: ${detail.subtitle}` : '',
    detail.metaTitle ? `页面标题: ${detail.metaTitle}` : '',
    detail.metaDescription ? `页面描述: ${detail.metaDescription}` : '',
    detail.price ? `页面价格(${detail.priceCurrency}): ${detail.price}` : '',
    detail.originalPrice ? `划线价格(${detail.originalPriceCurrency}): ${detail.originalPrice}` : '',
    `性别提示: ${item.genderHint}`,
    item.categoryHints.length ? `站内分类提示: ${item.categoryHints.join(' | ')}` : '',
    detail.productCode ? `产品代码: ${detail.productCode}` : '',
    '',
    detail.specPairs.length ? '[规格参数]' : '',
    ...detail.specPairs.map((pair) => `${pair.key}: ${pair.value}`),
    '',
    detail.featureHeadlines.length ? '[卖点摘要]' : '',
    ...detail.featureHeadlines,
    '',
    detail.bodySummary ? '[英文正文摘录]' : '',
    detail.bodySummary,
  ]
    .filter(Boolean)
    .join('\n');

  return sections.slice(0, 18000).trim();
}

function persistBuffer(bufferData: unknown[]) {
  ensureDir(BUFFER_PATH);
  fs.writeFileSync(BUFFER_PATH, JSON.stringify(bufferData, null, 2));
}

export async function runCrawler() {
  console.log('--- 启动 Lovehoney 官方站抓取任务 ---');
  console.log(`[列表] 分类入口: ${LIST_PAGE_CONFIGS.map((item) => item.url).join(' | ')}`);

  const bundle = await createContext();
  const page = await getOrCreatePage(bundle.context);

  try {
    if (bundle.runtime.interactive) {
      await prepareInteractiveGate(page, bundle.runtime);
    }

    const listItems = await collectListItems(page, bundle.runtime);
    console.log(`[列表] 去重后候选商品数: ${listItems.length}`);

    const targetItems = listItems.slice(0, MAX_ITEMS);
    const bufferData: Array<Record<string, unknown>> = [];
    persistBuffer(bufferData);

    if (targetItems.length === 0) {
      console.warn('[列表] 当前环境未抓到 Lovehoney 商品，可能仍被站点防护阻挡。');
    }

    for (let index = 0; index < targetItems.length; index += 1) {
      const item = targetItems[index];
      console.log(`\n[详情] (${index + 1}/${targetItems.length}) ${item.name}`);
      console.log(`[详情] URL: ${item.sourceUrl}`);

      try {
        await gotoAndSettle(page, item.sourceUrl, 4500);
        const detail = await extractDetail(page, item);
        if (!detail) continue;

        const detailImageUrls = uniqueStrings([detail.coverImage, ...detail.imageUrls], 30);
        const rawDescription = buildRawDescription(item, detail);

        const record = {
          sourceUrl: item.sourceUrl,
          name: detail.title || item.name,
          price: detail.price ?? item.price ?? null,
          priceCurrency: detail.priceCurrency || item.priceCurrency || 'UNKNOWN',
          originalPrice: detail.originalPrice ?? item.originalPrice ?? null,
          originalPriceCurrency: detail.originalPriceCurrency || item.originalPriceCurrency || 'UNKNOWN',
          coverImage: detail.coverImage || item.coverImage || '',
          genderHint: item.genderHint,
          categoryHints: uniqueStrings(item.categoryHints, 8),
          rawDescription,
          detailImageUrls,
          imagePlaceholder: IMAGE_PLACEHOLDER,
          isReviewed: false,
        };

        bufferData.push(record);
        persistBuffer(bufferData);
        console.log(
          `[抓取] 已写入缓冲: ${record.name} | ${record.priceCurrency} ${record.price ?? 'null'} | images=${detailImageUrls.length}`,
        );
        await sleep(350);
      } catch (error) {
        console.error(`[故障] 详情抓取失败: ${item.sourceUrl}`, error);
      }
    }

    console.log(`\n--- Lovehoney 官方站抓取结束，共写入 ${bufferData.length} 条 ---`);
    console.log(`[缓冲] ${BUFFER_PATH}`);

    try {
      await runCleaner();
    } catch (error) {
      console.error('[致命错误] cleaner 执行失败:', error);
    }
  } finally {
    await bundle.cleanup();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCrawler().catch((error) => {
    console.error('[致命错误] Lovehoney 官方站抓取进程崩溃:', error);
  });
}
