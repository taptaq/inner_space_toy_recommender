import test from "node:test";
import assert from "node:assert/strict";
import type { AnswerState, Product } from "../data/mock.ts";

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
    gender: "unisex",
    brand: "Test Brand",
    material: "Silicone",
    imagePlaceholder: "placeholder.png",
    tags: ["静音", "情侣"],
    ...overrides,
  };
}

test("selectScorePresetId routes female, male, and couple audiences to different presets", async () => {
  const branching = await import("./quiz-branching.ts").catch(() => null);
  assert.ok(branching, "quiz-branching.ts should exist");

  assert.equal(
    branching?.selectScorePresetId({ gender: "female", tags: [] }, []),
    "female",
  );
  assert.equal(
    branching?.selectScorePresetId({ gender: "male", tags: [] }, []),
    "male",
  );
  assert.equal(
    branching?.selectScorePresetId({ gender: "unisex", tags: [] }, []),
    "couple",
  );
});

test("selectScorePresetId still falls back to male when the pool is heavily tenga-like", async () => {
  const branching = await import("./quiz-branching.ts").catch(() => null);
  assert.ok(branching, "quiz-branching.ts should exist");

  const products = [
    makeProduct({ id: "m1", brand: "TENGA", gender: "male" }),
    makeProduct({ id: "m2", brand: "TENGA", gender: "male" }),
    makeProduct({ id: "m3", brand: "iroha", gender: "unisex" }),
  ];

  assert.equal(
    branching?.selectScorePresetId({ tags: [] }, products),
    "male",
  );
});

test("getBranchPreferenceAdjustments gives couple answers a bonus for quiet wearable unisex products", async () => {
  const branching = await import("./quiz-branching.ts").catch(() => null);
  assert.ok(branching, "quiz-branching.ts should exist");

  const answers: AnswerState = {
    gender: "unisex",
    fitPreference: "wearable",
    interactionMode: "sync",
    coupleScene: "quiet",
    sharedIntensity: "gentle",
    appearance: "high_disguise",
    maxDb: 40,
    tags: [],
  };

  const product = makeProduct({
    gender: "unisex",
    physicalForm: "external",
    motorType: "gentle",
    maxDb: 38,
    appearance: "high_disguise",
  });

  const result = branching?.getBranchPreferenceAdjustments(
    product,
    answers,
    "couple",
  );

  assert.ok(result);
  assert.ok(result.score > 0);
  assert.ok(result.summary.length > 0);
});

test("getResultLeadCopy returns branch-specific result intros", async () => {
  const branching = await import("./quiz-branching.ts").catch(() => null);
  assert.ok(branching, "quiz-branching.ts should exist");

  assert.match(
    branching?.getResultLeadCopy({ gender: "female", tags: [] }) ?? "",
    /刺激路径|敏感度/,
  );
  assert.match(
    branching?.getResultLeadCopy({ gender: "male", tags: [] }) ?? "",
    /驱动方式|通道体验/,
  );
  assert.match(
    branching?.getResultLeadCopy({ gender: "unisex", tags: [] }) ?? "",
    /互动方式|共玩/,
  );
});

test("buildBranchFallbackReason returns branch-specific local reasoning", async () => {
  const branching = await import("./quiz-branching.ts").catch(() => null);
  assert.ok(branching, "quiz-branching.ts should exist");

  const product = makeProduct({
    gender: "unisex",
    physicalForm: "external",
    motorType: "gentle",
  });

  assert.match(
    branching?.buildBranchFallbackReason(product, {
      gender: "female",
      experienceLevel: "sensitive",
      tags: [],
    }) ?? "",
    /慢热|温和/,
  );
  assert.match(
    branching?.buildBranchFallbackReason(product, {
      gender: "male",
      sessionGoal: "daily",
      tags: [],
    }) ?? "",
    /日常|顺手/,
  );
  assert.match(
    branching?.buildBranchFallbackReason(product, {
      gender: "unisex",
      interactionMode: "sync",
      tags: [],
    }) ?? "",
    /共玩|互动/,
  );
});
