import assert from "node:assert/strict";
import test from "node:test";

import { createBodyPersonaReportService } from "./body-persona-report-service.ts";
import type { BodyPersonaFullReport } from "../lib/body-persona-report.ts";

const baseReport: BodyPersonaFullReport = {
  title: "星幕型·隐秘安全感者",
  portrait: "base portrait",
  hiddenRouteSummary: "base hidden route",
  goodFits: ["base good fit"],
  avoidNotes: ["base avoid note"],
  productPicks: [],
};

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
            portrait: "AI portrait",
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
  assert.equal(report.hiddenRouteSummary, "base hidden route");
  assert.deepEqual(report.productPicks, []);
  assert.equal(report.portrait, "AI portrait");
  assert.deepEqual(report.goodFits, ["AI good fit"]);
  assert.deepEqual(report.avoidNotes, ["AI avoid note"]);
});

test("body persona report service falls back when AI arrays are malformed", async () => {
  const service = createBodyPersonaReportService({
    appAiService: {
      async runServerAiProxy() {
        return {
          data: {
            portrait: "AI portrait",
            goodFits: "AI good fit",
            avoidNotes: ["AI avoid note", 123],
          },
        };
      },
    },
  });

  const report = await service.enhanceUnlockedReport({
    freeSummary: { title: "星幕型·隐秘安全感者" },
    baseReport,
  });

  assert.equal(report.portrait, "AI portrait");
  assert.deepEqual(report.goodFits, baseReport.goodFits);
  assert.deepEqual(report.avoidNotes, baseReport.avoidNotes);
});

test("body persona report service falls back when AI arrays contain blank strings", async () => {
  const service = createBodyPersonaReportService({
    appAiService: {
      async runServerAiProxy() {
        return {
          data: {
            goodFits: ["AI good fit", ""],
            avoidNotes: ["   "],
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
});
