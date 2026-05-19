import dotenv from "dotenv";
import pg from "pg";
import { pathToFileURL } from "node:url";

import type { Product } from "../data/mock.ts";
import {
  buildRecommendationProductFeatures,
  type RecommendationEvidenceSnippet,
} from "../lib/recommendation-product-features.ts";

dotenv.config();

const { Pool } = pg;
const RECOMMENDATION_FEATURE_READ_BATCH_SIZE = 100;
const RECOMMENDATION_FEATURE_UPDATE_BATCH_SIZE = 200;
const RECOMMENDATION_FEATURE_SIGNAL_TEXT_LIMIT = 1200;

export const RECOMMENDATION_PRODUCT_FEATURE_VERSION =
  "recommendation-product-features-v1";

export type RecommendationFeatureBackfillRow = {
  id: string;
  original_id: string | null;
  name: string;
  safe_display_name: string | null;
  price: string | number | null;
  max_db: number | null;
  waterproof: number | null;
  appearance: string | null;
  physical_form: string | null;
  motor_type: string | null;
  gender: string | null;
  brand: string | null;
  material: string | null;
  image_url: string | null;
  raw_description: string | null;
  type_code: string | null;
  subtype_code: string | null;
  product_tags: string[] | null;
  product_raw_description: string | null;
};

export type RecommendationFeatureBackfillPayload = {
  toyId: string;
  featureVersion: typeof RECOMMENDATION_PRODUCT_FEATURE_VERSION;
  features: {
    isSuctionLike: boolean;
    isInsertableLike: boolean;
    supportsAppOrRemote: boolean;
    isCoupleOriented: boolean;
    hasManyPatterns: boolean;
    hasStrongSuctionSignal: boolean;
    hasGentleSignal: boolean;
    hasStrongIntensitySignal: boolean;
    evidence: RecommendationEvidenceSnippet[];
  };
};

type RecommendationFeatureToyBaseRow = Omit<
  RecommendationFeatureBackfillRow,
  "product_tags" | "product_raw_description"
> & {
  current_recommendation_features: unknown;
};

type ProductSignalRow = {
  id: string;
  product_tags: string[] | null;
  product_raw_description: string | null;
};

function normalizeAppearance(value: string | null): Product["appearance"] {
  return value === "high_disguise" ? "high_disguise" : "normal";
}

function normalizePhysicalForm(value: string | null): Product["physicalForm"] {
  if (value === "internal" || value === "composite") return value;
  return "external";
}

function normalizeMotorType(value: string | null): Product["motorType"] {
  return value === "strong" ? "strong" : "gentle";
}

function normalizeGender(value: string | null): Product["gender"] {
  if (value === "male" || value === "female") return value;
  return "unisex";
}

function normalizePrice(value: string | number | null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeRawDescription(row: RecommendationFeatureBackfillRow) {
  return [row.raw_description, row.product_raw_description]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n") || null;
}

export function buildRecommendationFeatureBackfillProduct(
  row: RecommendationFeatureBackfillRow,
): Product {
  return {
    id: row.id,
    originalId: row.original_id,
    name: row.name,
    displayName: row.safe_display_name ?? undefined,
    safeDisplayName: row.safe_display_name ?? undefined,
    price: normalizePrice(row.price),
    maxDb: row.max_db,
    waterproof: row.waterproof,
    appearance: normalizeAppearance(row.appearance),
    physicalForm: normalizePhysicalForm(row.physical_form),
    motorType: normalizeMotorType(row.motor_type),
    gender: normalizeGender(row.gender),
    typeCode: row.type_code,
    subtypeCode: row.subtype_code,
    brand: row.brand ?? "",
    material: row.material ?? "",
    imagePlaceholder: row.image_url ?? "",
    rawDescription: normalizeRawDescription(row),
    tags: Array.isArray(row.product_tags)
      ? row.product_tags.filter(
          (tag): tag is string => typeof tag === "string" && tag.trim().length > 0,
        )
      : [],
  };
}

export function buildRecommendationFeatureBackfillPayload(
  row: RecommendationFeatureBackfillRow,
): RecommendationFeatureBackfillPayload {
  const features = buildRecommendationProductFeatures(
    buildRecommendationFeatureBackfillProduct(row),
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

export function chunkRecommendationFeatureItems<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

export function collectUniqueRecommendationFeatureOriginalIds(
  rows: Array<Pick<RecommendationFeatureBackfillRow, "original_id">>,
) {
  return [
    ...new Set(
      rows
        .map((row) => row.original_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  ];
}

export function hydrateRecommendationFeatureBackfillRows(
  toyRows: RecommendationFeatureToyBaseRow[],
  productRowsById: Map<string, ProductSignalRow>,
): RecommendationFeatureBackfillRow[] {
  return toyRows.map((row) => {
    const productRow = row.original_id
      ? productRowsById.get(row.original_id)
      : undefined;

    return {
      ...row,
      product_tags: productRow?.product_tags ?? [],
      product_raw_description: productRow?.product_raw_description ?? null,
    };
  });
}

export function buildRecommendationFeatureUpdateBatch(
  payloads: RecommendationFeatureBackfillPayload[],
) {
  const placeholders = payloads
    .map(
      (_, index) =>
        `($${index * 2 + 1}::uuid, $${index * 2 + 2}::jsonb)`,
    )
    .join(", ");
  const values = payloads.flatMap((payload) => [
    payload.toyId,
    JSON.stringify({
      featureVersion: payload.featureVersion,
      ...payload.features,
    }),
  ]);

  return {
    sql: `
      UPDATE public.recommender_toys AS t
      SET recommendation_features = v.recommendation_features,
          updated_at = NOW()
      FROM (
        VALUES ${placeholders}
      ) AS v(id, recommendation_features)
      WHERE t.id = v.id
        AND t.recommendation_features IS DISTINCT FROM v.recommendation_features
    `,
    values,
  };
}

export function shouldRunRecommendationFeatureBackfillScript(
  importMetaUrl: string,
  argvEntry?: string,
) {
  if (!argvEntry) {
    return false;
  }

  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function ensureRecommendationFeaturesColumn(client: pg.PoolClient) {
  const columnExistsResult = await client.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'recommender_toys'
        AND column_name = 'recommendation_features'
    ) AS exists
  `);

  if (!columnExistsResult.rows[0]?.exists) {
    await client.query(`
      ALTER TABLE public.recommender_toys
      ADD COLUMN recommendation_features JSONB
    `);
  }
}

async function readRecommendationFeatureBatch(
  client: pg.PoolClient,
  lastSeenId?: string,
) {
  const params: Array<number | string> = [
    RECOMMENDATION_FEATURE_SIGNAL_TEXT_LIMIT,
    RECOMMENDATION_FEATURE_READ_BATCH_SIZE,
  ];
  const cursorClause =
    typeof lastSeenId === "string"
      ? "WHERE t.id > $3::uuid"
      : "";

  if (typeof lastSeenId === "string") {
    params.push(lastSeenId);
  }

  const result = await client.query<RecommendationFeatureToyBaseRow>(
    `
      SELECT
        t.id,
        t.original_id,
        t.name,
        t.safe_display_name,
        t.price::text AS price,
        t.max_db,
        t.waterproof,
        t.appearance,
        t.physical_form,
        t.motor_type,
        t.gender,
        t.brand,
        t.material,
        t.image_url,
        LEFT(COALESCE(t.raw_description, ''), $1) AS raw_description,
        t.type_code,
        t.subtype_code,
        t.recommendation_features AS current_recommendation_features
      FROM public.recommender_toys AS t
      ${cursorClause}
      ORDER BY t.id
      LIMIT $2
    `,
    params,
  );

  return result.rows;
}

async function backfillRecommendationProductFeatures() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log(
      "[backfill-recommendation-product-features] 开始回填 recommender_toys.recommendation_features ...",
    );
    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");
    await ensureRecommendationFeaturesColumn(client);

    let scanned = 0;
    let updated = 0;
    let lastSeenId: string | undefined;
    let batchIndex = 0;

    while (true) {
      const toyBatch = await readRecommendationFeatureBatch(client, lastSeenId);

      if (toyBatch.length === 0) {
        break;
      }

      batchIndex += 1;
      scanned += toyBatch.length;
      lastSeenId = toyBatch[toyBatch.length - 1]?.id;

      const originalIds = collectUniqueRecommendationFeatureOriginalIds(toyBatch);
      const productRowsById = new Map<string, ProductSignalRow>();

      for (const batch of chunkRecommendationFeatureItems(
        originalIds,
        RECOMMENDATION_FEATURE_UPDATE_BATCH_SIZE,
      )) {
        const productResult = await client.query<ProductSignalRow>(
          `
            SELECT
              p.id,
              p.tags AS product_tags,
              LEFT(COALESCE(p.specs::jsonb ->> 'rawDescription', ''), $2) AS product_raw_description
            FROM public.products AS p
            WHERE p.id = ANY($1::uuid[])
          `,
          [batch, RECOMMENDATION_FEATURE_SIGNAL_TEXT_LIMIT],
        );

        for (const row of productResult.rows) {
          productRowsById.set(row.id, row);
        }
      }

      const hydratedBatch = hydrateRecommendationFeatureBackfillRows(
        toyBatch,
        productRowsById,
      );
      const payloads = hydratedBatch.map(buildRecommendationFeatureBackfillPayload);

      for (const batch of chunkRecommendationFeatureItems(
        payloads,
        RECOMMENDATION_FEATURE_UPDATE_BATCH_SIZE,
      )) {
        const update = buildRecommendationFeatureUpdateBatch(batch);
        const result = await client.query(update.sql, update.values);
        updated += result.rowCount ?? 0;
      }

      console.log(
        `[backfill-recommendation-product-features] 已完成批次 ${batchIndex}，本批 ${toyBatch.length} 条，累计扫描 ${scanned} 条，累计更新 ${updated} 条`,
      );
    }

    console.log(
      JSON.stringify(
        {
          scanned,
          updated,
          featureVersion: RECOMMENDATION_PRODUCT_FEATURE_VERSION,
          column: "recommender_toys.recommendation_features",
        },
        null,
        2,
      ),
    );
  } catch (error) {
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

if (shouldRunRecommendationFeatureBackfillScript(import.meta.url, process.argv[1])) {
  backfillRecommendationProductFeatures().catch((error) => {
    console.error("[backfill-recommendation-product-features] 执行失败:", error);
    process.exitCode = 1;
  });
}
