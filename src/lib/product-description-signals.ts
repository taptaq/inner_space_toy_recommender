import type { AnswerState, Product } from "../data/mock.js";

type ScorePresetId = "female" | "male" | "couple";

export type DescriptionPreferenceAdjustment = {
  score: number;
  summary: string[];
};

const RAW_DESCRIPTION_PLACEHOLDERS = new Set([
  "",
  "信息未获取",
  "暂无描述",
  "暂无信息",
]);

function normalizeText(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function hasMeaningfulRawDescription(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return Boolean(normalized && !RAW_DESCRIPTION_PLACEHOLDERS.has(normalized));
}

function buildDescriptionText(product: Product) {
  return [
    product.name,
    product.brand,
    ...(product.tags ?? []),
    hasMeaningfulRawDescription(product.rawDescription)
      ? product.rawDescription
      : "",
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join("\n");
}

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function collectSignals(text: string) {
  return {
    quiet: matchesAny(text, [/静音/i, /低噪/i, /低分贝/i, /quiet/i, /whisper/i]),
    suction: matchesAny(text, [/吮吸/i, /吸吮/i, /舔吸/i, /脉冲气流/i, /air\s*pulse/i, /suction/i]),
    beginner: matchesAny(text, [/新手/i, /入门/i, /初次/i, /慢热/i, /温和/i, /gentle/i]),
    strong: matchesAny(text, [/强刺激/i, /强震/i, /强吸/i, /爆发/i, /powerful/i, /intense/i, /rumbly/i]),
    automatic: matchesAny(text, [/自动/i, /智能节奏/i, /活塞/i, /抽送/i, /thrust/i, /piston/i, /auto/i]),
    tight: matchesAny(text, [/紧致/i, /包裹感强/i, /夹吸/i, /tight/i]),
    remote: matchesAny(text, [/远控/i, /远程/i, /遥控/i, /remote/i, /\bapp\b/i, /蓝牙/i, /bluetooth/i]),
    wearable: matchesAny(text, [/穿戴/i, /可穿戴/i, /贴合/i, /免手持/i, /wearable/i, /hands[-\s]?free/i]),
    handheld: matchesAny(text, [/手持/i, /按摩棒/i, /握持/i, /handheld/i, /wand/i]),
    dualStim: matchesAny(text, [/双刺激/i, /双点/i, /双头/i, /兔耳/i, /rabbit/i, /内外同振/i]),
    easyCleanup: matchesAny(text, [/易清洗/i, /全身水洗/i, /整机水洗/i, /可直接冲洗/i]),
  };
}

export function buildProductDescriptionSignalsSummary(
  product: Pick<Product, "name" | "brand" | "tags" | "rawDescription">,
) {
  if (!hasMeaningfulRawDescription(product.rawDescription)) {
    return "";
  }

  const text = normalizeText(product.rawDescription);
  const signals = collectSignals(text);
  const labels: string[] = [];

  if (signals.quiet) labels.push("低噪静音");
  if (signals.suction) labels.push("吮吸刺激");
  if (signals.beginner) labels.push("新手友好");
  if (signals.automatic) labels.push("自动活塞");
  if (signals.strong) labels.push("强刺激");
  if (signals.tight) labels.push("紧致包裹");
  if (signals.remote) labels.push("远控联动");
  if (signals.wearable) labels.push("可穿戴");
  if (signals.handheld) labels.push("手持互动");
  if (signals.dualStim) labels.push("双刺激");
  if (signals.easyCleanup) labels.push("易清洗");

  return Array.from(new Set(labels)).slice(0, 4).join("、");
}

export function getDescriptionPreferenceAdjustments(
  product: Product,
  answers: AnswerState,
  presetId: ScorePresetId,
): DescriptionPreferenceAdjustment {
  if (!hasMeaningfulRawDescription(product.rawDescription)) {
    return { score: 0, summary: [] };
  }

  const text = buildDescriptionText(product);
  const signals = collectSignals(text);
  let score = 0;
  const summary: string[] = [];

  if (presetId === "female") {
    if (answers.experienceLevel === "sensitive" && signals.beginner) {
      score += 4;
      summary.push("描述里带有新手慢热友好信号");
    }
    if (answers.experienceLevel === "intense" && signals.strong) {
      score += 4;
      summary.push("描述里强调强刺激反馈");
    }
    if (answers.physicalForm === "external" && signals.suction) {
      score += 5;
      summary.push("描述更偏外部吮吸路线");
    }
    if (answers.physicalForm === "composite" && signals.dualStim) {
      score += 4;
      summary.push("描述更贴近内外双刺激层次");
    }
    if (answers.maxDb != null && answers.maxDb < 100 && signals.quiet) {
      score += 3;
      summary.push("描述强调低噪，更适合安静进入状态");
    }
  }

  if (presetId === "male") {
    if (answers.driveMode === "automatic" && signals.automatic) {
      score += 5;
      summary.push("描述更贴近自动驱动路线");
    }
    if (answers.driveMode === "manual" && signals.handheld) {
      score += 3;
      summary.push("描述更偏手动掌控节奏");
    }
    if (answers.channelFeel === "tight" && signals.tight) {
      score += 4;
      summary.push("描述更偏紧致包裹反馈");
    }
    if (answers.sessionGoal === "daily" && (signals.quiet || signals.easyCleanup)) {
      score += 3;
      summary.push("描述更适合日常复用和省心打理");
    }
    if (answers.sessionGoal === "explosive" && signals.strong) {
      score += 4;
      summary.push("描述里强调强刺激爆发");
    }
  }

  if (presetId === "couple") {
    if (answers.interactionMode === "remote" && signals.remote) {
      score += 5;
      summary.push("描述带有远控联动信号");
    }
    if (answers.fitPreference === "wearable" && signals.wearable) {
      score += 5;
      summary.push("描述更偏穿戴贴合共玩");
    }
    if (answers.fitPreference === "handheld" && signals.handheld) {
      score += 4;
      summary.push("描述更适合手持切换互动");
    }
    if (answers.coupleScene === "quiet" && signals.quiet) {
      score += 3;
      summary.push("描述强调低噪氛围感");
    }
    if (answers.sharedIntensity === "gentle" && signals.beginner) {
      score += 3;
      summary.push("描述更适合温和舒适的双方节奏");
    }
    if (answers.sharedIntensity === "strong" && signals.strong) {
      score += 3;
      summary.push("描述更贴近强反馈共玩期待");
    }
  }

  return {
    score,
    summary: Array.from(new Set(summary)).slice(0, 3),
  };
}
