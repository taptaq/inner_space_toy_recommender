import assert from "node:assert/strict";
import test from "node:test";

import { buildBrandBrief } from "./brand-brief.ts";

test("buildBrandBrief derives a stable brand slug and concise copy", () => {
  const brief = buildBrandBrief({
    brand: "We-Vibe",
    country: "Canada",
    description: "We-Vibe 是加拿大情侣互动与智能情趣科技品牌，强调远程联动与设计感。",
    focus: "Unisex",
    philosophy: ["强调远程联动和稳定体验。"],
    majorUserGroupProfile:
      "【心理特征】重视互动感和连接稳定性。",
  });

  assert.ok(brief);
  assert.equal(brief?.brandName, "We-Vibe");
  assert.equal(brief?.countryLabel, "Canada");
  assert.equal(brief?.positioning, "We-Vibe 是加拿大情侣互动与智能情趣科技品牌，强调远程联动与设计感。");
  assert.equal(brief?.styleSummary, "强调远程联动和稳定体验。");
  assert.equal(brief?.brandSlug, "we-vibe");
});
