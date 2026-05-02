import OpenAI from "openai";

import type {
  KnowledgeEmbeddingService,
  KnowledgeNebulaCardInput,
} from "./knowledge-nebula-store.ts";

type EmbeddingRunner = (request: {
  apiKey: string;
  baseURL?: string;
  model: string;
  input: string;
}) => Promise<number[]>;

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

function buildKnowledgeEmbeddingText(
  input: Pick<KnowledgeNebulaCardInput, "title" | "summary" | "body" | "tags">,
) {
  return [
    `标题：${input.title}`,
    `摘要：${input.summary}`,
    input.tags?.length ? `标签：${input.tags.join("、")}` : "",
    `正文：${input.body.join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function defaultEmbeddingRunner({
  apiKey,
  baseURL,
  model,
  input,
}: {
  apiKey: string;
  baseURL?: string;
  model: string;
  input: string;
}) {
  const openai = new OpenAI({ apiKey, baseURL });
  const response = await openai.embeddings.create({
    model,
    input,
  });

  return response.data[0]?.embedding ?? [];
}

export function createKnowledgeEmbeddingService({
  env = process.env,
  logger = console,
  embeddingRunner = defaultEmbeddingRunner,
}: {
  env?: NodeJS.ProcessEnv;
  logger?: Pick<Console, "warn">;
  embeddingRunner?: EmbeddingRunner;
} = {}): KnowledgeEmbeddingService | undefined {
  const apiKey =
    env.KNOWLEDGE_EMBEDDING_API_KEY ||
    env.OPENAI_API_KEY ||
    env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return undefined;
  }

  const baseURL =
    env.KNOWLEDGE_EMBEDDING_BASE_URL ||
    env.OPENAI_BASE_URL ||
    undefined;
  const model = env.KNOWLEDGE_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;

  return {
    async embedKnowledgeCard(input) {
      try {
        const embedding = await embeddingRunner({
          apiKey,
          baseURL,
          model,
          input: buildKnowledgeEmbeddingText(input),
        });

        return embedding.length > 0 ? embedding : null;
      } catch (error) {
        logger.warn?.("⚠️ [Server/Knowledge] 知识卡片 embedding 生成失败，使用规则兜底:", error);
        return null;
      }
    },
  };
}

export const knowledgeEmbeddingInternals = {
  buildKnowledgeEmbeddingText,
};
