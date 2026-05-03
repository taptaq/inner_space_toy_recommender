import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { Question } from "../data/mock.ts";
import { QuizPage } from "./QuizPage.tsx";

const questions: Question[] = [
  {
    id: "scenario",
    title: "你更接近哪种使用场景？",
    subtitle: "先校准环境，再判断推荐方向。",
    field: "gender",
    options: [
      { label: "独处放松", value: "female", tag: "独处" },
      { label: "同住环境", value: "male", tag: "同住" },
      { label: "情侣共玩", value: "unisex", tag: "情侣" },
    ],
  } as Question,
];

test("quiz page renders a differentiated deep-space scanning cockpit", () => {
  const html = renderToStaticMarkup(
    <QuizPage
      pageVariants={{}}
      step={0}
      activeQuestions={questions}
      onSelectOption={() => {}}
      onBackQuestion={() => {}}
      onBackHome={() => {}}
    />,
  );

  assert.match(html, /quiz-scan-shell/);
  assert.match(html, /isolate/);
  assert.match(html, /quiz-starfield/);
  assert.match(html, /SCAN PHASE 01/);
  assert.match(html, /SIGNAL CHANNEL 01/);
  assert.match(html, /信号校准中/);
  assert.doesNotMatch(html, /glass-panel rounded-3xl/);
  assert.doesNotMatch(html, /glass-button rounded-2xl/);
});

test("quiz scan background is sized to cover the full viewport", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const appSource = fs.readFileSync(path.resolve(process.cwd(), "src/App.tsx"), "utf8");
  const pageMarkup = renderToStaticMarkup(
    <QuizPage
      pageVariants={{}}
      step={0}
      activeQuestions={questions}
      onSelectOption={() => {}}
      onBackQuestion={() => {}}
      onBackHome={() => {}}
    />,
  );

  assert.match(source, /\.quiz-scan-shell/);
  assert.match(source, /min-height: 100dvh/);
  assert.doesNotMatch(source, /\.quiz-starfield\s*{[^}]*animation:/s);
  assert.match(source, /\.quiz-starfield::before/);
  assert.match(source, /@keyframes quiz-starfield-drift/);
  assert.match(appSource, /currentRoute === "\/quiz"\s*\?\s*"h-dvh min-h-dvh p-0"/);
  assert.match(pageMarkup, /flex/);
  assert.match(pageMarkup, /justify-center/);
});
