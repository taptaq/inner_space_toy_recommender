import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

const BRAND_ALIAS_RULES = [
  {
    from: "Nancy",
    to: "Hello Nancy",
  },
  {
    from: "绒谱",
    to: "ROMP",
  },
];

async function backfillBrandAliasNormalization() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log("[backfill-brand-alias-normalization] 开始统一品牌别名 ...");
    await client.query("BEGIN");

    const summary: Array<Record<string, unknown>> = [];

    for (const rule of BRAND_ALIAS_RULES) {
      const recommenderResult = await client.query(
        `
          UPDATE public.recommender_toys
          SET brand = $2,
              updated_at = NOW()
          WHERE LOWER(BTRIM(COALESCE(brand, ''))) = LOWER($1)
        `,
        [rule.from, rule.to],
      );

      const competitorResult = await client.query(
        `
          UPDATE public.competitors
          SET name = $2
          WHERE LOWER(BTRIM(COALESCE(name, ''))) = LOWER($1)
        `,
        [rule.from, rule.to],
      );

      summary.push({
        from: rule.from,
        to: rule.to,
        recommender_toys_updated: recommenderResult.rowCount ?? 0,
        competitors_updated: competitorResult.rowCount ?? 0,
      });
    }

    await client.query("COMMIT");
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

backfillBrandAliasNormalization().catch((error) => {
  console.error("[backfill-brand-alias-normalization] 执行失败:", error);
  process.exitCode = 1;
});
