import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPoweredToySignalText,
  buildPoweredToySpecPatch,
  isPoweredToyCandidate,
  shouldRunPoweredToyDefaultSpecsScript,
} from "./backfill-powered-toy-default-specs.ts";

test("buildPoweredToySignalText combines toy and product sources", () => {
  const text = buildPoweredToySignalText({
    id: "toy-1",
    original_id: "product-1",
    name: "Quiet App-Controlled Vibrator",
    type_code: "external_vibe",
    raw_description: "支持 APP 控制，静音震动",
    max_db: null,
    waterproof: null,
    product_tags: ["防水", "可充电"],
    product_raw_description: "Rechargeable waterproof vibrator with whisper quiet motor.",
  });

  assert.match(text, /app/i);
  assert.match(text, /Rechargeable waterproof/i);
  assert.match(text, /静音震动/);
});

test("isPoweredToyCandidate accepts toy rows with powered signals", () => {
  assert.equal(
    isPoweredToyCandidate({
      id: "toy-2",
      original_id: "product-2",
      name: "Rechargeable Clitoral Stimulator",
      type_code: "suction",
      raw_description: "Rechargeable suction toy with waterproof body.",
      max_db: null,
      waterproof: null,
      product_tags: [],
      product_raw_description: null,
    }),
    true,
  );
});

test("isPoweredToyCandidate rejects non-toy and non-powered rows", () => {
  assert.equal(
    isPoweredToyCandidate({
      id: "toy-3",
      original_id: "product-3",
      name: "Water-Based Lubricant",
      type_code: "care_accessory",
      raw_description: "Water-based lube.",
      max_db: null,
      waterproof: null,
      product_tags: [],
      product_raw_description: null,
    }),
    false,
  );

  assert.equal(
    isPoweredToyCandidate({
      id: "toy-4",
      original_id: "product-4",
      name: "Glass Dildo",
      type_code: "insertable",
      raw_description: "Handmade glass toy without motor or battery.",
      max_db: null,
      waterproof: null,
      product_tags: [],
      product_raw_description: null,
    }),
    false,
  );
});

test("buildPoweredToySpecPatch fills only missing defaults", () => {
  assert.deepEqual(
    buildPoweredToySpecPatch({
      id: "toy-5",
      original_id: "product-5",
      name: "Bullet Vibrator",
      type_code: "external_vibe",
      raw_description: "Quiet rechargeable bullet vibrator.",
      max_db: null,
      waterproof: 8,
      product_tags: [],
      product_raw_description: null,
    }),
    {
      max_db: 50,
      waterproof: null,
    },
  );

  assert.deepEqual(
    buildPoweredToySpecPatch({
      id: "toy-6",
      original_id: "product-6",
      name: "App-Controlled Egg",
      type_code: "wearable_remote",
      raw_description: "App-controlled rechargeable egg.",
      max_db: null,
      waterproof: null,
      product_tags: [],
      product_raw_description: null,
    }),
    {
      max_db: 50,
      waterproof: 7,
    },
  );
});

test("shouldRunPoweredToyDefaultSpecsScript matches direct execution only", () => {
  assert.equal(
    shouldRunPoweredToyDefaultSpecsScript("file:///tmp/script.ts", "/tmp/script.ts"),
    true,
  );
  assert.equal(
    shouldRunPoweredToyDefaultSpecsScript("file:///tmp/script.ts", "/tmp/other.ts"),
    false,
  );
  assert.equal(shouldRunPoweredToyDefaultSpecsScript("file:///tmp/script.ts"), false);
});
