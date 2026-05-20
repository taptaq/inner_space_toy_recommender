import dotenv from 'dotenv';
import pg from 'pg';
import { fileURLToPath } from 'node:url';

dotenv.config();

const { Pool } = pg;

const LOVENSE_FINAL_PATCHES = new Map<string, {
  type_code: string;
  subtype_code: string | null;
  gender: string;
  max_db: number | null;
  waterproof: number | null;
}>([
  [
    'Lush',
    {
      type_code: 'insertable',
      subtype_code: 'insertable_vibe',
      gender: 'unisex',
      max_db: 50,
      waterproof: 7,
    },
  ],
  [
    'Max 2 and Edge 2Gay s',
    {
      type_code: 'couples',
      subtype_code: 'insertable_couples',
      gender: 'male',
      max_db: 40,
      waterproof: 7,
    },
  ],
  [
    'USB Bluetooth Adapter',
    {
      type_code: 'unknown',
      subtype_code: null,
      gender: 'unisex',
      max_db: null,
      waterproof: null,
    },
  ],
]);

export function getLovenseFinalPatch(name: string) {
  return LOVENSE_FINAL_PATCHES.get(name) ?? null;
}

async function fixLovenseFinalThree() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const updatedNames: string[] = [];

    for (const [name, patch] of LOVENSE_FINAL_PATCHES) {
      await client.query(
        `
          UPDATE public.recommender_toys
          SET type_code = $2,
              subtype_code = $3,
              gender = $4,
              max_db = $5,
              waterproof = $6,
              updated_at = NOW()
          WHERE lower(coalesce(brand, '')) = 'lovense'
            AND name = $1
        `,
        [
          name,
          patch.type_code,
          patch.subtype_code,
          patch.gender,
          patch.max_db,
          patch.waterproof,
        ],
      );
      updatedNames.push(name);
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({ updated: updatedNames.length, updatedNames }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fixLovenseFinalThree().catch((error) => {
    console.error('[fix-lovense-final-3] 执行失败:', error);
    process.exitCode = 1;
  });
}
