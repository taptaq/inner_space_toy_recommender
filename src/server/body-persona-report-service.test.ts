import assert from "node:assert/strict";
import test from "node:test";

import { createBodyPersonaReportService } from "./body-persona-report-service.ts";
import { buildBodyPersonaFullReport } from "../lib/body-persona-report.ts";

const demoPersona = {
  primaryPersonaCode: "starlit_guard" as const,
  secondaryPersonaCode: null,
  hiddenRouteCode: "daily_object" as const,
  hiddenPowerGrade: "A" as const,
  coLivingComfortGrade: "medium" as const,
  freeSummary: {
    title: "星幕型·隐秘安全感者",
    blurb: "你更适合低存在感、易收纳、节奏可控的路线。",
    why: "你的答案让边界感、隐私感和进入节奏稳定地排在了前面。",
    hints: ["优先看低存在感路线"],
  },
};

const baseReport = buildBodyPersonaFullReport({
  persona: demoPersona,
  candidatePool: [],
});

test("body persona report service falls back to base report when AI fails", async () => {
  const service = createBodyPersonaReportService({
    appAiService: {
      async runServerAiProxy() {
        throw new Error("AI unavailable");
      },
    },
  });

  const report = await service.enhanceUnlockedReport({
    freeSummary: { title: "星幕型·隐秘安全感者" },
    baseReport,
  });

  assert.deepEqual(report, baseReport);
});

test("body persona report service keeps deterministic fields while applying AI text", async () => {
  const service = createBodyPersonaReportService({
    appAiService: {
      async runServerAiProxy() {
        return {
          data: {
            goodFits: ["AI good fit"],
            avoidNotes: ["AI avoid note"],
          },
        };
      },
    },
  });

  const report = await service.enhanceUnlockedReport({
    freeSummary: { title: "星幕型·隐秘安全感者" },
    baseReport,
  });

  assert.equal(report.title, "星幕型·隐秘安全感者");
  assert.equal(
    report.hiddenRouteSummary,
    "你的隐藏路线偏向日常器物型，隐藏力 A，共居安心度 中。",
  );
  assert.deepEqual(report.productPicks, []);
  assert.equal(report.portrait, baseReport.portrait);
  assert.deepEqual(report.goodFits, ["AI good fit"]);
  assert.deepEqual(report.avoidNotes, ["AI avoid note"]);
});

test("body persona report service preserves deterministic report shape and merges richer fields", async () => {
  const service = createBodyPersonaReportService({
    appAiService: {
      async runServerAiProxy() {
        return {
          data: {
            portraitLong: "更完整的长版画像",
            personaManifesto: "你不是退缩，你只是更需要边界。",
            strengthTags: ["边界清晰", "低压进入", "隐私优先"],
            goodFits: ["优先看低存在感路线"],
            parameterFocus: ["优先看静音", "优先看收纳"],
          },
        };
      },
    },
  });

  const report = await service.enhanceUnlockedReport({
    freeSummary: {},
    baseReport,
  });

  assert.equal(report.reportTitle, baseReport.reportTitle);
  assert.equal(report.portraitLong, "更完整的长版画像");
  assert.equal(report.portrait, "更完整的长版画像");
  assert.equal(report.personaManifesto, "你不是退缩，你只是更需要边界。");
  assert.deepEqual(report.strengthTags, ["边界清晰", "低压进入", "隐私优先"]);
  assert.deepEqual(report.goodFits, ["优先看低存在感路线"]);
  assert.deepEqual(report.parameterFocus, ["优先看静音", "优先看收纳"]);
  assert.equal(report.hiddenRouteSummaryLong.length > 0, true);
  assert.equal(report.dimensionBreakdown.length > 0, true);
});

test("body persona report service falls back when AI arrays are malformed", async () => {
  const service = createBodyPersonaReportService({
    appAiService: {
      async runServerAiProxy() {
        return {
          data: {
            portraitLong: "AI portrait",
            goodFits: "AI good fit",
            avoidNotes: ["AI avoid note", 123],
            strengthTags: ["边界清晰", 123],
          },
        };
      },
    },
  });

  const report = await service.enhanceUnlockedReport({
    freeSummary: { title: "星幕型·隐秘安全感者" },
    baseReport,
  });

  assert.equal(report.portraitLong, "AI portrait");
  assert.equal(report.portrait, "AI portrait");
  assert.deepEqual(report.goodFits, baseReport.goodFits);
  assert.deepEqual(report.avoidNotes, baseReport.avoidNotes);
  assert.deepEqual(report.strengthTags, baseReport.strengthTags);
});

test("body persona report service falls back when AI arrays contain blank strings", async () => {
  const service = createBodyPersonaReportService({
    appAiService: {
      async runServerAiProxy() {
        return {
          data: {
            goodFits: ["AI good fit", ""],
            avoidNotes: ["   "],
            parameterFocus: ["优先看静音", "  "],
          },
        };
      },
    },
  });

  const report = await service.enhanceUnlockedReport({
    freeSummary: { title: "星幕型·隐秘安全感者" },
    baseReport,
  });

  assert.deepEqual(report.goodFits, baseReport.goodFits);
  assert.deepEqual(report.avoidNotes, baseReport.avoidNotes);
  assert.deepEqual(report.parameterFocus, baseReport.parameterFocus);
});
