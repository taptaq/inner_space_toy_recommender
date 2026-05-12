import assert from "node:assert/strict";
import test from "node:test";

import { ensureBodyPersonaSchema } from "./body-persona-store.ts";

test("ensureBodyPersonaSchema creates session, order, and entitlement tables", async () => {
  const queries: string[] = [];
  const pool = {
    async query(sql: string) {
      queries.push(sql);
      return { rows: [] };
    },
  };

  await ensureBodyPersonaSchema(pool);

  const combinedSql = queries.join("\n");
  assert.match(
    combinedSql,
    /CREATE TABLE IF NOT EXISTS public\.body_persona_sessions/,
  );
  assert.match(
    combinedSql,
    /CREATE TABLE IF NOT EXISTS public\.body_persona_unlock_orders/,
  );
  assert.match(
    combinedSql,
    /CREATE TABLE IF NOT EXISTS public\.body_persona_unlock_entitlements/,
  );
});
