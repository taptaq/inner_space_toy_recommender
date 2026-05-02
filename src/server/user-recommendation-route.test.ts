import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import type { Request, Response } from "express";

import { createSaveUserRecommendationProfileHandler } from "./user-recommendation-route.ts";

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createTestJwt(payload: Record<string, unknown>, secret: string) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(
    crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest(),
  );

  return `${header}.${body}.${signature}`;
}

function createMockRequest({
  headers = {},
  body = {},
}: {
  headers?: Record<string, string | undefined>;
  body?: unknown;
}) {
  return { headers, body } as Request;
}

function createMockResponse() {
  let statusCode = 200;
  let jsonPayload: unknown;

  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(payload: unknown) {
      jsonPayload = payload;
      return response;
    },
  } as unknown as Response;

  return {
    response,
    readStatusCode() {
      return statusCode;
    },
    readJsonPayload() {
      return jsonPayload;
    },
  };
}

test("save recommendation profile handler requires an authenticated user id", async () => {
  let saveCount = 0;
  const handler = createSaveUserRecommendationProfileHandler({
    encryptionKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    jwtSecret: "test-jwt-secret",
    store: {
      saveEncryptedProfile: async () => {
        saveCount += 1;
        return { id: "profile-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({ body: { answers: { tags: ["静音"] } } }),
    mockResponse.response,
  );

  assert.equal(saveCount, 0);
  assert.equal(mockResponse.readStatusCode(), 401);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "Login is required to save encrypted recommendation profiles",
  });
});

test("save recommendation profile handler encrypts payload before storing", async () => {
  let captured: unknown;
  const handler = createSaveUserRecommendationProfileHandler({
    encryptionKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    jwtSecret: "test-jwt-secret",
    store: {
      saveEncryptedProfile: async (userId, encryptedPayload, metadata) => {
        captured = { userId, encryptedPayload, metadata };
        return { id: "profile-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      headers: {
        authorization: `Bearer ${createTestJwt(
          { sub: "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00" },
          "test-jwt-secret",
        )}`,
      },
      body: { answers: { tags: ["静音"] }, topProductIds: ["toy-1"] },
    }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 201);
  assert.deepEqual(mockResponse.readJsonPayload(), { id: "profile-1" });
  assert.match(JSON.stringify(captured), /6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00/);
  assert.match(JSON.stringify(captured), /toy-1/);
  assert.match(JSON.stringify(captured), /推荐档案/);
  assert.doesNotMatch(JSON.stringify(captured), /静音/);
  assert.match(JSON.stringify(captured), /aes-256-gcm/);
});

test("save recommendation profile handler rejects a forged user id header", async () => {
  let saveCount = 0;
  const handler = createSaveUserRecommendationProfileHandler({
    encryptionKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    jwtSecret: "test-jwt-secret",
    store: {
      saveEncryptedProfile: async () => {
        saveCount += 1;
        return { id: "profile-1" };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({
      headers: { "x-user-id": "6f78f6c4-6f1a-4d28-8f34-51ce2f10aa00" },
      body: { answers: { tags: ["静音"] } },
    }),
    mockResponse.response,
  );

  assert.equal(saveCount, 0);
  assert.equal(mockResponse.readStatusCode(), 401);
});
