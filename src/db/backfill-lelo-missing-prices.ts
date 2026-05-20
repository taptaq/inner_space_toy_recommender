import dotenv from 'dotenv';
import pg from 'pg';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

dotenv.config();

const { Pool } = pg;
const FALLBACK_USD_TO_CNY_RATE = 7.2;

export function extractUsdPriceFromLeloHtml(html: string) {
  const schemaMatch = html.match(
    /<script[^>]+id="schema_product"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (schemaMatch?.[1]) {
    try {
      const parsed = JSON.parse(schemaMatch[1]) as Record<string, unknown>;
      const offers =
        parsed.offers && typeof parsed.offers === 'object'
          ? (parsed.offers as Record<string, unknown>)
          : null;
      if (String(offers?.priceCurrency || '').trim() === 'USD') {
        const numeric = Number(String(offers?.price || '').trim());
        if (Number.isFinite(numeric) && numeric > 0) return numeric;
      }
    } catch {
      // ignore malformed schema json
    }
  }

  const dataLayerMatch = html.match(
    /"ecommerce"\s*:\s*\{[\s\S]*?"currency"\s*:\s*"USD"[\s\S]*?"items"\s*:\s*\[\s*\{[\s\S]*?"price"\s*:\s*([0-9.]+)/i,
  );
  if (dataLayerMatch?.[1]) {
    const numeric = Number(dataLayerMatch[1]);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }

  return null;
}

export function resolveRmbPrice(usd: number | null, rate = FALLBACK_USD_TO_CNY_RATE) {
  if (!Number.isFinite(Number(usd)) || Number(usd) <= 0) return null;
  return Math.round(Number(usd) * rate);
}

export function shouldRunLeloMissingPricesScript(importMetaUrl: string, argvEntry?: string) {
  if (!argvEntry) return false;
  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function backfillLeloMissingPrices() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: 'zh-TW',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  try {
    console.log('[backfill-lelo-missing-prices] 开始补抓 LELO 缺失价格 ...');

    const rows = await client.query<{
      id: string;
      original_id: string | null;
      name: string;
      link: string | null;
    }>(
      `
        SELECT
          t.id,
          t.original_id,
          t.name,
          p.link
        FROM public.recommender_toys AS t
        LEFT JOIN public.products AS p ON t.original_id = p.id
        WHERE lower(coalesce(t.brand, '')) = 'lelo'
          AND t.price IS NULL
          AND p.link IS NOT NULL
        ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC NULLS LAST
      `,
    );

    let updated = 0;
    const updatedNames: string[] = [];

    for (const row of rows.rows) {
      await page.goto(String(row.link), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2500);
      const html = await page.content();
      const usdPrice = extractUsdPriceFromLeloHtml(html);
      const rmbPrice = resolveRmbPrice(usdPrice);
      if (rmbPrice == null) continue;

      await client.query('BEGIN');
      try {
        await client.query(
          `
            UPDATE public.recommender_toys
            SET price = $2,
                updated_at = NOW()
            WHERE id = $1
          `,
          [row.id, rmbPrice],
        );

        if (row.original_id) {
          await client.query(
            `
              UPDATE public.products
              SET price = COALESCE(price, $2),
                  specs = jsonb_set(
                    jsonb_set(
                      COALESCE(specs::jsonb, '{}'::jsonb),
                      '{price_usd}',
                      to_jsonb($3::numeric),
                      true
                    ),
                    '{price_rmb}',
                    to_jsonb($2::numeric),
                    true
                  )
              WHERE id = $1
            `,
            [row.original_id, rmbPrice, usdPrice],
          );
        }

        await client.query('COMMIT');
        updated += 1;
        updatedNames.push(row.name);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      }
    }

    console.log(
      JSON.stringify(
        {
          scanned: rows.rowCount ?? 0,
          updated,
          updated_names: updatedNames,
        },
        null,
        2,
      ),
    );
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    client.release();
    await pool.end().catch(() => {});
  }
}

if (shouldRunLeloMissingPricesScript(import.meta.url, process.argv[1])) {
  backfillLeloMissingPrices().catch((error) => {
    console.error('[backfill-lelo-missing-prices] 执行失败:', error);
    process.exitCode = 1;
  });
}
