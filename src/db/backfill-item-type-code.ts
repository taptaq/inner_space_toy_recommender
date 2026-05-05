import pg from 'pg';
import dotenv from 'dotenv';
import { classifyLibraryTypeCode } from '../lib/library-product-type-classifier.ts';

dotenv.config();

const { Pool } = pg;
const TABLES = ['recommender_items', 'recommender_toys'] as const;

type BackfillRow = {
  id: string;
  name: string | null;
  raw_description: string | null;
  gender: string | null;
  physical_form: string | null;
  original_id: string | null;
  tags: string[] | null;
  product_raw_description: string | null;
};

async function runBackfill() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    let foundTargetTable = false;

    for (const tableName of TABLES) {
      const exists = await client.query<{ exists: boolean }>(
        `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = $1
          ) AS exists
        `,
        [tableName],
      );
      if (!exists.rows[0]?.exists) continue;
      foundTargetTable = true;

      console.log(`[backfill-item-type-code] 开始回填 ${tableName}.type_code ...`);

      await client.query(`
        ALTER TABLE public.${tableName}
        ADD COLUMN IF NOT EXISTS type_code TEXT
      `);

      const result = await client.query<BackfillRow>(`
        SELECT
          t.id,
          t.name,
          t.raw_description,
          t.gender,
          t.physical_form,
          t.original_id,
          p.tags,
          COALESCE(p.specs::jsonb ->> 'rawDescription', NULL) AS product_raw_description
        FROM public.${tableName}
        AS t
        LEFT JOIN public.products AS p
          ON t.original_id = p.id
      `);

      let updatedCount = 0;

      for (const row of result.rows) {
        const typeCode = classifyLibraryTypeCode({
          gender: row.gender,
          physicalForm: row.physical_form,
          name: row.name,
          rawDescription:
            [row.raw_description, row.product_raw_description]
              .filter(Boolean)
              .join('\n') || null,
          tags: Array.isArray(row.tags) ? row.tags : [],
        });

        const updateResult = await client.query(
          `
            UPDATE public.${tableName}
            SET type_code = $2,
                updated_at = NOW()
            WHERE id = $1
              AND type_code IS DISTINCT FROM $2
          `,
          [row.id, typeCode],
        );
        updatedCount += updateResult.rowCount ?? 0;
      }

      console.log(
        JSON.stringify(
          {
            table: tableName,
            scanned: result.rowCount ?? 0,
            updated: updatedCount,
          },
          null,
          2,
        ),
      );
    }

    if (!foundTargetTable) {
      throw new Error('public.recommender_items / public.recommender_toys 均不存在');
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

runBackfill().catch((error) => {
  console.error('[backfill-item-type-code] 执行失败:', error);
  process.exitCode = 1;
});
