import assert from "node:assert/strict";
import test from "node:test";

import * as knowledgeNebulaRoute from "./knowledge-nebula-route.ts";

test("knowledge detail opened from results returns directly to results", () => {
  assert.equal(
    typeof knowledgeNebulaRoute.resolveKnowledgeBackNavigation,
    "function",
  );

  assert.deepEqual(
    knowledgeNebulaRoute.resolveKnowledgeBackNavigation?.("/results", "science"),
    {
      kind: "route",
      route: "/results",
    },
  );
});

test("knowledge nebula path can include a nested brand section slug", () => {
  assert.equal(
    knowledgeNebulaRoute.buildKnowledgeNebulaPath("brand", "lelo"),
    "/knowledge/brand/lelo",
  );

  assert.deepEqual(
    knowledgeNebulaRoute.parseKnowledgeNebulaPath("/knowledge/brand/lelo"),
    {
      route: "/knowledge",
      topicSlug: "brand",
      sectionId: "lelo",
    },
  );
});

test("knowledge detail opened from the hub still returns to the knowledge hub", () => {
  assert.deepEqual(
    knowledgeNebulaRoute.resolveKnowledgeBackNavigation?.("/", "science"),
    {
      kind: "knowledge-hub",
    },
  );

  assert.deepEqual(
    knowledgeNebulaRoute.resolveKnowledgeBackNavigation?.(undefined, "science"),
    {
      kind: "knowledge-hub",
    },
  );
});

test("knowledge hub returns to the route that opened it", () => {
  assert.deepEqual(
    knowledgeNebulaRoute.resolveKnowledgeBackNavigation?.("/results"),
    {
      kind: "route",
      route: "/results",
    },
  );

  assert.deepEqual(
    knowledgeNebulaRoute.resolveKnowledgeBackNavigation?.(undefined),
    {
      kind: "route",
      route: "/",
    },
  );
});
