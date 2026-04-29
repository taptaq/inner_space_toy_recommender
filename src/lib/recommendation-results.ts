import type { AnswerState, Product } from "../data/mock";
import {
  buildBranchBackupReason,
  getBranchShoppingGuidanceLead,
  getBranchShoppingPreferenceHints,
} from "./quiz-branching.ts";

export type RecommendationAnswers = Pick<
  AnswerState,
  | "tags"
  | "maxDb"
  | "appearance"
  | "budget"
  | "gender"
  | "physicalForm"
  | "motorType"
  | "waterproof"
  | "experienceLevel"
  | "driveMode"
  | "channelFeel"
  | "sessionGoal"
  | "interactionMode"
  | "fitPreference"
  | "coupleScene"
  | "sharedIntensity"
>;

export type RecommendationRankedProduct = Product & {
  score: number;
  matchSummary?: string[];
  hardMisses?: number;
  budgetGap?: number;
  noiseGap?: number;
};

export type BackupCandidate = RecommendationRankedProduct & {
  backupLabel: string;
  backupReason: string;
};

type BackupDirection = {
  label: string;
  score: number;
};

function getMinMax(values: number[]) {
  if (values.length === 0) {
    return { min: 0, max: 0 };
  }
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function getDirectionScore(
  value: number | null | undefined,
  min: number,
  max: number,
  preferLower = false,
) {
  if (value == null) return -1;
  if (min === max) return 0.5;
  const raw = preferLower ? max - value : value - min;
  return raw / (max - min);
}

function buildDirection(product: RecommendationRankedProduct, pool: RecommendationRankedProduct[]): BackupDirection | null {
  const priceRange = getMinMax(pool.map((item) => item.price));
  const dbRange = getMinMax(
    pool
      .map((item) => item.maxDb)
      .filter((value): value is number => value != null),
  );
  const waterproofRange = getMinMax(
    pool
      .map((item) => item.waterproof)
      .filter((value): value is number => value != null),
  );

  const options: BackupDirection[] = [];

  const quietnessScore = getDirectionScore(
    product.maxDb,
    dbRange.min,
    dbRange.max,
    true,
  );
  if (quietnessScore >= 0) {
    options.push({
      label: "更静音",
      score: quietnessScore,
    });
  }

  const budgetScore = getDirectionScore(product.price, priceRange.min, priceRange.max, true);
  options.push({
    label: "更省预算",
    score: budgetScore,
  });

  if (product.waterproof != null) {
    const waterproofScore = getDirectionScore(
      product.waterproof,
      waterproofRange.min,
      waterproofRange.max,
    );
    options.push({
      label: "更防水",
      score: waterproofScore,
    });
  }

  options.push({
    label: product.appearance === "high_disguise" ? "更隐蔽" : "更直观",
    score: product.appearance === "high_disguise" ? 0.7 : 0.3,
  });

  options.push({
    label: product.motorType === "strong" ? "更强劲" : "更温和",
    score: product.motorType === "strong" ? 0.7 : 0.55,
  });

  options.sort((a, b) => b.score - a.score);
  return options[0] ?? null;
}

export function buildLocalBackupReason(
  product: RecommendationRankedProduct,
  backupLabel?: string,
  answers?: RecommendationAnswers,
) {
  return buildBranchBackupReason(product, backupLabel, answers);
}

export function buildBackupCandidates(
  ranked: RecommendationRankedProduct[],
  excludedIds: string[],
  count: number,
  answers?: RecommendationAnswers,
): BackupCandidate[] {
  const excluded = new Set(excludedIds);
  const pool = ranked.filter((item) => !excluded.has(item.id));
  const candidates = pool
    .map((product) => {
      const direction = buildDirection(product, pool);
      if (!direction) return null;
      return {
        ...product,
        backupLabel: direction.label,
        backupReason: buildLocalBackupReason(product, direction.label, answers),
      };
    })
    .filter((item): item is BackupCandidate => item != null);

  const selected: BackupCandidate[] = [];
  const usedLabels = new Set<string>();

  for (const candidate of candidates) {
    if (selected.length >= count) break;
    if (usedLabels.has(candidate.backupLabel)) continue;
    selected.push(candidate);
    usedLabels.add(candidate.backupLabel);
  }

  if (selected.length < count) {
    for (const candidate of candidates) {
      if (selected.length >= count) break;
      if (selected.some((item) => item.id === candidate.id)) continue;
      selected.push(candidate);
    }
  }

  return selected.slice(0, count);
}

export function buildLocalShoppingGuidance({
  answers,
  filteredCount,
  backupCandidates,
}: {
  answers: RecommendationAnswers;
  filteredCount: number;
  backupCandidates: Pick<BackupCandidate, "id" | "backupLabel" | "backupReason">[];
}) {
  const lines: string[] = [];

  lines.push(getBranchShoppingGuidanceLead(answers, filteredCount));
  lines.push(...getBranchShoppingPreferenceHints(answers));

  for (const candidate of backupCandidates.slice(0, 3)) {
    lines.push(`${candidate.backupLabel}：${candidate.backupReason}`);
  }

  return lines.slice(0, 5);
}
