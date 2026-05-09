import assert from "node:assert/strict";
import test from "node:test";

import type { Product } from "../data/mock.ts";
import {
  buildProductDisguiseSignalsSummary,
  getDisguisePreferenceAdjustment,
} from "./product-disguise-signals.ts";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Test Product",
    price: 199,
    maxDb: 42,
    waterproof: 7,
    appearance: "high_disguise",
    physicalForm: "external",
    motorType: "gentle",
    gender: "female",
    brand: "Test Brand",
    material: "Silicone",
    imagePlaceholder: "placeholder.png",
    tags: [],
    rawDescription: null,
    ...overrides,
  };
}

test("buildProductDisguiseSignalsSummary detects explicit disguised forms from name, tags, and description", () => {
  const summary = buildProductDisguiseSignalsSummary(
    makeProduct({
      name: "星云口红造型随身款",
      tags: ["隐形收纳", "玫瑰款"],
      rawDescription: "不是常规款式，日用品造型，放在桌面也低存在感。",
    }),
  );

  assert.equal(summary, "口红造型、玫瑰造型、日用品伪装、低存在感");
});

test("getDisguisePreferenceAdjustment boosts clearly disguised products only when high disguise is selected", () => {
  const lipstickProduct = makeProduct({
    name: "口红造型随身款",
    tags: ["隐形"],
    rawDescription: "日用品伪装，低存在感。",
  });
  const normalProduct = makeProduct({
    name: "经典手持款",
    tags: ["静音"],
    rawDescription: "外观简洁，适合日常使用。",
  });

  const boosted = getDisguisePreferenceAdjustment(lipstickProduct, {
    appearance: "high_disguise",
    tags: [],
  });
  const notBoosted = getDisguisePreferenceAdjustment(lipstickProduct, {
    appearance: "normal",
    tags: [],
  });
  const noExplicitSignal = getDisguisePreferenceAdjustment(normalProduct, {
    appearance: "high_disguise",
    tags: [],
  });

  assert.equal(boosted.score, 7);
  assert.deepEqual(boosted.summary, ["口红造型更利于日常收纳"]);
  assert.deepEqual(notBoosted, { score: 0, summary: [] });
  assert.deepEqual(noExplicitSignal, { score: 0, summary: [] });
});
