import assert from "node:assert/strict";
import test from "node:test";

import {
  confirmBodyPersonaUnlock,
  createBodyPersonaOrder,
  createBodyPersonaSession,
  getBodyPersonaSession,
  getBodyPersonaUnlockStatus,
} from "./body-persona-api.ts";

test("createBodyPersonaSession posts the free result payload", async () => {
  let captured: { url: string; body: string } | null = null;
  const fetcher = async (url: string, init?: RequestInit) => {
    captured = { url, body: String(init?.body ?? "") };
    return new Response(
      JSON.stringify({
        id: "persona-session-1",
        status: "completed_free",
      }),
      { status: 201 },
    );
  };

  const result = await createBodyPersonaSession({
    payload: {
      recommendationSessionId: "rec-1",
      questionVersion: "body-persona-v1",
      scoringVersion: "body-persona-score-v1",
      answers: { safety_need: "high" },
      answerPath: [],
      candidatePool: [],
    },
    fetcher,
  });

  assert.equal(result.id, "persona-session-1");
  assert.equal(captured?.url, "/api/body-persona/sessions");
  assert.match(captured?.body ?? "", /body-persona-v1/);
});

test("createBodyPersonaOrder posts the 0.5 yuan unlock order", async () => {
  let captured: { url: string; body: string } | null = null;
  const fetcher = async (url: string, init?: RequestInit) => {
    captured = { url, body: String(init?.body ?? "") };
    return new Response(
      JSON.stringify({
        order: {
          id: "order-1",
          status: "pending",
        },
        confirmationToken: "dev-confirm",
      }),
      { status: 201 },
    );
  };

  const result = await createBodyPersonaOrder({
    sessionId: "persona-session-1",
    amountCent: 50,
    fetcher,
  });

  assert.equal(result.id, "order-1");
  assert.equal(result.confirmationToken, "dev-confirm");
  assert.equal(captured?.url, "/api/body-persona/orders");
  assert.match(captured?.body ?? "", /persona-session-1/);
  assert.match(captured?.body ?? "", /50/);
});

test("confirmBodyPersonaUnlock posts confirmation token and returns unlocked report", async () => {
  let captured: { url: string; body: string } | null = null;
  const fetcher = async (url: string, init?: RequestInit) => {
    captured = { url, body: String(init?.body ?? "") };
    return new Response(
      JSON.stringify({
        unlocked: true,
        report: {
          title: "星幕型·隐秘安全感者",
          hiddenRouteSummary: "日常器物型，隐藏力 S，共居安心度 高",
        },
      }),
      { status: 200 },
    );
  };

  const result = await confirmBodyPersonaUnlock({
    orderId: "order-1",
    fetcher,
  });

  assert.equal(captured?.url, "/api/body-persona/orders/order-1/confirm");
  assert.match(captured?.body ?? "", /dev-confirm/);
  assert.equal(result.unlocked, true);
  assert.equal(result.report.title, "星幕型·隐秘安全感者");
});

test("getBodyPersonaSession reads the saved session payload", async () => {
  let capturedUrl = "";
  const fetcher = async (url: string) => {
    capturedUrl = url;
    return new Response(
      JSON.stringify({
        session: {
          id: "persona-session-1",
          freeSummary: {
            title: "星幕型·隐秘安全感者",
          },
        },
        unlocked: false,
      }),
      { status: 200 },
    );
  };

  const result = await getBodyPersonaSession({
    sessionId: "persona-session-1",
    fetcher,
  });

  assert.equal(capturedUrl, "/api/body-persona/sessions/persona-session-1");
  assert.equal(result.session.id, "persona-session-1");
  assert.equal(result.unlocked, false);
});

test("getBodyPersonaUnlockStatus reads the unlock entitlement status", async () => {
  let capturedUrl = "";
  const fetcher = async (url: string) => {
    capturedUrl = url;
    return new Response(
      JSON.stringify({
        unlocked: true,
        entitlement: {
          id: "ent-1",
          personaSessionId: "persona-session-1",
        },
      }),
      { status: 200 },
    );
  };

  const result = await getBodyPersonaUnlockStatus({
    sessionId: "persona-session-1",
    fetcher,
  });

  assert.equal(
    capturedUrl,
    "/api/body-persona/sessions/persona-session-1/unlock-status",
  );
  assert.equal(result.unlocked, true);
  assert.equal(result.entitlement?.id, "ent-1");
});

test("body persona api helpers surface server details on failure", async () => {
  await assert.rejects(
    () =>
      createBodyPersonaSession({
        payload: {
          questionVersion: "body-persona-v1",
          scoringVersion: "body-persona-score-v1",
          answers: {},
          answerPath: [],
          candidatePool: [],
        },
        fetcher: async () =>
          ({
            ok: false,
            json: async () => ({
              error: "Body persona session create failed",
              details: "database timeout",
            }),
          }) as Response,
      }),
    /database timeout/,
  );
});
