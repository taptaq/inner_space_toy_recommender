import test from "node:test";
import assert from "node:assert/strict";
import type {
  RecommendationAnswers,
  RecommendationRankedProduct,
} from "./recommendation-results.ts";
import {
  buildBackupCandidates,
  buildLocalBackupReason,
  buildLocalShoppingGuidance,
} from "./recommendation-results.ts";

function makeProduct(
  overrides: Partial<RecommendationRankedProduct> & Pick<RecommendationRankedProduct, "id" | "name" | "score" | "price">,
): RecommendationRankedProduct {
  return {
    id: overrides.id,
    name: overrides.name,
    score: overrides.score,
    price: overrides.price,
    maxDb: 50,
    waterproof: 5,
    appearance: "normal",
    physicalForm: "external",
    motorType: "gentle",
    gender: "female",
    brand: "A",
    material: "硅胶",
    imagePlaceholder: "",
    link: null,
    sourceUrl: null,
    tags: [],
    matchSummary: [],
    hardMisses: 0,
    budgetGap: 0,
    noiseGap: 0,
    ...overrides,
  };
}

test("buildBackupCandidates excludes top 3 and preserves overall quality order", () => {
  const ranked = [
    makeProduct({
      id: "p1",
      name: "Top 1",
      score: 98,
      price: 399,
      maxDb: 45,
      waterproof: 7,
      appearance: "high_disguise",
      motorType: "gentle",
      matchSummary: ["价格落在预算区间内"],
    }),
    makeProduct({
      id: "p2",
      name: "Top 2",
      score: 95,
      price: 299,
      maxDb: 48,
      waterproof: 7,
      motorType: "gentle",
      matchSummary: ["适配当前使用方向"],
    }),
    makeProduct({
      id: "p3",
      name: "Top 3",
      score: 91,
      price: 259,
      maxDb: 50,
      waterproof: 5,
      motorType: "strong",
      matchSummary: ["刺激形式与偏好一致"],
    }),
    makeProduct({
      id: "p5",
      name: "Higher Quality",
      score: 94,
      price: 169,
      maxDb: 52,
      waterproof: 5,
      motorType: "gentle",
    }),
    makeProduct({
      id: "p4",
      name: "More Extreme Quiet",
      score: 88,
      price: 349,
      maxDb: 30,
      waterproof: 5,
      motorType: "gentle",
    }),
    makeProduct({
      id: "p6",
      name: "Waterproof Pick",
      score: 87,
      price: 329,
      maxDb: 49,
      waterproof: 8,
      motorType: "strong",
    }),
  ];

  const result = buildBackupCandidates(ranked, ["p1", "p2", "p3"], 2);

  assert.deepEqual(result.map((item) => item.id), ["p5", "p4"]);
  assert.deepEqual(result.map((item) => item.backupLabel), ["更省预算", "更静音"]);
});

test("buildLocalBackupReason returns the local backup reason for a label", () => {
  assert.equal(
    buildLocalBackupReason(
      makeProduct({ id: "p4", name: "Quiet Pick", score: 90, price: 349, maxDb: 40 }),
      "更静音",
    ),
    "噪音约 40dB，适合更安静的环境",
  );
  assert.equal(
    buildLocalBackupReason(
      makeProduct({ id: "p5", name: "Budget Pick", score: 89, price: 169, maxDb: 52 }),
      "更省预算",
    ),
    "价格约 169 元，预算压力更小",
  );
});

test("buildLocalShoppingGuidance returns concise advice for narrow candidate pools", () => {
  const answers: RecommendationAnswers = {
    tags: ["安静", "低调"],
    maxDb: 50,
    appearance: "high_disguise",
  };

  const result = buildLocalShoppingGuidance({
    answers,
    filteredCount: 2,
    backupCandidates: [
      { id: "p4", backupLabel: "更静音", backupReason: "噪音约 40dB，适合更安静的环境" },
      { id: "p5", backupLabel: "更省预算", backupReason: "价格约 169 元，预算压力更小" },
      { id: "p6", backupLabel: "更防水", backupReason: "防水约 IPX8，清洁维护更省心" },
      { id: "p7", backupLabel: "更隐蔽", backupReason: "外观更利于日常收纳和隐蔽" },
      { id: "p8", backupLabel: "更强劲", backupReason: "输出更直接，适合偏强反馈的使用场景" },
      { id: "p9", backupLabel: "更温和", backupReason: "节奏更温和，适合慢慢进入状态" },
    ],
  });

  assert.equal(result[0], "候选池比较窄，先看备选卡片，避免只盯着前三名。");
  assert.ok(result.some((line) => line.includes("静音")));
  assert.equal(result.length, 5);
  assert.deepEqual(result, [
    "候选池比较窄，先看备选卡片，避免只盯着前三名。",
    "你在意静音，优先比较标注为更静音的备选。",
    "你也在意隐蔽性，可顺手看更隐蔽的替代方向。",
    "更静音：噪音约 40dB，适合更安静的环境",
    "更省预算：价格约 169 元，预算压力更小",
  ]);
});

test("buildLocalShoppingGuidance does not treat maxDb 100 as a quietness preference", () => {
  const answers: RecommendationAnswers = {
    tags: ["安静"],
    maxDb: 100,
    appearance: "high_disguise",
  };

  const result = buildLocalShoppingGuidance({
    answers,
    filteredCount: 8,
    backupCandidates: [
      { id: "p4", backupLabel: "更静音", backupReason: "噪音约 40dB，适合更安静的环境" },
      { id: "p5", backupLabel: "更省预算", backupReason: "价格约 169 元，预算压力更小" },
      { id: "p6", backupLabel: "更防水", backupReason: "防水约 IPX8，清洁维护更省心" },
      { id: "p7", backupLabel: "更隐蔽", backupReason: "外观更利于日常收纳和隐蔽" },
      { id: "p8", backupLabel: "更强劲", backupReason: "输出更直接，适合偏强反馈的使用场景" },
      { id: "p9", backupLabel: "更温和", backupReason: "节奏更温和，适合慢慢进入状态" },
    ],
  });

  assert.equal(result[0], "当前结果已经收窄，可以重点看差异化备选。");
  assert.equal(result.length, 5);
  assert.ok(!result.some((line) => line.includes("你在意静音")));
  assert.deepEqual(result, [
    "当前结果已经收窄，可以重点看差异化备选。",
    "你也在意隐蔽性，可顺手看更隐蔽的替代方向。",
    "更静音：噪音约 40dB，适合更安静的环境",
    "更省预算：价格约 169 元，预算压力更小",
    "更防水：防水约 IPX8，清洁维护更省心",
  ]);
});
