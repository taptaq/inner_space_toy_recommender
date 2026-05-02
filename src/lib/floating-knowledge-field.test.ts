import test from "node:test";
import assert from "node:assert/strict";
import { buildFloatingKnowledgeItems } from "./floating-knowledge-field.ts";
import type { LoadingFunFact } from "./loading-fun-facts.ts";

const facts: LoadingFunFact[] = Array.from({ length: 26 }, (_, index) => ({
  id: `fact-${index + 1}`,
  title: `知识碎片 ${index + 1}`,
  description: `描述 ${index + 1}`,
  theme: index % 2 === 0 ? "care" : "decision",
  surfaces: ["loading", "matching"],
}));

test("buildFloatingKnowledgeItems returns slightly richer desktop density", () => {
  const items = buildFloatingKnowledgeItems(facts, {
    variant: "loading",
    viewport: "desktop",
  });

  assert.equal(items.length, 13);
  assert.deepEqual(
    items.map((item) => item.fact.id),
    facts.slice(0, 13).map((fact) => fact.id),
  );
});

test("buildFloatingKnowledgeItems keeps matching desktop richer without becoming dense", () => {
  const items = buildFloatingKnowledgeItems(facts, {
    variant: "matching",
    viewport: "desktop",
  });

  assert.equal(items.length, 24);
  assert.ok(items.length < facts.length);
  assert.ok(
    items
      .slice(-5)
      .every((item) => item.slot.className.match(/floating-knowledge-slot-matching-2[0-4]/)),
    "newer matching slots should fill the middle ring rather than only the edges",
  );
});

test("buildFloatingKnowledgeItems returns slightly reduced mobile density", () => {
  const items = buildFloatingKnowledgeItems(facts, {
    variant: "matching",
    viewport: "mobile",
  });

  assert.equal(items.length, 6);
  assert.ok(items.every((item) => item.slot.mobileHidden !== true));
});

test("buildFloatingKnowledgeItems varies fragment shape and motion", () => {
  const items = buildFloatingKnowledgeItems(facts, {
    variant: "matching",
    viewport: "desktop",
  });

  assert.ok(
    new Set(items.map((item) => item.slot.shapeClassName)).size >= 4,
    "desktop fragments should use several silhouette shapes",
  );
  assert.ok(
    new Set(items.map((item) => item.slot.motionClassName)).size >= 3,
    "desktop fragments should use layered drifting motions",
  );
});

test("buildFloatingKnowledgeItems uses variant-specific slots", () => {
  const loadingItems = buildFloatingKnowledgeItems(facts, {
    variant: "loading",
    viewport: "desktop",
  });
  const matchingItems = buildFloatingKnowledgeItems(facts, {
    variant: "matching",
    viewport: "desktop",
  });

  assert.notEqual(loadingItems[0]?.slot.id, matchingItems[0]?.slot.id);
  assert.equal(loadingItems[0]?.slot.variant, "loading");
  assert.equal(matchingItems[0]?.slot.variant, "matching");
});

test("buildFloatingKnowledgeItems returns no items for empty facts", () => {
  assert.deepEqual(
    buildFloatingKnowledgeItems([], {
      variant: "loading",
      viewport: "desktop",
    }),
    [],
  );
});
