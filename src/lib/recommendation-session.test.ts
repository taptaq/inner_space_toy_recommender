import assert from "node:assert/strict";
import test from "node:test";

import {
  appendQuizAnswerPathEntry,
  createRecommendationSessionId,
  submitRecommendationSession,
  trimQuizAnswerPathFromStep,
} from "./recommendation-session.ts";

test("appendQuizAnswerPathEntry records the selected quiz option with question context", () => {
  const result = appendQuizAnswerPathEntry(
    [],
    {
      step: 1,
      question: {
        id: "male-drive",
        title: "驱动方式",
        subtitle: "你更喜欢哪种主导体验？",
        field: "driveMode",
        options: [],
      },
      optionLabel: "手动主导",
      optionValue: "manual",
      tag: "手动型",
      answerPatch: { physicalForm: "external" },
      selectedAt: "2026-05-09T08:00:00.000Z",
    },
  );

  assert.deepEqual(result, [
    {
      step: 1,
      questionId: "male-drive",
      questionTitle: "驱动方式",
      field: "driveMode",
      optionLabel: "手动主导",
      optionValue: "manual",
      tag: "手动型",
      answerPatch: { physicalForm: "external" },
      selectedAt: "2026-05-09T08:00:00.000Z",
    },
  ]);
});

test("createRecommendationSessionId returns stable prefixed ids", () => {
  const id = createRecommendationSessionId(() => "uuid-1");

  assert.equal(id, "rec-session-uuid-1");
});

test("trimQuizAnswerPathFromStep removes stale downstream answers when a condition is edited", () => {
  const path = [
    { step: 0, questionId: "q0", tag: "男性向" },
    { step: 1, questionId: "q1", tag: "静音优先" },
    { step: 2, questionId: "q2", tag: "高伪装" },
  ];

  assert.deepEqual(trimQuizAnswerPathFromStep(path, 1), [
    { step: 0, questionId: "q0", tag: "男性向" },
  ]);
});

test("submitRecommendationSession posts completed answer path snapshots", async () => {
  let captured: { url?: string; init?: RequestInit } = {};

  await submitRecommendationSession({
    sessionId: "session-1",
    answers: { gender: "female", tags: ["女性向"] },
    answerPath: [{ questionId: "q0", tag: "女性向" }],
    topProducts: [{ id: "p1", score: 98 }],
    resultProvider: "qwen",
    resultModelName: "qwen3.5-27b",
    pageRoute: "/results",
    fetcher: async (url, init) => {
      captured = { url: String(url), init };
      return new Response(JSON.stringify({ id: "session-row-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  assert.equal(captured.url, "/api/recommendation-sessions");
  assert.equal(captured.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(captured.init?.body)), {
    sessionId: "session-1",
    answers: { gender: "female", tags: ["女性向"] },
    answerPath: [{ questionId: "q0", tag: "女性向" }],
    topProducts: [{ id: "p1", score: 98 }],
    flowVersion: "quiz-flow-v1",
    algorithmVersion: "recommendation-v1",
    resultProvider: "qwen",
    resultModelName: "qwen3.5-27b",
    pageRoute: "/results",
  });
});
