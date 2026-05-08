export type KnowledgeNebulaPerformanceBudget = {
  demandFrameIntervalMs: number;
  idleFrameIntervalMs: number;
  focusFrameIntervalMs: number;
  maxStarCountDesktop: number;
  maxStarCountMobile: number;
  maxFloatingKnowledgeDesktop: number;
  maxFloatingKnowledgeMobile: number;
};

export const KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET: KnowledgeNebulaPerformanceBudget = {
  demandFrameIntervalMs: 112,
  idleFrameIntervalMs: 168,
  focusFrameIntervalMs: 84,
  maxStarCountDesktop: 760,
  maxStarCountMobile: 420,
  maxFloatingKnowledgeDesktop: 14,
  maxFloatingKnowledgeMobile: 6,
};

export type PerformanceViewport = "desktop" | "mobile";
export type FloatingKnowledgePerformanceVariant = "loading" | "matching";
export type TopicDetailSceneComplexityBudget = {
  dpr: [number, number];
  emissionFilaments: number;
  spectralTubes: number;
  dustLanes: number;
  starCount: number;
};

export type KnowledgeNebulaDecorativeBudget = {
  particleLayerCount: number;
  shootingStarCount: number;
  animateIdleNebulas: boolean;
};

export function getKnowledgeNebulaSceneFrameIntervalMs({
  isFocused,
  isVisible,
}: {
  isFocused: boolean;
  isVisible: boolean;
}) {
  if (!isVisible) {
    return KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.idleFrameIntervalMs;
  }

  return isFocused
    ? KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.focusFrameIntervalMs
    : KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.demandFrameIntervalMs;
}

export function getKnowledgeNebulaStarCountBudget({
  viewport,
  isFocused,
}: {
  viewport: "desktop" | "mobile";
  isFocused: boolean;
}) {
  const maxStarCount =
    viewport === "desktop"
      ? KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.maxStarCountDesktop
      : KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.maxStarCountMobile;

  return isFocused ? maxStarCount : Math.max(90, Math.round(maxStarCount * 0.7));
}

export function getKnowledgeNebulaDprBudget({
  viewport,
  isVisible,
  prefersReducedMotion,
}: {
  viewport: PerformanceViewport;
  isVisible: boolean;
  prefersReducedMotion: boolean;
}): [number, number] {
  if (!isVisible || prefersReducedMotion) {
    return [1, 1];
  }

  return viewport === "desktop" ? [1, 1.25] : [1, 1.05];
}

export function getTopicDetailSceneComplexityBudget({
  viewport,
  isVisible,
  prefersReducedMotion,
}: {
  viewport: PerformanceViewport;
  isVisible: boolean;
  prefersReducedMotion: boolean;
}): TopicDetailSceneComplexityBudget {
  const mobile = viewport === "mobile";
  const reduction = !isVisible || prefersReducedMotion;

  return {
    dpr: getKnowledgeNebulaDprBudget({
      viewport,
      isVisible,
      prefersReducedMotion,
    }),
    emissionFilaments: reduction ? (mobile ? 18 : 28) : mobile ? 32 : 56,
    spectralTubes: reduction ? (mobile ? 1 : 3) : mobile ? 3 : 6,
    dustLanes: reduction ? (mobile ? 3 : 5) : mobile ? 5 : 9,
    starCount: reduction ? (mobile ? 28 : 54) : mobile ? 72 : 124,
  };
}

export function getFloatingKnowledgeItemBudget({
  variant,
  viewport,
  isVisible,
  prefersReducedMotion,
}: {
  variant: FloatingKnowledgePerformanceVariant;
  viewport: PerformanceViewport;
  isVisible: boolean;
  prefersReducedMotion: boolean;
}) {
  if (!isVisible) {
    return 0;
  }

  if (prefersReducedMotion) {
    return viewport === "desktop" ? 8 : 4;
  }

  if (viewport === "mobile") {
    return KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.maxFloatingKnowledgeMobile;
  }

  return variant === "matching"
    ? KNOWLEDGE_NEBULA_PERFORMANCE_BUDGET.maxFloatingKnowledgeDesktop
    : 12;
}

export function shouldEnableFloatingKnowledgePointerEffects({
  isVisible,
  prefersReducedMotion,
  hasFinePointer,
}: {
  isVisible: boolean;
  prefersReducedMotion: boolean;
  hasFinePointer: boolean;
}) {
  return isVisible && !prefersReducedMotion && hasFinePointer;
}

export function getKnowledgeNebulaDecorativeBudget({
  viewport,
  isVisible,
  prefersReducedMotion,
}: {
  viewport: PerformanceViewport;
  isVisible: boolean;
  prefersReducedMotion: boolean;
}): KnowledgeNebulaDecorativeBudget {
  if (!isVisible) {
    return {
      particleLayerCount: 0,
      shootingStarCount: 0,
      animateIdleNebulas: false,
    };
  }

  if (prefersReducedMotion) {
    return {
      particleLayerCount: 1,
      shootingStarCount: 0,
      animateIdleNebulas: false,
    };
  }

  if (viewport === "mobile") {
    return {
      particleLayerCount: 2,
      shootingStarCount: 1,
      animateIdleNebulas: false,
    };
  }

  return {
    particleLayerCount: 3,
    shootingStarCount: 4,
    animateIdleNebulas: true,
  };
}
