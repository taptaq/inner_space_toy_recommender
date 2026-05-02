import dotenv from "dotenv";
import pg from "pg";

import { createKnowledgeEmbeddingService } from "../server/knowledge-embedding-service.ts";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function main() {
  const embeddingService = createKnowledgeEmbeddingService();
  if (!embeddingService) {
    throw new Error(
      "请先配置 KNOWLEDGE_EMBEDDING_API_KEY 或 OPENAI_API_KEY，再生成知识卡片 embedding。",
    );
  }

  const result = await pool.query<{
    id: string;
    title: string;
    summary: string;
    body: unknown;
    tags: unknown;
  }>(`
    SELECT id, title, summary, body, tags
    FROM public.knowledge_nebula_cards
    WHERE embedding IS NULL
    ORDER BY created_at ASC, id ASC
  `);

  console.log(`🪐 待生成 embedding 的知识卡片：${result.rows.length} 张`);

  for (const row of result.rows) {
    const body = Array.isArray(row.body)
      ? row.body.map((paragraph) => String(paragraph)).filter(Boolean)
      : [];
    const tags = Array.isArray(row.tags)
      ? row.tags.map((tag) => String(tag)).filter(Boolean)
      : [];
    const embedding = await embeddingService.embedKnowledgeCard({
      title: row.title,
      summary: row.summary,
      body,
      tags,
    });

    if (!embedding) {
      console.warn(`⚠️ 跳过 ${row.id}：embedding 生成失败`);
      continue;
    }

    await pool.query(
      `
        UPDATE public.knowledge_nebula_cards
        SET embedding = $2::jsonb, updated_at = now()
        WHERE id = $1
      `,
      [row.id, JSON.stringify(embedding)],
    );
    console.log(`✅ 已生成 ${row.id}`);
  }
}

main()
  .catch((error) => {
    console.error("💥 知识卡片 embedding 回填失败:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
