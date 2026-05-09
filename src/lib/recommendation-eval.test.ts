import assert from "node:assert/strict";
import test from "node:test";

import type { AnswerState, Product } from "../data/mock.ts";
import {
  assertRecommendationEvalPasses,
  runRecommendationEvalScenario,
  type RecommendationEvalScenario,
} from "./recommendation-eval.ts";

function makeProduct(overrides: Partial<Product> & Pick<Product, "id" | "name">): Product {
  return {
    id: overrides.id,
    name: overrides.name,
    price: overrides.price ?? 199,
    maxDb: overrides.maxDb ?? 46,
    waterproof: overrides.waterproof ?? 7,
    appearance: overrides.appearance ?? "normal",
    physicalForm: overrides.physicalForm ?? "external",
    motorType: overrides.motorType ?? "gentle",
    gender: overrides.gender ?? "unisex",
    typeCode: overrides.typeCode ?? "wearable_remote",
    subtypeCode: overrides.subtypeCode ?? "dual_wearable_remote",
    brand: overrides.brand ?? "Eval Brand",
    material: overrides.material ?? "硅胶",
    imagePlaceholder: overrides.imagePlaceholder ?? "",
    displayName: overrides.displayName,
    safeDisplayName: overrides.safeDisplayName,
    canonicalName: overrides.canonicalName,
    link: overrides.link,
    sourceUrl: overrides.sourceUrl,
    rawDescription: overrides.rawDescription ?? null,
    tags: overrides.tags ?? [],
    reason: overrides.reason,
    personaAnalysis: overrides.personaAnalysis,
    isDomestic: overrides.isDomestic,
  };
}

const evalProducts: Product[] = [
  makeProduct({
    id: "female-quiet-suction",
    name: "安静外部吮吸器",
    gender: "female",
    typeCode: "suction",
    subtypeCode: "clitoral_suction",
    physicalForm: "external",
    motorType: "gentle",
    price: 229,
    maxDb: 38,
    waterproof: 7,
    rawDescription: "新手友好，低噪静音，外部吮吸刺激，适合慢热进入。",
    tags: ["女性", "吮吸", "静音", "新手"],
  }),
  makeProduct({
    id: "female-dual-remote",
    name: "远控复合双刺激",
    gender: "female",
    typeCode: "dual_stimulation",
    subtypeCode: "dual_wearable_remote",
    physicalForm: "composite",
    motorType: "gentle",
    price: 299,
    maxDb: 42,
    waterproof: 7,
    rawDescription: "内外双刺激，APP 远控，可用于女女互动共玩。",
    tags: ["女性", "复合", "远控", "共玩"],
  }),
  makeProduct({
    id: "male-soft-daily",
    name: "日常柔软互动杯",
    gender: "male",
    typeCode: "masturbator",
    subtypeCode: "manual_masturbator",
    physicalForm: "external",
    motorType: "gentle",
    price: 189,
    maxDb: 45,
    waterproof: 7,
    rawDescription: "柔软包裹，慢玩耐用，易清洗，适合日常释放。",
    tags: ["男用", "柔软", "日常", "易清洗"],
  }),
  makeProduct({
    id: "male-prostate-remote",
    name: "远控前列腺按摩器",
    gender: "male",
    typeCode: "prostate",
    subtypeCode: "prostate_massager",
    physicalForm: "internal",
    motorType: "gentle",
    price: 269,
    maxDb: 44,
    waterproof: 7,
    rawDescription: "男性前列腺按摩，支持遥控互动，适合男男共玩。",
    tags: ["男用", "前列腺", "遥控", "共玩"],
  }),
  makeProduct({
    id: "unisex-ring",
    name: "震动环远控款",
    gender: "unisex",
    typeCode: "cock_ring",
    subtypeCode: "vibrating_cock_ring",
    physicalForm: "external",
    motorType: "gentle",
    price: 159,
    maxDb: 43,
    waterproof: 7,
    rawDescription: "震动环，远控互动，适合异性搭配或男男搭配共玩。",
    tags: ["震动环", "远控", "共玩"],
  }),
  makeProduct({
    id: "care-lube",
    name: "水基润滑液",
    gender: "unisex",
    typeCode: "care_accessory",
    subtypeCode: "lube_care",
    physicalForm: "external",
    motorType: "gentle",
    price: 59,
    maxDb: null,
    waterproof: null,
    rawDescription: "水基润滑液，护理周边，不是玩具设备。",
    tags: ["润滑液", "护理"],
  }),
  makeProduct({
    id: "care-condom",
    name: "安全套组合",
    gender: "unisex",
    typeCode: "care_accessory",
    subtypeCode: "condom_care",
    physicalForm: "external",
    motorType: "gentle",
    price: 39,
    maxDb: null,
    waterproof: null,
    rawDescription: "避孕套组合，护理周边，不是玩具设备。",
    tags: ["避孕套", "护理"],
  }),
];

function scenario(
  id: string,
  answers: AnswerState,
  expectations: RecommendationEvalScenario["expectations"],
): RecommendationEvalScenario {
  return {
    id,
    answers,
    products: evalProducts,
    expectations,
  };
}

const scenarios: RecommendationEvalScenario[] = [
  scenario(
    "female beginner external quiet should pick female toy and block care accessories",
    {
      gender: "female",
      physicalForm: "external",
      experienceLevel: "sensitive",
      motorType: "gentle",
      maxDb: 40,
      waterproof: 7,
      budget: [100, 300],
      tags: ["女性向", "外部震动/吮吸", "温柔慢热", "< 40dB", "≥ IPX7 防水", "进阶级"],
    },
    {
      topCount: 3,
      top1: { gender: "female", typeCodes: ["suction"] },
      forbiddenTypeCodesInTop: ["care_accessory", "masturbator", "prostate"],
      requiredTypeCodesInTop: ["suction"],
    },
  ),
  scenario(
    "male daily soft should not surface female-only or care products",
    {
      gender: "male",
      driveMode: "manual",
      channelFeel: "soft",
      sessionGoal: "daily",
      waterproof: 7,
      budget: [100, 300],
      tags: ["男性向", "手动型", "慢玩柔软", "日常释放", "易清洁优先", "进阶级"],
    },
    {
      topCount: 3,
      top1: { gender: "male", typeCodes: ["masturbator"] },
      forbiddenGendersInTop: ["female"],
      forbiddenTypeCodesInTop: ["care_accessory"],
      requiredTypeCodesInTop: ["masturbator"],
    },
  ),
  scenario(
    "male-male couple route should favor male-compatible co-play",
    {
      gender: "unisex",
      partnerComposition: "male_male",
      interactionMode: "remote",
      fitPreference: "wearable",
      coupleScene: "bedroom",
      sharedIntensity: "gentle",
      tags: ["情侣共玩", "男男搭配", "远控氛围", "稳定贴合", "卧室常用", "温和舒适"],
    },
    {
      topCount: 3,
      top1: { typeCodes: ["prostate", "cock_ring", "wearable_remote"] },
      forbiddenTypeCodesInTop: ["care_accessory", "suction"],
      requiredTypeCodesInTop: ["prostate"],
    },
  ),
  scenario(
    "female-female couple route should favor female-compatible co-play",
    {
      gender: "unisex",
      partnerComposition: "female_female",
      interactionMode: "remote",
      fitPreference: "handheld",
      coupleScene: "playful",
      sharedIntensity: "gentle",
      tags: ["情侣共玩", "女女搭配", "远控氛围", "手持灵活", "氛围尝鲜", "温和舒适"],
    },
    {
      topCount: 3,
      top1: { gender: "female", typeCodes: ["dual_stimulation", "suction", "wearable_remote"] },
      forbiddenTypeCodesInTop: ["care_accessory", "masturbator", "prostate"],
      requiredTypeCodesInTop: ["dual_stimulation"],
    },
  ),
];

test("recommendation eval scenarios pass the current local matching contract", () => {
  const results = scenarios.map(runRecommendationEvalScenario);
  const failures = results.flatMap((result) => result.failures);

  assert.deepEqual(failures, []);
  for (const result of results) {
    assertRecommendationEvalPasses(result);
  }
});
