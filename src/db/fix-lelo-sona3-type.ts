import dotenv from 'dotenv';
import pg from 'pg';
import { pathToFileURL } from 'node:url';

dotenv.config();

const { Pool } = pg;

export function shouldRunFixLeloSona3TypeScript(importMetaUrl: string, argvEntry?: string) {
  if (!argvEntry) return false;
  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function fixLeloSona3Type() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await client.query(
      `
        UPDATE public.recommender_toys
        SET type_code = 'suction',
            subtype_code = 'suction_pure',
            updated_at = NOW()
        WHERE lower(coalesce(brand, '')) = 'lelo'
          AND name = 'SONA™ 3'
        RETURNING id, name, type_code, subtype_code
      `,
    );
    await client.query('COMMIT');
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

if (shouldRunFixLeloSona3TypeScript(import.meta.url, process.argv[1])) {
  fixLeloSona3Type().catch((error) => {
    console.error('[fix-lelo-sona3-type] 执行失败:', error);
    process.exitCode = 1;
  });
}
