export const BODY_PERSONA_CODES = [
  "soft_glow",
  "starlit_guard",
  "tidal_sync",
  "comet_spark",
  "ring_control",
  "twin_orbit",
] as const;

export type BodyPersonaCode = (typeof BODY_PERSONA_CODES)[number];

export const HIDDEN_ROUTE_CODES = [
  "zero_profile",
  "daily_object",
  "beauty_disguise",
  "pocket_ready",
] as const;

export type HiddenRouteCode = (typeof HIDDEN_ROUTE_CODES)[number];

export const BODY_PERSONA_QUESTION_IDS = [
  "entry_anchor",
  "spark_trigger",
  "seen_shape",
  "secret_feeling",
  "mismatch_reaction",
  "relax_context",
  "rhythm_metaphor",
  "control_need",
  "private_hesitation",
  "long_term_route",
] as const;

export type BodyPersonaQuestionId = (typeof BODY_PERSONA_QUESTION_IDS)[number];

export type BodyPersonaAnswerValue =
  | "need_safe_first"
  | "need_atmosphere"
  | "ready_when_right"
  | "cared_for"
  | "layered_pull"
  | "clear_signal"
  | "fully_hidden"
  | "pretty_but_safe"
  | "easy_to_store"
  | "quiet_secret"
  | "ordinary_double_use"
  | "playful_contrast"
  | "pause_check"
  | "adjust_controls"
  | "stronger_if_right"
  | "solo_quiet"
  | "self_controlled_vibe"
  | "responsive_company"
  | "slow_prelude"
  | "rich_layers"
  | "clear_beat"
  | "stop_anytime"
  | "manual_control"
  | "guided_simple"
  | "fear_bad_fit"
  | "fear_discovery"
  | "fear_no_surprise"
  | "safe_low_key"
  | "layered_understood"
  | "direct_less_trial";

export type BodyPersonaAnswers = Partial<
  Record<BodyPersonaQuestionId, BodyPersonaAnswerValue>
>;

export type BodyPersonaWeights = Partial<Record<BodyPersonaCode, number>>;

export type BodyPersonaQuestionOption = {
  value: BodyPersonaAnswerValue;
  label: string;
  weights: BodyPersonaWeights;
  hidden?: readonly {
    route: HiddenRouteCode;
    power: number;
  }[];
};

export type BodyPersonaQuestion = {
  id: BodyPersonaQuestionId;
  title: string;
  options: readonly BodyPersonaQuestionOption[];
};

export type BodyPersonaResult = {
  primaryPersonaCode: BodyPersonaCode;
  secondaryPersonaCode: BodyPersonaCode | null;
  hiddenRouteCode: HiddenRouteCode;
  hiddenPowerGrade: "S" | "A" | "B";
  coLivingComfortGrade: "high" | "medium" | "low";
  freeSummary: {
    title: string;
    blurb: string;
    why: string;
    hints: string[];
  };
};

const PERSONA_TITLES = {
  soft_glow: "慢热探索型",
  starlit_guard: "隐私安全型",
  tidal_sync: "氛围感受型",
  comet_spark: "直接点燃型",
  ring_control: "节奏掌控型",
  twin_orbit: "互动共振型",
} as const;

const PERSONA_FREE_SUMMARIES: Record<
  BodyPersonaCode,
  Pick<BodyPersonaResult["freeSummary"], "blurb" | "why" | "hints">
> = {
  soft_glow: {
    blurb: "你更适合低压力、慢慢靠近的路线，先让身体安心，再一点点打开体验。",
    why: "你的答案在安全进入、慢节奏和随时可停的掌控感上更突出。",
    hints: ["优先看温和、易上手的产品", "把舒适度和放松感放在强度前面"],
  },
  starlit_guard: {
    blurb: "你更在意低压力进入、隐私边界和不打扰自己的节奏。",
    why: "你在隐私需求、慢热节奏和安全感维度得分更高。",
    hints: ["先看低存在感路线", "优先节奏温和、易收纳的产品"],
  },
  tidal_sync: {
    blurb: "你容易被氛围和层次打动，适合能慢慢叠加、带一点变化的体验路线。",
    why: "你的答案在氛围感、层次变化和被理解感上形成了稳定偏好。",
    hints: ["优先看反馈细腻、有变化的产品", "比起单点强度，更适合关注节奏层次"],
  },
  comet_spark: {
    blurb: "你更偏向反馈明确、进入更快、体验目标更清晰的路线。",
    why: "你在启动速度、直接反馈和低铺垫倾向上得分更高。",
    hints: ["优先看反馈直接路线", "更适合启动更快的产品"],
  },
  ring_control: {
    blurb: "你更看重过程可控，适合能自己调节节奏、强弱和切换方式的路线。",
    why: "你的答案在手动掌控、节奏调整和效率感上更集中。",
    hints: ["优先看模式清楚、调节方便的产品", "把可控性放在花哨功能前面"],
  },
  twin_orbit: {
    blurb: "你更容易被回应感和互动感放大体验，适合能和关系节奏同步的路线。",
    why: "你的答案在陪伴、回应和互动共振上更突出。",
    hints: ["优先看互动感强的产品", "关注是否适合单人和双人场景切换"],
  },
};

export const BODY_PERSONA_QUESTIONS: readonly BodyPersonaQuestion[] = [
  {
    id: "entry_anchor",
    title: "当你准备开始一段只属于自己的体验时，最需要先出现的是？",
    options: [
      {
        value: "need_safe_first",
        label: "我得先确认自己不会紧张、不会被打扰",
        weights: { starlit_guard: 3, soft_glow: 2 },
        hidden: [{ route: "daily_object", power: 2 }],
      },
      {
        value: "need_atmosphere",
        label: "我需要一点氛围感，慢慢被带进去",
        weights: { soft_glow: 3, tidal_sync: 2 },
      },
      {
        value: "ready_when_right",
        label: "我只要感觉对了，就不想拖太久",
        weights: { comet_spark: 3, ring_control: 1 },
      },
    ],
  },
  {
    id: "spark_trigger",
    title: "比起它有多强，你更容易被什么打动？",
    options: [
      {
        value: "cared_for",
        label: "它让我觉得自己被照顾到了",
        weights: { soft_glow: 2, starlit_guard: 2 },
      },
      {
        value: "layered_pull",
        label: "它有层次，会一点点把我带进去",
        weights: { tidal_sync: 3, soft_glow: 1 },
      },
      {
        value: "clear_signal",
        label: "它很直接，不绕弯，我能马上知道适不适合",
        weights: { comet_spark: 3, ring_control: 1 },
      },
    ],
  },
  {
    id: "seen_shape",
    title: "如果这件东西被别人偶然看到，你更希望它像什么？",
    options: [
      {
        value: "fully_hidden",
        label: "最好完全看不出它是什么",
        weights: { starlit_guard: 3 },
        hidden: [{ route: "daily_object", power: 3 }],
      },
      {
        value: "pretty_but_safe",
        label: "像一个漂亮的小物件，就算看到也不尴尬",
        weights: { tidal_sync: 1, starlit_guard: 2 },
        hidden: [{ route: "beauty_disguise", power: 3 }],
      },
      {
        value: "easy_to_store",
        label: "不一定要伪装，但要好收、好藏、好带走",
        weights: { ring_control: 2, soft_glow: 1 },
        hidden: [{ route: "pocket_ready", power: 1 }],
      },
    ],
  },
  {
    id: "secret_feeling",
    title: "你更喜欢哪一种秘密感？",
    options: [
      {
        value: "quiet_secret",
        label: "安静地拥有，不需要任何人知道",
        weights: { starlit_guard: 3, soft_glow: 1 },
        hidden: [
          { route: "zero_profile", power: 2 },
          { route: "daily_object", power: 1 },
        ],
      },
      {
        value: "ordinary_double_use",
        label: "表面很日常，但自己知道它有另一层用途",
        weights: { starlit_guard: 2, ring_control: 1 },
        hidden: [{ route: "daily_object", power: 3 }],
      },
      {
        value: "playful_contrast",
        label: "有一点反差感，像一个只有我懂的小彩蛋",
        weights: { tidal_sync: 2, comet_spark: 1 },
        hidden: [{ route: "beauty_disguise", power: 1 }],
      },
    ],
  },
  {
    id: "mismatch_reaction",
    title: "当体验不如预期时，你第一反应更像哪一种？",
    options: [
      {
        value: "pause_check",
        label: "先停一下，确认自己还舒服不舒服",
        weights: { soft_glow: 3, starlit_guard: 1 },
      },
      {
        value: "adjust_controls",
        label: "调一下节奏或模式，找到更合适的点",
        weights: { ring_control: 3, tidal_sync: 1 },
      },
      {
        value: "stronger_if_right",
        label: "如果方向没错，我愿意再试一下更明确的反馈",
        weights: { comet_spark: 2, tidal_sync: 1 },
      },
    ],
  },
  {
    id: "relax_context",
    title: "你更容易在哪种状态下放松？",
    options: [
      {
        value: "solo_quiet",
        label: "一个人、安静、没有被观察感",
        weights: { starlit_guard: 2, soft_glow: 2 },
        hidden: [{ route: "zero_profile", power: 1 }],
      },
      {
        value: "self_controlled_vibe",
        label: "有一点氛围，但节奏还是掌握在我手里",
        weights: { ring_control: 3, tidal_sync: 1 },
      },
      {
        value: "responsive_company",
        label: "有回应、有陪伴，感觉会被放大",
        weights: { twin_orbit: 3, tidal_sync: 1 },
      },
    ],
  },
  {
    id: "rhythm_metaphor",
    title: "如果把体验比作一段音乐，你更像哪一种？",
    options: [
      {
        value: "slow_prelude",
        label: "前奏要慢一点，身体先相信它",
        weights: { soft_glow: 3, starlit_guard: 1 },
      },
      {
        value: "rich_layers",
        label: "层次要丰富，最好有起伏和变化",
        weights: { tidal_sync: 3, twin_orbit: 1 },
      },
      {
        value: "clear_beat",
        label: "节拍要明确，我想快速抓住重点",
        weights: { comet_spark: 3, ring_control: 1 },
      },
    ],
  },
  {
    id: "control_need",
    title: "你对掌控感的需求更接近哪一句？",
    options: [
      {
        value: "stop_anytime",
        label: "我想慢慢试，随时能停下来",
        weights: { soft_glow: 2, starlit_guard: 2 },
      },
      {
        value: "manual_control",
        label: "我想自己掌握节奏、强弱和切换",
        weights: { ring_control: 3 },
      },
      {
        value: "guided_simple",
        label: "我不想研究太多，顺着体验走就好",
        weights: { comet_spark: 2, tidal_sync: 1 },
      },
    ],
  },
  {
    id: "private_hesitation",
    title: "当你想买一个更私密的东西时，最容易犹豫的点是？",
    options: [
      {
        value: "fear_bad_fit",
        label: "怕买回来不适合自己",
        weights: { soft_glow: 2, starlit_guard: 1 },
      },
      {
        value: "fear_discovery",
        label: "怕被发现、被误解、被打扰",
        weights: { starlit_guard: 3 },
        hidden: [
          { route: "daily_object", power: 2 },
          { route: "zero_profile", power: 1 },
        ],
      },
      {
        value: "fear_no_surprise",
        label: "怕太普通，最后没有惊喜",
        weights: { tidal_sync: 2, comet_spark: 2 },
        hidden: [{ route: "beauty_disguise", power: 1 }],
      },
    ],
  },
  {
    id: "long_term_route",
    title: "如果最后只能留下一种长期路线，你更想要哪种？",
    options: [
      {
        value: "safe_low_key",
        label: "安心、低调、慢慢靠近",
        weights: { starlit_guard: 2, soft_glow: 2 },
        hidden: [{ route: "daily_object", power: 1 }],
      },
      {
        value: "layered_understood",
        label: "有层次、有氛围、有一点被理解的感觉",
        weights: { tidal_sync: 3, twin_orbit: 1 },
        hidden: [{ route: "beauty_disguise", power: 1 }],
      },
      {
        value: "direct_less_trial",
        label: "直接、清楚、效率高，不浪费试错",
        weights: { comet_spark: 2, ring_control: 2 },
        hidden: [{ route: "pocket_ready", power: 1 }],
      },
    ],
  },
] as const;

export function resolveBodyPersonaResult({
  answers,
}: {
  answers: BodyPersonaAnswers;
}): BodyPersonaResult {
  const personaScores: Record<BodyPersonaCode, number> = {
    soft_glow: 0,
    starlit_guard: 0,
    tidal_sync: 0,
    comet_spark: 0,
    ring_control: 0,
    twin_orbit: 0,
  };

  const hiddenRouteScore: Record<HiddenRouteCode, number> = {
    zero_profile: 0,
    daily_object: 0,
    beauty_disguise: 0,
    pocket_ready: 0,
  };

  let hiddenPower = 0;

  for (const question of BODY_PERSONA_QUESTIONS) {
    const selected = question.options.find(
      (option) => option.value === answers[question.id],
    );
    if (!selected) continue;

    for (const code of BODY_PERSONA_CODES) {
      const score = selected.weights[code];
      if (score) {
        personaScores[code] += score;
      }
    }

    for (const hiddenSignal of selected.hidden ?? []) {
      hiddenRouteScore[hiddenSignal.route] += hiddenSignal.power;
      hiddenPower += hiddenSignal.power;
    }
  }

  const rankedPersonas = Object.entries(personaScores).sort(
    (a, b) => b[1] - a[1],
  );
  const primaryPersonaCode =
    (rankedPersonas[0]?.[0] as BodyPersonaCode | undefined) ?? "soft_glow";
  const secondaryPersonaCode =
    (rankedPersonas[1]?.[0] as BodyPersonaCode | undefined) ?? null;
  const hiddenRouteCode: HiddenRouteCode =
    hiddenPower === 0
      ? "zero_profile"
      : ((Object.entries(hiddenRouteScore).sort((a, b) => b[1] - a[1])[0]?.[0] as
          | HiddenRouteCode
          | undefined) ?? "zero_profile");
  const hiddenPowerGrade =
    hiddenPower >= 5 ? "S" : hiddenPower >= 3 ? "A" : "B";
  const title =
    PERSONA_TITLES[primaryPersonaCode] ??
    PERSONA_TITLES.soft_glow;

  return {
    primaryPersonaCode,
    secondaryPersonaCode,
    hiddenRouteCode,
    hiddenPowerGrade,
    coLivingComfortGrade:
      hiddenPower >= 5 ? "high" : hiddenPower >= 3 ? "medium" : "low",
    freeSummary: {
      title,
      ...PERSONA_FREE_SUMMARIES[primaryPersonaCode],
    },
  } satisfies BodyPersonaResult;
}
