import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import {
  ensureCompetitorRecord,
  type CompetitorRegistryConfig,
} from "../scraper/shared/competitor-registry.ts";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const POPOCAT_CONFIG: CompetitorRegistryConfig = {
  canonicalName: "POPOCAT",
  matchNames: ["popocat"],
  domain: "popocat.tmall.com",
  country: "China",
  description:
    "POPOCAT 是天猫在售的个人护理与情趣用品品牌，覆盖女性向器具、情侣场景用品以及部分护理耗材。",
  focus: "Female",
  philosophy: [
    "以电商货架式运营为主，强调丰富 SKU、入门友好和女性向使用场景。",
    "产品覆盖器具、润滑与辅助用品，强调从单人到情侣场景的可选范围。",
    "以天猫店铺为核心销售阵地，依赖平台化内容呈现与促销转化。",
  ],
  majorUserGroupProfile:
    "【核心人口】20-40 岁女性用户为主，兼顾情侣共同购买场景。\n【心理特征】偏好在电商平台直接比价和快速下单，重视隐私包装、基础功能和价格接受度。\n【核心痛点】希望在一个店铺内快速买齐入门器具与配套用品，减少跨品牌筛选成本。\n【消费行为】更依赖天猫搜索、活动页与店铺货架推荐，对促销、销量和图文卖点敏感。",
  isDomestic: true,
};

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

async function backfillPopocatCompetitor() {
  console.log("[backfill-popocat-competitor] 开始补齐 POPOCAT competitors 记录...");

  const competitorId = await ensureCompetitorRecord({
    prisma,
    withDbRetry,
    brandName: POPOCAT_CONFIG.canonicalName,
    overrideConfig: POPOCAT_CONFIG,
  });

  const productResult = await withDbRetry("回填 POPOCAT products.competitor_id", () =>
    prisma.products.updateMany({
      where: {
        competitor_id: null,
        OR: [
          { name: { contains: "POPOCAT", mode: "insensitive" } },
          { link: { contains: "popocat.tmall.com", mode: "insensitive" } },
        ],
      },
      data: {
        competitor_id: competitorId,
      },
    }),
  );

  const toyResult = await withDbRetry("统计 POPOCAT recommender_toys", () =>
    prisma.recommender_toys.count({
      where: {
        brand: "POPOCAT",
      },
    }),
  );

  console.log(
    JSON.stringify(
      {
        competitor_id: competitorId,
        products_updated: productResult.count,
        recommender_toys_with_brand: toyResult,
      },
      null,
      2,
    ),
  );
}

backfillPopocatCompetitor()
  .catch((error) => {
    console.error("[backfill-popocat-competitor] 执行失败:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    await pool.end().catch(() => {});
  });
