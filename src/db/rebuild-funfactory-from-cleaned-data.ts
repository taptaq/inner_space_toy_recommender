import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { pathToFileURL } from 'url';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const CLEANED_PATH = path.resolve(process.cwd(), 'src/data/funfactory-official-cleaned-data.json');

type CleanedRow = {
  sourceUrl: string;
  name: string;
  safeDisplayName: string;
  brand: string;
  price: number | null;
  coverImage: string;
  rawDescription: string;
  gender: 'male' | 'female' | 'unisex';
  material: string;
  specs: Record<string, unknown>;
  typeCode: string | null;
  subtypeCode: string | null;
};

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function rebuildFunFactoryPrice(sourceAmount: number | null, currency: string) {
  if (sourceAmount == null || !Number.isFinite(sourceAmount) || sourceAmount <= 0) {
    return null;
  }

  if (String(currency || '').toUpperCase() === 'EUR') {
    return Number.isInteger(sourceAmount) && sourceAmount >= 1000 ? sourceAmount / 100 : sourceAmount;
  }

  return sourceAmount;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function shouldRunRebuildFunFactoryFromCleanedData(importMetaUrl: string, argvEntry?: string) {
  if (!argvEntry) return false;
  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function rebuildFunFactoryFromCleanedData() {
  console.log('[rebuild-funfactory-from-cleaned-data] 开始用 cleaned-data 重建 Fun Factory 入库数据...');
  if (!fs.existsSync(CLEANED_PATH)) {
    throw new Error(`未找到 cleaned data: ${CLEANED_PATH}`);
  }

  const cleanedRows = JSON.parse(fs.readFileSync(CLEANED_PATH, 'utf8')) as CleanedRow[];
  const competitor = await prisma.competitors.findFirst({
    where: {
      OR: [
        { name: { contains: 'Fun Factory', mode: 'insensitive' } },
        { name: { contains: 'funFactory', mode: 'insensitive' } },
        { domain: { contains: 'funfactory.com', mode: 'insensitive' } },
      ],
    },
  });

  const existingProducts = await prisma.products.findMany({
    where: {
      link: { contains: 'funfactory.com', mode: 'insensitive' },
    },
    select: { id: true },
  });
  const productIds = existingProducts.map((row) => row.id);

  if (productIds.length > 0) {
    await prisma.recommender_toys.deleteMany({
      where: {
        OR: [
          { brand: 'Fun Factory' },
          { brand: 'funFactory' },
          { original_id: { in: productIds } },
        ],
      },
    });

    await prisma.products.deleteMany({
      where: {
        id: { in: productIds },
      },
    });
  } else {
    await prisma.recommender_toys.deleteMany({
      where: {
        OR: [{ brand: 'Fun Factory' }, { brand: 'funFactory' }],
      },
    });
  }

  for (const rowChunk of chunkRows(cleanedRows, 20)) {
    await prisma.$transaction(async (tx) => {
      for (const row of rowChunk) {
        const sourceAmount = asNullableNumber((row.specs as any)?.price_source_amount);
        const rebuiltPrice = rebuildFunFactoryPrice(
          sourceAmount ?? row.price,
          String((row.specs as any)?.price_source_currency || 'EUR'),
        );
        const product = await tx.products.create({
          data: {
            name: row.name,
            price: rebuiltPrice,
            image: row.coverImage || null,
            link: row.sourceUrl || null,
            specs: {
              ...(row.specs || {}),
              rawDescription: row.rawDescription || null,
            } as any,
            gender: row.gender === 'male' ? 'Male' : row.gender === 'female' ? 'Female' : 'Unisex',
            tags: Array.isArray(row.specs?.function_tags) ? row.specs.function_tags : [],
            competitor_id: competitor?.id,
          },
        });

        await tx.recommender_toys.create({
          data: {
            original_id: product.id,
            name: row.name,
            safe_display_name: row.safeDisplayName,
            brand: row.brand,
            price: rebuiltPrice,
            max_db: asNullableNumber(row.specs?.max_db),
            waterproof: asNullableNumber(row.specs?.waterproof),
            appearance: asNullableString(row.specs?.appearance),
            physical_form: asNullableString(row.specs?.physical_form),
            motor_type: asNullableString(row.specs?.motor_type),
            gender: row.gender,
            material: row.material,
            image_url: row.coverImage || null,
            raw_description: row.rawDescription || null,
            type_code: asNullableString(row.typeCode),
            subtype_code: asNullableString(row.subtypeCode),
            updated_at: new Date(),
          },
        });
      }
    }, { timeout: 30000 });
  }

  console.log(
    JSON.stringify(
      {
        rebuilt: cleanedRows.length,
      },
      null,
      2,
    ),
  );
}

if (shouldRunRebuildFunFactoryFromCleanedData(import.meta.url, process.argv[1])) {
  rebuildFunFactoryFromCleanedData()
    .catch((error) => {
      console.error('[rebuild-funfactory-from-cleaned-data] 执行失败:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect().catch(() => {});
      await pool.end().catch(() => {});
    });
}
