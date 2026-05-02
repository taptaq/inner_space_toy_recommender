import assert from "node:assert/strict";
import test from "node:test";

import { KNOWLEDGE_NEBULA_TOPICS } from "../data/knowledge-nebula.ts";
import { mergeKnowledgeNebulaTopicPayload } from "./knowledge-nebula-topic-sync.ts";

test("mergeKnowledgeNebulaTopicPayload keeps local expanded cards when database payload is stale", () => {
  const localTopic = KNOWLEDGE_NEBULA_TOPICS[0];
  const staleDatabaseTopic = {
    ...localTopic,
    sections: localTopic.sections.slice(0, 3).map((section, index) => ({
      ...section,
      summary: index === 0 ? "数据库热更新摘要" : section.summary,
      viewCount: index === 0 ? 12 : section.viewCount,
    })),
  };

  const mergedTopic = mergeKnowledgeNebulaTopicPayload(
    localTopic,
    staleDatabaseTopic,
  );

  assert.equal(mergedTopic.sections.length, localTopic.sections.length);
  assert.equal(mergedTopic.sections[0].summary, "数据库热更新摘要");
  assert.equal(mergedTopic.sections[0].viewCount, 12);
  assert.ok(
    mergedTopic.sections.some((section) => section.id === "science-noise"),
    "local expanded cards should remain visible after database sync",
  );
});

test("mergeKnowledgeNebulaTopicPayload computes varied related cards for local expanded cards", () => {
  const localTopic = KNOWLEDGE_NEBULA_TOPICS[0];
  const staleDatabaseTopic = {
    ...localTopic,
    sections: localTopic.sections.slice(0, 3),
  };

  const mergedTopic = mergeKnowledgeNebulaTopicPayload(
    localTopic,
    staleDatabaseTopic,
  );
  const scienceNoise = mergedTopic.sections.find(
    (section) => section.id === "science-noise",
  );
  const scienceMaterial = mergedTopic.sections.find(
    (section) => section.id === "science-material",
  );

  assert.ok(scienceNoise?.relatedSectionIds?.length);
  assert.ok(scienceMaterial?.relatedSectionIds?.length);
  assert.notDeepEqual(
    scienceNoise?.relatedSectionIds,
    scienceMaterial?.relatedSectionIds,
  );
  assert.notDeepEqual(scienceNoise?.relatedSectionIds, [
    "science-routes",
    "science-terms",
    "science-body",
  ]);
});
