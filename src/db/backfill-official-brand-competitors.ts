import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import {
  OFFICIAL_COMPETITOR_REGISTRY,
  ensureCompetitorRecord,
} from "../scraper/shared/competitor-registry.ts";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientDbError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || "");
  return /Connection terminated|ECONNRESET|server closed the connection|terminating connection|Can't reach database|P1001|P1017/i.test(
    message,
  );
};

async function reconnectPrisma() {
  await prisma.$disconnect().catch(() => {});
  await sleep(800);
  await prisma.$connect();
}

async function ensurePrismaConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    if (!isTransientDbError(error)) throw error;
    await reconnectPrisma();
  }
}

async function withDbRetry<T>(label: string, action: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await ensurePrismaConnection();
      return await action();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === 3) break;
      await reconnectPrisma();
      await sleep(1000 * attempt);
    }
  }
  throw lastError;
}

async function backfillOfficialBrandCompetitors() {
  console.log("[backfill-official-brand-competitors] 开始补齐品牌 competitor 关联与官网字段...");

  const summary: Array<Record<string, unknown>> = [];

  for (const config of OFFICIAL_COMPETITOR_REGISTRY) {
    const competitorId = await ensureCompetitorRecord({
      prisma,
      withDbRetry,
      brandName: config.canonicalName,
      overrideConfig: config,
    });

    const names = [config.canonicalName, ...config.matchNames];
    const productsResult = await withDbRetry(`回填 ${config.canonicalName} products.competitor_id`, () =>
      prisma.products.updateMany({
        where: {
          competitor_id: null,
          OR: names.map((name) => ({
            OR: [
              { name: { contains: name, mode: "insensitive" } },
              { link: { contains: config.domain || name, mode: "insensitive" } },
            ],
          })),
        },
        data: {
          competitor_id: competitorId,
        },
      }),
    );

    summary.push({
      brand: config.canonicalName,
      competitor_id: competitorId,
      products_updated: productsResult.count,
      domain: config.domain ?? null,
      country: config.country ?? null,
    });
  }

  console.log(JSON.stringify(summary, null, 2));
}

backfillOfficialBrandCompetitors()
  .catch((error) => {
    console.error("[backfill-official-brand-competitors] 执行失败:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    await pool.end().catch(() => {});
  });
