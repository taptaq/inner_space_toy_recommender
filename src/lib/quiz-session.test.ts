import test from "node:test";
import assert from "node:assert/strict";
import {
  createClearedQuizSessionState,
  removeQuizAnswersFromQuestionIndex,
  removeQuizQuestionAnswer,
  rewindQuizAnswer,
} from "./quiz-session.ts";

test("createClearedQuizSessionState resets quiz progress and recommendations", () => {
  assert.deepEqual(createClearedQuizSessionState(), {
    step: -1,
    answers: { tags: [] },
    topProducts: [],
    backupProducts: [],
    recommendationTips: [],
    shoppingGuidance: [],
  });
});

test("rewindQuizAnswer removes the latest tag and clears the previous question fields", () => {
  const result = rewindQuizAnswer(
    {
      gender: "female",
      experienceLevel: "sensitive",
      physicalForm: "external",
      tags: ["女性向", "外部震动/吮吸"],
    },
    {
      field: "experienceLevel",
      answerPatchFields: ["physicalForm"],
    },
  );

  assert.deepEqual(result, {
    gender: "female",
    tags: ["女性向"],
  });
});

test("removeQuizQuestionAnswer clears a targeted question value, option tags, and answer patch fields", () => {
  const result = removeQuizQuestionAnswer(
    {
      gender: "female",
      experienceLevel: "sensitive",
      physicalForm: "external",
      motorType: "gentle",
      tags: ["女性向", "外部震动/吮吸", "温柔慢热", "进阶级"],
    },
    {
      id: "female-route",
      title: "刺激路径",
      subtitle: "",
      field: "experienceLevel",
      options: [
        {
          label: "外部细节优先",
          value: "sensitive",
          tag: "外部震动/吮吸",
          answerPatch: { physicalForm: "external" },
        },
        {
          label: "内外一起到位",
          value: "intense",
          tag: "复合机型",
          answerPatch: { physicalForm: "composite" },
        },
      ],
    },
  );

  assert.deepEqual(result, {
    gender: "female",
    motorType: "gentle",
    tags: ["女性向", "温柔慢热", "进阶级"],
  });
});

test("removeQuizAnswersFromQuestionIndex clears the target question and everything after it", () => {
  const result = removeQuizAnswersFromQuestionIndex(
    {
      gender: "female",
      experienceLevel: "sensitive",
      physicalForm: "external",
      maxDb: 40,
      waterproof: 7,
      tags: ["女性向", "外部震动/吮吸", "< 40dB", "≥ IPX7 防水"],
    },
    [
      {
        id: "female-route",
        title: "刺激路径",
        subtitle: "",
        field: "experienceLevel",
        options: [
          {
            label: "外部细节优先",
            value: "sensitive",
            tag: "外部震动/吮吸",
            answerPatch: { physicalForm: "external" },
          },
        ],
      },
      {
        id: "female-noise",
        title: "静音场景",
        subtitle: "",
        field: "maxDb",
        options: [{ label: "极度怕吵", value: 40, tag: "< 40dB" }],
      },
      {
        id: "female-cleanup",
        title: "清洁与维护",
        subtitle: "",
        field: "waterproof",
        options: [{ label: "越省心越好", value: 7, tag: "≥ IPX7 防水" }],
      },
    ],
    0,
  );

  assert.deepEqual(result, {
    gender: "female",
    tags: ["女性向"],
  });
});
