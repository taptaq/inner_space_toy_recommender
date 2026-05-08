import assert from "node:assert/strict";
import test from "node:test";

import { ensureRecommenderItemsSchema } from "./recommender-items-schema.ts";

test("ensureRecommenderItemsSchema creates the table before altering columns", async () => {
  const queries: string[] = [];
  const pool = {
    async query(sql: string) {
      queries.push(sql);
      return { rows: [], rowCount: 0 };
    },
  };

  await ensureRecommenderItemsSchema(pool);

  assert.ok(queries.length >= 2);
  assert.match(queries[0] ?? "", /CREATE TABLE IF NOT EXISTS public\.recommender_toys/i);
  assert.match(queries[1] ?? "", /ALTER TABLE public\.recommender_toys/i);
  assert.match(queries[1] ?? "", /safe_display_name/i);
});

test("ensureRecommenderItemsSchema adds lookup indexes for the library API", async () => {
  const queries: string[] = [];
  const pool = {
    async query(sql: string) {
      queries.push(sql);
      return { rows: [], rowCount: 0 };
    },
  };

  await ensureRecommenderItemsSchema(pool);

  assert.ok(
    queries.some((query) =>
      /CREATE INDEX IF NOT EXISTS idx_recommender_toys_created_at/i.test(query),
    ),
    "created_at ordering should be indexed",
  );
  assert.ok(
    queries.some((query) =>
      /CREATE INDEX IF NOT EXISTS idx_recommender_toys_original_id/i.test(query),
    ),
    "product join key should be indexed",
  );
  assert.ok(
    queries.some((query) =>
      /CREATE INDEX IF NOT EXISTS idx_recommender_toys_filter_codes/i.test(query),
    ),
    "common library filters should be indexed together",
  );
});
