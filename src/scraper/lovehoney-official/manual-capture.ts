import fs from 'fs';
import path from 'path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'url';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { runCleaner } from './cleaner.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORIGIN = 'https://www.lovehoney.co.uk';
const DEFAULT_CDP_ENDPOINT = 'http://127.0.0.1:9222';
const DEFAULT_BUFFER_RELATIVE_PATH = 'src/data/lovehoney-official-review-buffer.json';
const IMAGE_PLACEHOLDER = 'bg-gradient-to-br from-zinc-950/50 to-rose-900/30';

type ManualCaptureEnv = {
  LOVEHONEY_CDP_ENDPOINT?: string;
  LOVEHONEY_MANUAL_BUFFER_PATH?: string;
  LOVEHONEY_MANUAL_RUN_CLEANER?: string;
  LOVEHONEY_MANUAL_MAX_CAPTURES?: string;
};

export type LovehoneyManualCaptureConfig = {
  cdpEndpoint: string;
  bufferPath: string;
  runCleaner: boolean;
  maxCaptures: number;
};

export type LovehoneyManualPageSnapshot = {
  url: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  bodyText: string;
  headings: string[];
  images: string[];
};

export { resolveLovehoneyPersistenceMode } from './persistence.ts';
export type { LovehoneyPersistenceInput, LovehoneyPersistenceMode } from './persistence.ts';

type ManualCaptureRecord = Record<string, unknown> & {
  sourceUrl: string;
  name: string;
  rawDescription: string;
};

function isTruthyFlag(value: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
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

function normalizeInline(value: string): string {
  return normalizeWhitespace(value).replace(/\s*\n\s*/g, ' ').trim();
}

function uniqueStrings(values: Array<string | null | undefined>, limit = 40): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeInline(String(value || ''));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeUrlForDedupe(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

function resolveUrl(inputUrl: string): string {
  try {
    return new URL(String(inputUrl || '').trim(), ORIGIN).toString();
  } catch {
    return '';
  }
}

function parseNumber(value: unknown): number | null {
  const normalized = String(value ?? '').replace(/,/g, '').replace(/[^\d.]+/g, '');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function parseCurrencyCode(text: string): string {
  const value = String(text || '');
  if (value.includes('£')) return 'GBP';
  if (value.includes('$')) return 'USD';
  if (value.includes('€')) return 'EUR';
  return 'UNKNOWN';
}

function parsePriceLine(bodyText: string): { amount: number | null; currency: string } {
  const priceLine =
    String(bodyText || '')
      .split('\n')
      .map((line) => normalizeInline(line))
      .find((line) => /[£$€]\s*\d/.test(line)) || '';
  return {
    amount: parseNumber(priceLine),
    currency: parseCurrencyCode(priceLine),
  };
}

function inferGenderHint(snapshot: LovehoneyManualPageSnapshot): 'female' | 'male' | 'unisex' {
  const source = `${snapshot.url}\n${snapshot.title}\n${snapshot.metaDescription}\n${snapshot.bodyText}`.toLowerCase();
  if (/\b(couples?|partner|pair)\b/.test(source)) return 'unisex';
  if (/\b(male|men|man|penis|fleshlight|stroker|masturbator|arcwave|blowmotion)\b/.test(source)) return 'male';
  if (/\b(women|woman|female|rabbit|rose|clitoral|clitoris)\b/.test(source)) return 'female';
  return 'unisex';
}

function isBlockedLovehoneyPage(snapshot: LovehoneyManualPageSnapshot): boolean {
  const joined = `${snapshot.title}\n${snapshot.metaTitle}\n${snapshot.bodyText}`.toLowerCase();
  return (
    joined.includes('blocked request') ||
    joined.includes('technical difficulties with our website') ||
    joined.includes('reference number:') ||
    joined.includes('host: www.lovehoney.co.uk')
  );
}

export function isCapturableLovehoneyProductUrl(inputUrl: string): boolean {
  const value = resolveUrl(inputUrl);
  if (!value.startsWith(`${ORIGIN}/`)) return false;
  return /\/p\//.test(value);
}

export function resolveLovehoneyManualCaptureConfig(
  env: ManualCaptureEnv,
  cwd = process.cwd(),
): LovehoneyManualCaptureConfig {
  const configuredBufferPath = String(env.LOVEHONEY_MANUAL_BUFFER_PATH || '').trim();
  const rawMaxCaptures = Number(String(env.LOVEHONEY_MANUAL_MAX_CAPTURES || '').trim());
  return {
    cdpEndpoint: String(env.LOVEHONEY_CDP_ENDPOINT || '').trim() || DEFAULT_CDP_ENDPOINT,
    bufferPath: path.resolve(cwd, configuredBufferPath || DEFAULT_BUFFER_RELATIVE_PATH),
    runCleaner: isTruthyFlag(String(env.LOVEHONEY_MANUAL_RUN_CLEANER || '')),
    maxCaptures: Number.isFinite(rawMaxCaptures) && rawMaxCaptures > 0 ? Math.round(rawMaxCaptures) : 7,
  };
}

export function buildManualCaptureRecord(snapshot: LovehoneyManualPageSnapshot): ManualCaptureRecord | null {
  const sourceUrl = resolveUrl(snapshot.url);
  if (!isCapturableLovehoneyProductUrl(sourceUrl)) return null;
  if (isBlockedLovehoneyPage(snapshot)) return null;

  const name = normalizeInline(snapshot.title || snapshot.metaTitle).replace(/\s+\|\s+Lovehoney.*$/i, '');
  if (!name) return null;

  const price = parsePriceLine(snapshot.bodyText);
  const images = uniqueStrings(snapshot.images.map((image) => resolveUrl(image)).filter(Boolean), 30);
  const headings = uniqueStrings(snapshot.headings, 10);
  const genderHint = inferGenderHint(snapshot);
  const rawDescription = [
    '[基础信息]',
    `商品名: ${name}`,
    snapshot.metaTitle ? `页面标题: ${normalizeInline(snapshot.metaTitle)}` : '',
    snapshot.metaDescription ? `页面描述: ${normalizeInline(snapshot.metaDescription)}` : '',
    price.amount ? `页面价格(${price.currency}): ${price.amount}` : '',
    `性别提示: ${genderHint}`,
    '',
    headings.length ? '[卖点摘要]' : '',
    ...headings,
    '',
    snapshot.bodyText ? '[英文正文摘录]' : '',
    normalizeWhitespace(snapshot.bodyText).slice(0, 14000),
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 18000)
    .trim();

  return {
    sourceUrl,
    name,
    price: price.amount,
    priceCurrency: price.currency,
    originalPrice: null,
    originalPriceCurrency: 'UNKNOWN',
    coverImage: images[0] || '',
    genderHint,
    categoryHints: headings.slice(0, 6),
    rawDescription,
    detailImageUrls: images,
    imagePlaceholder: IMAGE_PLACEHOLDER,
    isReviewed: false,
  };
}

export function appendCapturedRecords(
  existingRecords: Array<Record<string, unknown>>,
  incomingRecords: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const result: Array<Record<string, unknown>> = [];

  for (const record of [...existingRecords, ...incomingRecords]) {
    const sourceUrl = normalizeUrlForDedupe(String(record.sourceUrl || ''));
    if (!sourceUrl || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    result.push(record);
  }

  return result;
}

export function buildManualSnapshotScript(): string {
  return `(() => {
    const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const images = Array.from(document.querySelectorAll('img'))
      .map((img) =>
        normalize(
          img.getAttribute('src') ||
            img.getAttribute('data-src') ||
            img.getAttribute('srcset')?.split(',')[0]?.trim().split(/\\s+/)[0] ||
            '',
        ),
      )
      .filter(Boolean);
    const title =
      normalize(document.querySelector('h1')?.textContent || '') ||
      normalize(document.querySelector('[data-testid="product-title"]')?.textContent || '') ||
      normalize(document.title || '');

    return {
      url: window.location.href,
      title,
      metaTitle: normalize(document.title || ''),
      metaDescription: normalize(document.querySelector('meta[name="description"]')?.getAttribute('content') || ''),
      bodyText: String(document.body?.innerText || '').trim(),
      headings: Array.from(document.querySelectorAll('h2, h3'))
        .map((node) => normalize(node.textContent || ''))
        .filter(Boolean),
      images,
    };
  })()`;
}

async function captureSnapshot(page: Page): Promise<LovehoneyManualPageSnapshot> {
  return page.evaluate(buildManualSnapshotScript()) as Promise<LovehoneyManualPageSnapshot>;
}

function readBuffer(bufferPath: string): Array<Record<string, unknown>> {
  if (!fs.existsSync(bufferPath)) return [];
  const parsed = JSON.parse(fs.readFileSync(bufferPath, 'utf-8'));
  return Array.isArray(parsed) ? parsed : [];
}

function writeBuffer(bufferPath: string, records: Array<Record<string, unknown>>) {
  const dir = path.dirname(bufferPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(bufferPath, JSON.stringify(records, null, 2));
}

function selectLovehoneyPage(context: BrowserContext): Page | null {
  const pages = context
    .pages()
    .filter((page) => !page.isClosed())
    .filter((page) => page.url().includes('lovehoney.co.uk'));
  return (
    [...pages].reverse().find((page) => isCapturableLovehoneyProductUrl(page.url())) ||
    [...pages].reverse()[0] ||
    null
  );
}

async function connectToChrome(cdpEndpoint: string): Promise<Browser> {
  try {
    return await chromium.connectOverCDP(cdpEndpoint);
  } catch (error) {
    throw new Error(
      `无法连接真实 Chrome 的 CDP 端口 ${cdpEndpoint}。请先用 --remote-debugging-port=9222 启动 Chrome。原始错误: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export async function runLovehoneyManualCapture() {
  const config = resolveLovehoneyManualCaptureConfig(process.env);
  console.log('--- Lovehoney 手动真实浏览器捕获 ---');
  console.log(`[CDP] ${config.cdpEndpoint}`);
  console.log(`[缓冲] ${config.bufferPath}`);
  console.log('[用法] 在已连接的 Chrome 中手动打开 Lovehoney 商品详情页，每打开一页就在终端按回车捕获。输入 q 结束。');

  const browser = await connectToChrome(config.cdpEndpoint);
  const context = browser.contexts()[0];
  if (!context) {
    await browser.close();
    throw new Error('已连接 Chrome，但没有可用浏览器上下文。');
  }

  const rl = readline.createInterface({ input, output });
  const captured: Array<Record<string, unknown>> = [];

  try {
    for (let index = 0; index < config.maxCaptures; index += 1) {
      const answer = await rl.question(`打开第 ${index + 1}/${config.maxCaptures} 个 Lovehoney 商品页后按回车捕获，输入 q 结束: `);
      if (answer.trim().toLowerCase() === 'q') break;

      const page = selectLovehoneyPage(context);
      if (!page) {
        console.warn('[跳过] 当前 Chrome 里没有 Lovehoney 页面。');
        index -= 1;
        continue;
      }

      await page.bringToFront().catch(() => {});
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      const snapshot = await captureSnapshot(page);
      const record = buildManualCaptureRecord(snapshot);
      if (!record) {
        console.warn(`[跳过] 当前页不是可捕获商品页，或仍是阻塞页: ${snapshot.url}`);
        index -= 1;
        continue;
      }

      const merged = appendCapturedRecords(readBuffer(config.bufferPath), [record]);
      writeBuffer(config.bufferPath, merged);
      captured.push(record);
      console.log(`[捕获] ${record.name} | ${record.priceCurrency || 'UNKNOWN'} ${record.price ?? 'null'} | ${record.sourceUrl}`);
    }

    console.log(`[完成] 本次捕获 ${captured.length} 条，review-buffer 当前共 ${readBuffer(config.bufferPath).length} 条。`);
    if (config.runCleaner && captured.length > 0) {
      await runCleaner();
    }
  } finally {
    rl.close();
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLovehoneyManualCapture().catch((error) => {
    console.error('[致命错误] Lovehoney 手动捕获失败:', error);
    process.exitCode = 1;
  });
}
