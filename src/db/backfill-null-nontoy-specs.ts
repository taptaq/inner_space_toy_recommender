import dotenv from "dotenv";
import pg from "pg";
import { pathToFileURL } from "node:url";

import { classifyLibraryTypeCode } from "../lib/library-product-type-classifier.ts";

dotenv.config();

const { Pool } = pg;
const CLEANUP_READ_BATCH_SIZE = 100;
const CLEANUP_UPDATE_BATCH_SIZE = 200;
const CLEANUP_SIGNAL_TEXT_LIMIT = 1200;

type ToyCleanupBaseRow = {
  id: string;
  original_id: string | null;
  name: string;
  gender: string | null;
  physical_form: string | null;
  raw_description: string | null;
  current_type_code: string | null;
  max_db: number | null;
  waterproof: number | null;
};

type ProductSignalRow = {
  id: string;
  product_tags: string[] | null;
  product_raw_description: string | null;
};

export type NonToySpecCleanupRow = {
  id: string;
  original_id: string | null;
  name: string;
  gender: string | null;
  physical_form: string | null;
  raw_description: string | null;
  current_type_code: string | null;
  max_db: number | null;
  waterproof: number | null;
  product_tags: string[] | null;
  product_raw_description: string | null;
};

export function buildNonToySpecCleanupSignals(row: NonToySpecCleanupRow) {
  return {
    gender: row.gender,
    physicalForm: row.physical_form,
    name: row.name,
    rawDescription: [row.raw_description, row.product_raw_description]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join("\n") || null,
    tags: Array.isArray(row.product_tags)
      ? row.product_tags.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : [],
  };
}

export function shouldNullNonToySpecs(row: NonToySpecCleanupRow) {
  if (row.max_db == null && row.waterproof == null) {
    return false;
  }

  return classifyLibraryTypeCode(buildNonToySpecCleanupSignals(row)) === "care_accessory";
}

export function collectUniqueCleanupOriginalIds(rows: ToyCleanupBaseRow[]) {
  return [
    ...new Set(
      rows
        .map((row) => row.original_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  ];
}

export function chunkCleanupItems<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

export function hydrateNonToySpecCleanupRows(
  toyRows: ToyCleanupBaseRow[],
  productRowsById: Map<string, ProductSignalRow>,
) {
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

export function shouldRunNonToySpecCleanupScript(
  importMetaUrl: string,
  argvEntry?: string,
) {
  if (!argvEntry) {
    return false;
  }

  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function readCleanupBatch(
  client: pg.PoolClient,
  lastSeenId?: string,
) {
  const params: Array<number | string> = [
    CLEANUP_SIGNAL_TEXT_LIMIT,
    CLEANUP_READ_BATCH_SIZE,
  ];
  const cursorClause =
    typeof lastSeenId === "string"
      ? "WHERE t.id > $3::uuid"
      : "";

  if (typeof lastSeenId === "string") {
    params.push(lastSeenId);
  }

  const result = await client.query<ToyCleanupBaseRow>(
    `
      SELECT
        t.id,
        t.original_id,
        t.name,
        t.gender,
        t.physical_form,
        LEFT(COALESCE(t.raw_description, ''), $1) AS raw_description,
        t.type_code AS current_type_code,
        t.max_db,
        t.waterproof
      FROM public.recommender_toys AS t
      ${cursorClause}
      ORDER BY t.id
      LIMIT $2
    `,
    params,
  );

  return result.rows;
}

async function backfillNullNonToySpecs() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log(
      "[backfill-null-nontoy-specs] 开始清洗 recommender_toys 中非玩具类的 max_db / waterproof ...",
    );
    await client.query("BEGIN");
    await client.query("SET statement_timeout TO 0");
    await client.query("SET lock_timeout TO '5s'");

    let scanned = 0;
    let cleaned = 0;
    let productSpecsCleaned = 0;
    let lastSeenId: string | undefined;
    const sampleNames: string[] = [];

    while (true) {
      const toyBatch = await readCleanupBatch(client, lastSeenId);

      if (toyBatch.length === 0) {
        break;
      }

      scanned += toyBatch.length;
      lastSeenId = toyBatch[toyBatch.length - 1]?.id;

      const originalIds = collectUniqueCleanupOriginalIds(toyBatch);
      const productRowsById = new Map<string, ProductSignalRow>();

      for (const batch of chunkCleanupItems(
        originalIds,
        CLEANUP_UPDATE_BATCH_SIZE,
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
          [batch, CLEANUP_SIGNAL_TEXT_LIMIT],
        );

        for (const row of productResult.rows) {
          productRowsById.set(row.id, row);
        }
      }

      const hydratedRows = hydrateNonToySpecCleanupRows(toyBatch, productRowsById);
      const rowsToClean = hydratedRows.filter(shouldNullNonToySpecs);

      for (const row of rowsToClean) {
        if (sampleNames.length >= 10) {
          break;
        }

        sampleNames.push(row.name);
      }

      for (const batch of chunkCleanupItems(
        rowsToClean,
        CLEANUP_UPDATE_BATCH_SIZE,
      )) {
        const toyIds = batch.map((row) => row.id);
        const productIds = batch
          .map((row) => row.original_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0);

        const toyResult = await client.query(
          `
            UPDATE public.recommender_toys
            SET max_db = NULL,
                waterproof = NULL,
                updated_at = NOW()
            WHERE id = ANY($1::uuid[])
              AND (
                max_db IS NOT NULL OR
                waterproof IS NOT NULL
              )
            RETURNING id
          `,
          [toyIds],
        );
        cleaned += toyResult.rowCount ?? 0;

        if (productIds.length > 0) {
          const productResult = await client.query(
            `
              UPDATE public.products AS p
              SET specs = jsonb_set(
                jsonb_set(
                  COALESCE(p.specs::jsonb, '{}'::jsonb),
                  '{max_db}',
                  'null'::jsonb,
                  true
                ),
                '{waterproof}',
                'null'::jsonb,
                true
              )
              WHERE p.id = ANY($1::uuid[])
              RETURNING p.id
            `,
            [productIds],
          );
          productSpecsCleaned += productResult.rowCount ?? 0;
        }
      }
    }

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          scanned,
          recommender_toys_cleaned: cleaned,
          product_specs_cleaned: productSpecsCleaned,
          samples: sampleNames,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

if (shouldRunNonToySpecCleanupScript(import.meta.url, process.argv[1])) {
  backfillNullNonToySpecs().catch((error) => {
    console.error("[backfill-null-nontoy-specs] 执行失败:", error);
    process.exitCode = 1;
  });
}
