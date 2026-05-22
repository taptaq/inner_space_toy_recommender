import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const CLEANED_PATH = path.resolve(process.cwd(), 'src/data/funfactory-official-cleaned-data.json');
const MISSING_NAMES = new Set([
  'RYDE | Grinding Dildo | FUN FACTORY',
  'BIG BOSS | Realistischer Vibrator im XL-Format ❤️ | FUN FACTORY',
  'STRONIC G | G-Punkt Pulsator | FUN FACTORY',
  'Druckwellenvibrator MEA online kaufen ❤️ | FUN FACTORY',
  'Rabbitvibrator MISS BI online kaufen ❤️ | FUN FACTORY',
  'SEDUCTION | AIR PULSE VIBRATOR | FUN FACTORY',
  'INTENSE | AIR PULSE VIBRATOR | FUN FACTORY',
  'Auflegevibrator VOLITA online kaufen ❤️ | FUN FACTORY',
  'A-Punkt-Vibrator LADY BI online kaufen ❤️ | FUN FACTORY',
  'Schlanker Vibrator JOUPIE online kaufen ❤️ | FUN FACTORY',
]);

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

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

async function backfillFunFactoryMissingProducts() {
  console.log('[backfill-funfactory-missing-products] 开始补写 Fun Factory 缺失商品...');

  if (!fs.existsSync(CLEANED_PATH)) {
    throw new Error(`未找到 cleaned data: ${CLEANED_PATH}`);
  }

  const cleanedRows = JSON.parse(fs.readFileSync(CLEANED_PATH, 'utf8')) as CleanedRow[];
  const targetRows = cleanedRows.filter((row) => MISSING_NAMES.has(String(row.name || '')));
  const competitor = await prisma.competitors.findFirst({
    where: {
      OR: [
        { name: { contains: 'Fun Factory', mode: 'insensitive' } },
        { name: { contains: 'funFactory', mode: 'insensitive' } },
        { domain: { contains: 'funfactory.com', mode: 'insensitive' } },
      ],
    },
  });

  let synced = 0;
  for (const row of targetRows) {
    const productPayload = {
      name: row.name,
      price: row.price,
      image: row.coverImage || null,
      link: row.sourceUrl || null,
      specs: {
        ...(row.specs || {}),
        rawDescription: row.rawDescription || null,
      } as any,
      gender: row.gender === 'male' ? 'Male' : row.gender === 'female' ? 'Female' : 'Unisex',
      tags: Array.isArray(row.specs?.function_tags) ? row.specs.function_tags : [],
      competitor_id: competitor?.id,
    };

    const toyPayload = {
      name: row.name,
      safe_display_name: row.safeDisplayName,
      brand: row.brand,
      price: row.price,
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
    };

    const existingProduct = await prisma.products.findFirst({
      where: {
        name: row.name,
      },
    });

    let originalId: string;
    if (existingProduct) {
      const updated = await prisma.products.update({
        where: { id: existingProduct.id },
        data: productPayload,
      });
      originalId = updated.id;
    } else {
      const created = await prisma.products.create({
        data: productPayload,
      });
      originalId = created.id;
    }

    await prisma.recommender_toys.deleteMany({ where: { name: row.name } });
    await prisma.recommender_toys.create({
      data: {
        original_id: originalId,
        ...toyPayload,
      },
    });
    synced += 1;
  }

  console.log(
    JSON.stringify(
      {
        targetRows: targetRows.length,
        synced,
      },
      null,
      2,
    ),
  );
}

backfillFunFactoryMissingProducts()
  .catch((error) => {
    console.error('[backfill-funfactory-missing-products] 执行失败:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    await pool.end().catch(() => {});
  });
