import test from "node:test";
import assert from "node:assert/strict";
import * as quizData from "./mock.ts";

test("getActiveQuestions returns only the opening question before audience is selected", () => {
  assert.equal(typeof quizData.getActiveQuestions, "function");

  const questions = quizData.getActiveQuestions?.();

  assert.equal(questions?.length, 1);
  assert.equal(questions?.[0]?.field, "gender");
});

test("getActiveQuestions returns a female-focused flow after selecting female audience", () => {
  const questions = quizData.getActiveQuestions?.("female");
  const ids = questions?.map((question) => question.id);

  assert.deepEqual(ids, [
    "q0",
    "female-route",
    "female-experience",
    "female-noise",
    "female-cleanup",
    "female-budget",
    "female-appearance",
  ]);
});

test("choice-heavy questions include a help-me-decide option that does not force a preference", () => {
  const questions = quizData.getActiveQuestions?.("female") ?? [];
  const routeQuestion = questions.find((question) => question.id === "female-route");
  const uncertainOption = routeQuestion?.options.find((option) =>
    option.label.includes("帮我判断"),
  );

  assert.ok(uncertainOption);
  assert.equal(uncertainOption?.value, undefined);
  assert.deepEqual(uncertainOption?.answerPatch, {});
});

test("opening question requires a concrete audience direction without an undecided shortcut", () => {
  const questions = quizData.getActiveQuestions?.() ?? [];
  const openingQuestion = questions[0];
  const undecidedOption = openingQuestion?.options.find((option) =>
    option.label.includes("还不确定"),
  );

  assert.equal(openingQuestion?.options.length, 3);
  assert.equal(undecidedOption, undefined);
});

test("getActiveQuestions returns a male-focused flow after selecting male audience", () => {
  const questions = quizData.getActiveQuestions?.("male");
  const ids = questions?.map((question) => question.id);

  assert.deepEqual(ids, [
    "q0",
    "male-drive",
    "male-channel",
    "male-session-goal",
    "male-cleanup",
    "male-budget",
    "male-appearance",
  ]);
});

test("getActiveQuestions returns a longer couple flow after selecting couple audience", () => {
  const questions = quizData.getActiveQuestions?.("unisex");
  const ids = questions?.map((question) => question.id);

  assert.deepEqual(ids, [
    "q0",
    "couple-interaction",
    "couple-fit",
    "couple-scene",
    "couple-intensity",
    "couple-noise",
    "couple-cleanup",
    "couple-budget",
    "couple-appearance",
  ]);
  assert.ok((questions?.length ?? 0) > 7);
});
