import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

async function auditDomainMissingSubtypes() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    const domains = process.argv.slice(2).filter(Boolean);
    const targetDomains =
      domains.length > 0
        ? domains
        : ['lovense.com', 'we-vibe.com', 'us.satisfyer.com'];

    const result = await client.query(
      `
        SELECT
          lower(regexp_replace(split_part(coalesce(p.link, ''), '/', 3), '^www\\.', '')) AS domain,
          t.name,
          t.type_code,
          t.subtype_code,
          t.max_db,
          t.waterproof,
          left(coalesce(t.raw_description, ''), 300) AS raw_preview
        FROM public.recommender_toys AS t
        LEFT JOIN public.products AS p
          ON t.original_id = p.id
        WHERE lower(regexp_replace(split_part(coalesce(p.link, ''), '/', 3), '^www\\.', '')) = ANY($1::text[])
          AND NULLIF(BTRIM(COALESCE(t.subtype_code, '')), '') IS NULL
        ORDER BY 1, 2
      `,
      [targetDomains],
    );

    console.log(JSON.stringify(result.rows, null, 2));
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

auditDomainMissingSubtypes().catch((error) => {
  console.error('[audit-domain-missing-subtypes] 执行失败:', error);
  process.exitCode = 1;
});
