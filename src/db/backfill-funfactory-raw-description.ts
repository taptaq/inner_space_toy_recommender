import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { pathToFileURL } from 'url';

import {
  extractDetailFromHtml,
  extractDetailFromShopifyProduct,
  normalizeProductUrl,
} from '../scraper/funfactory-official/crawler.ts';
import { translateRawDescriptionToZh } from '../scraper/shared/raw-description-translator.ts';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const ORIGIN = 'https://www.funfactory.com';
const REVIEW_BUFFER_PATH = path.resolve(process.cwd(), 'src/data/funfactory-official-review-buffer.json');
const RAW_TRANSLATION_CACHE_PATH = path.resolve(
  process.cwd(),
  'src/data/funfactory-official-raw-description-zh-cache.json',
);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type BufferRow = {
  sourceUrl?: string;
  name?: string;
};

type PendingRawUpdate = {
  productId: string;
  productName: string;
  translatedRaw: string;
};

const REQUEST_HEADERS: HeadersInit = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
  'accept-language': 'de-DE,de;q=0.9,en;q=0.8,zh-CN;q=0.7',
  pragma: 'no-cache',
  'cache-control': 'no-cache',
};

type ShopifyVariant = {
  price?: string | number | null;
  compare_at_price?: string | number | null;
};

type ShopifyImage = {
  src?: string | null;
};

type ShopifyProduct = {
  title?: string | null;
  handle?: string | null;
  body_html?: string | null;
  product_type?: string | null;
  tags?: string | string[] | null;
  variants?: ShopifyVariant[] | null;
  images?: ShopifyImage[] | null;
};

const isTransientDbError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Connection terminated|ECONNRESET|server closed the connection|terminating connection|Can't reach database|P1001|P1017/i.test(
    message,
  );
};

async function reconnectPrisma() {
  await prisma.$disconnect().catch(() => {});
  await sleep(800);
  await prisma.$connect();
}

async function ensurePrismaConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    if (!isTransientDbError(error)) throw error;
    await reconnectPrisma();
  }
}

async function withDbRetry<T>(label: string, action: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await ensurePrismaConnection();
      return await action();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === 3) break;
      await reconnectPrisma();
      await sleep(1000 * attempt);
    }
  }
  throw lastError;
}

function loadTranslationCache() {
  if (!fs.existsSync(RAW_TRANSLATION_CACHE_PATH)) {
    return {} as Record<string, string>;
  }
  return JSON.parse(fs.readFileSync(RAW_TRANSLATION_CACHE_PATH, 'utf8')) as Record<string, string>;
}

function saveTranslationCache(cache: Record<string, string>) {
  fs.mkdirSync(path.dirname(RAW_TRANSLATION_CACHE_PATH), { recursive: true });
  fs.writeFileSync(RAW_TRANSLATION_CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: REQUEST_HEADERS });
  if (!response.ok) {
    throw new Error(`[backfill-funfactory-raw-description] HTML 请求失败 ${response.status}: ${url}`);
  }
  return await response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { ...REQUEST_HEADERS, accept: 'application/json,text/plain;q=0.9,*/*;q=0.8' },
  });
  if (!response.ok) {
    throw new Error(`[backfill-funfactory-raw-description] JSON 请求失败 ${response.status}: ${url}`);
  }
  return (await response.json()) as T;
}

async function translateWithCache(rawDescription: string, cache: Record<string, string>) {
  const normalized = String(rawDescription || '').trim();
  if (!normalized) return '';
  if (cache[normalized]) return cache[normalized];
  const translated = await translateRawDescriptionToZh(normalized, {
    cachePath: RAW_TRANSLATION_CACHE_PATH,
    logLabel: 'backfill-funfactory-raw-description',
  }).catch(() => normalized);
  cache[normalized] = translated;
  return translated;
}

async function backfillFunFactoryRawDescription() {
  console.log('[backfill-funfactory-raw-description] 开始重爬并回填 Fun Factory raw_description ...');
  const translationCache = loadTranslationCache();

  const reviewRows = fs.existsSync(REVIEW_BUFFER_PATH)
    ? (JSON.parse(fs.readFileSync(REVIEW_BUFFER_PATH, 'utf8')) as BufferRow[])
    : [];

  const reviewRowsByUrl = new Map(
    reviewRows
      .map((row) => [normalizeProductUrl(String(row.sourceUrl || '')), row] as const)
      .filter(([url]) => Boolean(url)),
  );

  const products = await withDbRetry('读取 Fun Factory products', () =>
    prisma.products.findMany({
      where: {
        link: {
          contains: 'funfactory.com',
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        link: true,
      },
      orderBy: {
        name: 'asc',
      },
    }),
  );

  let updatedProducts = 0;
  let updatedToys = 0;
  const pendingUpdates: PendingRawUpdate[] = [];

  for (const [index, product] of products.entries()) {
    const sourceUrl = normalizeProductUrl(String(product.link || ''));
    if (!sourceUrl) continue;
    const handle = sourceUrl.match(/\/products\/([^/?#]+)/i)?.[1] || '';
    if (!handle) continue;

    console.log(`[backfill-funfactory-raw-description] 抓取详情 ${index + 1}/${products.length}: ${product.name}`);

    let htmlDetailRaw = '';
    try {
      const html = await fetchText(sourceUrl);
      htmlDetailRaw = extractDetailFromHtml(html, sourceUrl).rawDescription;
    } catch (error) {
      console.warn(`[backfill-funfactory-raw-description] HTML 详情失败，继续尝试 JSON: ${sourceUrl}`);
    }

    let jsonDetailRaw = '';
    try {
      const productJson = await fetchJson<ShopifyProduct>(`${ORIGIN}/products/${handle}.js`);
      jsonDetailRaw = extractDetailFromShopifyProduct(productJson).rawDescription;
    } catch (error) {
      console.warn(`[backfill-funfactory-raw-description] JSON 详情失败: ${sourceUrl}`);
    }

    const mergedRaw = [jsonDetailRaw, htmlDetailRaw].filter(Boolean).join('\n').trim();
    if (!mergedRaw) continue;
    const translatedRaw = await translateWithCache(mergedRaw, translationCache);
    pendingUpdates.push({
      productId: product.id,
      productName: product.name,
      translatedRaw,
    });
  }

  saveTranslationCache(translationCache);

  // 详情抓取和翻译结束后，再单独做数据库写入，减少长耗时任务夹带 DB 操作导致的掉线。
  await reconnectPrisma();

  for (const [index, update] of pendingUpdates.entries()) {
    console.log(
      `[backfill-funfactory-raw-description] 回填数据库 ${index + 1}/${pendingUpdates.length}: ${update.productName}`,
    );
    await withDbRetry(`更新 product ${update.productName}`, () =>
      prisma.products.update({
        where: { id: update.productId },
        data: {
          specs: {
            rawDescription: update.translatedRaw,
          } as any,
        },
      }),
    );
    updatedProducts += 1;

    await withDbRetry(`更新 toy ${update.productName}`, () =>
      prisma.recommender_toys.updateMany({
        where: {
          original_id: update.productId,
        },
        data: {
          raw_description: update.translatedRaw,
          updated_at: new Date(),
        },
      }),
    );
    updatedToys += 1;
  }

  console.log(
    JSON.stringify(
      {
        scanned: products.length,
        translated: pendingUpdates.length,
        updatedProducts,
        updatedToys,
      },
      null,
      2,
    ),
  );
}

function shouldRunBackfillFunFactoryRawDescription(importMetaUrl: string, argvEntry?: string) {
  if (!argvEntry) return false;
  return importMetaUrl === pathToFileURL(argvEntry).href;
}

if (shouldRunBackfillFunFactoryRawDescription(import.meta.url, process.argv[1])) {
  backfillFunFactoryRawDescription()
    .catch((error) => {
      console.error('[backfill-funfactory-raw-description] 执行失败:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect().catch(() => {});
      await pool.end().catch(() => {});
    });
}
