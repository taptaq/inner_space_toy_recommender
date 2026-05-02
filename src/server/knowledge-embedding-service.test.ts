import assert from "node:assert/strict";
import test from "node:test";

import {
  createKnowledgeEmbeddingService,
  knowledgeEmbeddingInternals,
} from "./knowledge-embedding-service.ts";

test("knowledge embedding text includes title summary tags and body", () => {
  const text = knowledgeEmbeddingInternals.buildKnowledgeEmbeddingText({
    title: "预算不是越高越对",
    summary: "第一台更该验证方向",
    tags: ["新手", "预算"],
    body: ["先验证路线", "再看预算"],
  });

  assert.match(text, /标题：预算不是越高越对/);
  assert.match(text, /摘要：第一台更该验证方向/);
  assert.match(text, /标签：新手、预算/);
  assert.match(text, /正文：先验证路线/);
});

test("knowledge embedding service skips when no api key is configured", () => {
  const service = createKnowledgeEmbeddingService({ env: {} });

  assert.equal(service, undefined);
});

test("knowledge embedding service calls an OpenAI compatible embedding runner", async () => {
  let capturedRequest: unknown;
  const service = createKnowledgeEmbeddingService({
    env: {
      KNOWLEDGE_EMBEDDING_API_KEY: "test-key",
      KNOWLEDGE_EMBEDDING_BASE_URL: "https://example.com/v1",
      KNOWLEDGE_EMBEDDING_MODEL: "embedding-model",
    },
    embeddingRunner: async (request) => {
      capturedRequest = request;
      return [0.1, 0.2, 0.3];
    },
  });

  const embedding = await service?.embedKnowledgeCard({
    title: "卡片",
    summary: "摘要",
    tags: ["标签"],
    body: ["正文"],
  });

  assert.deepEqual(embedding, [0.1, 0.2, 0.3]);
  assert.deepEqual(capturedRequest, {
    apiKey: "test-key",
    baseURL: "https://example.com/v1",
    model: "embedding-model",
    input: "标题：卡片\n摘要：摘要\n标签：标签\n正文：正文",
  });
});
