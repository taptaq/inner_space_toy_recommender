import type { Request, Response } from "express";

import type {
  RecommendationSessionStore,
  SaveRecommendationSessionInput,
} from "./recommendation-session-store.js";

const DEFAULT_FLOW_VERSION = "quiz-flow-v1";
const DEFAULT_ALGORITHM_VERSION = "recommendation-v1";

function normalizeRequiredText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function normalizePageRoute(value: unknown) {
  const pageRoute = typeof value === "string" ? value.trim() : "";
  return pageRoute || "/results";
}

function normalizeJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeJsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function createSaveRecommendationSessionHandler({
  store,
}: {
  store: Pick<RecommendationSessionStore, "saveSession">;
}) {
  return async (req: Request, res: Response) => {
    const requestBody = (req.body ?? {}) as Record<string, unknown>;
    const sessionId = normalizeRequiredText(requestBody.sessionId);

    if (!sessionId) {
      res.status(400).json({ error: "Recommendation session id is required" });
      return;
    }

    const input: SaveRecommendationSessionInput = {
      sessionId,
      answers: normalizeJsonObject(requestBody.answers),
      answerPath: normalizeJsonArray(requestBody.answerPath),
      topProducts: normalizeJsonArray(requestBody.topProducts),
      flowVersion:
        normalizeOptionalText(requestBody.flowVersion) ?? DEFAULT_FLOW_VERSION,
      algorithmVersion:
        normalizeOptionalText(requestBody.algorithmVersion) ??
        DEFAULT_ALGORITHM_VERSION,
      resultProvider: normalizeOptionalText(requestBody.resultProvider),
      resultModelName: normalizeOptionalText(requestBody.resultModelName),
      pageRoute: normalizePageRoute(requestBody.pageRoute),
    };

    try {
      const savedSession = await store.saveSession(input);
      res.status(201).json({ id: savedSession.id });
    } catch (error) {
      console.error("❌ [Server/RecommendationSession] 保存推荐会话失败:", error);
      res.status(500).json({
        error: "Recommendation session save failed",
        details: getErrorMessage(error),
      });
    }
  };
}
