import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNonToySpecCleanupSignals,
  chunkCleanupItems,
  collectUniqueCleanupOriginalIds,
  hydrateNonToySpecCleanupRows,
  shouldNullNonToySpecs,
  shouldRunNonToySpecCleanupScript,
} from "./backfill-null-nontoy-specs.ts";

test("buildNonToySpecCleanupSignals combines toy and product sources", () => {
  const signals = buildNonToySpecCleanupSignals({
    id: "toy-1",
    original_id: "product-1",
    name: "Water-Based Lubricant 100ml",
    gender: "female",
    physical_form: "external",
    raw_description: "本体是润滑护理用品",
    current_type_code: "insertable",
    max_db: 45,
    waterproof: 7,
    product_tags: ["润滑液", "水基"],
    product_raw_description: "亲肤易清洗",
  });

  assert.match(signals.rawDescription ?? "", /本体是润滑护理用品/);
  assert.match(signals.rawDescription ?? "", /亲肤易清洗/);
  assert.deepEqual(signals.tags, ["润滑液", "水基"]);
});

test("shouldNullNonToySpecs returns true for care accessory rows even if the stored type is stale", () => {
  assert.equal(
    shouldNullNonToySpecs({
      id: "toy-2",
      original_id: "product-2",
      name: "Water-Based Lubricant 100ml",
      gender: "female",
      physical_form: "external",
      raw_description: "人体润滑液，亲肤易清洗",
      current_type_code: "insertable",
      max_db: 40,
      waterproof: 7,
      product_tags: ["润滑液", "水基"],
      product_raw_description: null,
    }),
    true,
  );
});

test("shouldNullNonToySpecs keeps actual device rows intact", () => {
  assert.equal(
    shouldNullNonToySpecs({
      id: "toy-3",
      original_id: "product-3",
      name: "Rabbit Dual",
      gender: "female",
      physical_form: "external",
      raw_description: "兔耳双刺激震动器，支持防水与静音",
      current_type_code: "care_accessory",
      max_db: 42,
      waterproof: 7,
      product_tags: ["双刺激", "兔耳"],
      product_raw_description: null,
    }),
    false,
  );
});

test("shouldNullNonToySpecs skips rows that already have null specs", () => {
  assert.equal(
    shouldNullNonToySpecs({
      id: "toy-4",
      original_id: "product-4",
      name: "Super Thin Condom",
      gender: "male",
      physical_form: "external",
      raw_description: "独立包装安全套",
      current_type_code: "care_accessory",
      max_db: null,
      waterproof: null,
      product_tags: ["避孕套"],
      product_raw_description: null,
    }),
    false,
  );
});

test("hydrateNonToySpecCleanupRows joins product metadata onto toy rows", () => {
  const rows = hydrateNonToySpecCleanupRows(
    [
      {
        id: "toy-5",
        original_id: "product-5",
        name: "Lace Bodysuit",
        gender: "female",
        physical_form: "external",
        raw_description: null,
        current_type_code: "care_accessory",
        max_db: 50,
        waterproof: 6,
      },
    ],
    new Map([
      [
        "product-5",
        {
          id: "product-5",
          product_tags: ["蕾丝", "内衣"],
          product_raw_description: "性感连体衣",
        },
      ],
    ]),
  );

  assert.deepEqual(rows[0]?.product_tags, ["蕾丝", "内衣"]);
  assert.equal(rows[0]?.product_raw_description, "性感连体衣");
});

test("collectUniqueCleanupOriginalIds de-duplicates and drops blanks", () => {
  assert.deepEqual(
    collectUniqueCleanupOriginalIds([
      {
        id: "toy-6",
        original_id: "product-6",
        name: "A",
        gender: null,
        physical_form: null,
        raw_description: null,
        current_type_code: null,
        max_db: 40,
        waterproof: 7,
      },
      {
        id: "toy-7",
        original_id: "product-6",
        name: "B",
        gender: null,
        physical_form: null,
        raw_description: null,
        current_type_code: null,
        max_db: 40,
        waterproof: 7,
      },
      {
        id: "toy-8",
        original_id: null,
        name: "C",
        gender: null,
        physical_form: null,
        raw_description: null,
        current_type_code: null,
        max_db: 40,
        waterproof: 7,
      },
    ]),
    ["product-6"],
  );
});

test("chunkCleanupItems splits arrays into stable batches", () => {
  assert.deepEqual(chunkCleanupItems([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test("shouldRunNonToySpecCleanupScript matches direct execution only", () => {
  assert.equal(
    shouldRunNonToySpecCleanupScript("file:///tmp/script.ts", "/tmp/script.ts"),
    true,
  );
  assert.equal(
    shouldRunNonToySpecCleanupScript("file:///tmp/script.ts", "/tmp/other.ts"),
    false,
  );
  assert.equal(shouldRunNonToySpecCleanupScript("file:///tmp/script.ts"), false);
});
