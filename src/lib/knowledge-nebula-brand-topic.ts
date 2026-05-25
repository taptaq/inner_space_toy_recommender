import type {
  KnowledgeNebulaSection,
  KnowledgeNebulaTopic,
} from "../data/knowledge-nebula.ts";
import { buildBrandSlug } from "./brand-brief.ts";
import {
  OFFICIAL_COMPETITOR_REGISTRY,
  type CompetitorRegistryConfig,
} from "../scraper/shared/competitor-registry.ts";

export type BrandKnowledgeSource = {
  brandName: string;
  brandSlug: string;
  country?: string | null;
  description?: string | null;
  focus?: string | null;
  philosophy?: string[] | null;
  majorUserGroupProfile?: string | null;
  domain?: string | null;
  foundedDate?: string | null;
  isDomestic?: boolean | null;
};

const BRAND_KNOWLEDGE_FALLBACKS: CompetitorRegistryConfig[] = [
  {
    canonicalName: "LELO",
    matchNames: ["lelo"],
    country: "Sweden",
    description:
      "LELO 是偏高完成度、设计感与整体质感的经典品牌，覆盖女性向、男性向与情侣场景。",
    focus: "Unisex",
    philosophy: [
      "风格更克制、稳定，也更强调长期复用体验。",
      "整体完成度、材质和包装表达更像高端个人护理设备，而不只是单次刺激工具。",
    ],
    majorUserGroupProfile:
      "【核心人口】25-45 岁、愿意为材质、设计和长期体验买单的中高消费用户。 【心理特征】重视完成度、审美一致性和稳定体验，不希望产品显得廉价或一次性。",
    isDomestic: false,
  },
  {
    canonicalName: "SVAKOM",
    matchNames: ["svakom"],
    country: "China",
    description:
      "SVAKOM 是偏现代审美与女性向体验的情趣科技品牌，强调设计感、易用性和相对稳定的体感反馈。",
    focus: "Female",
    philosophy: [
      "整体风格更现代、友好，也更强调轻压力进入体验。",
    ],
    majorUserGroupProfile:
      "【核心人口】20-40 岁女性用户为主。 【心理特征】偏好外观友好、学习成本低、容易开始的产品。",
    isDomestic: true,
  },
  {
    canonicalName: "Lovense",
    matchNames: ["lovense"],
    country: "China",
    description:
      "Lovense 是远程互动和智能连接场景里辨识度较高的品牌，覆盖穿戴、互动和异地玩法。",
    focus: "Unisex",
    philosophy: [
      "整体风格更偏互动、连接和远程场景，也更强调联动体验。",
    ],
    majorUserGroupProfile:
      "【核心人口】异地情侣、科技偏好用户与互动内容场景用户。 【心理特征】重视连接能力、远程控制和玩法延展。",
    isDomestic: true,
  },
];

export function buildBrandKnowledgeSourceFromConfig(
  config: CompetitorRegistryConfig,
): BrandKnowledgeSource {
  return {
    brandName: config.canonicalName,
    brandSlug: buildBrandSlug(config.canonicalName),
    country: config.country ?? null,
    description: config.description ?? null,
    focus: config.focus ?? null,
    philosophy: config.philosophy ?? null,
    majorUserGroupProfile: config.majorUserGroupProfile ?? null,
    domain: config.domain ?? null,
    foundedDate: config.foundedDate ?? null,
    isDomestic: config.isDomestic ?? null,
  };
}

function buildBrandSection(source: BrandKnowledgeSource): KnowledgeNebulaSection {
  const summary =
    source.description || `${source.brandName} 的品牌定位与适用场景概览。`;
  const body = [
    source.description || `${source.brandName} 更适合作为一条需要进一步比较的品牌路径来看，而不是只看单个型号。`,
    ...(source.philosophy?.slice(0, 2) ?? []),
    source.majorUserGroupProfile || "这类品牌信息更适合拿来理解整体风格、人群偏好和决策成本，而不是替代具体参数判断。",
  ].filter(Boolean);

  return {
    id: source.brandSlug,
    title: source.brandName,
    summary,
    body,
    tags: [
      "品牌",
      source.country || "全球",
      source.focus || "Unisex",
    ],
  };
}

export function listDefaultBrandKnowledgeSources() {
  const allConfigs = [...OFFICIAL_COMPETITOR_REGISTRY];

  for (const fallback of BRAND_KNOWLEDGE_FALLBACKS) {
    const exists = allConfigs.some(
      (config) => buildBrandSlug(config.canonicalName) === buildBrandSlug(fallback.canonicalName),
    );
    if (!exists) {
      allConfigs.push(fallback);
    }
  }

  return allConfigs.map(buildBrandKnowledgeSourceFromConfig);
}

export function buildBrandKnowledgeTopic(
  baseTopic: KnowledgeNebulaTopic,
  preferredSources?: BrandKnowledgeSource[],
): KnowledgeNebulaTopic {
  const sourceMap = new Map<string, BrandKnowledgeSource>();

  for (const source of listDefaultBrandKnowledgeSources()) {
    sourceMap.set(source.brandSlug, source);
  }
  for (const source of preferredSources ?? []) {
    sourceMap.set(source.brandSlug, source);
  }

  const brandSections = Array.from(sourceMap.values()).map(buildBrandSection);

  return {
    ...baseTopic,
    title: "品牌星图",
    shortLabel: "品牌星图",
    summary: "从品牌定位、风格和适用场景，读懂一条完整的品牌路径。",
    featuredSectionIds: brandSections.slice(0, 3).map((section) => section.id),
    sections: brandSections,
  };
}
