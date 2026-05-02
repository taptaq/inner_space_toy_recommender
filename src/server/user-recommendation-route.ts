import type { Request, Response } from "express";

import { encryptPrivateJson } from "./user-recommendation-privacy.ts";
import type { UserRecommendationStore } from "./user-recommendation-store.ts";
import { verifyBearerUserId } from "./user-auth.ts";

function normalizeString(value: unknown, fallback: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 10);
}

export function createSaveUserRecommendationProfileHandler({
  encryptionKey,
  jwtSecret,
  store,
}: {
  encryptionKey: string | undefined;
  jwtSecret: string | undefined;
  store: Pick<UserRecommendationStore, "saveEncryptedProfile">;
}) {
  return async (req: Request, res: Response) => {
    const authorizationHeader = Array.isArray(req.headers.authorization)
      ? req.headers.authorization[0]
      : req.headers.authorization;
    const userId = verifyBearerUserId(authorizationHeader, jwtSecret);

    if (!userId) {
      res.status(401).json({
        error: "Login is required to save encrypted recommendation profiles",
      });
      return;
    }

    if (!encryptionKey) {
      res.status(500).json({
        error: "Private data encryption key is not configured",
      });
      return;
    }

    const requestBody = (req.body ?? {}) as Record<string, unknown>;
    const encryptedPayload = encryptPrivateJson(requestBody, encryptionKey);
    const savedProfile = await store.saveEncryptedProfile(
      userId,
      encryptedPayload,
      {
        title: normalizeString(requestBody.title, "推荐档案"),
        summary: normalizeString(requestBody.summary, ""),
        topProductIds: normalizeStringArray(requestBody.topProductIds),
      },
    );

    res.status(201).json({ id: savedProfile.id });
  };
}
