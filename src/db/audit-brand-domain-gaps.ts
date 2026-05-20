import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

const DEFAULT_TARGET_DOMAINS = [
  'lovehoney.co.uk',
  'svakom.com.cn',
  'us.satisfyer.com',
  'we-vibe.com',
  'lovense.com',
];

async function auditBrandDomainGaps() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    const domains = process.argv.slice(2).filter(Boolean);
    const targetDomains = domains.length > 0 ? domains : DEFAULT_TARGET_DOMAINS;

    const summary = await client.query(
      `
        SELECT
          lower(regexp_replace(split_part(coalesce(p.link, ''), '/', 3), '^www\\.', '')) AS domain,
          count(*)::int AS total,
          count(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(t.raw_description, '')), '') IS NULL)::int AS missing_raw_description,
          count(*) FILTER (WHERE t.price IS NULL)::int AS missing_price,
          count(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(t.type_code, '')), '') IS NULL)::int AS missing_type_code,
          count(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(t.subtype_code, '')), '') IS NULL)::int AS missing_subtype_code,
          count(*) FILTER (WHERE t.max_db IS NULL)::int AS missing_max_db,
          count(*) FILTER (WHERE t.waterproof IS NULL)::int AS missing_waterproof,
          count(*) FILTER (WHERE t.recommendation_features IS NULL)::int AS missing_recommendation_features
        FROM public.recommender_toys AS t
        LEFT JOIN public.products AS p
          ON t.original_id = p.id
        WHERE lower(regexp_replace(split_part(coalesce(p.link, ''), '/', 3), '^www\\.', '')) = ANY($1::text[])
        GROUP BY 1
        ORDER BY 1
      `,
      [targetDomains],
    );

    const missingRawDescriptionSample = await client.query(
      `
        SELECT
          t.name,
          p.link
        FROM public.recommender_toys AS t
        LEFT JOIN public.products AS p
          ON t.original_id = p.id
        WHERE lower(regexp_replace(split_part(coalesce(p.link, ''), '/', 3), '^www\\.', '')) = ANY($1::text[])
          AND NULLIF(BTRIM(COALESCE(t.raw_description, '')), '') IS NULL
        ORDER BY p.link NULLS LAST
        LIMIT 40
      `,
      [targetDomains],
    );

    console.log(
      JSON.stringify(
        {
          summary: summary.rows,
          missingRawDescriptionSample: missingRawDescriptionSample.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

auditBrandDomainGaps().catch((error) => {
  console.error('[audit-brand-domain-gaps] 执行失败:', error);
  process.exitCode = 1;
});
