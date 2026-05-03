import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { RankedProduct } from "../lib/app-shell.ts";
import { ResultsPage } from "./ResultsPage.tsx";

const authPanel = {
  isConfigured: true,
  userLabel: null,
  statusMessage: null,
  isSubmitting: false,
  onSubmit: async () => {},
  onSignOut: async () => {},
};

function makeProduct(overrides: Partial<RankedProduct>): RankedProduct {
  return {
    id: "p1",
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
    matchSummary: ["适配当前使用方向", "价格落在预算区间内"],
    hardMisses: 0,
    budgetGap: 0,
    noiseGap: 0,
    ...overrides,
  };
}

test("results page shows confidence, fit reasons, and caveats for the primary recommendation", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{
        tags: ["静音"],
        maxDb: 50,
        waterproof: 7,
        budget: [100, 300],
      }}
      topProducts={[
        makeProduct({ id: "p1", name: "Primary Pick" }),
        makeProduct({ id: "p2", name: "Second Pick", score: 88 }),
      ]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      selectedResultProvider="dmxapi-mimo"
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onSelectResultProvider={() => {}}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /高匹配/);
  assert.match(html, /为什么适合/);
  assert.match(html, /需要留意/);
  assert.match(html, /适配当前使用方向/);
  assert.match(html, /主要参数与当前偏好吻合/);
});

test("results page shows a save recommendation profile action", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      selectedResultProvider="dmxapi-mimo"
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onSelectResultProvider={() => {}}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage="登录后可加密保存到云端"
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /保存推荐档案/);
  assert.match(html, /登录后可加密保存到云端/);
});

test("results page hides login action when the auth session is already active", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音"] }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      selectedResultProvider="dmxapi-mimo"
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onSelectResultProvider={() => {}}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage="已登录，可加密保存并多端同步"
      authPanel={{ ...authPanel, userLabel: "taptaq" }}
      onReset={() => {}}
    />,
  );

  assert.match(html, /已登录/);
  assert.match(html, /taptaq/);
  assert.doesNotMatch(html, /登录 \/ 注册/);
  assert.doesNotMatch(html, /退出登录/);
  assert.doesNotMatch(html, /登录后可加密保存/);
});

test("results page prioritizes the primary recommendation before secondary controls", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音", "入门级", "高伪装", "预算友好", "防水"] }}
      topProducts={[
        makeProduct({ id: "p1", name: "Primary Pick" }),
        makeProduct({ id: "p2", name: "Second Pick", score: 88 }),
        makeProduct({ id: "p3", name: "Third Pick", score: 82 }),
      ]}
      backupProducts={[]}
      shoppingGuidance={["优先确认清洁便利性"]}
      recommendationTips={[]}
      selectedResultProvider="dmxapi-mimo"
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onSelectResultProvider={() => {}}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /results-report-shell/);
  assert.match(html, /已锁定/);
  assert.match(html, /主推荐方案/);
  assert.match(html, /登录后可加密保存/);
  assert.doesNotMatch(html, /用户名/);
  assert.ok(
    html.indexOf("主推荐方案") < html.indexOf("登录后可加密保存"),
    "primary recommendation should be rendered before save/login controls",
  );
  assert.ok(
    html.indexOf("快速微调结果") < html.indexOf("Top 3 快速对比"),
    "quick tuning should stay near the primary result instead of competing with comparison",
  );
  assert.doesNotMatch(html, /算法最匹配（第 1 推荐）/);
});

test("results page shows tuning feedback and disables already applied tuning modes", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{ tags: ["静音", "微调：更安静"] }}
      topProducts={[makeProduct({ id: "p1", name: "Primary Pick" })]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      selectedResultProvider="dmxapi-mimo"
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onSelectResultProvider={() => {}}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onSaveRecommendationProfile={async () => {}}
      onOpenRecommendationProfiles={() => {}}
      isSavingRecommendationProfile={false}
      saveRecommendationProfileMessage={null}
      authPanel={authPanel}
      onReset={() => {}}
    />,
  );

  assert.match(html, /已应用更安静一点/);
  assert.match(html, /已应用：更安静一点/);
  assert.match(html, /disabled=""/);
});
