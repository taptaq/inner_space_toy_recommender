import assert from "node:assert/strict";
import test from "node:test";

import { ensureUserRecommendationSchema } from "./user-recommendation-store.ts";

test("ensureUserRecommendationSchema creates encrypted recommendation profile storage", async () => {
  const queries: string[] = [];
  const pool = {
    async query(sql: string) {
      queries.push(sql);
      return { rows: [] };
    },
  };

  await ensureUserRecommendationSchema(pool);

  const combinedSql = queries.join("\n");
  assert.match(combinedSql, /CREATE TABLE IF NOT EXISTS public\.user_recommendation_profiles/);
  assert.match(combinedSql, /user_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
  assert.match(combinedSql, /title text NOT NULL/);
  assert.match(combinedSql, /summary text NOT NULL DEFAULT ''/);
  assert.match(combinedSql, /top_product_ids jsonb NOT NULL DEFAULT '\[\]'::jsonb/);
  assert.match(combinedSql, /saved_at timestamptz NOT NULL DEFAULT now\(\)/);
  assert.match(combinedSql, /encrypted_payload jsonb NOT NULL/);
  assert.match(combinedSql, /encryption_version integer NOT NULL DEFAULT 1/);
  assert.match(combinedSql, /deleted_at timestamptz/);
  assert.match(combinedSql, /idx_user_recommendation_profiles_user_updated/);
});
