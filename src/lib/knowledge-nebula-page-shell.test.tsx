import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { KNOWLEDGE_NEBULA_TOPICS } from "../data/knowledge-nebula.js";
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

test("brand knowledge detail page can render a specific competitor long-form card", () => {
  const html = renderToStaticMarkup(
    <KnowledgeNebulaPage
      pageVariants={{}}
      topicSlug="brand"
      sectionId="lelo"
      onBack={() => {}}
      onSelectTopic={() => {}}
    />,
  );

  assert.match(html, /LELO/);
  assert.match(html, /品牌星图/);
  assert.match(html, /偏高完成度、设计感与整体质感的经典品牌/);
});

test("knowledge nebula landing page keeps a more compact mobile shell", () => {
  const html = renderToStaticMarkup(
    <KnowledgeNebulaPage
      pageVariants={{}}
      onBack={() => {}}
      onSelectTopic={() => {}}
    />,
  );

  assert.match(html, /pt-20/);
  assert.match(html, /sm:pt-28/);
  assert.match(html, /gap-2\.5/);
  assert.match(html, /sm:gap-3/);
  assert.match(html, /text-xl font-light tracking-\[0\.2em\] text-white sm:text-3xl/);
  assert.match(html, /max-w-\[17\.5rem\] text-\[13px\] leading-relaxed text-slate-300\/88 sm:max-w-2xl sm:text-sm/);
  assert.match(html, /top-\[10rem\]/);
  assert.match(html, /sm:top-\[12\.75rem\]/);
  assert.match(html, /px-5/);
  assert.match(html, /text-center/);
  assert.match(html, /sm:px-6/);
  assert.match(html, /进入品牌星图/);
});
