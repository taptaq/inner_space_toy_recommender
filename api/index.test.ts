import assert from "node:assert/strict";
import test from "node:test";

import { normalizeVercelApiRequestUrl } from "./index.ts";

test("normalizeVercelApiRequestUrl restores rewritten api path payloads", () => {
  assert.equal(
    normalizeVercelApiRequestUrl("/api?path=recommender/toys"),
    "/api/recommender/toys",
  );
});

test("normalizeVercelApiRequestUrl keeps /api root requests unchanged", () => {
  assert.equal(normalizeVercelApiRequestUrl("/api"), "/api");
});
