import type { AnswerState } from "../data/mock.ts";
import type { RankedProduct } from "./app-shell.ts";
import type { BackupCandidate } from "./recommendation-results.ts";

type RecommendationProfileProduct = {
  id: string;
  name: string;
  score: number;
};

export type RecommendationProfilePayload = {
  createdAt: string;
  title: string;
  summary: string;
  topProductIds: string[];
  answers: AnswerState;
  topProducts: RecommendationProfileProduct[];
  backupProducts: RecommendationProfileProduct[];
  recommendationTips: string[];
  shoppingGuidance: string[];
};

function pickProductSnapshot(
  product: Pick<RankedProduct, "id" | "name" | "score">,
): RecommendationProfileProduct {
  return {
    id: product.id,
    name: product.name,
    score: product.score,
  };
}

export function buildRecommendationProfilePayload({
  answers,
  topProducts,
  backupProducts,
  recommendationTips,
  shoppingGuidance,
}: {
  answers: AnswerState;
  topProducts: RankedProduct[];
  backupProducts: BackupCandidate[];
  recommendationTips: string[];
  shoppingGuidance: string[];
}): RecommendationProfilePayload {
  const topProductSnapshots = topProducts.map(pickProductSnapshot);
  const topProductNames = topProductSnapshots.map((product) => product.name);
  const title =
    topProductNames.length > 0
      ? `${topProductNames[0]}${topProductNames.length > 1 ? ` 等 ${topProductNames.length} 个推荐` : ""}`
      : "推荐档案";
  const answerTags = Array.isArray(answers.tags) ? answers.tags.join("、") : "";
  const summaryParts = [
    answerTags ? `偏好：${answerTags}` : "",
    topProductNames.length > 0 ? `推荐：${topProductNames.slice(0, 3).join("、")}` : "",
  ].filter(Boolean);

  return {
    createdAt: new Date().toISOString(),
    title,
    summary: summaryParts.join("；") || "推荐档案",
    topProductIds: topProductSnapshots.map((product) => product.id),
    answers,
    topProducts: topProductSnapshots,
    backupProducts: backupProducts.map(pickProductSnapshot),
    recommendationTips,
    shoppingGuidance,
  };
}

export async function saveRecommendationProfile({
  authToken,
  payload,
  fetcher = fetch,
}: {
  authToken: string;
  payload: RecommendationProfilePayload;
  fetcher?: typeof fetch;
}) {
  if (!authToken.trim()) {
    throw new Error("需要登录后才能保存推荐档案");
  }

  const response = await fetcher("/api/user/recommendation-profiles", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("保存推荐档案失败，请稍后重试");
  }

  return (await response.json()) as { id: string };
}
