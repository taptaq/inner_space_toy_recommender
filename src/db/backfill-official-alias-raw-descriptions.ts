import dotenv from 'dotenv';
import pg from 'pg';
import { pathToFileURL } from 'node:url';

dotenv.config();

const { Pool } = pg;

const OFFICIAL_ALIAS_TO_CANONICAL = new Map<string, string>([
  ['diamo环', 'Diamo'],
  ['lush器', 'Lush Anal'],
  ['ambi震动器', 'Ambi'],
  ['domi2', 'Domi 2Bluetooth app-controlled wand vibrator suitable for everyone'],
  ['jive2', 'We-Vibe Jive 2'],
  ['melt2', 'We-Vibe Melt 2'],
  ['moxie', 'We-Vibe Moxie+'],
  ['temp', 'We-Vibe Temp'],
  ['gspotwave4', 'Satisfyer G-Spot Wave 4'],
  ['missioncontrol', 'Satisfyer Mission Control'],
  ['perfectpair2', 'Satisfyer Perfect Pair 2'],
  ['playfulfour', 'Satisfyer Playful Four'],
  ['spoton1', 'Satisfyer Spot On 1'],
  ['arcwavezing男式免提振动器', 'Arcwave Zing Rechargeable Vibrating Male Masturbator'],
  ['blowmotion加热振动男性', 'Blowmotion Warming Vibrating Male Masturbator'],
  ['fleshlightxlovehoney男用', 'Fleshlight X Lovehoney Masterstroke Male Masturbator'],
  ['dualembracepulsingsuctiondualstimulator脉动双效吮吸', 'Lovehoney Dual Embrace Pulsing Clitoral Suction Dual Stimulator'],
  ['lovehoneyrosesuctionstimulator玫瑰型吮吸器', 'Lovehoney Rose Clitoral Suction Stimulator'],
  ['fiftyshadesofgreedygirl兔子振动器', 'Fifty Shades of Grey Greedy Girl G-Spot Rabbit Vibrator'],
  ['pleasuretripsiliconerechargeablewand硅胶充电棒振动器', 'Lovehoney Pleasure Trip Silicone Rechargeable Wand Vibrator'],
]);

export type OfficialCanonicalSourceRow = {
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
  recommendation_features: unknown;
};

export function buildOfficialCanonicalSourceMap(
  recommenderRows: OfficialCanonicalSourceRow[],
  productFallbackRows: OfficialCanonicalSourceRow[] = [],
) {
  const canonicalMap = new Map<string, OfficialCanonicalSourceRow>();
  for (const row of productFallbackRows) {
    if (!row.raw_description) continue;
    canonicalMap.set(row.name, row);
  }
  for (const row of recommenderRows) {
    if (!row.raw_description) continue;
    canonicalMap.set(row.name, row);
  }
  return canonicalMap;
}

export function normalizeAliasKey(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[\s"'`‘’“”\-_.:/\\|()[\]{}+~!?@#$%^&*=,，。；：、（）]/g, '');
}

export function findOfficialAliasCanonicalName(name: string | null | undefined) {
  const normalized = normalizeAliasKey(name);
  if (!normalized) return null;
  return OFFICIAL_ALIAS_TO_CANONICAL.get(normalized) ?? null;
}

export function shouldRunOfficialAliasRawDescriptionScript(importMetaUrl: string, argvEntry?: string) {
  if (!argvEntry) return false;
  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function backfillOfficialAliasRawDescriptions() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    console.log('[backfill-official-alias-raw-descriptions] 开始按官方别名补齐 raw_description ...');
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
        WHERE NULLIF(BTRIM(COALESCE(t.raw_description, '')), '') IS NULL
          AND lower(coalesce(t.brand, '')) IN ('lovehoney', 'lovense', 'we-vibe', 'satisfyer')
        ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC NULLS LAST
      `,
    );

    const canonicalNames = Array.from(
      new Set(
        missingRows.rows
          .map((row) => findOfficialAliasCanonicalName(row.name))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (canonicalNames.length === 0) {
      await client.query('COMMIT');
      console.log(JSON.stringify({ scanned: missingRows.rowCount ?? 0, updated: 0 }, null, 2));
      return;
    }

    const canonicalRows = await client.query<OfficialCanonicalSourceRow>(
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
          recommendation_features
        FROM public.recommender_toys
        WHERE name = ANY($1::text[])
      `,
      [canonicalNames],
    );

    const canonicalProductRows = await client.query<OfficialCanonicalSourceRow>(
      `
        SELECT
          name,
          price::numeric AS price,
          CASE
            WHEN COALESCE(specs::jsonb->>'max_db', '') ~ '^\\d+$' THEN (specs::jsonb->>'max_db')::integer
            ELSE NULL
          END AS max_db,
          CASE
            WHEN COALESCE(specs::jsonb->>'waterproof', '') ~ '^\\d+$' THEN (specs::jsonb->>'waterproof')::integer
            ELSE NULL
          END AS waterproof,
          NULLIF(BTRIM(COALESCE(specs::jsonb->>'appearance', '')), '') AS appearance,
          NULLIF(BTRIM(COALESCE(specs::jsonb->>'physical_form', '')), '') AS physical_form,
          NULLIF(BTRIM(COALESCE(specs::jsonb->>'motor_type', '')), '') AS motor_type,
          lower(NULLIF(BTRIM(COALESCE(gender, '')), '')) AS gender,
          NULLIF(BTRIM(COALESCE(specs::jsonb->>'material', '')), '') AS material,
          image AS image_url,
          NULLIF(BTRIM(COALESCE(specs::jsonb->>'rawDescription', '')), '') AS raw_description,
          NULL::text AS type_code,
          NULL::text AS subtype_code,
          NULL::jsonb AS recommendation_features
        FROM public.products
        WHERE name = ANY($1::text[])
      `,
      [canonicalNames],
    );

    const canonicalMap = buildOfficialCanonicalSourceMap(canonicalRows.rows, canonicalProductRows.rows);
    let updated = 0;
    const updatedNames: string[] = [];

    for (const row of missingRows.rows) {
      const canonicalName = findOfficialAliasCanonicalName(row.name);
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
              type_code = COALESCE(NULLIF(type_code, 'unknown'), $12, type_code),
              subtype_code = COALESCE(subtype_code, $13),
              recommendation_features = COALESCE(recommendation_features, $14::jsonb),
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
          source.recommendation_features ? JSON.stringify(source.recommendation_features) : null,
        ],
      );

      if (row.original_id) {
        await client.query(
          `
            UPDATE public.products
            SET price = COALESCE(price, $2),
                specs = jsonb_set(
                  COALESCE(specs::jsonb, '{}'::jsonb),
                  '{rawDescription}',
                  to_jsonb($3::text),
                  true
                )
            WHERE id = $1
          `,
          [row.original_id, source.price, source.raw_description],
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

if (shouldRunOfficialAliasRawDescriptionScript(import.meta.url, process.argv[1])) {
  backfillOfficialAliasRawDescriptions().catch((error) => {
    console.error('[backfill-official-alias-raw-descriptions] 执行失败:', error);
    process.exitCode = 1;
  });
}
