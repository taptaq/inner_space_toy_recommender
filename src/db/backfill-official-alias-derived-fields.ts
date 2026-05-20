import dotenv from 'dotenv';
import pg from 'pg';
import { pathToFileURL } from 'node:url';
import { findOfficialAliasCanonicalName } from './backfill-official-alias-raw-descriptions.ts';

dotenv.config();

const { Pool } = pg;

export type OfficialAliasDerivedFieldRow = {
  id: string;
  name: string;
  current_price: number | string | null;
  current_gender: string | null;
  current_type_code: string | null;
  current_subtype_code: string | null;
  current_max_db: number | null;
  current_waterproof: number | null;
  current_recommendation_features: unknown;
  raw_description: string | null;
  canonical_name: string | null;
  canonical_price: number | string | null;
  canonical_gender: string | null;
  canonical_type_code: string | null;
  canonical_subtype_code: string | null;
  canonical_max_db: number | null;
  canonical_waterproof: number | null;
  canonical_recommendation_features: unknown;
};

function normalizePrice(value: number | string | null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function buildOfficialAliasDerivedFieldPatch(row: OfficialAliasDerivedFieldRow) {
  return {
    price: normalizePrice(row.current_price) ?? normalizePrice(row.canonical_price),
    gender: row.current_gender ?? row.canonical_gender,
    type_code: row.current_type_code || row.canonical_type_code,
    subtype_code: row.current_subtype_code || row.canonical_subtype_code,
    max_db: row.current_max_db ?? row.canonical_max_db,
    waterproof: row.current_waterproof ?? row.canonical_waterproof,
    recommendation_features:
      row.current_recommendation_features ?? row.canonical_recommendation_features,
  };
}

export function shouldRunOfficialAliasDerivedFieldsScript(importMetaUrl: string, argvEntry?: string) {
  if (!argvEntry) return false;
  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function backfillOfficialAliasDerivedFields() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    console.log('[backfill-official-alias-derived-fields] 开始按官方别名补齐派生字段 ...');
    await client.query('BEGIN');
    await client.query('SET statement_timeout TO 0');
    await client.query("SET lock_timeout TO '5s'");

    const rows = await client.query<{
      id: string;
      name: string;
    }>(
      `
        SELECT id, name
        FROM public.recommender_toys
        WHERE lower(coalesce(brand, '')) IN ('lovehoney', 'lovense', 'we-vibe', 'satisfyer')
      `,
    );

    const aliasPairs = rows.rows
      .map((row) => ({
        id: row.id,
        name: row.name,
        canonicalName: findOfficialAliasCanonicalName(row.name),
      }))
      .filter((row): row is { id: string; name: string; canonicalName: string } => Boolean(row.canonicalName));

    const canonicalNames = Array.from(new Set(aliasPairs.map((row) => row.canonicalName)));

    const canonicalRows = await client.query<{
      name: string;
      price: number | null;
      gender: string | null;
      type_code: string | null;
      subtype_code: string | null;
      max_db: number | null;
      waterproof: number | null;
      recommendation_features: unknown;
    }>(
      `
        SELECT
          name,
          price,
          gender,
          type_code,
          subtype_code,
          max_db,
          waterproof,
          recommendation_features
        FROM public.recommender_toys
        WHERE name = ANY($1::text[])
      `,
      [canonicalNames],
    );

    const canonicalMap = new Map(canonicalRows.rows.map((row) => [row.name, row]));

    let updated = 0;
    const updatedNames: string[] = [];

    for (const alias of aliasPairs) {
      const currentRowResult = await client.query<OfficialAliasDerivedFieldRow>(
        `
          SELECT
            t.id,
            t.name,
            t.price::text AS current_price,
            t.gender AS current_gender,
            t.type_code AS current_type_code,
            t.subtype_code AS current_subtype_code,
            t.max_db AS current_max_db,
            t.waterproof AS current_waterproof,
            t.recommendation_features AS current_recommendation_features,
            t.raw_description,
            $2::text AS canonical_name,
            NULL::numeric AS canonical_price,
            NULL::text AS canonical_gender,
            NULL::text AS canonical_type_code,
            NULL::text AS canonical_subtype_code,
            NULL::integer AS canonical_max_db,
            NULL::integer AS canonical_waterproof,
            NULL::jsonb AS canonical_recommendation_features
          FROM public.recommender_toys AS t
          WHERE t.id = $1::uuid
        `,
        [alias.id, alias.canonicalName],
      );

      const current = currentRowResult.rows[0];
      if (!current) continue;
      const canonical = canonicalMap.get(alias.canonicalName);
      if (!canonical) continue;

      const patch = buildOfficialAliasDerivedFieldPatch({
        ...current,
        canonical_name: alias.canonicalName,
        canonical_price: canonical.price,
        canonical_gender: (canonical as any).gender ?? null,
        canonical_type_code: canonical.type_code,
        canonical_subtype_code: canonical.subtype_code,
        canonical_max_db: canonical.max_db,
        canonical_waterproof: canonical.waterproof,
        canonical_recommendation_features: canonical.recommendation_features,
      });

      await client.query(
        `
          UPDATE public.recommender_toys
          SET price = COALESCE(price, $2::numeric),
              gender = COALESCE(NULLIF(BTRIM(COALESCE(gender, '')), ''), $3::text),
              type_code = COALESCE(NULLIF(type_code, 'unknown'), $4::text, type_code),
              subtype_code = COALESCE(subtype_code, $5::text),
              max_db = COALESCE(max_db, $6::integer),
              waterproof = COALESCE(waterproof, $7::integer),
              recommendation_features = COALESCE(recommendation_features, $8::jsonb),
              updated_at = NOW()
          WHERE id = $1::uuid
        `,
        [
          alias.id,
          patch.price,
          patch.gender,
          patch.type_code,
          patch.subtype_code,
          patch.max_db,
          patch.waterproof,
          patch.recommendation_features ? JSON.stringify(patch.recommendation_features) : null,
        ],
      );

      updated += 1;
      updatedNames.push(alias.name);
    }

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          alias_count: aliasPairs.length,
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

if (shouldRunOfficialAliasDerivedFieldsScript(import.meta.url, process.argv[1])) {
  backfillOfficialAliasDerivedFields().catch((error) => {
    console.error('[backfill-official-alias-derived-fields] 执行失败:', error);
    process.exitCode = 1;
  });
}
