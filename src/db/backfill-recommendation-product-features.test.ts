import assert from "node:assert/strict";
import test from "node:test";

import {
  RECOMMENDATION_PRODUCT_FEATURE_VERSION,
  buildRecommendationFeatureUpdateBatch,
  buildRecommendationFeatureBackfillPayload,
  shouldRunRecommendationFeatureBackfillScript,
} from "./backfill-recommendation-product-features.ts";

test("buildRecommendationFeatureBackfillPayload serializes booleans and evidence for DB storage", () => {
  const payload = buildRecommendationFeatureBackfillPayload({
    id: "toy-1",
    original_id: "product-1",
    name: "强吸吮吸器",
    safe_display_name: "强吸吮吸器",
    price: "259.00",
    max_db: 46,
    waterproof: 7,
    appearance: "normal",
    physical_form: "external",
    motor_type: "strong",
    gender: "female",
    brand: "Eval Brand",
    material: "硅胶",
    image_url: null,
    raw_description: "空气脉冲吸感明显，强吸力更直接。多模式节奏变化。",
    type_code: "suction",
    subtype_code: "clitoral_suction",
    product_tags: ["强吸", "模式多"],
    product_raw_description: null,
  });

  assert.equal(payload.toyId, "toy-1");
  assert.equal(payload.featureVersion, RECOMMENDATION_PRODUCT_FEATURE_VERSION);
  assert.equal(payload.features.isSuctionLike, true);
  assert.equal(payload.features.hasStrongSuctionSignal, true);
  assert.equal(payload.features.hasManyPatterns, true);
  assert.deepEqual(
    payload.features.evidence
      .filter((item) => item.signal === "suction")
      .map((item) => item.text),
    [
      "空气脉冲吸感明显，强吸力更直接。",
      "强吸吮吸器",
      "商品类型标记为吮吸路线",
    ],
  );
});

test("buildRecommendationFeatureBackfillPayload normalizes nullable DB values safely", () => {
  const payload = buildRecommendationFeatureBackfillPayload({
    id: "toy-2",
    original_id: null,
    name: "未知产品",
    safe_display_name: null,
    price: null,
    max_db: null,
    waterproof: null,
    appearance: null,
    physical_form: null,
    motor_type: null,
    gender: null,
    brand: null,
    material: null,
    image_url: null,
    raw_description: null,
    type_code: null,
    subtype_code: null,
    product_tags: null,
    product_raw_description: null,
  });

  assert.equal(payload.features.isSuctionLike, false);
  assert.equal(payload.features.isInsertableLike, false);
  assert.deepEqual(payload.features.evidence, []);
});

test("buildRecommendationFeatureUpdateBatch writes recommendation_features as jsonb", () => {
  const batch = [
    buildRecommendationFeatureBackfillPayload({
      id: "toy-1",
      original_id: null,
      name: "强吸吮吸器",
      safe_display_name: null,
      price: "259.00",
      max_db: 46,
      waterproof: 7,
      appearance: "normal",
      physical_form: "external",
      motor_type: "strong",
      gender: "female",
      brand: null,
      material: null,
      image_url: null,
      raw_description: "空气脉冲吸感明显。",
      type_code: "suction",
      subtype_code: "clitoral_suction",
      product_tags: [],
      product_raw_description: null,
    }),
  ];

  const update = buildRecommendationFeatureUpdateBatch(batch);

  assert.match(update.sql, /recommendation_features = v\.recommendation_features/);
  assert.match(update.sql, /jsonb/);
  assert.deepEqual(update.values[0], "toy-1");
  assert.equal(
    JSON.parse(String(update.values[1])).featureVersion,
    RECOMMENDATION_PRODUCT_FEATURE_VERSION,
  );
});

test("shouldRunRecommendationFeatureBackfillScript only runs direct CLI entry", () => {
  assert.equal(
    shouldRunRecommendationFeatureBackfillScript(
      new URL("file:///repo/src/db/backfill-recommendation-product-features.ts").href,
      "/repo/src/db/backfill-recommendation-product-features.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunRecommendationFeatureBackfillScript(
      new URL("file:///repo/src/db/backfill-recommendation-product-features.ts").href,
      "/repo/src/db/other.ts",
    ),
    false,
  );
});
