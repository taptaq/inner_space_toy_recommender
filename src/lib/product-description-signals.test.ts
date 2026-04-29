import test from "node:test";
import assert from "node:assert/strict";
import type { AnswerState, Product } from "../data/mock.ts";
import {
  getDescriptionPreferenceAdjustments,
  hasMeaningfulRawDescription,
} from "./product-description-signals.ts";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Test Product",
    price: 199,
    maxDb: 52,
    waterproof: 7,
    appearance: "normal",
    physicalForm: "external",
    motorType: "gentle",
    gender: "female",
    brand: "Test Brand",
    material: "Silicone",
    imagePlaceholder: "placeholder.png",
    tags: ["静音"],
    ...overrides,
  };
}

test("hasMeaningfulRawDescription ignores empty placeholder-like values", () => {
  assert.equal(hasMeaningfulRawDescription(""), false);
  assert.equal(hasMeaningfulRawDescription("   "), false);
  assert.equal(hasMeaningfulRawDescription("信息未获取"), false);
  assert.equal(hasMeaningfulRawDescription("支持 APP 远控和穿戴使用"), true);
});

test("getDescriptionPreferenceAdjustments identifies gentle female-oriented signals from raw descriptions", () => {
  const answers: AnswerState = {
    gender: "female",
    experienceLevel: "sensitive",
    physicalForm: "external",
    maxDb: 40,
    tags: [],
  };

  const result = getDescriptionPreferenceAdjustments(
    makeProduct({
      rawDescription: "这是一款低噪吮吸器，适合新手与敏感慢热用户，低噪更安心。",
    }),
    answers,
    "female",
  );

  assert.ok(result.score > 0);
  assert.match(result.summary.join(" "), /新手|慢热|低噪|吮吸/);
});

test("getDescriptionPreferenceAdjustments identifies male automatic and explosive cues from raw descriptions", () => {
  const answers: AnswerState = {
    gender: "male",
    driveMode: "automatic",
    sessionGoal: "explosive",
    channelFeel: "tight",
    tags: [],
  };

  const result = getDescriptionPreferenceAdjustments(
    makeProduct({
      gender: "male",
      rawDescription: "自动活塞抽送配合紧致包裹通道，强刺激反馈更直接。",
    }),
    answers,
    "male",
  );

  assert.ok(result.score > 0);
  assert.match(result.summary.join(" "), /自动|强刺激|紧致|活塞/);
});

test("getDescriptionPreferenceAdjustments identifies couple remote wearable quiet cues from raw descriptions", () => {
  const answers: AnswerState = {
    gender: "unisex",
    interactionMode: "remote",
    fitPreference: "wearable",
    coupleScene: "quiet",
    tags: [],
  };

  const result = getDescriptionPreferenceAdjustments(
    makeProduct({
      gender: "unisex",
      rawDescription: "支持 APP 远程控制，可穿戴贴合设计，低噪不打扰氛围。",
    }),
    answers,
    "couple",
  );

  assert.ok(result.score > 0);
  assert.match(result.summary.join(" "), /远控|穿戴|低噪|氛围/);
});
