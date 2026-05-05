import test from "node:test";
import assert from "node:assert/strict";

import { recoverCanonicalProductName } from "./product-name-recovery.ts";

test("recoverCanonicalProductName removes qq placeholders while keeping real title content", () => {
  const result = recoverCanonicalProductName({
    currentName: "qq兔耳跳蛋 女用",
  });

  assert.equal(result, "兔耳跳蛋 女用");
});

test("recoverCanonicalProductName prefers extracted detail-page names when qq corruption dominates", () => {
  const result = recoverCanonicalProductName({
    currentName: "qqqq",
    rawDescription: "品名: We-Vibe Sync 2\n材质: silicone",
    productName: "qq情侣器具",
  });

  assert.equal(result, "We-Vibe Sync 2");
});

test("recoverCanonicalProductName preserves already-usable names", () => {
  const result = recoverCanonicalProductName({
    currentName: "LELO Sila Cruise",
    rawDescription: "产品名称：LELO Sila Cruise",
  });

  assert.equal(result, "LELO Sila Cruise");
});
