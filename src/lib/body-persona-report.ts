import type { BodyPersonaResult } from "./body-persona.ts";

export type BodyPersonaCandidate = {
  id: string;
  name: string;
  score: number;
  tags?: string[];
  typeCode?: string | null;
  appearance?: string | null;
  maxDb?: number | null;
};

export type BodyPersonaDimensionScore = {
  id:
    | "safety_boundary"
    | "pace_control"
    | "atmosphere_need"
    | "response_need"
    | "privacy_need"
    | "disguise_need";
  label: string;
  score: number;
  summary: string;
};

export type BodyPersonaCategoryMatch = {
  id: string;
  label: string;
  fitScore: number;
  reason: string;
};

export type BodyPersonaProductPick = BodyPersonaCandidate & {
  personaScore: number;
  reason: string;
  categoryLabel?: string;
};

export type BodyPersonaFullReport = {
  reportTitle: string;
  personaName: string;
  personaSubtitle: string;
  personaManifesto: string;
  personaImageAsset: string | null;
  primaryPersonaCode: BodyPersonaResult["primaryPersonaCode"];
  secondaryPersonaCode: BodyPersonaResult["secondaryPersonaCode"];
  secondaryPersonaName: string | null;
  hiddenRouteCode: BodyPersonaResult["hiddenRouteCode"];
  hiddenRouteName: string;
  hiddenPowerGrade: BodyPersonaResult["hiddenPowerGrade"];
  coLivingComfortGrade: BodyPersonaResult["coLivingComfortGrade"];
  portraitShort: string;
  portraitLong: string;
  whyYouAreThis: string;
  strengthTags: string[];
  growthTip: string;
  dimensionBreakdown: BodyPersonaDimensionScore[];
  hiddenRouteSummaryShort: string;
  hiddenRouteSummaryLong: string;
  disguisePreference: string;
  storagePreference: string;
  privacyNeedLevel: string;
  bestRouteSummary: string;
  goodFits: string[];
  avoidNotes: string[];
  sceneMatches: string[];
  paceAdvice: string[];
  parameterFocus: string[];
  topCategoryMatches: BodyPersonaCategoryMatch[];
  pickReasonSummary: string;
  mismatchWarnings: string[];
  productPicks: BodyPersonaProductPick[];

  // Legacy aliases kept for current consumers while the richer contract rolls out.
  title: string;
  portrait: string;
  hiddenRouteSummary: string;
};

type BodyPersonaCode = BodyPersonaResult["primaryPersonaCode"];
type HiddenRouteCode = BodyPersonaResult["hiddenRouteCode"];

type PersonaNarrative = {
  manifesto: string;
  portraitExtension: string;
  strengthTags: string[];
  growthTip: string;
  bestRouteSummary: string;
  sceneMatches: string[];
  paceAdvice: string[];
  parameterFocus: string[];
  topCategoryMatches: BodyPersonaCategoryMatch[];
  pickReasonSummary: string;
  mismatchWarnings: string[];
  goodFits: string[];
  avoidNotes: string[];
  dimensionBreakdown: BodyPersonaDimensionScore[];
};

const PERSONA_DISPLAY_NAMES: Record<BodyPersonaCode, string> = {
  soft_glow: "慢热探索型",
  starlit_guard: "隐私安全型",
  tidal_sync: "氛围感受型",
  comet_spark: "直接点燃型",
  ring_control: "节奏掌控型",
  twin_orbit: "互动共振型",
};

const HIDDEN_ROUTE_NAMES: Record<HiddenRouteCode, string> = {
  zero_profile: "低存在感型",
  daily_object: "日常器物型",
  beauty_disguise: "精致伪装型",
  pocket_ready: "口袋随身型",
};

const CO_LIVING_COMFORT_LABELS: Record<
  BodyPersonaResult["coLivingComfortGrade"],
  string
> = {
  high: "高",
  medium: "中",
  low: "低",
};

const TYPE_CODE_LABELS: Record<string, string> = {
  care_accessory: "低存在感路线",
  external_vibe: "节奏温和路线",
  wand: "直接反馈路线",
  rabbit: "双重点路线",
  wearable: "互动陪伴路线",
  insertable: "沉浸包裹路线",
};

const PERSONA_NARRATIVES: Record<BodyPersonaCode, PersonaNarrative> = {
  soft_glow: {
    manifesto: "你不是慢，你是在等身体先确认舒服和信任。",
    portraitExtension:
      "你的身体会先确认舒服、熟悉和没有压力，再愿意把体验一点点往更深处打开。",
    strengthTags: ["慢热进入", "舒适优先", "低压探索"],
    growthTip: "先把体验做轻，再逐步拉长时长和层次，会比硬推强度更有效。",
    bestRouteSummary: "你长期更适合温和、易理解、能够慢慢建立熟悉感的路线。",
    sceneMatches: ["独处放松时段", "睡前慢速进入", "需要低压力试新的场景"],
    paceAdvice: ["先从轻反馈进入", "给自己一点适应时间再加层次"],
    parameterFocus: ["优先看舒适度", "优先看上手门槛", "优先看清洁友好度"],
    topCategoryMatches: [
      {
        id: "external_vibe",
        label: "温和起步路线",
        fitScore: 90,
        reason: "更容易帮你建立熟悉感，不需要一开始就承受明显压力。",
      },
      {
        id: "care_accessory",
        label: "轻量陪伴路线",
        fitScore: 84,
        reason: "存在感更低，更适合把安心感放在第一位。",
      },
    ],
    pickReasonSummary: "这些方向会先帮你把舒服感建立起来，再给你逐步升级的空间。",
    mismatchWarnings: ["一上来就强调强刺激的产品，可能会打断你本来正在建立的状态。"],
    goodFits: ["优先看温和、易理解的路线", "更适合低压力进入、可慢慢加深的产品"],
    avoidNotes: ["暂不优先一开始就高强度的路线", "暂不优先明显需要快速适应的产品"],
    dimensionBreakdown: [
      {
        id: "safety_boundary",
        label: "安全边界",
        score: 84,
        summary: "舒服和不被催促，是你愿意进入状态的前提。",
      },
      {
        id: "pace_control",
        label: "节奏掌控",
        score: 78,
        summary: "你更适合渐进式的节奏，不喜欢突然被推快。",
      },
      {
        id: "atmosphere_need",
        label: "氛围需求",
        score: 68,
        summary: "放松感会明显影响你的进入速度和持续度。",
      },
      {
        id: "response_need",
        label: "回应需求",
        score: 52,
        summary: "你在意反馈是否温和，而不是反馈是否夸张。",
      },
      {
        id: "privacy_need",
        label: "隐私需求",
        score: 64,
        summary: "你需要私密边界，但通常不会把它推到最高优先级。",
      },
      {
        id: "disguise_need",
        label: "伪装需求",
        score: 58,
        summary: "你会考虑低存在感，但核心还是舒适和安心。",
      },
    ],
  },
  starlit_guard: {
    manifesto: "你不是退缩，你只是更需要边界清晰的靠近方式。",
    portraitExtension:
      "你的身体会优先确认边界、安全感与进入节奏，再决定是否继续向更深的体验推进。",
    strengthTags: ["边界清晰", "低压进入", "隐私优先"],
    growthTip: "先把环境安稳下来，再去追求更复杂的体验层次。",
    bestRouteSummary: "你长期更适合低存在感、节奏可控、易收纳的路线。",
    sceneMatches: ["同住环境", "夜间个人使用", "需要快速收纳的场景"],
    paceAdvice: ["先从低压进入", "先确认边界再逐步推进"],
    parameterFocus: ["优先看静音", "优先看收纳", "优先看清洁成本"],
    topCategoryMatches: [
      {
        id: "care_accessory",
        label: "低存在感路线",
        fitScore: 92,
        reason: "更符合你对边界与安心感的长期需求。",
      },
      {
        id: "external_vibe",
        label: "节奏温和路线",
        fitScore: 86,
        reason: "进入成本更低，更适合慢慢建立信任感。",
      },
    ],
    pickReasonSummary: "这些方向更贴近你长期对边界、安全感、存在感和收纳成本的综合要求。",
    mismatchWarnings: ["高存在感但难收纳的产品，短期可能新鲜，长期不一定适合你。"],
    goodFits: ["优先看低存在感路线", "更适合节奏温和、可控的产品"],
    avoidNotes: ["暂不优先看高存在感路线", "暂不优先看噪音更明显的路线"],
    dimensionBreakdown: [
      {
        id: "safety_boundary",
        label: "安全边界",
        score: 92,
        summary: "你需要先确认不会被打扰，身体才会放松。",
      },
      {
        id: "pace_control",
        label: "节奏掌控",
        score: 74,
        summary: "你偏好低压力进入，而不是被突然推快。",
      },
      {
        id: "atmosphere_need",
        label: "氛围需求",
        score: 46,
        summary: "你需要的是安稳氛围，不一定需要强氛围戏剧性。",
      },
      {
        id: "response_need",
        label: "回应需求",
        score: 35,
        summary: "你更先关注边界，而不是互动回应本身。",
      },
      {
        id: "privacy_need",
        label: "隐私需求",
        score: 95,
        summary: "你对暴露和打扰的敏感度很高。",
      },
      {
        id: "disguise_need",
        label: "伪装需求",
        score: 88,
        summary: "越像日常物件，你越容易长期安心使用。",
      },
    ],
  },
  tidal_sync: {
    manifesto: "你不是需要铺垫，你是在等层次和氛围把自己带进去。",
    portraitExtension:
      "你的身体更容易被氛围、细节和层次渐进地带动，而不是被单点刺激直接推进。",
    strengthTags: ["氛围敏感", "层次偏好", "感受细腻"],
    growthTip: "把注意力放在节奏变化和反馈细腻度上，会比单纯追求强度更有收获。",
    bestRouteSummary: "你更适合有变化感、能慢慢叠加体验的路线。",
    sceneMatches: ["想认真享受过程的时段", "需要氛围铺垫的夜晚", "慢慢进入状态的独处场景"],
    paceAdvice: ["先建立氛围", "用变化而不是蛮力去推进体验"],
    parameterFocus: ["优先看模式层次", "优先看细腻反馈", "优先看材质触感"],
    topCategoryMatches: [
      {
        id: "rabbit",
        label: "层次变化路线",
        fitScore: 90,
        reason: "能给你更丰富的节奏层次，而不是单点输出。",
      },
      {
        id: "external_vibe",
        label: "细腻反馈路线",
        fitScore: 82,
        reason: "更适合你边感受边调整的进入方式。",
      },
    ],
    pickReasonSummary: "这些方向能把你的体验重点放在层次、氛围和变化上，而不是只有结果。",
    mismatchWarnings: ["过于直接、缺少变化的路线，可能会让你很快觉得体验单薄。"],
    goodFits: ["优先看有层次变化的路线", "更适合反馈细腻、氛围友好的产品"],
    avoidNotes: ["暂不优先纯直给型路线", "暂不优先反馈单一、变化少的产品"],
    dimensionBreakdown: [
      {
        id: "safety_boundary",
        label: "安全边界",
        score: 70,
        summary: "你需要舒服的环境，但不会像隐私型那样把边界放在绝对第一位。",
      },
      {
        id: "pace_control",
        label: "节奏掌控",
        score: 72,
        summary: "你喜欢边感受边调整，而不是单向被推着走。",
      },
      {
        id: "atmosphere_need",
        label: "氛围需求",
        score: 91,
        summary: "氛围和层次是你进入状态的重要开关。",
      },
      {
        id: "response_need",
        label: "回应需求",
        score: 67,
        summary: "你会被细腻的反馈和变化感持续带动。",
      },
      {
        id: "privacy_need",
        label: "隐私需求",
        score: 60,
        summary: "你会考虑私密感，但通常不是最核心的判断轴。",
      },
      {
        id: "disguise_need",
        label: "伪装需求",
        score: 64,
        summary: "如果外观更漂亮、压力更低，你会更愿意长期使用。",
      },
    ],
  },
  comet_spark: {
    manifesto: "你不是心急，你只是更容易被明确反馈快速点燃。",
    portraitExtension:
      "一旦反馈足够明确、目标感足够清楚，你往往能很快判断方向对不对，并迅速进入状态。",
    strengthTags: ["启动快速", "反馈直接", "目标清晰"],
    growthTip: "把刺激感和后续恢复感一起考虑，能让你的高能路线更稳定更耐用。",
    bestRouteSummary: "你更适合反馈明确、进入更快、目标感强的路线。",
    sceneMatches: ["想快速进入状态的时段", "需要明确反馈的独处场景", "不想做太多铺垫的时候"],
    paceAdvice: ["先确定目标感", "可以更快进入，但别跳过身体反馈"],
    parameterFocus: ["优先看反馈直给", "优先看力度上限", "优先看模式切换效率"],
    topCategoryMatches: [
      {
        id: "wand",
        label: "直给反馈路线",
        fitScore: 92,
        reason: "更符合你希望快速知道是否对味的节奏。",
      },
      {
        id: "rabbit",
        label: "高能组合路线",
        fitScore: 84,
        reason: "如果方向对了，你会愿意接受更明确的推进。",
      },
    ],
    pickReasonSummary: "这些方向能更快给你明确信号，减少你在铺垫阶段消耗的耐心。",
    mismatchWarnings: ["节奏过慢、反馈过弱的产品，可能会让你觉得一直进不到重点。"],
    goodFits: ["优先看反馈更直接的路线", "更适合启动更快、目标感强的产品"],
    avoidNotes: ["暂不优先过度强调铺垫的路线", "暂不优先反馈偏弱、存在感不足的产品"],
    dimensionBreakdown: [
      {
        id: "safety_boundary",
        label: "安全边界",
        score: 62,
        summary: "你在意舒服，但通常不会让边界验证拖慢整体节奏。",
      },
      {
        id: "pace_control",
        label: "节奏掌控",
        score: 76,
        summary: "你愿意快速推进，但仍希望节奏是清楚可理解的。",
      },
      {
        id: "atmosphere_need",
        label: "氛围需求",
        score: 44,
        summary: "你不会太依赖氛围铺垫来进入状态。",
      },
      {
        id: "response_need",
        label: "回应需求",
        score: 88,
        summary: "明确反馈会大幅提升你对体验的投入度。",
      },
      {
        id: "privacy_need",
        label: "隐私需求",
        score: 52,
        summary: "你会考虑隐私，但不会让它压过反馈效率。",
      },
      {
        id: "disguise_need",
        label: "伪装需求",
        score: 40,
        summary: "你通常不会优先为了伪装去牺牲反馈明确度。",
      },
    ],
  },
  ring_control: {
    manifesto: "你不是挑剔，你是在主动为自己安排更合适的节奏。",
    portraitExtension:
      "你会自然关注调节逻辑、切换手感和掌控边界，希望体验始终跟得上自己的节奏判断。",
    strengthTags: ["掌控明确", "调整敏感", "效率导向"],
    growthTip: "优先选择调节逻辑清楚的路线，比盲目堆功能更能让你长久满意。",
    bestRouteSummary: "你更适合可调空间大、模式切换清楚、自己能掌舵的路线。",
    sceneMatches: ["想精准调整的独处时段", "测试不同节奏偏好的场景", "需要高可控性的长期使用"],
    paceAdvice: ["先找到舒服基线", "把切换成本低的产品放在前面"],
    parameterFocus: ["优先看调节档位", "优先看操控清晰度", "优先看模式切换效率"],
    topCategoryMatches: [
      {
        id: "external_vibe",
        label: "可控节奏路线",
        fitScore: 88,
        reason: "更容易让你把节奏留在自己手里。",
      },
      {
        id: "wearable",
        label: "灵活切换路线",
        fitScore: 80,
        reason: "适合在不同场景下做细节调整。",
      },
    ],
    pickReasonSummary: "这些方向的共同点不是花哨，而是能把控制权稳定交还给你。",
    mismatchWarnings: ["模式复杂却逻辑混乱的产品，可能会迅速消耗你的耐心。"],
    goodFits: ["优先看调节清楚的路线", "更适合模式逻辑明确、切换方便的产品"],
    avoidNotes: ["暂不优先不可预期的随机反馈路线", "暂不优先需要大量摸索才能上手的产品"],
    dimensionBreakdown: [
      {
        id: "safety_boundary",
        label: "安全边界",
        score: 68,
        summary: "边界重要，但你更关心的是边界能否被自己掌控。",
      },
      {
        id: "pace_control",
        label: "节奏掌控",
        score: 94,
        summary: "你希望节奏、强弱和切换方式都在自己的掌握里。",
      },
      {
        id: "atmosphere_need",
        label: "氛围需求",
        score: 58,
        summary: "氛围能加分，但不会替代你对控制感的要求。",
      },
      {
        id: "response_need",
        label: "回应需求",
        score: 72,
        summary: "你重视反馈，但更重视反馈是否可预测、可调整。",
      },
      {
        id: "privacy_need",
        label: "隐私需求",
        score: 60,
        summary: "你会考虑环境限制，但仍优先保证掌控效率。",
      },
      {
        id: "disguise_need",
        label: "伪装需求",
        score: 56,
        summary: "如果收纳和外观更省心，会让你的整体决策更轻松。",
      },
    ],
  },
  twin_orbit: {
    manifesto: "你不是依赖回应，你只是更容易被互动感真正带动起来。",
    portraitExtension:
      "你会明显被回应感、同步感和来回互动所放大，所以体验是否有共振会格外重要。",
    strengthTags: ["回应敏感", "互动偏好", "共振体验"],
    growthTip: "优先选择能兼顾独处和互动两种节奏的路线，会让你的使用半径更大。",
    bestRouteSummary: "你更适合有回应感、可切换单人和双人节奏的路线。",
    sceneMatches: ["想感受互动陪伴的时段", "关系中的共同探索", "单人双人都想兼顾的场景"],
    paceAdvice: ["先确认互动感来源", "把可切换场景的产品放在前面"],
    parameterFocus: ["优先看互动感", "优先看双场景适配", "优先看连接和操控方式"],
    topCategoryMatches: [
      {
        id: "wearable",
        label: "互动陪伴路线",
        fitScore: 91,
        reason: "更能放大你对回应和连接感的偏好。",
      },
      {
        id: "rabbit",
        label: "双重点路线",
        fitScore: 82,
        reason: "更容易让你感到体验是有往复和共振的。",
      },
    ],
    pickReasonSummary: "这些方向更适合你把注意力放在互动感和回应感，而不是只看单点强度。",
    mismatchWarnings: ["完全孤立、缺少反馈变化的路线，可能会让你觉得体验不够被回应。"],
    goodFits: ["优先看互动感更强的路线", "更适合能兼顾单人和双人场景的产品"],
    avoidNotes: ["暂不优先缺少回应感的路线", "暂不优先只能在单一场景发挥的产品"],
    dimensionBreakdown: [
      {
        id: "safety_boundary",
        label: "安全边界",
        score: 66,
        summary: "你需要舒服的边界，但不会让它盖过互动本身的吸引力。",
      },
      {
        id: "pace_control",
        label: "节奏掌控",
        score: 71,
        summary: "你希望互动和节奏能彼此跟上，而不是各走各的。",
      },
      {
        id: "atmosphere_need",
        label: "氛围需求",
        score: 72,
        summary: "氛围会帮助你更容易进入互动状态。",
      },
      {
        id: "response_need",
        label: "回应需求",
        score: 93,
        summary: "你会明显被回应感、陪伴感和共振感放大体验。",
      },
      {
        id: "privacy_need",
        label: "隐私需求",
        score: 58,
        summary: "你会考虑边界，但通常不是判断路线的核心驱动。",
      },
      {
        id: "disguise_need",
        label: "伪装需求",
        score: 50,
        summary: "低存在感有帮助，但你更关心互动是否自然顺手。",
      },
    ],
  },
};

function scorePersonaCandidate(
  personaCode: BodyPersonaCode,
  candidate: Pick<
    BodyPersonaCandidate,
    "appearance" | "maxDb" | "tags" | "score" | "typeCode"
  >,
) {
  const narrative = PERSONA_NARRATIVES[personaCode];
  const categoryBoosts = new Map(
    narrative.topCategoryMatches.map((match, index) => [
      match.id,
      Math.max(4, Math.round((match.fitScore - 70) / 4) - index * 2),
    ]),
  );
  let boost = 0;

  if (candidate.typeCode) {
    boost += categoryBoosts.get(candidate.typeCode) ?? 0;
  }

  if (personaCode === "starlit_guard") {
    if (candidate.appearance === "high_disguise") boost += 8;
    if ((candidate.maxDb ?? 99) <= 45) boost += 6;
    if ((candidate.tags ?? []).some((tag) => /伪装|静音|隐蔽/.test(tag))) {
      boost += 6;
    }
  }

  if (personaCode === "comet_spark") {
    if ((candidate.tags ?? []).some((tag) => /强刺激|直给|高能/.test(tag))) {
      boost += 6;
    }
  }

  if (personaCode === "ring_control") {
    if ((candidate.tags ?? []).some((tag) => /可调|多档|模式|操控/.test(tag))) {
      boost += 5;
    }
  }

  if (personaCode === "tidal_sync") {
    if ((candidate.tags ?? []).some((tag) => /层次|氛围|细腻|变化/.test(tag))) {
      boost += 5;
    }
  }

  if (personaCode === "twin_orbit") {
    if ((candidate.tags ?? []).some((tag) => /互动|共振|双人|陪伴/.test(tag))) {
      boost += 5;
    }
  }

  if (personaCode === "soft_glow") {
    if ((candidate.tags ?? []).some((tag) => /温和|入门|轻柔|慢热/.test(tag))) {
      boost += 5;
    }
  }

  return candidate.score + boost;
}

function buildPrivacyNeedLevel(
  hiddenPowerGrade: BodyPersonaResult["hiddenPowerGrade"],
) {
  if (hiddenPowerGrade === "S") return "高";
  if (hiddenPowerGrade === "A") return "中高";
  return "中";
}

function buildDisguisePreference(hiddenRouteCode: HiddenRouteCode) {
  switch (hiddenRouteCode) {
    case "daily_object":
      return "更偏好表面日常、像普通物件一样不引人注意的外观。";
    case "beauty_disguise":
      return "更偏好精致但不过度直白的外观，让被看到时的压力更低。";
    case "pocket_ready":
      return "不一定要强伪装，但会明显偏好低负担、可随手带走的外观。";
    case "zero_profile":
    default:
      return "你对伪装没有极端要求，但会优先避免明显暴露用途的设计。";
  }
}

function buildStoragePreference(hiddenRouteCode: HiddenRouteCode) {
  switch (hiddenRouteCode) {
    case "daily_object":
      return "倾向优先选择能自然放进日常环境、不需要专门解释的收纳方式。";
    case "beauty_disguise":
      return "偏好既好看又不突兀的收纳方式，让整个体验更完整。";
    case "pocket_ready":
      return "倾向优先选择易收纳、拿取成本更低、移动也方便的路线。";
    case "zero_profile":
    default:
      return "你对收纳的核心要求是省心和低暴露，不想额外制造心理负担。";
  }
}

function buildHiddenRouteSummaryLong(
  hiddenRouteCode: HiddenRouteCode,
  hiddenRouteName: string,
) {
  switch (hiddenRouteCode) {
    case "daily_object":
      return `你不仅重视体验本身，也重视它如何被收纳、如何不打扰自己，以及在共居环境中是否足够安心。${hiddenRouteName}对你来说不是包装，而是长期安心使用的一部分。`;
    case "beauty_disguise":
      return `你希望这条路线在审美上也能成立，被看到时不会立刻带来突兀感。${hiddenRouteName}让你更容易把体验留在自己的节奏里。`;
    case "pocket_ready":
      return `你会把移动、收纳和快速结束后的处理成本一起纳入考虑。${hiddenRouteName}意味着你更适合低负担、可随时切换状态的路线。`;
    case "zero_profile":
    default:
      return `你不会把隐藏本身当成唯一目标，但会持续关注是否足够省心、低压力、不额外制造暴露焦虑。`;
  }
}

function buildProductCategoryLabel(candidate: BodyPersonaCandidate) {
  if (!candidate.typeCode) {
    return "通用方向";
  }

  return TYPE_CODE_LABELS[candidate.typeCode] ?? candidate.typeCode;
}

function buildProductReason(
  personaCode: BodyPersonaCode,
  candidate: BodyPersonaCandidate,
) {
  const traits: string[] = [];

  if (candidate.appearance === "high_disguise") {
    traits.push("外观低存在感");
  }

  if ((candidate.maxDb ?? 99) <= 45) {
    traits.push("噪音更克制");
  }

  if ((candidate.tags ?? []).some((tag) => /伪装|静音|隐蔽/.test(tag))) {
    traits.push("更容易低调使用");
  }

  if ((candidate.tags ?? []).some((tag) => /强刺激|直给|高能/.test(tag))) {
    traits.push("反馈更直接");
  }

  const traitText =
    traits.length > 0 ? traits.join("、") : "基础体验特征更稳定";

  switch (personaCode) {
    case "starlit_guard":
      return `它的${traitText}，更符合你对边界、安全感和低打扰节奏的要求。`;
    case "comet_spark":
      return `它的${traitText}，更容易帮你快速判断是否对味，不必在铺垫里消耗耐心。`;
    case "tidal_sync":
      return `它的${traitText}，更适合你在氛围和层次里慢慢把体验推开。`;
    case "ring_control":
      return `它的${traitText}，更适合你一边体验一边自己掌控节奏。`;
    case "twin_orbit":
      return `它的${traitText}，更容易放大你对回应感和互动感的偏好。`;
    case "soft_glow":
    default:
      return `它的${traitText}，更适合你先建立舒服感，再逐步进入状态。`;
  }
}

export function buildBodyPersonaFullReport({
  persona,
  candidatePool,
}: {
  persona: BodyPersonaResult;
  candidatePool: BodyPersonaCandidate[];
}): BodyPersonaFullReport {
  const narrative = PERSONA_NARRATIVES[persona.primaryPersonaCode];
  const primaryPersonaName =
    persona.freeSummary.title || PERSONA_DISPLAY_NAMES[persona.primaryPersonaCode];
  const hiddenRouteName = HIDDEN_ROUTE_NAMES[persona.hiddenRouteCode];
  const hiddenRouteSummary = `你的隐藏路线偏向${hiddenRouteName}，隐藏力 ${
    persona.hiddenPowerGrade
  }，共居安心度 ${
    CO_LIVING_COMFORT_LABELS[persona.coLivingComfortGrade]
  }。`;
  const portraitLong = `${persona.freeSummary.blurb} ${narrative.portraitExtension}`;

  const productPicks = [...candidatePool]
    .map((candidate) => ({
      ...candidate,
      personaScore: scorePersonaCandidate(persona.primaryPersonaCode, candidate),
    }))
    .sort((a, b) => {
      if (b.personaScore !== a.personaScore) {
        return b.personaScore - a.personaScore;
      }

      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.id.localeCompare(b.id);
    })
    .slice(0, 5)
    .map((candidate) => ({
      ...candidate,
      reason: buildProductReason(persona.primaryPersonaCode, candidate),
      categoryLabel: buildProductCategoryLabel(candidate),
    }));

  return {
    reportTitle: `${primaryPersonaName} · 完整星系人格档案`,
    personaName: primaryPersonaName,
    personaSubtitle: `${PERSONA_DISPLAY_NAMES[persona.primaryPersonaCode]} · 星系人格档案`,
    personaManifesto: narrative.manifesto,
    personaImageAsset: null,
    primaryPersonaCode: persona.primaryPersonaCode,
    secondaryPersonaCode: persona.secondaryPersonaCode,
    secondaryPersonaName: persona.secondaryPersonaCode
      ? PERSONA_DISPLAY_NAMES[persona.secondaryPersonaCode]
      : null,
    hiddenRouteCode: persona.hiddenRouteCode,
    hiddenRouteName,
    hiddenPowerGrade: persona.hiddenPowerGrade,
    coLivingComfortGrade: persona.coLivingComfortGrade,
    portraitShort: persona.freeSummary.blurb,
    portraitLong,
    whyYouAreThis: persona.freeSummary.why,
    strengthTags: narrative.strengthTags,
    growthTip: narrative.growthTip,
    dimensionBreakdown: narrative.dimensionBreakdown,
    hiddenRouteSummaryShort: `你的隐藏路线偏向${hiddenRouteName}。`,
    hiddenRouteSummaryLong: buildHiddenRouteSummaryLong(
      persona.hiddenRouteCode,
      hiddenRouteName,
    ),
    disguisePreference: buildDisguisePreference(persona.hiddenRouteCode),
    storagePreference: buildStoragePreference(persona.hiddenRouteCode),
    privacyNeedLevel: buildPrivacyNeedLevel(persona.hiddenPowerGrade),
    bestRouteSummary: narrative.bestRouteSummary,
    goodFits: narrative.goodFits,
    avoidNotes: narrative.avoidNotes,
    sceneMatches: narrative.sceneMatches,
    paceAdvice: narrative.paceAdvice,
    parameterFocus: narrative.parameterFocus,
    topCategoryMatches: narrative.topCategoryMatches,
    pickReasonSummary: narrative.pickReasonSummary,
    mismatchWarnings: narrative.mismatchWarnings,
    productPicks,

    title: primaryPersonaName,
    portrait: portraitLong,
    hiddenRouteSummary,
  };
}
