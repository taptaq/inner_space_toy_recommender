import dotenv from 'dotenv';
import pg from 'pg';
import { fileURLToPath } from 'node:url';

dotenv.config();

const { Pool } = pg;

export type WeVibeDerivedRow = {
  name: string;
  current_type_code: string | null;
  current_subtype_code: string | null;
  raw_description: string | null;
};

export function buildWeVibeDerivedPatch(row: WeVibeDerivedRow) {
  const source = `${row.name}\n${row.raw_description || ''}`.toLowerCase();

  if (row.current_type_code === 'prostate' && !row.current_subtype_code) {
    return {
      type_code: 'prostate',
      subtype_code: 'prostate_vibe',
    };
  }

  if (row.current_type_code === 'wearable_remote' && !row.current_subtype_code) {
    if (/jive 2|wearable egg|g-spot/.test(source) && !/moxie|set/.test(source)) {
      return {
        type_code: 'wearable_remote',
        subtype_code: 'insertable_remote',
      };
    }

    if (/jive|moxie|wearable/.test(source)) {
      return {
        type_code: 'wearable_remote',
        subtype_code: 'dual_wearable_remote',
      };
    }
  }

  if (/we-vibe temp|temperature play vibrator|lay-on vibrator/.test(source)) {
    return {
      type_code: 'external_vibe',
      subtype_code: 'bullet_vibe',
    };
  }

  if ((!row.current_type_code || row.current_type_code === 'unknown') && /perfect match|share ultra-thrilling|fifty shades|moving as one/.test(source)) {
    return {
      type_code: 'couples',
      subtype_code: 'external_couples',
    };
  }

  return {
    type_code: row.current_type_code,
    subtype_code: row.current_subtype_code,
  };
}

async function backfillWeVibeDerivedFields() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    console.log('[backfill-wevibe-derived-fields] 开始回填 We-Vibe 剩余 subtype ...');
    await client.query('BEGIN');

    const result = await client.query<{
      id: string;
      name: string;
      current_type_code: string | null;
      current_subtype_code: string | null;
      raw_description: string | null;
    }>(
      `
        SELECT
          id,
          name,
          type_code AS current_type_code,
          subtype_code AS current_subtype_code,
          raw_description
        FROM public.recommender_toys
        WHERE lower(coalesce(brand, '')) = 'we-vibe'
          AND NULLIF(BTRIM(COALESCE(subtype_code, '')), '') IS NULL
      `,
    );

    let updated = 0;
    for (const row of result.rows) {
      const patch = buildWeVibeDerivedPatch(row);
      if (!patch.subtype_code) continue;

      await client.query(
        `
          UPDATE public.recommender_toys
          SET type_code = $2,
              subtype_code = $3,
              updated_at = NOW()
          WHERE id = $1::uuid
        `,
        [row.id, patch.type_code, patch.subtype_code],
      );
      updated += 1;
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({ scanned: result.rowCount ?? 0, updated }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  backfillWeVibeDerivedFields().catch((error) => {
    console.error('[backfill-wevibe-derived-fields] 执行失败:', error);
    process.exitCode = 1;
  });
}
