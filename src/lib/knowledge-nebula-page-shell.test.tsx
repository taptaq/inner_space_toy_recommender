import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { KNOWLEDGE_NEBULA_TOPICS } from "../data/knowledge-nebula.ts";
import { KnowledgeNebulaPage } from "../pages/KnowledgeNebulaPage.tsx";

const scienceTopic = KNOWLEDGE_NEBULA_TOPICS[0];

test("knowledge topic detail page renders the unified interior nebula shell", () => {
  const html = renderToStaticMarkup(
    <KnowledgeNebulaPage
      pageVariants={{}}
      topicSlug="science"
      onBack={() => {}}
      onSelectTopic={() => {}}
    />,
  );

  assert.match(html, /驾驶舱导航/);
  assert.match(html, /驾驶舱中控台/);
  assert.match(html, /cockpit-cruise-field/);
  assert.match(html, /knowledge-detail-viewport/);
  assert.match(html, /cockpit-cruise-depth/);
  assert.match(html, /fixed inset-0/);
  assert.match(html, /h-\[100dvh\]/);
  assert.match(html, new RegExp(`${scienceTopic.sections.length} 项参数配置`));
  assert.match(html, /<canvas/);
  assert.match(html, /h-\[100dvh\]/);
  assert.doesNotMatch(html, /<section[^>]*border border-white\/8/);
  assert.doesNotMatch(html, /星云档案/);
  assert.doesNotMatch(html, /主题星团/);
  assert.doesNotMatch(html, /glass-panel/);
  assert.doesNotMatch(html, /rounded-\[2rem\]/);
  assert.doesNotMatch(html, /3D 背景壳层/);
  assert.doesNotMatch(html, /碎片锚点/);
});

test("knowledge topic detail page does not render TOPIC MAP", () => {
  const html = renderToStaticMarkup(
    <KnowledgeNebulaPage
      pageVariants={{}}
      topicSlug="science"
      onBack={() => {}}
      onSelectTopic={() => {}}
    />,
  );

  assert.doesNotMatch(html, /TOPIC MAP/);
});
