import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHighConfidenceRawDescriptionUpdateBatch,
  buildNeedsRefetchList,
  buildRawDescriptionCandidate,
  buildUrlRawDescriptionCandidate,
  extractRawDescriptionFromHtml,
  selectHighConfidenceApplyCandidates,
  shouldRunRawDescriptionCandidatesScript,
} from "./backfill-raw-description-candidates.ts";

test("buildRawDescriptionCandidate prefers existing product rawDescription with high confidence", () => {
  const candidate = buildRawDescriptionCandidate({
    id: "toy-1",
    name: "多模式吮吸器",
    brand: "Eval Brand",
    type_code: "suction",
    subtype_code: "clitoral_suction",
    physical_form: "external",
    gender: "female",
    product_name: "多模式吮吸器",
    product_category: "女性玩具",
    product_tags: ["吮吸", "模式多"],
    product_link: "https://example.com/products/suction",
    product_raw_description: "外部吮吸器，多模式，多档位节奏变化。",
  });

  assert.deepEqual(candidate, {
    toyId: "toy-1",
    name: "多模式吮吸器",
    sourceType: "product_raw_description",
    matchedUrl: "https://example.com/products/suction",
    proposedRawDescription: "外部吮吸器，多模式，多档位节奏变化。",
    confidence: 0.95,
    reason: "关联 products.specs.rawDescription 已有可用描述",
  });
});

test("buildRawDescriptionCandidate summarizes local product metadata with lower confidence", () => {
  const candidate = buildRawDescriptionCandidate({
    id: "toy-2",
    name: "强吸吮吸器",
    brand: "Eval Brand",
    type_code: "suction",
    subtype_code: "clitoral_suction",
    physical_form: "external",
    gender: "female",
    product_name: "强吸吮吸器",
    product_category: "女性玩具",
    product_tags: ["吮吸", "强吸", "模式多"],
    product_link: "https://example.com/products/strong-suction",
    product_raw_description: null,
  });

  assert.equal(candidate?.sourceType, "local_metadata_summary");
  assert.equal(candidate?.confidence, 0.62);
  assert.match(candidate?.proposedRawDescription ?? "", /女性向/);
  assert.match(candidate?.proposedRawDescription ?? "", /外部吮吸/);
  assert.match(candidate?.proposedRawDescription ?? "", /强吸/);
  assert.match(candidate?.reason ?? "", /本地字段和标签/);
});

test("buildRawDescriptionCandidate skips rows without enough source evidence", () => {
  const candidate = buildRawDescriptionCandidate({
    id: "toy-3",
    name: "未知产品",
    brand: null,
    type_code: null,
    subtype_code: null,
    physical_form: null,
    gender: null,
    product_name: null,
    product_category: null,
    product_tags: null,
    product_link: null,
    product_raw_description: null,
  });

  assert.equal(candidate, null);
});

test("extractRawDescriptionFromHtml prefers product-like metadata over noisy body text", () => {
  const extracted = extractRawDescriptionFromHtml(`
    <html>
      <head>
        <meta name="description" content="Compact external suction toy with multiple modes." />
        <script type="application/ld+json">
          {"@type":"Product","name":"Pulse Mini","description":"JSON-LD product description"}
        </script>
      </head>
      <body>
        <nav>Free shipping and account links</nav>
        <div class="product-description">Longer product detail text that should be considered.</div>
      </body>
    </html>
  `);

  assert.equal(extracted, "Compact external suction toy with multiple modes.");
});

test("extractRawDescriptionFromHtml falls back to JSON-LD product description", () => {
  const extracted = extractRawDescriptionFromHtml(`
    <script type="application/ld+json">
      [{"@type":"BreadcrumbList"},{"@type":"Product","description":"Wearable remote vibrator for couples."}]
    </script>
  `);

  assert.equal(extracted, "Wearable remote vibrator for couples.");
});

test("buildUrlRawDescriptionCandidate upgrades URL extracted descriptions to reviewable confidence", () => {
  const candidate = buildUrlRawDescriptionCandidate(
    {
      id: "toy-url",
      name: "Pulse Mini",
      brand: "Eval Brand",
      type_code: "suction",
      subtype_code: "clitoral_suction",
      physical_form: "external",
      gender: "female",
      product_name: "Pulse Mini",
      product_category: "女性玩具",
      product_tags: ["吮吸"],
      product_link: "https://example.com/products/pulse-mini",
      product_raw_description: null,
    },
    "Compact external suction toy with multiple modes.",
  );

  assert.deepEqual(candidate, {
    toyId: "toy-url",
    name: "Pulse Mini",
    sourceType: "matched_url_page",
    matchedUrl: "https://example.com/products/pulse-mini",
    proposedRawDescription: "Compact external suction toy with multiple modes.",
    confidence: 0.82,
    reason: "matchedUrl 页面提取到可用商品描述，建议抽样复核后批量写入",
  });
});

test("selectHighConfidenceApplyCandidates only keeps matched URL page candidates", () => {
  const candidates = [
    {
      toyId: "toy-url",
      name: "Pulse Mini",
      sourceType: "matched_url_page" as const,
      matchedUrl: "https://example.com/products/pulse-mini",
      proposedRawDescription: "Compact external suction toy with multiple modes.",
      confidence: 0.82,
      reason: "matchedUrl 页面提取到可用商品描述，建议抽样复核后批量写入",
    },
    {
      toyId: "toy-local",
      name: "Local Only",
      sourceType: "local_metadata_summary" as const,
      matchedUrl: "https://example.com/products/local-only",
      proposedRawDescription: "本地字段摘要。",
      confidence: 0.62,
      reason: "基于本地字段和标签生成，需要人工或官方来源复核",
    },
  ];

  assert.deepEqual(selectHighConfidenceApplyCandidates(candidates), [candidates[0]]);
});

test("buildHighConfidenceRawDescriptionUpdateBatch writes raw_description with audit-safe guard", () => {
  const update = buildHighConfidenceRawDescriptionUpdateBatch([
    {
      toyId: "toy-url",
      name: "Pulse Mini",
      sourceType: "matched_url_page",
      matchedUrl: "https://example.com/products/pulse-mini",
      proposedRawDescription: "Compact external suction toy with multiple modes.",
      confidence: 0.82,
      reason: "matchedUrl 页面提取到可用商品描述，建议抽样复核后批量写入",
    },
  ]);

  assert.match(update.sql, /raw_description = v\.raw_description/);
  assert.match(update.sql, /NULLIF\(BTRIM\(COALESCE\(t\.raw_description, ''\)\), ''\) IS NULL/);
  assert.deepEqual(update.values, [
    "toy-url",
    "Compact external suction toy with multiple modes.",
  ]);
});

test("buildNeedsRefetchList lists low-confidence candidates with URLs", () => {
  const items = buildNeedsRefetchList([
    {
      toyId: "toy-url",
      name: "Pulse Mini",
      sourceType: "matched_url_page",
      matchedUrl: "https://example.com/products/pulse-mini",
      proposedRawDescription: "Compact external suction toy with multiple modes.",
      confidence: 0.82,
      reason: "matchedUrl 页面提取到可用商品描述，建议抽样复核后批量写入",
    },
    {
      toyId: "toy-local",
      name: "Local Only",
      sourceType: "local_metadata_summary",
      matchedUrl: "https://example.com/products/local-only",
      proposedRawDescription: "本地字段摘要。",
      confidence: 0.62,
      reason: "基于本地字段和标签生成，需要人工或官方来源复核",
    },
  ]);

  assert.deepEqual(items, [
    {
      toyId: "toy-local",
      name: "Local Only",
      matchedUrl: "https://example.com/products/local-only",
      sourceType: "local_metadata_summary",
      confidence: 0.62,
      reason: "基于本地字段和标签生成，需要人工或官方来源复核",
    },
  ]);
});

test("shouldRunRawDescriptionCandidatesScript only runs direct CLI entry", () => {
  assert.equal(
    shouldRunRawDescriptionCandidatesScript(
      new URL("file:///repo/src/db/backfill-raw-description-candidates.ts").href,
      "/repo/src/db/backfill-raw-description-candidates.ts",
    ),
    true,
  );
  assert.equal(
    shouldRunRawDescriptionCandidatesScript(
      new URL("file:///repo/src/db/backfill-raw-description-candidates.ts").href,
      "/repo/src/db/other.ts",
    ),
    false,
  );
});
