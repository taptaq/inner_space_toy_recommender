import assert from "node:assert/strict";
import test from "node:test";

import {
  createApiHandler,
  normalizeVercelApiRequestUrl,
} from "./index.ts";

test("normalizeVercelApiRequestUrl restores rewritten api path payloads", () => {
  assert.equal(
    normalizeVercelApiRequestUrl("/api?path=recommender/toys"),
    "/api/recommender/toys",
  );
});

test("normalizeVercelApiRequestUrl keeps /api root requests unchanged", () => {
  assert.equal(normalizeVercelApiRequestUrl("/api"), "/api");
});

test("createApiHandler returns a JSON 500 payload when server app loading fails", async () => {
  let responseBody = "";
  const handler = createApiHandler({
    loadServerApp: async () => {
      throw new Error("load failed");
    },
  });

  await handler(
    { url: "/api?path=knowledge/topics/lgbtq" },
    {
      statusCode: 200,
      setHeader() {},
      end(body: string) {
        responseBody = body;
      },
    },
  );

  assert.match(responseBody, /Server initialization failed/);
  assert.match(responseBody, /load failed/);
});
