import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";

import {
  createConfirmBodyPersonaUnlockHandler,
  createGetBodyPersonaSessionHandler,
} from "./body-persona-route.ts";

function createMockRequest({
  params = {},
  body = {},
}: {
  params?: Record<string, string>;
  body?: unknown;
}) {
  return { params, body } as Request;
}

function createMockResponse() {
  let statusCode = 200;
  let jsonPayload: unknown;

  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(payload: unknown) {
      jsonPayload = payload;
      return response;
    },
  } as unknown as Response;

  return {
    response,
    readStatusCode() {
      return statusCode;
    },
    readJsonPayload() {
      return jsonPayload;
    },
  };
}

test("confirm unlock handler creates entitlement and returns unlocked report", async () => {
  const handler = createConfirmBodyPersonaUnlockHandler({
    store: {
      markOrderPaid: async () => ({
        id: "order-1",
        personaSessionId: "session-1",
      }),
      createEntitlement: async () => ({ id: "ent-1" }),
      getSessionById: async () => ({
        id: "session-1",
        primaryPersonaCode: "starlit_guard",
        secondaryPersonaCode: null,
        hiddenRouteCode: "daily_object",
        hiddenPowerGrade: "A",
        coLivingComfortGrade: "medium",
        freeSummary: { title: "星幕型·隐秘安全感者" },
        fullReport: { title: "星幕型·隐秘安全感者" },
      }),
      saveFullReport: async () => undefined,
    },
    reportService: {
      enhanceUnlockedReport: async ({ baseReport }) => baseReport,
    },
  });

  const response = createMockResponse();
  await handler(
    createMockRequest({
      params: { id: "order-1" },
      body: { confirmationToken: "dev-confirm" },
    }),
    response.response,
  );

  const payload = response.readJsonPayload() as {
    report: Record<string, unknown>;
  };

  assert.equal(response.readStatusCode(), 200);
  assert.match(JSON.stringify(payload), /星幕型/);
  assert.equal(typeof payload.report.reportTitle, "string");
  assert.equal(typeof payload.report.personaName, "string");
  assert.equal(Array.isArray(payload.report.dimensionBreakdown), true);
  assert.equal(Array.isArray(payload.report.topCategoryMatches), true);
  assert.equal(Array.isArray(payload.report.parameterFocus), true);
});

test("get session handler normalizes unlocked full report before returning it", async () => {
  const handler = createGetBodyPersonaSessionHandler({
    store: {
      getSessionById: async () => ({
        id: "session-1",
        recommendationSessionId: null,
        userId: null,
        sourcePageRoute: "/results",
        questionVersion: "body-persona-question-v1",
        scoringVersion: "body-persona-scoring-v1",
        answers: {},
        answerPath: [],
        dimensionScores: {},
        primaryPersonaCode: "starlit_guard",
        secondaryPersonaCode: null,
        hiddenRouteCode: "daily_object",
        hiddenPowerGrade: "A",
        coLivingComfortGrade: "medium",
        freeSummary: { title: "星幕型·隐秘安全感者" },
        fullReport: {
          title: "星幕型·隐秘安全感者",
          goodFits: [],
          avoidNotes: ["dirty avoid note", 123],
          productPicks: "not an array",
        },
        status: "completed",
      }),
      getEntitlementBySessionId: async () => ({
        id: "ent-1",
        personaSessionId: "session-1",
        orderId: "order-1",
        userId: null,
        unlockedScope: "body_persona_full_report",
      }),
    },
  });

  const response = createMockResponse();
  await handler(
    createMockRequest({
      params: { id: "session-1" },
    }),
    response.response,
  );

  const payload = response.readJsonPayload() as {
    session: {
      fullReport: {
        reportTitle: unknown;
        personaName: unknown;
        dimensionBreakdown: unknown;
        topCategoryMatches: unknown;
        parameterFocus: unknown;
        goodFits: unknown;
        avoidNotes: unknown;
        productPicks: unknown;
      };
    };
  };

  assert.equal(response.readStatusCode(), 200);
  assert.deepEqual(payload.session.fullReport.goodFits, [
    "优先看低存在感路线",
    "更适合节奏温和、可控的产品",
  ]);
  assert.deepEqual(payload.session.fullReport.avoidNotes, [
    "暂不优先看高存在感路线",
    "暂不优先看噪音更明显的路线",
  ]);
  assert.equal(typeof payload.session.fullReport.reportTitle, "string");
  assert.equal(typeof payload.session.fullReport.personaName, "string");
  assert.equal(
    Array.isArray(payload.session.fullReport.dimensionBreakdown),
    true,
  );
  assert.equal(Array.isArray(payload.session.fullReport.topCategoryMatches), true);
  assert.deepEqual(payload.session.fullReport.parameterFocus, [
    "优先看静音",
    "优先看收纳",
    "优先看清洁成本",
  ]);
  assert.deepEqual(payload.session.fullReport.productPicks, []);
});

test("confirm unlock handler falls back from empty and mixed saved report arrays", async () => {
  let capturedBaseReport: unknown;
  const handler = createConfirmBodyPersonaUnlockHandler({
    store: {
      markOrderPaid: async () => ({
        id: "order-1",
        personaSessionId: "session-1",
      }),
      createEntitlement: async () => ({ id: "ent-1" }),
      getSessionById: async () => ({
        id: "session-1",
        primaryPersonaCode: "starlit_guard",
        hiddenRouteCode: "daily_object",
        hiddenPowerGrade: "A",
        coLivingComfortGrade: "medium",
        freeSummary: { title: "星幕型·隐秘安全感者" },
        fullReport: {
          title: "星幕型·隐秘安全感者",
          goodFits: [],
          avoidNotes: ["dirty avoid note", 123],
        },
      }),
      saveFullReport: async () => undefined,
    },
    reportService: {
      enhanceUnlockedReport: async ({ baseReport }) => {
        capturedBaseReport = baseReport;
        return baseReport;
      },
    },
  });

  const response = createMockResponse();
  await handler(
    createMockRequest({
      params: { id: "order-1" },
      body: { confirmationToken: "dev-confirm" },
    }),
    response.response,
  );

  assert.equal(response.readStatusCode(), 200);
  assert.deepEqual(
    (capturedBaseReport as { goodFits: string[] }).goodFits,
    ["优先看低存在感路线", "更适合节奏温和、可控的产品"],
  );
  assert.deepEqual(
    (capturedBaseReport as { avoidNotes: string[] }).avoidNotes,
    ["暂不优先看高存在感路线", "暂不优先看噪音更明显的路线"],
  );
  assert.equal(
    typeof (capturedBaseReport as { reportTitle: string }).reportTitle,
    "string",
  );
  assert.deepEqual(
    (capturedBaseReport as { parameterFocus: string[] }).parameterFocus,
    ["优先看静音", "优先看收纳", "优先看清洁成本"],
  );
});

test("get session handler upgrades legacy full report aliases into richer fields", async () => {
  const handler = createGetBodyPersonaSessionHandler({
    store: {
      getSessionById: async () => ({
        id: "session-legacy",
        recommendationSessionId: null,
        userId: null,
        sourcePageRoute: "/results",
        questionVersion: "body-persona-question-v1",
        scoringVersion: "body-persona-scoring-v1",
        answers: {},
        answerPath: [],
        dimensionScores: {},
        primaryPersonaCode: "starlit_guard",
        secondaryPersonaCode: null,
        hiddenRouteCode: "daily_object",
        hiddenPowerGrade: "A",
        coLivingComfortGrade: "medium",
        freeSummary: { title: "星幕型·隐秘安全感者" },
        fullReport: {
          title: "老版标题",
          portrait: "老版长画像",
          hiddenRouteSummary: "老版隐藏路线总结",
        },
        status: "completed",
      }),
      getEntitlementBySessionId: async () => ({
        id: "ent-legacy",
        personaSessionId: "session-legacy",
        orderId: "order-legacy",
        userId: null,
        unlockedScope: "body_persona_full_report",
      }),
    },
  });

  const response = createMockResponse();
  await handler(
    createMockRequest({
      params: { id: "session-legacy" },
    }),
    response.response,
  );

  const payload = response.readJsonPayload() as {
    session: {
      fullReport: {
        reportTitle: unknown;
        personaName: unknown;
        portraitLong: unknown;
        hiddenRouteSummaryShort: unknown;
        hiddenRouteSummaryLong: unknown;
        title: unknown;
        portrait: unknown;
        hiddenRouteSummary: unknown;
      };
    };
  };

  assert.equal(response.readStatusCode(), 200);
  assert.equal(payload.session.fullReport.reportTitle, "老版标题");
  assert.equal(payload.session.fullReport.personaName, "老版标题");
  assert.equal(payload.session.fullReport.portraitLong, "老版长画像");
  assert.equal(payload.session.fullReport.hiddenRouteSummaryShort, "老版隐藏路线总结");
  assert.equal(payload.session.fullReport.hiddenRouteSummaryLong, "老版隐藏路线总结");
  assert.equal(payload.session.fullReport.title, "老版标题");
  assert.equal(payload.session.fullReport.portrait, "老版长画像");
  assert.equal(payload.session.fullReport.hiddenRouteSummary, "老版隐藏路线总结");
});

test("confirm unlock handler rejects bad confirmation tokens", async () => {
  let markPaidCount = 0;
  const handler = createConfirmBodyPersonaUnlockHandler({
    store: {
      markOrderPaid: async () => {
        markPaidCount += 1;
        return {
          id: "order-1",
          personaSessionId: "session-1",
        };
      },
      createEntitlement: async () => ({ id: "ent-1" }),
      getSessionById: async () => ({
        id: "session-1",
        freeSummary: { title: "星幕型·隐秘安全感者" },
        fullReport: { title: "星幕型·隐秘安全感者" },
      }),
      saveFullReport: async () => undefined,
    },
    reportService: {
      enhanceUnlockedReport: async () => ({ title: "星幕型·隐秘安全感者" }),
    },
  });

  const response = createMockResponse();
  await handler(
    createMockRequest({
      params: { id: "order-1" },
      body: { confirmationToken: "bad-token" },
    }),
    response.response,
  );

  assert.equal(markPaidCount, 0);
  assert.equal(response.readStatusCode(), 400);
  assert.deepEqual(response.readJsonPayload(), {
    error: "Body persona unlock confirmation failed",
  });
});
