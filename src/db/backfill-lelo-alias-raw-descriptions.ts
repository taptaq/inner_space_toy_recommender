import dotenv from 'dotenv';
import pg from 'pg';
import { pathToFileURL } from 'node:url';

dotenv.config();

const { Pool } = pg;

const LELO_ALIAS_TO_CANONICAL = new Map<string, string>([
  ['sona3汐汐贝吮吸', 'SONA™ 3'],
  ['lyla2', 'LYLA™ 2'],
  ['f1sv3', 'F1S™ V3'],
  ['mia3米娅三代口红', 'MIA™ 3'],
  ['tor3代环', 'TOR™ 3'],
  ['tiani™harmony', 'TIANI™ Harmony'],
  ['tianiharmony', 'TIANI™ Harmony'],
  ['tianiduo夫妻共用体感遥控', 'TIANI™ DUO'],
  ['beads缩阴球', 'LELO Beads™'],
  ['gigi3g点按摩', 'GIGI™ 3'],
]);

export function normalizeLooseToyName(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[\s"'`‘’“”\-_.:/\\|()[\]{}+~!?@#$%^&*=,，。；：、]/g, '');
}

export function findLeloAliasCanonicalName(name: string | null | undefined) {
  const normalized = normalizeLooseToyName(name);
  if (!normalized) return null;
  return LELO_ALIAS_TO_CANONICAL.get(normalized) ?? null;
}

export function shouldRunLeloAliasRawDescriptionScript(
  importMetaUrl: string,
  argvEntry?: string,
) {
  if (!argvEntry) return false;
  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function backfillLeloAliasRawDescriptions() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    console.log('[backfill-lelo-alias-raw-descriptions] 开始按 LELO 别名补齐 raw_description ...');

    await client.query('BEGIN');
    await client.query('SET statement_timeout TO 0');
    await client.query("SET lock_timeout TO '5s'");

    const missingRows = await client.query<{
      id: string;
      name: string;
      original_id: string | null;
    }>(
      `
        SELECT t.id, t.name, t.original_id
        FROM public.recommender_toys AS t
        WHERE lower(coalesce(t.brand, '')) = 'lelo'
          AND NULLIF(BTRIM(COALESCE(t.raw_description, '')), '') IS NULL
        ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC NULLS LAST
      `,
    );

    const canonicalNames = Array.from(
      new Set(
        missingRows.rows
          .map((row) => findLeloAliasCanonicalName(row.name))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (canonicalNames.length === 0) {
      await client.query('COMMIT');
      console.log(JSON.stringify({ scanned: missingRows.rowCount ?? 0, updated: 0 }, null, 2));
      return;
    }

    const canonicalResult = await client.query<{
      name: string;
      price: number | null;
      max_db: number | null;
      waterproof: number | null;
      appearance: string | null;
      physical_form: string | null;
      motor_type: string | null;
      gender: string | null;
      material: string | null;
      image_url: string | null;
      raw_description: string | null;
      type_code: string | null;
      subtype_code: string | null;
      original_id: string | null;
    }>(
      `
        SELECT
          name,
          price,
          max_db,
          waterproof,
          appearance,
          physical_form,
          motor_type,
          gender,
          material,
          image_url,
          raw_description,
          type_code,
          subtype_code,
          original_id
        FROM public.recommender_toys
        WHERE lower(coalesce(brand, '')) = 'lelo'
          AND name = ANY($1::text[])
          AND NULLIF(BTRIM(COALESCE(raw_description, '')), '') IS NOT NULL
      `,
      [canonicalNames],
    );

    const canonicalMap = new Map(
      canonicalResult.rows.map((row) => [row.name, row]),
    );

    let updated = 0;
    const updatedNames: string[] = [];

    for (const row of missingRows.rows) {
      const canonicalName = findLeloAliasCanonicalName(row.name);
      if (!canonicalName) continue;

      const source = canonicalMap.get(canonicalName);
      if (!source?.raw_description) continue;

      await client.query(
        `
          UPDATE public.recommender_toys
          SET price = COALESCE(price, $2),
              max_db = COALESCE(max_db, $3),
              waterproof = COALESCE(waterproof, $4),
              appearance = COALESCE(NULLIF(BTRIM(COALESCE(appearance, '')), ''), $5),
              physical_form = COALESCE(NULLIF(BTRIM(COALESCE(physical_form, '')), ''), $6),
              motor_type = COALESCE(NULLIF(BTRIM(COALESCE(motor_type, '')), ''), $7),
              gender = COALESCE(NULLIF(BTRIM(COALESCE(gender, '')), ''), $8),
              material = COALESCE(NULLIF(BTRIM(COALESCE(material, '')), ''), $9),
              image_url = COALESCE(NULLIF(BTRIM(COALESCE(image_url, '')), ''), $10),
              raw_description = $11,
              type_code = COALESCE(type_code, $12),
              subtype_code = COALESCE(subtype_code, $13),
              updated_at = NOW()
          WHERE id = $1
        `,
        [
          row.id,
          source.price,
          source.max_db,
          source.waterproof,
          source.appearance,
          source.physical_form,
          source.motor_type,
          source.gender,
          source.material,
          source.image_url,
          source.raw_description,
          source.type_code,
          source.subtype_code,
        ],
      );

      if (row.original_id) {
        await client.query(
          `
            UPDATE public.products AS p
            SET specs = jsonb_set(
                  COALESCE(p.specs::jsonb, '{}'::jsonb),
                  '{rawDescription}',
                  to_jsonb($2::text),
                  true
                )
            WHERE p.id = $1
          `,
          [row.original_id, source.raw_description],
        );
      }

      updated += 1;
      updatedNames.push(row.name);
    }

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          scanned: missingRows.rowCount ?? 0,
          canonical_names: canonicalNames,
          updated,
          updated_names: updatedNames,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

if (shouldRunLeloAliasRawDescriptionScript(import.meta.url, process.argv[1])) {
  backfillLeloAliasRawDescriptions().catch((error) => {
    console.error('[backfill-lelo-alias-raw-descriptions] 执行失败:', error);
    process.exitCode = 1;
  });
}
