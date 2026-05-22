import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });

const COMPETITOR_ID = "d7fb4ea3-7935-47ce-a382-8167a7ceec32";
const POPOCAT_PURGE_NAMES = [
  "【入会消费满279元免费赠送】popocat品牌周边丨99积分免费兑换",
  "POPOCAT双旦特别送礼套装｜专属礼袋 + 双旦精美贺卡",
  "POPOCAT小飞象可适配吮吸替换头跳蛋成人情趣自慰玩具充电线配件",
];

async function backfillPopocatCleanup() {
  console.log("[backfill-popocat-cleanup] 开始清理 POPOCAT 污染商品...");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await client.query<{
      toys_deleted: number;
      products_deleted: number;
    }>(
      `
        WITH suspicious_products AS (
          SELECT id
          FROM public.products
          WHERE competitor_id = $1::uuid
            AND name = ANY($2::text[])
        ),
        deleted_toys AS (
          DELETE FROM public.recommender_toys
          WHERE brand = 'POPOCAT'
            AND (
              name = ANY($2::text[])
              OR original_id IN (SELECT id FROM suspicious_products)
            )
          RETURNING 1
        ),
        deleted_products AS (
          DELETE FROM public.products
          WHERE competitor_id = $1::uuid
            AND name = ANY($2::text[])
          RETURNING 1
        )
        SELECT
          (SELECT COUNT(*)::int FROM deleted_toys) AS toys_deleted,
          (SELECT COUNT(*)::int FROM deleted_products) AS products_deleted
      `,
      [COMPETITOR_ID, POPOCAT_PURGE_NAMES],
    );
    await client.query("COMMIT");
    console.log(JSON.stringify(result.rows[0], null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

backfillPopocatCleanup()
  .catch((error) => {
    console.error("[backfill-popocat-cleanup] 执行失败:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
