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
import {
  buildNormalizedSpecs,
} from '../scraper/funfactory-official/cleaner.ts';
import { translateRawDescriptionToZh } from '../scraper/shared/raw-description-translator.ts';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const ORIGIN = 'https://www.funfactory.com';
const DEFAULT_NAME = 'LAYA III';
const FALLBACK_EUR_TO_CNY_RATE = 7.8;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

const REQUEST_HEADERS: HeadersInit = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
  'accept-language': 'de-DE,de;q=0.9,en;q=0.8,zh-CN;q=0.7',
  pragma: 'no-cache',
  'cache-control': 'no-cache',
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

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: REQUEST_HEADERS });
  if (!response.ok) {
    throw new Error(`[backfill-funfactory-single] HTML 请求失败 ${response.status}: ${url}`);
  }
  return await response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { ...REQUEST_HEADERS, accept: 'application/json,text/plain;q=0.9,*/*;q=0.8' },
  });
  if (!response.ok) {
    throw new Error(`[backfill-funfactory-single] JSON 请求失败 ${response.status}: ${url}`);
  }
  return (await response.json()) as T;
}

function getTargetNameFromArgv() {
  return process.argv.slice(2).join(' ').trim() || DEFAULT_NAME;
}

async function backfillFunFactorySingle() {
  const targetName = getTargetNameFromArgv();
  console.log(`[backfill-funfactory-single] 开始处理单条样本: ${targetName}`);

  const product = await withDbRetry(`查找 ${targetName}`, () =>
    prisma.products.findFirst({
      where: {
        OR: [
          { name: targetName },
          { name: { contains: targetName, mode: 'insensitive' } },
        ],
        link: {
          contains: 'funfactory.com',
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        link: true,
        image: true,
        specs: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    }),
  );

  if (!product?.link) {
    throw new Error(`未找到 Fun Factory 商品: ${targetName}`);
  }

  const sourceUrl = normalizeProductUrl(product.link);
  const handle = sourceUrl.match(/\/products\/([^/?#]+)/i)?.[1] || '';
  if (!handle) {
    throw new Error(`无法从链接解析 handle: ${sourceUrl}`);
  }

  let htmlDetail = null as ReturnType<typeof extractDetailFromHtml> | null;
  try {
    const html = await fetchText(sourceUrl);
    htmlDetail = extractDetailFromHtml(html, sourceUrl);
  } catch (error) {
    console.warn(`[backfill-funfactory-single] HTML 详情失败，继续 JSON 兜底: ${sourceUrl}`);
  }

  let jsonDetail = null as ReturnType<typeof extractDetailFromShopifyProduct> | null;
  try {
    const productJson = await fetchJson<ShopifyProduct>(`${ORIGIN}/products/${handle}.js`);
    jsonDetail = extractDetailFromShopifyProduct(productJson);
  } catch (error) {
    console.warn(`[backfill-funfactory-single] JSON 详情失败，继续 HTML 兜底: ${sourceUrl}`);
  }

  const mergedRaw = [htmlDetail?.rawDescription, jsonDetail?.rawDescription]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n')
    .trim();
  if (!mergedRaw) {
    throw new Error(`未能抓到有效详情正文: ${sourceUrl}`);
  }

  const translatedRaw = await translateRawDescriptionToZh(mergedRaw, {
    cachePath: 'src/data/funfactory-official-raw-description-zh-cache.json',
    logLabel: 'backfill-funfactory-single',
  }).catch(() => mergedRaw);

  const priceSourceAmount =
    typeof (product.specs as Record<string, unknown> | null)?.price_source_amount === 'number'
      ? ((product.specs as Record<string, unknown>).price_source_amount as number)
      : null;
  const originalPriceSourceAmount =
    typeof (product.specs as Record<string, unknown> | null)?.original_price_source_amount === 'number'
      ? ((product.specs as Record<string, unknown>).original_price_source_amount as number)
      : null;
  const priceCurrency =
    typeof (product.specs as Record<string, unknown> | null)?.price_source_currency === 'string'
      ? String((product.specs as Record<string, unknown>).price_source_currency)
      : 'EUR';

  const specs = buildNormalizedSpecs(
    {
      sourceUrl,
      name: product.name,
      subtitle: htmlDetail?.subtitle || jsonDetail?.subtitle || '',
      coverImage: htmlDetail?.coverImage || jsonDetail?.coverImage || product.image || null,
      rawDescription: translatedRaw,
      priceSourceAmount,
      originalPriceSourceAmount,
      priceCurrency,
      categoryHints: [],
      genderHint: null,
    },
    {
      rate: FALLBACK_EUR_TO_CNY_RATE,
      source: 'fallback',
      date: null,
      currency: 'EUR',
    },
  );

  await withDbRetry(`更新 product ${product.name}`, () =>
    prisma.products.update({
      where: { id: product.id },
      data: {
        image: htmlDetail?.coverImage || jsonDetail?.coverImage || product.image,
        specs: {
          ...(typeof product.specs === 'object' && product.specs ? (product.specs as object) : {}),
          ...specs,
          rawDescription: translatedRaw,
        } as any,
        gender: specs.gender === 'male' ? 'Male' : specs.gender === 'female' ? 'Female' : 'Unisex',
        tags: specs.function_tags,
      },
    }),
  );

  await withDbRetry(`更新 toy ${product.name}`, () =>
    prisma.recommender_toys.updateMany({
      where: {
        original_id: product.id,
      },
      data: {
        gender: specs.gender,
        max_db: specs.max_db,
        waterproof: specs.waterproof,
        appearance: specs.appearance,
        physical_form: specs.physical_form,
        motor_type: specs.motor_type,
        material: specs.material,
        image_url: htmlDetail?.coverImage || jsonDetail?.coverImage || product.image || null,
        raw_description: translatedRaw,
        type_code: specs.type_code,
        subtype_code: specs.subtype_code,
        updated_at: new Date(),
      },
    }),
  );

  console.log(
    JSON.stringify(
      {
        productId: product.id,
        name: product.name,
        sourceUrl,
        translatedRawPreview: translatedRaw.slice(0, 300),
        gender: specs.gender,
        max_db: specs.max_db,
        waterproof: specs.waterproof,
        material: specs.material,
        type_code: specs.type_code,
        subtype_code: specs.subtype_code,
      },
      null,
      2,
    ),
  );
}

function shouldRunBackfillFunFactorySingle(importMetaUrl: string, argvEntry?: string) {
  if (!argvEntry) return false;
  return importMetaUrl === pathToFileURL(argvEntry).href;
}

if (shouldRunBackfillFunFactorySingle(import.meta.url, process.argv[1])) {
  backfillFunFactorySingle()
    .catch((error) => {
      console.error('[backfill-funfactory-single] 执行失败:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect().catch(() => {});
      await pool.end().catch(() => {});
    });
}
