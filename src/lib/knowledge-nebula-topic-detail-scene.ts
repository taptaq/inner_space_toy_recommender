import type {
  KnowledgeNebulaTopic,
  KnowledgeNebulaSection,
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

export function getTopicDetailViewport(): TopicDetailViewport {
  if (typeof window === "undefined") {
    return "desktop";
  }

  return window.matchMedia("(min-width: 768px)").matches ? "desktop" : "mobile";
}

export type TopicDetailNodeCardWidth = {
  desktop: string;
  mobile: string;
};

export type TopicDetailNodePlacement = {
  width: string;
  xOffset: number;
  yOffset: number;
};

type TopicDetailLayout = {
  xPercent: number;
  yPercent: number;
  scenePosition: [number, number, number];
  kind: TopicDetailNodeKind;
  depthBand: TopicDetailDepthBand;
  scale: number;
};

type BuildTopicDetailNodeAnchorsOptions = {
  topic: KnowledgeNebulaTopic;
  viewport: TopicDetailViewport;
};

const TOPIC_DETAIL_CORE_POSITION: [number, number, number] = [0, 0.18, 0];
const TOPIC_DETAIL_DISTANCE_FROM_CORE_SCALE = 50;

const ACCENT_PALETTE: Record<
  KnowledgeNebulaTopic["accent"],
  { coreGlowColor: string; mistColor: string }
> = {
  cyan: {
    coreGlowColor: "#76f0ff",
    mistColor: "#0d2f3f",
  },
  sky: {
    coreGlowColor: "#8bc8ff",
    mistColor: "#102843",
  },
  indigo: {
    coreGlowColor: "#9da4ff",
    mistColor: "#1a1940",
  },
};

const DESKTOP_LAYOUT: readonly TopicDetailLayout[] = [
  createTopicDetailLayoutEntry({
    xPercent: 22,
    yPercent: 28,
    scenePosition: [-4.5, 1.8, -1.2],
    kind: "primary",
    depthBand: "mid",
    scale: 1.08,
  }),
  createTopicDetailLayoutEntry({
    xPercent: 78,
    yPercent: 30,
    scenePosition: [4.6, 1.7, -1.8],
    kind: "secondary",
    depthBand: "far",
    scale: 0.98,
  }),
  createTopicDetailLayoutEntry({
    xPercent: 50,
    yPercent: 78,
    scenePosition: [0.4, -3.8, 0.9],
    kind: "tertiary",
    depthBand: "near",
    scale: 1,
  }),
  createTopicDetailLayoutEntry({
    xPercent: 14,
    yPercent: 66,
    scenePosition: [-5.2, -0.9, -0.8],
    kind: "tertiary",
    depthBand: "far",
    scale: 0.9,
  }),
  createTopicDetailLayoutEntry({
    xPercent: 86,
    yPercent: 62,
    scenePosition: [5.2, -0.6, -1.1],
    kind: "secondary",
    depthBand: "mid",
    scale: 0.92,
  }),
  createTopicDetailLayoutEntry({
    xPercent: 42,
    yPercent: 16,
    scenePosition: [-1.2, 4.4, 0.3],
    kind: "tertiary",
    depthBand: "near",
    scale: 0.88,
  }),
  createTopicDetailLayoutEntry({
    xPercent: 64,
    yPercent: 18,
    scenePosition: [2.1, 4.2, -0.4],
    kind: "tertiary",
    depthBand: "mid",
    scale: 0.86,
  }),
  createTopicDetailLayoutEntry({
    xPercent: 34,
    yPercent: 84,
    scenePosition: [-2.4, -4.4, -0.6],
    kind: "tertiary",
    depthBand: "far",
    scale: 0.84,
  }),
];

const MOBILE_LAYOUT: readonly TopicDetailLayout[] = [
  createTopicDetailLayoutEntry({
    xPercent: 50,
    yPercent: 36,
    scenePosition: [-0.9, 1.5, -1.1],
    kind: "primary",
    depthBand: "mid",
    scale: 0.92,
  }),
  createTopicDetailLayoutEntry({
    xPercent: 52,
    yPercent: 58,
    scenePosition: [1.1, -0.4, -1.4],
    kind: "secondary",
    depthBand: "far",
    scale: 0.86,
  }),
  createTopicDetailLayoutEntry({
    xPercent: 48,
    yPercent: 78,
    scenePosition: [-1.1, -2.6, 0.7],
    kind: "tertiary",
    depthBand: "near",
    scale: 0.86,
  }),
  createTopicDetailLayoutEntry({
    xPercent: 34,
    yPercent: 48,
    scenePosition: [-2.8, 0.2, -0.6],
    kind: "tertiary",
    depthBand: "far",
    scale: 0.78,
  }),
  createTopicDetailLayoutEntry({
    xPercent: 66,
    yPercent: 68,
    scenePosition: [2.9, -1.4, -0.8],
    kind: "secondary",
    depthBand: "mid",
    scale: 0.78,
  }),
  createTopicDetailLayoutEntry({
    xPercent: 50,
    yPercent: 88,
    scenePosition: [0.2, 3.9, -0.2],
    kind: "tertiary",
    depthBand: "mid",
    scale: 0.8,
  }),
];

export function buildTopicDetailNodeAnchors({
  topic,
  viewport,
}: BuildTopicDetailNodeAnchorsOptions): TopicDetailNodeAnchor[] {
  const layout = viewport === "mobile" ? MOBILE_LAYOUT : DESKTOP_LAYOUT;

  return topic.sections.map((section: KnowledgeNebulaSection, index) => {
    const anchor = layout[index] ?? createOverflowTopicDetailLayout(index, viewport);

    return {
      id: section.id,
      title: section.title,
      xPercent: anchor.xPercent,
      yPercent: anchor.yPercent,
      scenePosition: [...anchor.scenePosition],
      distanceFromCore: getTopicDetailDistanceFromCore(
        anchor.scenePosition,
        TOPIC_DETAIL_CORE_POSITION,
      ),
      kind: anchor.kind,
      depthBand: anchor.depthBand,
      scale: anchor.scale,
    };
  });
}

export function buildTopicDetailSceneMeta(
  topic: Pick<KnowledgeNebulaTopic, "accent">,
): TopicDetailSceneMeta {
  const palette = ACCENT_PALETTE[topic.accent];

  return {
    corePosition: [...TOPIC_DETAIL_CORE_POSITION],
    coreGlowColor: palette.coreGlowColor,
    mistColor: palette.mistColor,
    starDensity: {
      desktop: 180,
      mobile: 92,
    },
  };
}

export function getTopicDetailNodeCardWidth(
  kind: TopicDetailNodeKind,
  viewport: TopicDetailViewport,
): string {
  const desktopWidths: Record<TopicDetailNodeKind, string> = {
    primary: "min(26rem, 26vw)",
    secondary: "min(23rem, 24vw)",
    tertiary: "min(21rem, 22vw)",
  };
  const mobileWidths: Record<TopicDetailNodeKind, string> = {
    primary: "min(20rem, 82vw)",
    secondary: "min(18rem, 80vw)",
    tertiary: "min(17rem, 78vw)",
  };

  return viewport === "mobile" ? mobileWidths[kind] : desktopWidths[kind];
}

export function getTopicDetailNodePlacement(
  kind: TopicDetailNodeKind,
  viewport: TopicDetailViewport,
): TopicDetailNodePlacement {
  const width = getTopicDetailNodeCardWidth(kind, viewport);

  if (kind === "primary") {
    return {
      width,
      xOffset: viewport === "mobile" ? 0 : -50,
      yOffset: viewport === "mobile" ? -20 : -40,
    };
  }

  if (kind === "secondary") {
    return {
      width,
      xOffset: viewport === "mobile" ? 0 : -12,
      yOffset: viewport === "mobile" ? -18 : -28,
    };
  }

  return {
    width,
    xOffset: viewport === "mobile" ? 0 : -88,
    yOffset: viewport === "mobile" ? -18 : -56,
  };
}

function createTopicDetailLayoutEntry(
  layout: TopicDetailLayout,
): TopicDetailLayout {
  return {
    ...layout,
    scenePosition: [...layout.scenePosition],
  };
}

function createOverflowTopicDetailLayout(
  index: number,
  viewport: TopicDetailViewport,
): TopicDetailLayout {
  const baseLength = viewport === "mobile" ? MOBILE_LAYOUT.length : DESKTOP_LAYOUT.length;
  const overflowIndex = index - baseLength;
  const angle = overflowIndex * 1.27 + (viewport === "mobile" ? 0.42 : 0.16);
  const radiusX = viewport === "mobile" ? 3.55 : 4.85;
  const radiusY = viewport === "mobile" ? 2.8 : 3.9;
  const xPercent = clamp(
    50 + Math.cos(angle) * (viewport === "mobile" ? 34 : 38),
    viewport === "mobile" ? 28 : 10,
    viewport === "mobile" ? 72 : 90,
  );
  const yPercent = clamp(
    50 + Math.sin(angle) * (viewport === "mobile" ? 30 : 34),
    14,
    86,
  );
  const depthBand: TopicDetailDepthBand =
    overflowIndex % 3 === 0 ? "near" : overflowIndex % 3 === 1 ? "mid" : "far";
  const kind: TopicDetailNodeKind =
    overflowIndex % 4 === 0 ? "secondary" : "tertiary";

  return {
    xPercent,
    yPercent,
    scenePosition: [
      Math.cos(angle) * radiusX,
      Math.sin(angle) * radiusY,
      depthBand === "near" ? 0.9 : depthBand === "mid" ? -0.4 : -1.1,
    ],
    kind,
    depthBand,
    scale: kind === "secondary" ? 0.9 : 0.82,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getTopicDetailDistanceFromCore(
  scenePosition: [number, number, number],
  corePosition: [number, number, number],
) {
  const dx = scenePosition[0] - corePosition[0];
  const dy = scenePosition[1] - corePosition[1];
  const dz = scenePosition[2] - corePosition[2];

  return Math.hypot(dx, dy, dz) * TOPIC_DETAIL_DISTANCE_FROM_CORE_SCALE;
}
