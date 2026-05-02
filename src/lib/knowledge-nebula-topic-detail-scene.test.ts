import assert from "node:assert/strict";
import test from "node:test";

import { getKnowledgeNebulaTopicBySlug } from "../data/knowledge-nebula.ts";
import {
  buildTopicDetailNodeAnchors,
  buildTopicDetailSceneMeta,
} from "./knowledge-nebula-topic-detail-scene.ts";

const TOPIC_DETAIL_DISTANCE_FROM_CORE_SCALE = 50;
const DISTANCE_EPSILON = 1e-9;

test("knowledge nebula topic detail scene anchors and meta are deterministic", () => {
  const topic = getKnowledgeNebulaTopicBySlug("first-time");

  assert.ok(topic);

  const meta = buildTopicDetailSceneMeta(topic);
  const desktopAnchors = buildTopicDetailNodeAnchors({
    topic,
    viewport: "desktop",
  });
  const desktopAnchorsAgain = buildTopicDetailNodeAnchors({
    topic,
    viewport: "desktop",
  });
  const mobileAnchors = buildTopicDetailNodeAnchors({
    topic,
    viewport: "mobile",
  });
  const mobileAnchorsAgain = buildTopicDetailNodeAnchors({
    topic,
    viewport: "mobile",
  });

  assert.deepEqual(desktopAnchorsAgain, desktopAnchors);
  assert.deepEqual(mobileAnchorsAgain, mobileAnchors);

  assert.equal(desktopAnchors.length, topic.sections.length);
  assert.ok(
    desktopAnchors.every(
      (anchor) =>
        anchor.distanceFromCore >= 20 &&
        Math.abs(
          anchor.distanceFromCore -
            getTopicDetailDistanceFromCore(anchor.scenePosition, meta.corePosition),
        ) < DISTANCE_EPSILON,
    ),
  );
  assert.equal(
    desktopAnchors.filter((anchor) => anchor.kind === "primary").length,
    1,
  );
  assert.ok(
    new Set(desktopAnchors.map((anchor) => anchor.depthBand)).size >= 2,
  );

  assert.ok(
    mobileAnchors.every(
      (anchor) =>
        anchor.xPercent >= 28 &&
        anchor.xPercent <= 72 &&
        anchor.yPercent >= 16 &&
        anchor.yPercent <= 88,
    ),
  );

  assert.deepEqual(meta.corePosition, [0, 0.18, 0]);
  assert.ok(meta.coreGlowColor.startsWith("#"));
  assert.ok(meta.starDensity.desktop > meta.starDensity.mobile);
  assert.ok(meta.starDensity.desktop >= 160);
  assert.ok(meta.starDensity.mobile <= 100);
});

test("knowledge nebula topic detail scene supports expanded custom card counts", () => {
  const topic = getKnowledgeNebulaTopicBySlug("first-time");

  assert.ok(topic);

  const expandedTopic = {
    ...topic,
    sections: [
      ...topic.sections,
      {
        id: "first-extra-1",
        title: "额外碎片 1",
        summary: "用于验证更多自定义卡片时仍能生成锚点。",
        body: ["额外内容 1"],
      },
      {
        id: "first-extra-2",
        title: "额外碎片 2",
        summary: "用于验证更多自定义卡片时仍能生成锚点。",
        body: ["额外内容 2"],
      },
      {
        id: "first-extra-3",
        title: "额外碎片 3",
        summary: "用于验证更多自定义卡片时仍能生成锚点。",
        body: ["额外内容 3"],
      },
    ],
  };

  const anchors = buildTopicDetailNodeAnchors({
    topic: expandedTopic,
    viewport: "desktop",
  });

  assert.equal(anchors.length, expandedTopic.sections.length);
  assert.ok(
    anchors.every(
      (anchor) =>
        anchor.xPercent >= 8 &&
        anchor.xPercent <= 92 &&
        anchor.yPercent >= 12 &&
        anchor.yPercent <= 86,
    ),
  );
});

function getTopicDetailDistanceFromCore(
  scenePosition: [number, number, number],
  corePosition: [number, number, number],
) {
  return (
    Math.hypot(
      scenePosition[0] - corePosition[0],
      scenePosition[1] - corePosition[1],
      scenePosition[2] - corePosition[2],
    ) * TOPIC_DETAIL_DISTANCE_FROM_CORE_SCALE
  );
}
