import assert from "node:assert/strict";
import test from "node:test";

import type { RankedProduct } from "./app-shell.ts";
import {
  buildRecommendationProfilePayload,
  saveRecommendationProfile,
} from "./user-recommendation-profile.ts";

function makeProduct(overrides: Partial<RankedProduct>): RankedProduct {
  return {
    id: "toy-1",
    name: "Nebula Match",
    price: 269,
    score: 96,
    maxDb: 42,
    waterproof: 7,
    appearance: "high_disguise",
    physicalForm: "external",
    motorType: "gentle",
    gender: "female",
    brand: "Brand",
    material: "Silicone",
    imagePlaceholder: "",
    tags: ["静音"],
    ...overrides,
  };
}

test("buildRecommendationProfilePayload keeps enough recommendation context for encrypted cloud save", () => {
  const payload = buildRecommendationProfilePayload({
    answers: {
      tags: ["静音"],
      maxDb: 50,
    },
    topProducts: [
      makeProduct({ id: "toy-1", name: "Top Pick" }),
      makeProduct({ id: "toy-2", name: "Second Pick", score: 88 }),
    ],
    backupProducts: [],
    recommendationTips: ["可以放宽预算"],
    shoppingGuidance: ["优先看售后"],
  });

  assert.deepEqual(payload.answers, { tags: ["静音"], maxDb: 50 });
  assert.equal(payload.title, "Top Pick 等 2 个推荐");
  assert.match(payload.summary, /静音/);
  assert.deepEqual(payload.topProductIds, ["toy-1", "toy-2"]);
  assert.deepEqual(payload.topProducts, [
    { id: "toy-1", name: "Top Pick", score: 96 },
    { id: "toy-2", name: "Second Pick", score: 88 },
  ]);
  assert.deepEqual(payload.recommendationTips, ["可以放宽预算"]);
  assert.deepEqual(payload.shoppingGuidance, ["优先看售后"]);
  assert.match(payload.createdAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("saveRecommendationProfile posts the payload with bearer authorization", async () => {
  let captured: unknown;

  const result = await saveRecommendationProfile({
    authToken: "signed-token",
    payload: {
      createdAt: "2026-05-01T00:00:00.000Z",
      title: "推荐档案",
      summary: "偏好：静音",
      topProductIds: ["toy-1"],
      answers: { tags: ["静音"] },
      topProducts: [],
      backupProducts: [],
      recommendationTips: [],
      shoppingGuidance: [],
    },
    fetcher: async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        json: async () => ({ id: "profile-1" }),
      } as Response;
    },
  });

  assert.deepEqual(result, { id: "profile-1" });
  assert.match(JSON.stringify(captured), /\/api\/user\/recommendation-profiles/);
  assert.match(JSON.stringify(captured), /Bearer signed-token/);
  assert.match(JSON.stringify(captured), /静音/);
});

test("saveRecommendationProfile refuses to call the API without a token", async () => {
  let fetchCount = 0;

  await assert.rejects(
    () =>
      saveRecommendationProfile({
        authToken: "",
        payload: {
          createdAt: "2026-05-01T00:00:00.000Z",
          title: "推荐档案",
          summary: "",
          topProductIds: [],
          answers: { tags: [] },
          topProducts: [],
          backupProducts: [],
          recommendationTips: [],
          shoppingGuidance: [],
        },
        fetcher: async () => {
          fetchCount += 1;
          return { ok: true, json: async () => ({}) } as Response;
        },
      }),
    /需要登录后才能保存推荐档案/,
  );

  assert.equal(fetchCount, 0);
});
