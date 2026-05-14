import assert from "node:assert/strict";
import test from "node:test";

import type { BodyPersonaResult } from "./body-persona.ts";
import { buildBodyPersonaFullReport } from "./body-persona-report.ts";

const starlitPersona: BodyPersonaResult = {
  primaryPersonaCode: "starlit_guard",
  secondaryPersonaCode: null,
  hiddenRouteCode: "daily_object",
  hiddenPowerGrade: "S",
  coLivingComfortGrade: "high",
  freeSummary: {
    title: "星幕型·隐秘安全感者",
    blurb: "你更在意低压力进入。",
    why: "你在隐私与慢热维度更高。",
    hints: ["优先看低存在感路线"],
  },
};

const zeroProfilePersona: BodyPersonaResult = {
  primaryPersonaCode: "soft_glow",
  secondaryPersonaCode: null,
  hiddenRouteCode: "zero_profile",
  hiddenPowerGrade: "B",
  coLivingComfortGrade: "low",
  freeSummary: {
    title: "微光型·慢热探索者",
    blurb: "你更适合先建立自己的节奏。",
    why: "你当前更偏向低显眼、低介入。",
    hints: ["先看更轻量的路线"],
  },
};

test("buildBodyPersonaFullReport promotes aligned low-profile products", () => {
  const report = buildBodyPersonaFullReport({
    persona: starlitPersona,
    candidatePool: [
      {
        id: "quiet-1",
        name: "Quiet Rose",
        score: 88,
        tags: ["高伪装", "静音"],
        typeCode: "external_vibe",
        appearance: "high_disguise",
        maxDb: 40,
      },
      {
        id: "loud-1",
        name: "Loud Wand",
        score: 92,
        tags: ["强刺激"],
        typeCode: "external_vibe",
        appearance: "normal",
        maxDb: 58,
      },
      {
        id: "mid-1",
        name: "Mid Bloom",
        score: 70,
        tags: ["低调"],
        typeCode: "external_vibe",
        appearance: "normal",
        maxDb: 50,
      },
      {
        id: "mid-2",
        name: "Mid Glow",
        score: 69,
        tags: ["静音"],
        typeCode: "external_vibe",
        appearance: "normal",
        maxDb: 46,
      },
      {
        id: "mid-3",
        name: "Mid Ray",
        score: 68,
        tags: ["隐蔽"],
        typeCode: "external_vibe",
        appearance: "normal",
        maxDb: 52,
      },
      {
        id: "mid-4",
        name: "Mid Silk",
        score: 67,
        tags: ["收纳"],
        typeCode: "external_vibe",
        appearance: "normal",
        maxDb: 60,
      },
      {
        id: "mid-5",
        name: "Mid Drift",
        score: 66,
        tags: ["安静"],
        typeCode: "external_vibe",
        appearance: "normal",
        maxDb: 55,
      },
    ],
  });

  assert.equal(report.productPicks[0]?.id, "quiet-1");
  assert.match(report.hiddenRouteSummary, /日常器物型/);
  assert.match(report.hiddenRouteSummary, /隐藏力 S/);
  assert.match(report.hiddenRouteSummary, /共居安心度 高/);
  assert.equal(report.productPicks.length, 5);
});

test("buildBodyPersonaFullReport returns the richer full report contract", () => {
  const report = buildBodyPersonaFullReport({
    persona: {
      primaryPersonaCode: "starlit_guard",
      secondaryPersonaCode: "soft_glow",
      hiddenRouteCode: "daily_object",
      hiddenPowerGrade: "S",
      coLivingComfortGrade: "high",
      freeSummary: {
        title: "隐私安全型",
        blurb: "你更在意低压力进入、隐私边界和不打扰自己的节奏。",
        why: "你在隐私需求、慢热节奏和安全感维度得分更高。",
        hints: ["先看低存在感路线", "优先节奏温和、易收纳的产品"],
      },
    },
    candidatePool: [
      {
        id: "demo-1",
        name: "演示产品",
        score: 86,
        appearance: "high_disguise",
        maxDb: 38,
        tags: ["静音", "伪装"],
        typeCode: "external_vibe",
      },
    ],
  });

  assert.equal(report.reportTitle, "隐私安全型 · 完整星系人格档案");
  assert.equal(report.personaName, "隐私安全型");
  assert.equal(report.secondaryPersonaName, "慢热探索型");
  assert.equal(report.hiddenRouteName, "日常器物型");
  assert.equal(report.personaImageAsset, null);
  assert.equal(report.dimensionBreakdown.length, 6);
  assert.equal(report.topCategoryMatches.length > 0, true);
  assert.equal(report.productPicks[0]?.reason.length > 0, true);
  assert.equal(report.parameterFocus.length > 0, true);
  assert.equal(report.sceneMatches.length > 0, true);
  assert.equal(report.title, "隐私安全型");
  assert.match(report.hiddenRouteSummary, /日常器物型/);
});

test("buildBodyPersonaFullReport uses stable tie-breakers for equal persona scores", () => {
  const report = buildBodyPersonaFullReport({
    persona: starlitPersona,
    candidatePool: [
      {
        id: "tie-c",
        name: "Tie C",
        score: 80,
        tags: [],
        typeCode: "external_vibe",
        appearance: "high_disguise",
        maxDb: 60,
      },
      {
        id: "tie-a",
        name: "Tie A",
        score: 88,
        tags: [],
        typeCode: "external_vibe",
        appearance: "normal",
        maxDb: 99,
      },
      {
        id: "tie-b",
        name: "Tie B",
        score: 80,
        tags: [],
        typeCode: "external_vibe",
        appearance: "high_disguise",
        maxDb: 60,
      },
    ],
  });

  assert.deepEqual(report.productPicks.map((candidate) => candidate.id), [
    "tie-a",
    "tie-b",
    "tie-c",
  ]);
});

test("buildBodyPersonaFullReport names zero profile and low comfort explicitly", () => {
  const report = buildBodyPersonaFullReport({
    persona: zeroProfilePersona,
    candidatePool: [],
  });

  assert.match(report.hiddenRouteSummary, /低存在感型/);
  assert.match(report.hiddenRouteSummary, /隐藏力 B/);
  assert.match(report.hiddenRouteSummary, /共居安心度 低/);
});

test("buildBodyPersonaFullReport tailors portrait and ranking by persona route guidance", () => {
  const report = buildBodyPersonaFullReport({
    persona: {
      primaryPersonaCode: "twin_orbit",
      secondaryPersonaCode: "tidal_sync",
      hiddenRouteCode: "pocket_ready",
      hiddenPowerGrade: "A",
      coLivingComfortGrade: "medium",
      freeSummary: {
        title: "互动共振型",
        blurb: "你很容易被回应感和互动节奏带动。",
        why: "你在回应需求与互动偏好维度更高。",
        hints: ["优先看互动感更强的路线"],
      },
    },
    candidatePool: [
      {
        id: "base-strong",
        name: "Base Strong",
        score: 90,
        tags: ["强刺激"],
        typeCode: "wand",
      },
      {
        id: "interactive-fit",
        name: "Interactive Fit",
        score: 82,
        tags: ["互动", "双人", "共振"],
        typeCode: "wearable",
      },
      {
        id: "secondary-fit",
        name: "Secondary Fit",
        score: 80,
        tags: ["层次"],
        typeCode: "rabbit",
      },
    ],
  });

  assert.match(report.portraitLong, /回应感、同步感和来回互动/);
  assert.equal(report.productPicks[0]?.id, "interactive-fit");
  assert.equal(report.productPicks[0]?.categoryLabel, "互动陪伴路线");
});
