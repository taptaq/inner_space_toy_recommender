import assert from "node:assert/strict";
import test from "node:test";

import {
  createLazyRouteInitializer,
  getRequiredServerEnv,
} from "./server-runtime.ts";

test("getRequiredServerEnv returns the configured value", () => {
  assert.equal(
    getRequiredServerEnv("DATABASE_URL", {
      DATABASE_URL: "postgres://demo",
    }),
    "postgres://demo",
  );
});

test("getRequiredServerEnv throws a clear error when missing", () => {
  assert.throws(
    () => getRequiredServerEnv("DATABASE_URL", {}),
    /Missing required server env: DATABASE_URL/,
  );
});

test("createLazyRouteInitializer reuses the same in-flight initialization", async () => {
  const ensureInitialized = createLazyRouteInitializer();
  let runCount = 0;

  const first = ensureInitialized("knowledge", async () => {
    runCount += 1;
    await Promise.resolve();
  });
  const second = ensureInitialized("knowledge", async () => {
    runCount += 1;
  });

  await Promise.all([first, second]);
  assert.equal(runCount, 1);
});

test("createLazyRouteInitializer retries after a failure", async () => {
  const ensureInitialized = createLazyRouteInitializer();
  let runCount = 0;

  await assert.rejects(
    ensureInitialized("knowledge", async () => {
      runCount += 1;
      throw new Error("boom");
    }),
    /boom/,
  );

  await ensureInitialized("knowledge", async () => {
    runCount += 1;
  });

  assert.equal(runCount, 2);
});
