import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ProfilesPage } from "./ProfilesPage.tsx";
import type { SavedRecommendationProfile } from "../lib/user-recommendation-profile.ts";

const profile: SavedRecommendationProfile = {
  id: "profile-1",
  title: "Nebula Pick 等 2 个推荐",
  summary: "偏好：静音、入门级；推荐：Nebula Pick",
  topProductIds: ["toy-1", "toy-2"],
  savedAt: "2026-05-02T12:00:00.000Z",
  payload: {
    createdAt: "2026-05-02T12:00:00.000Z",
    title: "Nebula Pick 等 2 个推荐",
    summary: "偏好：静音、入门级；推荐：Nebula Pick",
    topProductIds: ["toy-1", "toy-2"],
    answers: { tags: ["静音", "入门级"] },
    topProducts: [
      { id: "toy-1", name: "Nebula Pick", score: 96 },
      { id: "toy-2", name: "Second Pick", score: 88 },
    ],
    backupProducts: [],
    recommendationTips: [],
    shoppingGuidance: ["优先确认清洁便利性"],
  },
};

const detailedProfile: SavedRecommendationProfile = {
  ...profile,
  payload: {
    ...profile.payload,
    answers: {
      tags: ["女性向", "纯入体", "女性向", "  ≥ IPX7 防水  ", "≥ IPX7 防水"],
      gender: "female",
      physicalForm: "internal",
      motorType: "gentle",
      budget: [300, 10000],
      maxDb: 50,
      waterproof: 7,
    },
  },
};

test("profiles page renders saved equipment matching profiles", () => {
  const html = renderToStaticMarkup(
    <ProfilesPage
      profiles={[profile]}
      isLoading={false}
      error={null}
      userLabel="taptaq"
      onBack={() => {}}
      onReload={() => {}}
    />,
  );

  assert.match(html, /我的装备匹配档案/);
  assert.match(html, /EQUIPMENT MATCHING ARCHIVE/);
  assert.match(html, /Nebula Pick 等 2 个推荐/);
  assert.match(html, /已加密同步/);
  assert.match(html, /查看详情/);
});

test("profiles page renders an empty state", () => {
  const html = renderToStaticMarkup(
    <ProfilesPage
      profiles={[]}
      isLoading={false}
      error={null}
      userLabel="taptaq"
      onBack={() => {}}
      onReload={() => {}}
    />,
  );

  assert.match(html, /还没有保存过装备匹配档案/);
  assert.match(html, /完成一次匹配后/);
});

test("profiles detail dedupes saved preference tags and localizes answer values", () => {
  const html = renderToStaticMarkup(
    <ProfilesPage
      profiles={[detailedProfile]}
      isLoading={false}
      error={null}
      userLabel="taptaq"
      initialSelectedProfile={detailedProfile}
      onBack={() => {}}
      onReload={() => {}}
    />,
  );

  assert.match(html, /当时的条件/);
  assert.match(html, /女性向/);
  assert.match(html, /纯入体/);
  assert.match(html, /温柔慢热/);
  assert.doesNotMatch(html, /female/);
  assert.doesNotMatch(html, /internal/);
  assert.doesNotMatch(html, /gentle/);
  assert.equal((html.match(/女性向/g) || []).length, 2);
  assert.equal((html.match(/≥ IPX7 防水/g) || []).length, 1);
});
