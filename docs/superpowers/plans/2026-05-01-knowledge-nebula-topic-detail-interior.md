# Knowledge Nebula Topic Detail Interior Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/knowledge/:slug` topic detail pages into an “inside the nebula” experience with a 3D cloud core, freely distributed knowledge nodes, and a separate deep-space detail layer for each node.

**Architecture:** Keep the existing topic data, routes, and topic slugs, but replace the detail-page `Hero + grid cards` structure with a hybrid detail scene: a new R3F background scene renders the cloud core, depth layers, and motion, while DOM overlay components render readable knowledge nodes and an expanded deep-space info layer. The current `KnowledgeNebulaPage` remains the route entry point, and `KnowledgeNebulaTopicSections` is repurposed from a card grid into the detail-node interaction layer.

**Tech Stack:** React 19, TypeScript, `three`, `@react-three/fiber`, `@react-three/drei`, `motion/react`, Tailwind, Node test runner with `ts-node/esm`

---

## File Structure

### New files

- `src/lib/knowledge-nebula-topic-detail-scene.ts`
  Owns deterministic node placement, core safe-zone math, and deep-space layer metadata for desktop/mobile.
- `src/lib/knowledge-nebula-topic-detail-scene.test.ts`
  Verifies node distribution, safe-zone protection, relation ordering, and scene metadata contracts.
- `src/components/knowledge-nebula/TopicDetailScene3D.tsx`
  Owns the topic-detail R3F canvas, cloud core, depth fog, background stars, and node anchor motion.
- `src/components/knowledge-nebula/TopicDetailNodeLayer.tsx`
  Renders the DOM overlay nodes, hover state, and click targets aligned to the scene anchors.

### Modified files

- `src/pages/KnowledgeNebulaPage.tsx`
  Replaces the detail-page `Hero` shell with the new topic-detail scene scaffold.
- `src/components/KnowledgeNebulaTopicSections.tsx`
  Stops rendering the grid card list and instead owns the node detail state, deep-space info layer, and related-node navigation.
- `src/lib/knowledge-nebula-topic-detail.test.tsx`
  Updates assertions from “localized hero + grid fragments” to “cloud core + node overlay + expanded detail layer” behavior.

### Verification targets

- `node --loader ts-node/esm --test src/lib/knowledge-nebula-topic-detail-scene.test.ts`
- `node --loader ts-node/esm --test src/lib/knowledge-nebula-topic-detail.test.tsx`
- `npm run lint`
- Manual browser check on `/knowledge/first-time` and `/knowledge/science` in desktop and mobile widths

### Execution note

The user explicitly asked for no automatic commits. Replace commit steps with checkpoint review steps.

---

### Task 1: Define topic-detail scene math and placement contracts

**Files:**
- Create: `src/lib/knowledge-nebula-topic-detail-scene.ts`
- Create: `src/lib/knowledge-nebula-topic-detail-scene.test.ts`

- [ ] **Step 1: Write the failing scene-layout test**

`src/lib/knowledge-nebula-topic-detail-scene.test.ts`

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { getKnowledgeNebulaTopicBySlug } from "../data/knowledge-nebula.ts";
import {
  buildTopicDetailNodeAnchors,
  buildTopicDetailSceneMeta,
} from "./knowledge-nebula-topic-detail-scene.ts";

const topic = getKnowledgeNebulaTopicBySlug("first-time");

test("buildTopicDetailNodeAnchors keeps every node outside the protected core radius", () => {
  assert.ok(topic);
  const anchors = buildTopicDetailNodeAnchors({
    topic,
    viewport: "desktop",
  });

  assert.equal(anchors.length, topic.sections.length);
  assert.ok(anchors.every((anchor) => anchor.distanceFromCore >= 20));
});

test("buildTopicDetailNodeAnchors creates one primary node and mixed depth bands", () => {
  assert.ok(topic);
  const anchors = buildTopicDetailNodeAnchors({
    topic,
    viewport: "desktop",
  });

  assert.equal(anchors.filter((anchor) => anchor.kind === "primary").length, 1);
  assert.ok(new Set(anchors.map((anchor) => anchor.depthBand)).size >= 2);
});

test("mobile anchors stay inside readable viewport bounds", () => {
  assert.ok(topic);
  const anchors = buildTopicDetailNodeAnchors({
    topic,
    viewport: "mobile",
  });

  assert.ok(anchors.every((anchor) => anchor.xPercent >= 10 && anchor.xPercent <= 90));
  assert.ok(anchors.every((anchor) => anchor.yPercent >= 16 && anchor.yPercent <= 82));
});

test("buildTopicDetailSceneMeta returns a centered cloud core and matching accent tone", () => {
  assert.ok(topic);
  const meta = buildTopicDetailSceneMeta(topic);

  assert.deepEqual(meta.corePosition, [0, 0.18, 0]);
  assert.ok(meta.coreGlowColor.startsWith("#"));
  assert.ok(meta.starDensity.desktop > meta.starDensity.mobile);
});
```

- [ ] **Step 2: Run the new scene-layout test and confirm it fails**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-topic-detail-scene.test.ts
```

Expected:

- FAIL with module-not-found for `knowledge-nebula-topic-detail-scene.ts`

- [ ] **Step 3: Write the minimal scene-layout implementation**

`src/lib/knowledge-nebula-topic-detail-scene.ts`

```ts
import type {
  KnowledgeNebulaTopic,
  KnowledgeNebulaTopic["accent"],
} from "../data/knowledge-nebula.ts";

export type TopicDetailViewport = "desktop" | "mobile";
export type TopicDetailNodeKind = "primary" | "secondary" | "tertiary";
export type TopicDetailDepthBand = "near" | "mid" | "far";

export type TopicDetailNodeAnchor = {
  id: string;
  title: string;
  xPercent: number;
  yPercent: number;
  scenePosition: [number, number, number];
  distanceFromCore: number;
  kind: TopicDetailNodeKind;
  depthBand: TopicDetailDepthBand;
  scale: number;
};

export type TopicDetailSceneMeta = {
  corePosition: [number, number, number];
  coreGlowColor: string;
  mistColor: string;
  starDensity: {
    desktop: number;
    mobile: number;
  };
};

const SCENE_ACCENTS: Record<
  KnowledgeNebulaTopic["accent"],
  Pick<TopicDetailSceneMeta, "coreGlowColor" | "mistColor">
> = {
  cyan: {
    coreGlowColor: "#b9ecff",
    mistColor: "#4db4ff",
  },
  sky: {
    coreGlowColor: "#d5efff",
    mistColor: "#63b3ff",
  },
  indigo: {
    coreGlowColor: "#cfd4ff",
    mistColor: "#6f7cff",
  },
};

const DESKTOP_LAYOUT = [
  { xPercent: 25, yPercent: 30, scenePosition: [-4.4, 2.0, -1.4], distanceFromCore: 24, kind: "primary", depthBand: "mid", scale: 1.18 },
  { xPercent: 73, yPercent: 34, scenePosition: [4.1, 1.6, -2.1], distanceFromCore: 26, kind: "secondary", depthBand: "far", scale: 0.98 },
  { xPercent: 58, yPercent: 73, scenePosition: [1.8, -2.7, 0.5], distanceFromCore: 23, kind: "secondary", depthBand: "near", scale: 1.02 },
  { xPercent: 20, yPercent: 67, scenePosition: [-4.9, -1.8, -0.8], distanceFromCore: 28, kind: "tertiary", depthBand: "far", scale: 0.92 },
  { xPercent: 84, yPercent: 58, scenePosition: [5.1, -0.8, -1.2], distanceFromCore: 31, kind: "tertiary", depthBand: "mid", scale: 0.88 },
  { xPercent: 42, yPercent: 19, scenePosition: [-1.2, 3.2, 0.2], distanceFromCore: 22, kind: "tertiary", depthBand: "near", scale: 0.9 },
  { xPercent: 37, yPercent: 81, scenePosition: [-1.8, -3.4, -1.4], distanceFromCore: 29, kind: "tertiary", depthBand: "far", scale: 0.84 },
  { xPercent: 66, yPercent: 18, scenePosition: [2.8, 3.3, -0.9], distanceFromCore: 25, kind: "tertiary", depthBand: "mid", scale: 0.86 },
] as const;

const MOBILE_LAYOUT = [
  { xPercent: 23, yPercent: 28, scenePosition: [-2.9, 1.8, -1.2], distanceFromCore: 24, kind: "primary", depthBand: "mid", scale: 1.04 },
  { xPercent: 77, yPercent: 33, scenePosition: [3.0, 1.4, -1.8], distanceFromCore: 25, kind: "secondary", depthBand: "far", scale: 0.92 },
  { xPercent: 52, yPercent: 71, scenePosition: [0.7, -2.3, 0.4], distanceFromCore: 22, kind: "secondary", depthBand: "near", scale: 0.96 },
  { xPercent: 16, yPercent: 64, scenePosition: [-3.2, -1.4, -0.7], distanceFromCore: 27, kind: "tertiary", depthBand: "far", scale: 0.84 },
  { xPercent: 84, yPercent: 57, scenePosition: [3.4, -0.6, -1.0], distanceFromCore: 28, kind: "tertiary", depthBand: "mid", scale: 0.8 },
];

export function buildTopicDetailNodeAnchors({
  topic,
  viewport,
}: {
  topic: KnowledgeNebulaTopic;
  viewport: TopicDetailViewport;
}): TopicDetailNodeAnchor[] {
  const layout = viewport === "mobile" ? MOBILE_LAYOUT : DESKTOP_LAYOUT;

  return topic.sections.map((section, index) => {
    const slot = layout[index];
    return {
      id: section.id,
      title: section.title,
      ...slot,
    };
  });
}

export function buildTopicDetailSceneMeta(
  topic: KnowledgeNebulaTopic,
): TopicDetailSceneMeta {
  const accent = SCENE_ACCENTS[topic.accent];

  return {
    corePosition: [0, 0.18, 0],
    coreGlowColor: accent.coreGlowColor,
    mistColor: accent.mistColor,
    starDensity: {
      desktop: 180,
      mobile: 92,
    },
  };
}
```

- [ ] **Step 4: Re-run the scene-layout test and confirm it passes**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-topic-detail-scene.test.ts
```

Expected:

- PASS with 4 passing tests

- [ ] **Step 5: Checkpoint review**

Review:

- `src/lib/knowledge-nebula-topic-detail-scene.ts`
- `src/lib/knowledge-nebula-topic-detail-scene.test.ts`

Confirm:

- only one primary node is oversized
- every anchor stays outside the core safe-zone
- desktop and mobile both return deterministic layouts

---

### Task 2: Build the 3D topic-detail scene shell

**Files:**
- Create: `src/components/knowledge-nebula/TopicDetailScene3D.tsx`
- Modify: `src/lib/knowledge-nebula-topic-detail-scene.ts`
- Test: `src/lib/knowledge-nebula-topic-detail-scene.test.ts`

- [ ] **Step 1: Extend the test with scene-motion metadata expectations**

Append to `src/lib/knowledge-nebula-topic-detail-scene.test.ts`

```ts
test("scene meta exposes layered drift and fog settings for the 3D shell", () => {
  assert.ok(topic);
  const meta = buildTopicDetailSceneMeta(topic);

  assert.ok(meta.starDensity.desktop >= 160);
  assert.ok(meta.starDensity.mobile <= 100);
});
```

- [ ] **Step 2: Run the test and confirm it still passes before the component exists**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-topic-detail-scene.test.ts
```

Expected:

- PASS

- [ ] **Step 3: Create the topic-detail 3D shell component**

`src/components/knowledge-nebula/TopicDetailScene3D.tsx`

```tsx
import { AdaptiveDpr } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { KnowledgeNebulaTopic } from "../../data/knowledge-nebula.ts";
import type {
  TopicDetailNodeAnchor,
  TopicDetailSceneMeta,
  TopicDetailViewport,
} from "../../lib/knowledge-nebula-topic-detail-scene.ts";

function DriftGroup({
  meta,
  anchors,
}: {
  meta: TopicDetailSceneMeta;
  anchors: TopicDetailNodeAnchor[];
}) {
  const coreRef = useRef<THREE.Mesh>(null);
  const starRefs = useRef<THREE.Points[]>([]);
  const starPositions = useMemo(() => {
    return Array.from({ length: meta.starDensity.desktop }, (_, index) => {
      const x = (Math.sin(index * 17.13) * 5.8) as number;
      const y = (Math.cos(index * 13.7) * 3.9) as number;
      const z = ((index % 11) - 5) * 0.34;
      return [x, y, z] as const;
    });
  }, [meta.starDensity.desktop]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (coreRef.current) {
      coreRef.current.position.y = meta.corePosition[1] + Math.sin(t * 0.35) * 0.12;
      coreRef.current.rotation.z = Math.sin(t * 0.14) * 0.05;
    }

    starRefs.current.forEach((points, index) => {
      points.rotation.z = t * 0.01 * (index + 1);
    });
  });

  return (
    <>
      <fog attach="fog" args={["#050814", 7, 22]} />
      <ambientLight intensity={0.68} color="#dbeafe" />
      <pointLight position={[0, 0.6, 4]} intensity={1.3} color={meta.coreGlowColor} />
      <pointLight position={[-4.4, -2.1, 2]} intensity={0.42} color={meta.mistColor} />

      <mesh ref={coreRef} position={meta.corePosition}>
        <sphereGeometry args={[1.85, 48, 48]} />
        <meshBasicMaterial color={meta.coreGlowColor} transparent opacity={0.15} />
      </mesh>

      <mesh position={meta.corePosition}>
        <sphereGeometry args={[3.8, 48, 48]} />
        <meshBasicMaterial color={meta.mistColor} transparent opacity={0.06} />
      </mesh>

      {starPositions.length ? (
        <points ref={(node) => {
          if (node) starRefs.current[0] = node;
        }}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={starPositions.length}
              array={new Float32Array(starPositions.flat())}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial color="#d7ecff" size={0.025} transparent opacity={0.65} />
        </points>
      ) : null}
    </>
  );
}

export function TopicDetailScene3D({
  topic,
  anchors,
  meta,
  viewport,
}: {
  topic: KnowledgeNebulaTopic;
  anchors: TopicDetailNodeAnchor[];
  meta: TopicDetailSceneMeta;
  viewport: TopicDetailViewport;
}) {
  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={viewport === "mobile" ? [1, 1.25] : [1, 1.75]}
        gl={{ antialias: viewport !== "mobile", alpha: true }}
        camera={{
          position: [0, 0, viewport === "mobile" ? 9.8 : 10.6],
          fov: viewport === "mobile" ? 42 : 38,
          near: 0.1,
          far: 40,
        }}
      >
        <AdaptiveDpr pixelated />
        <DriftGroup meta={meta} anchors={anchors} />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 4: Re-run the scene test and lint the new component**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-topic-detail-scene.test.ts
npm run lint
```

Expected:

- scene-layout test PASS
- `tsc --noEmit` PASS

- [ ] **Step 5: Checkpoint review**

Review:

- `src/components/knowledge-nebula/TopicDetailScene3D.tsx`

Confirm:

- cloud core exists without a card-shaped panel
- scene shell is isolated from DOM node rendering
- no text rendering is attempted inside Three objects

---

### Task 3: Build the free-floating node overlay layer

**Files:**
- Create: `src/components/knowledge-nebula/TopicDetailNodeLayer.tsx`
- Modify: `src/lib/knowledge-nebula-topic-detail-scene.ts`
- Test: `src/lib/knowledge-nebula-topic-detail.test.tsx`

- [ ] **Step 1: Replace the old grid expectation with free-floating node assertions**

Update `src/lib/knowledge-nebula-topic-detail.test.tsx`

```ts
test("knowledge topic detail page renders a cloud core instead of a hero grid shell", () => {
  const html = renderToStaticMarkup(
    <KnowledgeNebulaPage
      pageVariants={{}}
      topicSlug="science"
      onBack={() => {}}
      onSelectTopic={() => {}}
    />,
  );

  assert.match(html, /主题星云核心/);
  assert.match(html, /进入主题云层/);
  assert.doesNotMatch(html, /TOPIC DETAIL/);
});

test("knowledge topic detail page no longer renders the fragment grid copy", () => {
  const html = renderToStaticMarkup(
    <KnowledgeNebulaPage
      pageVariants={{}}
      topicSlug="science"
      onBack={() => {}}
      onSelectTopic={() => {}}
    />,
  );

  assert.doesNotMatch(html, /碎片轨道/);
  assert.doesNotMatch(html, /共 3 个碎片/);
  assert.match(html, /读取碎片/);
});
```

- [ ] **Step 2: Run the topic-detail test and confirm it fails**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-topic-detail.test.tsx
```

Expected:

- FAIL because `主题星云核心` and `进入主题云层` are not yet rendered

- [ ] **Step 3: Create the DOM node overlay component**

`src/components/knowledge-nebula/TopicDetailNodeLayer.tsx`

```tsx
import { motion } from "motion/react";

import type { KnowledgeNebulaSection } from "../../data/knowledge-nebula.ts";
import type {
  TopicDetailNodeAnchor,
  TopicDetailViewport,
} from "../../lib/knowledge-nebula-topic-detail-scene.ts";

export function TopicDetailNodeLayer({
  anchors,
  sectionsById,
  openSectionId,
  hoveredSectionId,
  viewport,
  onHoverSection,
  onOpenSection,
}: {
  anchors: TopicDetailNodeAnchor[];
  sectionsById: Map<string, KnowledgeNebulaSection>;
  openSectionId?: string | null;
  hoveredSectionId?: string | null;
  viewport: TopicDetailViewport;
  onHoverSection: (sectionId: string | null) => void;
  onOpenSection: (sectionId: string) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {anchors.map((anchor, index) => {
        const section = sectionsById.get(anchor.id);
        if (!section) return null;

        const isActive = openSectionId === anchor.id || hoveredSectionId === anchor.id;

        return (
          <motion.button
            key={anchor.id}
            type="button"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{
              opacity: 1,
              scale: isActive ? 1.04 : 1,
              y: isActive ? -4 : 0,
            }}
            transition={{ delay: index * 0.06, duration: 0.42, ease: "easeOut" }}
            onMouseEnter={() => onHoverSection(anchor.id)}
            onMouseLeave={() => onHoverSection(null)}
            onFocus={() => onHoverSection(anchor.id)}
            onBlur={() => onHoverSection(null)}
            onClick={() => onOpenSection(anchor.id)}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-[1.75rem] border border-white/12 bg-[linear-gradient(180deg,rgba(8,14,30,0.58),rgba(8,14,30,0.32))] px-4 py-4 text-left shadow-[0_10px_50px_rgba(13,22,44,0.28)] backdrop-blur-md transition-colors hover:border-cyan-200/24 hover:bg-[linear-gradient(180deg,rgba(9,18,38,0.68),rgba(8,14,30,0.42))]"
            style={{
              left: `${anchor.xPercent}%`,
              top: `${anchor.yPercent}%`,
              width:
                anchor.kind === "primary"
                  ? viewport === "mobile"
                    ? "13rem"
                    : "16rem"
                  : viewport === "mobile"
                    ? "10.5rem"
                    : "12.5rem",
            }}
            aria-label={`打开知识节点 ${section.title}`}
          >
            <span className="text-[11px] tracking-[0.16em] text-slate-400">
              {anchor.kind === "primary" ? "主节点" : "知识节点"}
            </span>
            <h3 className="mt-3 text-base leading-snug text-white sm:text-lg">
              {section.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300/82">
              {section.summary}
            </p>
            <p className="mt-4 text-xs tracking-[0.16em] text-slate-400">
              读取碎片
            </p>
          </motion.button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Re-run the topic-detail test and lint**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-topic-detail.test.tsx
npm run lint
```

Expected:

- topic-detail test still FAILS on page integration assertions
- `tsc --noEmit` PASS

- [ ] **Step 5: Checkpoint review**

Review:

- `src/components/knowledge-nebula/TopicDetailNodeLayer.tsx`

Confirm:

- nodes are overlay fragments, not a grid
- node widths differ by node kind
- node buttons remain readable and clickable on mobile

---

### Task 4: Replace the detail-page page shell with cloud-core scene composition

**Files:**
- Modify: `src/pages/KnowledgeNebulaPage.tsx`
- Modify: `src/components/knowledge-nebula/TopicDetailScene3D.tsx`
- Modify: `src/lib/knowledge-nebula-topic-detail-scene.ts`
- Test: `src/lib/knowledge-nebula-topic-detail.test.tsx`

- [ ] **Step 1: Keep the failing topic-detail test in place and integrate the new scene scaffold**

No test edits in this step. Reuse the failing assertions from Task 3.

- [ ] **Step 2: Run the topic-detail test to confirm the page shell is still failing**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-topic-detail.test.tsx
```

Expected:

- FAIL because `KnowledgeNebulaPage` still renders the old detail structure

- [ ] **Step 3: Rewrite the detail-page branch to mount the scene shell**

`src/pages/KnowledgeNebulaPage.tsx`

```tsx
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";

import {
  KNOWLEDGE_NEBULA_TOPICS,
  getKnowledgeNebulaTopicBySlug,
  type KnowledgeNebulaTopicSlug,
} from "../data/knowledge-nebula.ts";
import { KnowledgeNebulaField } from "../components/KnowledgeNebulaField.tsx";
import { KnowledgeNebulaTopicSections } from "../components/KnowledgeNebulaTopicSections.tsx";
import { TopicDetailScene3D } from "../components/knowledge-nebula/TopicDetailScene3D.tsx";
import {
  buildTopicDetailNodeAnchors,
  buildTopicDetailSceneMeta,
  type TopicDetailViewport,
} from "../lib/knowledge-nebula-topic-detail-scene.ts";

function getTopicDetailViewport() {
  if (typeof window === "undefined") {
    return "desktop" as TopicDetailViewport;
  }
  return window.matchMedia("(min-width: 768px)").matches ? "desktop" : "mobile";
}

export function KnowledgeNebulaPage({
  pageVariants,
  topicSlug,
  onBack,
  onSelectTopic,
}: {
  pageVariants: any;
  topicSlug?: KnowledgeNebulaTopicSlug;
  onBack: () => void;
  onSelectTopic: (slug: KnowledgeNebulaTopicSlug) => void;
}) {
  const topic = topicSlug ? getKnowledgeNebulaTopicBySlug(topicSlug) : undefined;
  const isDetailPage = topic != null;
  const detailViewport = getTopicDetailViewport();
  const detailAnchors = useMemo(
    () => (topic ? buildTopicDetailNodeAnchors({ topic, viewport: detailViewport }) : []),
    [topic, detailViewport],
  );
  const detailMeta = useMemo(
    () => (topic ? buildTopicDetailSceneMeta(topic) : null),
    [topic],
  );

  return (
    <motion.div
      key={topicSlug ? `knowledge-${topicSlug}` : "knowledge"}
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className={isDetailPage ? "w-full pb-6 sm:pb-8" : "relative h-dvh w-full overflow-hidden"}
    >
      <div className={isDetailPage ? "mb-4 px-1 sm:mb-5 sm:px-2" : "absolute left-4 top-4 z-50 sm:left-6 sm:top-6"}>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/15 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>返回上一层</span>
        </button>
      </div>

      {isDetailPage && topic && detailMeta ? (
        <section className="relative min-h-[76vh] overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,#050915_0%,#07101d_100%)]">
          <TopicDetailScene3D
            topic={topic}
            anchors={detailAnchors}
            meta={detailMeta}
            viewport={detailViewport}
          />
          <KnowledgeNebulaTopicSections topic={topic} />
        </section>
      ) : (
        <div>
          <KnowledgeNebulaField
            topics={KNOWLEDGE_NEBULA_TOPICS}
            selectedTopicSlug={topicSlug}
            onSelectTopic={onSelectTopic}
          />
        </div>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 4: Re-run the topic-detail test and confirm the new shell assertions pass**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-topic-detail.test.tsx
```

Expected:

- PASS on `主题星云核心` / `进入主题云层` assertions once `KnowledgeNebulaTopicSections` is updated in the next task
- if still failing, failure should be in overlay content only, not the page shell

- [ ] **Step 5: Checkpoint review**

Review:

- `src/pages/KnowledgeNebulaPage.tsx`

Confirm:

- detail page no longer centers around a hero card
- topic scene composition is isolated from the hub
- route entry point stays unchanged

---

### Task 5: Rebuild `KnowledgeNebulaTopicSections` into node-state orchestration and deep-space info layer

**Files:**
- Modify: `src/components/KnowledgeNebulaTopicSections.tsx`
- Modify: `src/components/knowledge-nebula/TopicDetailNodeLayer.tsx`
- Test: `src/lib/knowledge-nebula-topic-detail.test.tsx`

- [ ] **Step 1: Extend the topic-detail test for the new detail-layer content**

Append to `src/lib/knowledge-nebula-topic-detail.test.tsx`

```ts
test("knowledge topic sections expose deep-space detail metadata and related-node navigation", () => {
  const source = fs.readFileSync(
    path.resolve(
      process.cwd(),
      "src/components/KnowledgeNebulaTopicSections.tsx",
    ),
    "utf8",
  );

  assert.match(source, /主题归属/);
  assert.match(source, /内容长度/);
  assert.match(source, /重点状态/);
  assert.match(source, /本主题其他碎片/);
  assert.match(source, /碎片已展开/);
});
```

- [ ] **Step 2: Run the topic-detail test and confirm it fails**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-topic-detail.test.tsx
```

Expected:

- FAIL because the new detail-layer copy does not yet exist

- [ ] **Step 3: Refactor `KnowledgeNebulaTopicSections` away from the grid list**

`src/components/KnowledgeNebulaTopicSections.tsx`

```tsx
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import type {
  KnowledgeNebulaSection,
  KnowledgeNebulaTopic,
} from "../data/knowledge-nebula.ts";
import {
  buildTopicDetailNodeAnchors,
  type TopicDetailViewport,
} from "../lib/knowledge-nebula-topic-detail-scene.ts";
import { TopicDetailNodeLayer } from "./knowledge-nebula/TopicDetailNodeLayer.tsx";

function getViewport() {
  if (typeof window === "undefined") {
    return "desktop" as TopicDetailViewport;
  }
  return window.matchMedia("(min-width: 768px)").matches ? "desktop" : "mobile";
}

export function KnowledgeNebulaTopicSections({
  topic,
  isAdmin = false,
}: {
  topic: KnowledgeNebulaTopic;
  isAdmin?: boolean;
}) {
  const [viewport, setViewport] = useState<TopicDetailViewport>(getViewport);
  const [hoveredSectionId, setHoveredSectionId] = useState<string | null>(null);
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);

  const sectionsById = useMemo(
    () => new Map(topic.sections.map((section) => [section.id, section])),
    [topic.sections],
  );
  const anchors = useMemo(
    () => buildTopicDetailNodeAnchors({ topic, viewport }),
    [topic, viewport],
  );
  const openSection = openSectionId ? sectionsById.get(openSectionId) : undefined;
  const relatedSections = openSection
    ? topic.sections.filter((section) => section.id !== openSection.id).slice(0, 3)
    : [];

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const onChange = (event: MediaQueryListEvent) => {
      setViewport(event.matches ? "desktop" : "mobile");
    };

    mediaQuery.addEventListener("change", onChange);
    return () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }, []);

  return (
    <>
      <div className="absolute inset-0">
        <div className="pointer-events-none absolute left-1/2 top-[20%] z-10 w-[min(34rem,82vw)] -translate-x-1/2 text-center">
          <p className="text-[11px] tracking-[0.26em] text-slate-400">主题星云核心</p>
          <h1 className="mt-4 text-3xl font-light tracking-[0.18em] text-white sm:text-5xl">
            {topic.title}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300/84 sm:text-base">
            {topic.summary}
          </p>
          <p className="mt-5 text-xs tracking-[0.18em] text-slate-500">进入主题云层</p>
        </div>

        <TopicDetailNodeLayer
          anchors={anchors}
          sectionsById={sectionsById}
          openSectionId={openSectionId}
          hoveredSectionId={hoveredSectionId}
          viewport={viewport}
          onHoverSection={setHoveredSectionId}
          onOpenSection={setOpenSectionId}
        />
      </div>

      {openSection ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/78 px-4 py-8 backdrop-blur-md"
          onClick={() => setOpenSectionId(null)}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${openSection.id}-dialog-title`}
            initial={{ opacity: 0, y: 28, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(7,12,24,0.98),rgba(4,8,18,0.96))] p-6 shadow-[0_0_120px_rgba(56,189,248,0.12)] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex rounded-full border border-cyan-300/16 bg-cyan-400/8 px-2.5 py-1 text-[10px] tracking-[0.18em] text-cyan-100/86">
                  碎片已展开
                </span>
                <h2 id={`${openSection.id}-dialog-title`} className="mt-4 text-2xl text-white sm:text-3xl">
                  {openSection.title}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300/84 sm:text-base">
                  {openSection.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenSectionId(null)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                aria-label="关闭碎片弹窗"
              >
                ×
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                <p className="text-[11px] tracking-[0.18em] text-slate-500">主题归属</p>
                <p className="mt-2 text-sm text-slate-100">{topic.title}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                <p className="text-[11px] tracking-[0.18em] text-slate-500">内容长度</p>
                <p className="mt-2 text-sm text-slate-100">{openSection.body.length} 段知识说明</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                <p className="text-[11px] tracking-[0.18em] text-slate-500">重点状态</p>
                <p className="mt-2 text-sm text-slate-100">
                  {topic.featuredSectionIds.includes(openSection.id) ? "重点碎片" : "普通碎片"}
                </p>
              </div>
            </div>

            <div className="mt-6 max-h-[40vh] space-y-4 overflow-y-auto pr-1">
              {openSection.body.map((paragraph, paragraphIndex) => (
                <p
                  key={`${openSection.id}-${paragraphIndex}`}
                  className="border-l-2 border-cyan-300/18 py-1 pl-4 text-sm leading-7 text-slate-200/88 sm:text-[15px]"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="mt-6 space-y-4 border-t border-white/8 pt-5">
              {openSection.tags?.length || openSection.sourceUrl ? (
                <div className="flex flex-wrap items-center gap-3">
                  {openSection.tags?.map((tag) => (
                    <span
                      key={`${openSection.id}-${tag}`}
                      className="rounded-full border border-cyan-300/14 bg-cyan-400/8 px-3 py-1 text-xs text-cyan-100/85"
                    >
                      {tag}
                    </span>
                  ))}
                  {openSection.sourceUrl ? (
                    <a
                      href={openSection.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition-colors hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-white"
                    >
                      查看来源
                    </a>
                  ) : null}
                </div>
              ) : null}

              <div>
                <p className="text-[11px] tracking-[0.18em] text-slate-500">本主题其他碎片</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {relatedSections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setOpenSectionId(section.id)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200 transition-colors hover:border-cyan-300/26 hover:bg-cyan-400/10 hover:text-white"
                    >
                      {section.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </>
  );
}
```

- [ ] **Step 4: Re-run topic-detail tests and lint**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-topic-detail.test.tsx
npm run lint
```

Expected:

- PASS with all topic-detail tests green
- `tsc --noEmit` PASS

- [ ] **Step 5: Checkpoint review**

Review:

- `src/components/KnowledgeNebulaTopicSections.tsx`

Confirm:

- no fragment grid remains
- page now has a center core + floating nodes composition
- detail layer includes metadata, body, source, and related-node navigation

---

### Task 6: Final verification and browser review

**Files:**
- Verify only: `src/pages/KnowledgeNebulaPage.tsx`
- Verify only: `src/components/KnowledgeNebulaTopicSections.tsx`
- Verify only: `src/components/knowledge-nebula/TopicDetailScene3D.tsx`
- Verify only: `src/components/knowledge-nebula/TopicDetailNodeLayer.tsx`

- [ ] **Step 1: Run the focused automated verification suite**

Run:

```bash
node --loader ts-node/esm --test src/lib/knowledge-nebula-topic-detail-scene.test.ts
node --loader ts-node/esm --test src/lib/knowledge-nebula-topic-detail.test.tsx
npm run lint
```

Expected:

- all tests PASS
- `tsc --noEmit` PASS

- [ ] **Step 2: Run an end-to-end browser sanity check**

Run:

```bash
npm run dev
```

Manual checklist:

- open `/knowledge/first-time`
- confirm there is no hero card + grid list structure
- confirm the page shows a central topic core and surrounding nodes
- hover a node on desktop and confirm only that node lifts and brightens
- open one node and confirm the deep-space detail layer shows metadata, body, and related nodes
- close the layer and confirm the page returns to the same topic scene
- repeat on a mobile-width viewport

- [ ] **Step 3: Review the spec coverage before declaring completion**

Compare implementation against:

- `docs/superpowers/specs/2026-05-01-knowledge-nebula-topic-detail-interior-design.md`

Confirm:

- 3D scene + 2D overlay architecture is present
- topic core replaces hero card
- nodes are freely distributed and avoid the core
- detail layer is separate from the node surface
- mobile retains the same world, not a plain list fallback

- [ ] **Step 4: Share a checkpoint summary with the user**

Summary should mention:

- what was rebuilt
- what tests passed
- whether any browser-only polish gaps remain
