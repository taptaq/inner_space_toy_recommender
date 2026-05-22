import dotenv from "dotenv";
import pg from "pg";

import {
  buildRecommendationFeatureBackfillPayload,
  buildRecommendationFeatureUpdateBatch,
  hydrateRecommendationFeatureBackfillRows,
  collectUniqueRecommendationFeatureOriginalIds,
  type RecommendationFeatureBackfillRow,
} from "./backfill-recommendation-product-features.ts";

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});
const SIGNAL_TEXT_LIMIT = 1200;

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

async function backfillFunFactoryRecommendationFeatures() {
  console.log("[backfill-funfactory-recommendation-features] 开始回填 Fun Factory recommendation_features ...");
  const client = await pool.connect();

  try {
    const toyResult = await client.query<RecommendationFeatureToyBaseRow>(
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
        WHERE t.brand = 'Fun Factory'
        ORDER BY t.name
      `,
      [SIGNAL_TEXT_LIMIT],
    );

    const originalIds = collectUniqueRecommendationFeatureOriginalIds(toyResult.rows);
    const productRowsById = new Map<string, ProductSignalRow>();

    if (originalIds.length > 0) {
      const productResult = await client.query<ProductSignalRow>(
        `
          SELECT
            p.id,
            p.tags AS product_tags,
            LEFT(COALESCE(p.specs::jsonb ->> 'rawDescription', ''), $2) AS product_raw_description
          FROM public.products AS p
          WHERE p.id = ANY($1::uuid[])
        `,
        [originalIds, SIGNAL_TEXT_LIMIT],
      );

      for (const row of productResult.rows) {
        productRowsById.set(row.id, row);
      }
    }

    const hydratedRows = hydrateRecommendationFeatureBackfillRows(
      toyResult.rows,
      productRowsById,
    );
    const payloads = hydratedRows.map(buildRecommendationFeatureBackfillPayload);
    const update = buildRecommendationFeatureUpdateBatch(payloads);
    const result = await client.query(update.sql, update.values);

    console.log(
      JSON.stringify(
        {
          scanned: toyResult.rows.length,
          updated: result.rowCount ?? 0,
        },
        null,
        2,
      ),
    );
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

backfillFunFactoryRecommendationFeatures().catch((error) => {
  console.error("[backfill-funfactory-recommendation-features] 执行失败:", error);
  process.exitCode = 1;
});
