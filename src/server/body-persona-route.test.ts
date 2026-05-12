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
      body: { confirmationToken: "dev-confirm" },
    }),
    response.response,
  );

  assert.equal(response.readStatusCode(), 200);
  assert.match(JSON.stringify(response.readJsonPayload()), /星幕型/);
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
        goodFits: unknown;
        avoidNotes: unknown;
        productPicks: unknown;
      };
    };
  };

  assert.equal(response.readStatusCode(), 200);
  assert.deepEqual(payload.session.fullReport.goodFits, [
    "更适合低存在感、易收纳、节奏可控的路线",
  ]);
  assert.deepEqual(payload.session.fullReport.avoidNotes, [
    "暂不优先看高存在感、噪音更明显的路线",
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
    ["更适合低存在感、易收纳、节奏可控的路线"],
  );
  assert.deepEqual(
    (capturedBaseReport as { avoidNotes: string[] }).avoidNotes,
    ["暂不优先看高存在感、噪音更明显的路线"],
  );
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
