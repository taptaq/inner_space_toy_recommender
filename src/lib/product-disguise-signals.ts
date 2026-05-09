import type { AnswerState, Product } from "../data/mock.js";

export type DisguisePreferenceAdjustment = {
  score: number;
  summary: string[];
};

type ProductDisguiseSignal = {
  label: string;
  reason: string;
  explicit: boolean;
  patterns: RegExp[];
};

const DISGUISE_SIGNALS: ProductDisguiseSignal[] = [
  {
    label: "口红造型",
    reason: "口红造型更利于日常收纳",
    explicit: true,
    patterns: [/口红/i, /lipstick/i],
  },
  {
    label: "玫瑰造型",
    reason: "玫瑰造型更像装饰物",
    explicit: true,
    patterns: [/玫瑰/i, /rose/i],
  },
  {
    label: "香水造型",
    reason: "香水造型更贴近日用品",
    explicit: true,
    patterns: [/香水/i, /perfume/i],
  },
  {
    label: "挂件配饰",
    reason: "挂件配饰造型更适合随身收纳",
    explicit: true,
    patterns: [/钥匙扣/i, /挂件/i, /吊坠/i, /项链/i, /首饰/i, /挂饰/i, /key\s*chain/i, /pendant/i, /necklace/i],
  },
  {
    label: "摆件装饰",
    reason: "摆件装饰造型更不易被联想到设备",
    explicit: true,
    patterns: [/摆件/i, /装饰款/i, /装饰物/i, /decor/i, /ornament/i],
  },
  {
    label: "日用品伪装",
    reason: "日用品伪装更贴近高隐蔽偏好",
    explicit: false,
    patterns: [/日用品/i, /生活用品/i, /常规用品/i, /不是常规款式/i, /非传统/i, /非设备外观/i, /伪装/i, /随身/i, /口袋/i, /compact/i],
  },
  {
    label: "低存在感",
    reason: "低存在感更利于降低收纳压力",
    explicit: false,
    patterns: [/低存在感/i, /隐形/i, /隐藏/i, /隐蔽/i, /私密收纳/i, /隐私/i, /收纳/i, /discreet/i],
  },
];

function normalizeText(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildDisguiseText(
  product: Pick<
    Product,
    | "name"
    | "displayName"
    | "safeDisplayName"
    | "canonicalName"
    | "brand"
    | "tags"
    | "rawDescription"
  >,
) {
  return [
    product.name,
    product.displayName,
    product.safeDisplayName,
    product.canonicalName,
    product.brand,
    ...(product.tags ?? []),
    product.rawDescription ?? "",
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join("\n");
}

function collectMatchedDisguiseSignals(
  product: Pick<
    Product,
    | "name"
    | "displayName"
    | "safeDisplayName"
    | "canonicalName"
    | "brand"
    | "tags"
    | "rawDescription"
  >,
) {
  const text = buildDisguiseText(product);
  return DISGUISE_SIGNALS.filter((signal) =>
    signal.patterns.some((pattern) => pattern.test(text)),
  );
}

export function buildProductDisguiseSignalsSummary(
  product: Pick<
    Product,
    | "name"
    | "displayName"
    | "safeDisplayName"
    | "canonicalName"
    | "brand"
    | "tags"
    | "rawDescription"
  >,
) {
  return collectMatchedDisguiseSignals(product)
    .map((signal) => signal.label)
    .slice(0, 4)
    .join("、");
}

export function getDisguisePreferenceAdjustment(
  product: Product,
  answers: Pick<AnswerState, "appearance" | "tags">,
): DisguisePreferenceAdjustment {
  if (answers.appearance !== "high_disguise") {
    return { score: 0, summary: [] };
  }

  const matchedSignals = collectMatchedDisguiseSignals(product);
  if (matchedSignals.length === 0) {
    return { score: 0, summary: [] };
  }

  const hasExplicitShape = matchedSignals.some((signal) => signal.explicit);
  const score = hasExplicitShape ? 7 : 4;

  return {
    score,
    summary: [matchedSignals[0].reason],
  };
}
