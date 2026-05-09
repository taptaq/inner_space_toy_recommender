import assert from "node:assert/strict";
import test from "node:test";

import type { AnswerState, Product, QuestionOption } from "../data/mock.ts";
import { questionFlows } from "../data/mock.ts";
import {
  buildRecommendationPreferenceSignals,
  getPreferenceSignalAdjustment,
  getQuestionOptionPreferenceSignals,
} from "./recommendation-preference-signals.ts";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Test Product",
    price: 199,
    maxDb: 48,
    waterproof: 7,
    appearance: "normal",
    physicalForm: "external",
    motorType: "gentle",
    gender: "unisex",
    typeCode: "wearable_remote",
    subtypeCode: "dual_wearable_remote",
    brand: "Test Brand",
    material: "硅胶",
    imagePlaceholder: "",
    tags: [],
    rawDescription: null,
    ...overrides,
  };
}

function applyOptionToAnswers(
  field: keyof AnswerState,
  option: QuestionOption,
): AnswerState {
  return {
    tags: [option.tag],
    [field]: option.value,
    ...(option.answerPatch ?? {}),
  } as AnswerState;
}

test("every quiz option maps to at least one scoring or explanation signal", () => {
  for (const [flowName, questions] of Object.entries(questionFlows)) {
    for (const question of questions) {
      for (const option of question.options) {
        const signals = getQuestionOptionPreferenceSignals(question, option);

        assert.ok(
          signals.length > 0,
          `${flowName}/${question.id}/${option.label} should influence matching`,
        );
        assert.ok(
          signals.some((signal) => signal.impacts.includes("score")),
          `${flowName}/${question.id}/${option.label} should influence scoring`,
        );
      }
    }
  }
});

test("selected answer options produce concrete matching signals instead of display-only tags", () => {
  const femaleAnswers: AnswerState = {
    gender: "female",
    physicalForm: "composite",
    experienceLevel: "intense",
    motorType: "strong",
    maxDb: 40,
    waterproof: 7,
    budget: [300, 10000],
    appearance: "high_disguise",
    tags: ["女性向", "复合机型", "强刺激偏好", "< 40dB", "≥ IPX7 防水", "旗舰级", "高伪装"],
  };

  const signals = buildRecommendationPreferenceSignals(femaleAnswers);

  assert.ok(signals.some((signal) => signal.id === "audience.female"));
  assert.ok(signals.some((signal) => signal.id === "stimulation.composite"));
  assert.ok(signals.some((signal) => signal.id === "intensity.strong"));
  assert.ok(signals.some((signal) => signal.id === "noise.strict"));
  assert.ok(signals.some((signal) => signal.id === "maintenance.easy"));
  assert.ok(signals.some((signal) => signal.id === "budget.premium"));
  assert.ok(signals.some((signal) => signal.id === "privacy.high"));
});

test("balanced options actively reward stable middle-ground products", () => {
  const balancedOption = questionFlows.male
    .find((question) => question.id === "male-channel")
    ?.options.find((option) => option.value === "balanced");
  assert.ok(balancedOption);

  const answers = applyOptionToAnswers("channelFeel", balancedOption);
  const adjustment = getPreferenceSignalAdjustment(
    makeProduct({
      gender: "male",
      typeCode: "masturbator",
      subtypeCode: "manual_masturbator",
      price: 229,
      maxDb: 48,
      waterproof: 7,
      rawDescription: "平衡真实，刺激稳定，适合日常耐玩。",
      tags: ["平衡", "耐玩"],
    }),
    answers,
  );

  assert.ok(adjustment.score > 0);
  assert.match(adjustment.summary.join(" "), /平衡|稳定|耐玩/);
});

test("couple sync, guided, and playful choices all influence product scoring", () => {
  const syncAdjustment = getPreferenceSignalAdjustment(
    makeProduct({
      rawDescription: "双人同步共振，适合双方同时进入状态。",
      tags: ["同步", "共振", "双人"],
    }),
    { interactionMode: "sync", tags: ["同步共振"] },
  );
  const guidedAdjustment = getPreferenceSignalAdjustment(
    makeProduct({
      physicalForm: "composite",
      rawDescription: "手持切换位置，一方主导引导互动。",
      tags: ["主导", "引导", "手持"],
    }),
    { interactionMode: "guided", fitPreference: "handheld", tags: ["主导互动", "手持灵活"] },
  );
  const playfulAdjustment = getPreferenceSignalAdjustment(
    makeProduct({
      rawDescription: "APP 远控氛围玩法，互动趣味和新鲜感更明显。",
      tags: ["远控", "趣味", "氛围"],
    }),
    { coupleScene: "playful", interactionMode: "remote", tags: ["氛围尝鲜", "远控氛围"] },
  );

  assert.ok(syncAdjustment.score > 0);
  assert.ok(guidedAdjustment.score > 0);
  assert.ok(playfulAdjustment.score > 0);
  assert.match(syncAdjustment.summary.join(" "), /同步|共振/);
  assert.match(guidedAdjustment.summary.join(" "), /主导|手持|引导/);
  assert.match(playfulAdjustment.summary.join(" "), /趣味|远控|新鲜/);
});

test("couple flow asks partner composition and maps every option to scoring signals", () => {
  const question = questionFlows.unisex.find(
    (item) => item.id === "couple-partner-composition",
  );

  assert.ok(question, "couple flow should ask interaction partner composition");
  assert.equal(question.field, "partnerComposition");
  assert.ok(
    questionFlows.unisex.findIndex((item) => item.id === "couple-partner-composition") <
      questionFlows.unisex.findIndex((item) => item.id === "couple-interaction"),
    "partner composition should be answered before interaction details",
  );

  const expectedSignalIds = new Set([
    "couple.partner.mixed",
    "couple.partner.male_male",
    "couple.partner.female_female",
    "couple.partner.open",
  ]);

  for (const option of question.options) {
    const signals = getQuestionOptionPreferenceSignals(question, option);
    assert.ok(
      signals.some((signal) => expectedSignalIds.has(signal.id)),
      `${option.label} should map to a partner composition signal`,
    );
    assert.ok(
      signals.some((signal) => signal.impacts.includes("score")),
      `${option.label} should influence scoring`,
    );
  }
});

test("partner composition answers produce explicit matching signals", () => {
  const maleMaleSignals = buildRecommendationPreferenceSignals({
    partnerComposition: "male_male",
    tags: ["男男搭配"],
  });
  const femaleFemaleSignals = buildRecommendationPreferenceSignals({
    partnerComposition: "female_female",
    tags: ["女女搭配"],
  });

  assert.ok(maleMaleSignals.some((signal) => signal.id === "couple.partner.male_male"));
  assert.ok(femaleFemaleSignals.some((signal) => signal.id === "couple.partner.female_female"));
});

test("partner composition scoring favors compatible co-play routes", () => {
  const maleCompatible = getPreferenceSignalAdjustment(
    makeProduct({
      gender: "male",
      typeCode: "prostate",
      subtypeCode: "prostate_massager",
      rawDescription: "男性前列腺按摩，适合遥控互动和共玩。",
      tags: ["男用", "遥控", "共玩"],
    }),
    { gender: "unisex", partnerComposition: "male_male", tags: ["男男搭配"] },
  );
  const femaleOnly = getPreferenceSignalAdjustment(
    makeProduct({
      gender: "female",
      typeCode: "suction",
      subtypeCode: "clitoral_suction",
      rawDescription: "女性吮吸刺激器，偏女性单人外部反馈。",
      tags: ["女性", "吮吸"],
    }),
    { gender: "unisex", partnerComposition: "male_male", tags: ["男男搭配"] },
  );
  const femaleCompatible = getPreferenceSignalAdjustment(
    makeProduct({
      gender: "female",
      typeCode: "dual_stimulation",
      subtypeCode: "dual_wearable_remote",
      rawDescription: "女性复合刺激，可远控共玩，适合双方互动。",
      tags: ["女性", "复合", "远控", "共玩"],
    }),
    { gender: "unisex", partnerComposition: "female_female", tags: ["女女搭配"] },
  );
  const maleOnly = getPreferenceSignalAdjustment(
    makeProduct({
      gender: "male",
      typeCode: "masturbator",
      subtypeCode: "manual_masturbator",
      rawDescription: "男性飞机杯，偏男性单人通道刺激。",
      tags: ["男用", "飞机杯"],
    }),
    { gender: "unisex", partnerComposition: "female_female", tags: ["女女搭配"] },
  );

  assert.ok(maleCompatible.score > femaleOnly.score);
  assert.ok(femaleCompatible.score > maleOnly.score);
  assert.match(maleCompatible.summary.join(" "), /男男|男性向共玩|前列腺|环/);
  assert.match(femaleCompatible.summary.join(" "), /女女|女性向共玩|外部|复合|远控/);
});
