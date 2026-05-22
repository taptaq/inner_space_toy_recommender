import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { pathToFileURL } from 'url';

import {
  buildNormalizedSpecs,
} from '../scraper/funfactory-official/cleaner.ts';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const BUFFER_PATH = path.resolve(process.cwd(), 'src/data/funfactory-official-review-buffer.json');
const FALLBACK_EUR_TO_CNY_RATE = 7.8;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type BufferRow = {
  sourceUrl?: string;
  name?: string;
  subtitle?: string;
  coverImage?: string | null;
  rawDescription?: string;
  priceSourceAmount?: number | null;
  originalPriceSourceAmount?: number | null;
  priceCurrency?: string | null;
  categoryHints?: string[] | null;
  genderHint?: string | null;
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

export function shouldRunBackfillFunFactoryRefreshNonpriceFields(importMetaUrl: string, argvEntry?: string) {
  if (!argvEntry) return false;
  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function backfillFunFactoryRefreshNonpriceFields() {
  console.log('[backfill-funfactory-refresh-nonprice-fields] 开始重洗 Fun Factory 非价格字段...');

  if (!fs.existsSync(BUFFER_PATH)) {
    throw new Error(`未找到 review buffer: ${BUFFER_PATH}`);
  }

  const bufferRows = JSON.parse(fs.readFileSync(BUFFER_PATH, 'utf8')) as BufferRow[];
  const fx = {
    rate: FALLBACK_EUR_TO_CNY_RATE,
    source: 'fallback',
    date: null,
    currency: 'EUR',
  } as const;

  let updatedProducts = 0;
  let updatedToys = 0;

  for (const row of bufferRows) {
    const sourceUrl = String(row.sourceUrl || '').trim();
    const name = String(row.name || '').trim();
    if (!sourceUrl || !name) continue;

    const product = await withDbRetry(`查找 ${name}`, () =>
      prisma.products.findFirst({
        where: {
          link: sourceUrl,
        },
      }),
    );
    if (!product) continue;

    const persistedRawDescription =
      typeof product.specs === 'object' &&
      product.specs &&
      typeof (product.specs as Record<string, unknown>).rawDescription === 'string' &&
      String((product.specs as Record<string, unknown>).rawDescription || '').trim().length > 0
        ? String((product.specs as Record<string, unknown>).rawDescription)
        : String(row.rawDescription || '');

    const specs = buildNormalizedSpecs(
      {
        ...row,
        name,
        rawDescription: persistedRawDescription,
      },
      fx,
    );

    await withDbRetry(`更新 product ${name}`, () =>
      prisma.products.update({
        where: { id: product.id },
        data: {
          image: row.coverImage || product.image,
          specs: {
            ...(typeof product.specs === 'object' && product.specs ? (product.specs as object) : {}),
            ...specs,
            rawDescription: persistedRawDescription || null,
          } as any,
          gender: specs.gender === 'male' ? 'Male' : specs.gender === 'female' ? 'Female' : 'Unisex',
          tags: specs.function_tags,
        },
      }),
    );
    updatedProducts += 1;

    await withDbRetry(`更新 toy ${name}`, () =>
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
          image_url: row.coverImage || null,
          raw_description: persistedRawDescription || null,
          type_code: specs.type_code,
          subtype_code: specs.subtype_code,
          updated_at: new Date(),
        },
      }),
    );
    updatedToys += 1;
  }

  console.log(
    JSON.stringify(
      {
        updatedProducts,
        updatedToys,
      },
      null,
      2,
    ),
  );
}

if (shouldRunBackfillFunFactoryRefreshNonpriceFields(import.meta.url, process.argv[1])) {
  backfillFunFactoryRefreshNonpriceFields()
    .catch((error) => {
      console.error('[backfill-funfactory-refresh-nonprice-fields] 执行失败:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect().catch(() => {});
      await pool.end().catch(() => {});
    });
}
