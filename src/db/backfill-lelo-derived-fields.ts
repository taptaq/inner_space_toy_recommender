import dotenv from 'dotenv';
import pg from 'pg';
import { pathToFileURL } from 'node:url';

import {
  classifyLibrarySubtypeCode,
} from '../lib/library-product-type-classifier.ts';
import {
  buildRecommendationProductFeatures,
} from '../lib/recommendation-product-features.ts';
import type { Product } from '../data/mock.ts';

dotenv.config();

const { Pool } = pg;
const RECOMMENDATION_PRODUCT_FEATURE_VERSION = 'recommendation-product-features-v1';

export type LeloDerivedFieldRow = {
  id: string;
  name: string;
  current_price: number | string | null;
  current_type_code: string | null;
  current_subtype_code: string | null;
  current_max_db: number | null;
  current_waterproof: number | null;
  current_recommendation_features: unknown;
  raw_description: string | null;
  product_name: string | null;
  product_price: number | string | null;
  product_tags: string[] | null;
  product_raw_description: string | null;
  gender: string | null;
  physical_form: string | null;
  appearance: string | null;
  motor_type: string | null;
  brand: string | null;
  material: string | null;
  image_url: string | null;
};

function normalizePrice(value: number | string | null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function normalizeRawDescription(row: LeloDerivedFieldRow) {
  return [row.raw_description, row.product_raw_description]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n') || null;
}

function hasAnyHint(text: string, hints: string[]) {
  const source = String(text || '').toLowerCase();
  return hints.some((hint) => source.includes(hint.toLowerCase()));
}

function inferExplicitWaterproof(text: string | null) {
  const source = String(text || '');
  const ipxMatch = source.match(/ipx\s*([0-9])/i);
  if (ipxMatch) return Number(ipxMatch[1]);
  const explicitMatch =
    source.match(/waterproof\s*([0-9])/i) ||
    source.match(/防水\s*([0-9])/i);
  if (explicitMatch) return Number(explicitMatch[1]);
  return /waterproof|100% waterproof|防水/i.test(source) ? 7 : null;
}

function inferExplicitMaxDb(text: string | null) {
  const source = String(text || '');
  const match =
    source.match(/(?:noise level|max(?:imum)? noise|sound level)\s*[:：]?\s*([0-9]{2,3})\s*d?b/i) ||
    source.match(/([0-9]{2,3})\s*d\s*b/i) ||
    source.match(/([0-9]{2,3})\s*分贝/);
  if (!match?.[1]) return null;

  const numeric = Number(match[1]);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function inferLeloTypeCode(row: LeloDerivedFieldRow, rawDescription: string | null) {
  if (row.current_type_code && row.current_type_code !== 'unknown') {
    return row.current_type_code;
  }

  const source = `${row.name}\n${row.product_name || ''}\n${rawDescription || ''}`.toLowerCase();
  if (/bundle|套装|kit/.test(source)) {
    if (/hugo|loki|prostate|前列腺/.test(source)) return 'prostate';
    if (/lubricant|lube|cleaner|保湿液|润滑|清洁喷雾/.test(source) && !/sona|gigi|soraya|tiani|tor|hugo|loki|vibrator|振动/.test(source)) {
      return 'care_accessory';
    }
  }
  if (/condom|避孕套|乳胶/.test(source)) return 'care_accessory';
  if (/cock ring|penis ring|快乐环|阴茎环|锁精环/.test(source)) return 'cock_ring';
  if (/sonic|sensonic|阴蒂刺激器|吮吸|clitoral stimulation/.test(source)) return 'suction';
  if (/oral|舔舌|口交模拟/.test(source)) return 'external_vibe';
  if (/beads|ben wa|缩阴球|凯格尔|盆底/.test(source)) return 'insertable';
  return row.current_type_code;
}

function inferLeloSubtypeCode(
  typeCode: string | null,
  row: LeloDerivedFieldRow,
  rawDescription: string | null,
) {
  const source = `${row.name}\n${row.product_name || ''}\n${rawDescription || ''}`.toLowerCase();

  if (typeCode === 'care_accessory' && /condom|避孕套|乳胶/.test(source)) {
    return 'condom';
  }

  return null;
}

function normalizeProductFeatureProduct(row: LeloDerivedFieldRow): Product {
  const appearance =
    row.appearance === 'high_disguise' ? 'high_disguise' : 'normal';
  const physicalForm =
    row.physical_form === 'internal' || row.physical_form === 'composite'
      ? row.physical_form
      : 'external';
  const motorType = row.motor_type === 'strong' ? 'strong' : 'gentle';
  const gender =
    row.gender === 'male' || row.gender === 'female'
      ? row.gender
      : 'unisex';

  return {
    id: row.id,
    originalId: null,
    name: row.name,
    displayName: undefined,
    safeDisplayName: undefined,
    canonicalName: row.product_name || row.name,
    price: normalizePrice(row.current_price) ?? normalizePrice(row.product_price) ?? 0,
    maxDb: row.current_max_db,
    waterproof: row.current_waterproof,
    appearance,
    physicalForm,
    motorType,
    gender,
    typeCode: row.current_type_code,
    subtypeCode: row.current_subtype_code,
    brand: row.brand ?? 'LELO',
    material: row.material ?? '',
    imagePlaceholder: row.image_url ?? '',
    rawDescription: normalizeRawDescription(row),
    tags: Array.isArray(row.product_tags) ? row.product_tags.filter(Boolean) : [],
  };
}

export function buildLeloDerivedFieldPatch(row: LeloDerivedFieldRow) {
  const rawDescription = normalizeRawDescription(row);
  const tags = Array.isArray(row.product_tags)
    ? row.product_tags.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];

  const typeCode = inferLeloTypeCode(row, rawDescription);
  const subtypeCode =
    row.current_subtype_code ||
    inferLeloSubtypeCode(typeCode, row, rawDescription) ||
    classifyLibrarySubtypeCode({
      gender: row.gender,
      physicalForm: row.physical_form,
      name: row.name,
      rawDescription,
      tags,
      typeCode,
    });

  const explicitMaxDb = inferExplicitMaxDb(rawDescription);
  const explicitWaterproof = inferExplicitWaterproof(rawDescription);
  const looksPoweredDevice =
    typeCode != null &&
    typeCode !== 'unknown' &&
    typeCode !== 'care_accessory' &&
    !hasAnyHint(`${row.name}\n${row.product_name || ''}`, ['condom', '避孕套']);

  return {
    price: normalizePrice(row.current_price) ?? normalizePrice(row.product_price),
    type_code: typeCode,
    subtype_code: subtypeCode,
    max_db:
      typeCode === 'care_accessory'
        ? null
        : row.current_max_db ?? explicitMaxDb ?? (looksPoweredDevice ? 50 : null),
    waterproof:
      typeCode === 'care_accessory'
        ? null
        : row.current_waterproof ?? explicitWaterproof ?? (looksPoweredDevice ? 7 : null),
  };
}

export function buildLeloRecommendationFeaturePayload(row: LeloDerivedFieldRow) {
  const features = buildRecommendationProductFeatures(
    normalizeProductFeatureProduct(row),
  );

  return {
    toyId: row.id,
    featureVersion: RECOMMENDATION_PRODUCT_FEATURE_VERSION,
    features: {
      isSuctionLike: features.isSuctionLike,
      isInsertableLike: features.isInsertableLike,
      supportsAppOrRemote: features.supportsAppOrRemote,
      isCoupleOriented: features.isCoupleOriented,
      hasManyPatterns: features.hasManyPatterns,
      hasStrongSuctionSignal: features.hasStrongSuctionSignal,
      hasGentleSignal: features.hasGentleSignal,
      hasStrongIntensitySignal: features.hasStrongIntensitySignal,
      evidence: features.evidence,
    },
  };
}

export function shouldRunLeloDerivedFieldsScript(importMetaUrl: string, argvEntry?: string) {
  if (!argvEntry) return false;
  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function backfillLeloDerivedFields() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    console.log('[backfill-lelo-derived-fields] 开始回填 LELO 的 price/subtype/recommendation_features ...');
    await client.query('BEGIN');
    await client.query('SET statement_timeout TO 0');
    await client.query("SET lock_timeout TO '5s'");

    await client.query(`
      ALTER TABLE public.recommender_toys
      ADD COLUMN IF NOT EXISTS recommendation_features JSONB
    `);

    const result = await client.query<LeloDerivedFieldRow>(`
      SELECT
        t.id,
        t.name,
        t.price::text AS current_price,
        t.type_code AS current_type_code,
        t.subtype_code AS current_subtype_code,
        t.max_db AS current_max_db,
        t.waterproof AS current_waterproof,
        t.recommendation_features AS current_recommendation_features,
        t.raw_description,
        p.name AS product_name,
        p.price::text AS product_price,
        p.tags AS product_tags,
        COALESCE(p.specs::jsonb ->> 'rawDescription', NULL) AS product_raw_description,
        t.gender,
        t.physical_form,
        t.appearance,
        t.motor_type,
        t.brand,
        t.material,
        t.image_url
      FROM public.recommender_toys AS t
      LEFT JOIN public.products AS p
        ON t.original_id = p.id
      WHERE lower(coalesce(t.brand, '')) = 'lelo'
    `);

    let updated = 0;

    for (const row of result.rows) {
      const patch = buildLeloDerivedFieldPatch(row);
      const recommendationPayload = buildLeloRecommendationFeaturePayload({
        ...row,
        current_price: patch.price ?? row.current_price,
        current_subtype_code: patch.subtype_code ?? row.current_subtype_code,
        current_max_db: patch.max_db ?? row.current_max_db,
        current_waterproof: patch.waterproof ?? row.current_waterproof,
      });

      await client.query(
        `
          UPDATE public.recommender_toys
          SET price = COALESCE(price, $2::numeric),
              type_code = COALESCE(NULLIF(type_code, 'unknown'), $3::text, type_code),
              subtype_code = COALESCE(subtype_code, $4::text),
              max_db = CASE
                WHEN $3::text = 'care_accessory' THEN NULL
                ELSE COALESCE(max_db, $5::integer)
              END,
              waterproof = CASE
                WHEN $3::text = 'care_accessory' THEN NULL
                ELSE COALESCE(waterproof, $6::integer)
              END,
              recommendation_features = COALESCE(recommendation_features, $7::jsonb),
              updated_at = NOW()
          WHERE id = $1::uuid
        `,
        [
          row.id,
          patch.price,
          patch.type_code,
          patch.subtype_code,
          patch.max_db,
          patch.waterproof,
          JSON.stringify({
            featureVersion: recommendationPayload.featureVersion,
            ...recommendationPayload.features,
          }),
        ],
      );

      updated += 1;
    }

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          scanned: result.rowCount ?? 0,
          updated,
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

if (shouldRunLeloDerivedFieldsScript(import.meta.url, process.argv[1])) {
  backfillLeloDerivedFields().catch((error) => {
    console.error('[backfill-lelo-derived-fields] 执行失败:', error);
    process.exitCode = 1;
  });
}
