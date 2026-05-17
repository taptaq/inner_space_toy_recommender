import pg from "pg";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const { Pool } = pg;

export type LbdoMaterialRow = {
  name: string;
  raw_description: string | null;
};

export function inferLbdoMaterialFromRow(row: LbdoMaterialRow) {
  const text = `${row.name || ""}\n${row.raw_description || ""}`.toLowerCase();
  if (/water-based|lubricant|lube|aloe vera|p-?h balanced|toy-friendly/i.test(text)) return "水基配方";
  if (/massage candle|soy wax|shea butter|jojoba oil|macadamia oil|candle/i.test(text)) return "大豆蜡/油脂复合";
  if (/card game|prompt cards|guide|ebook|digital|downloadable/i.test(text)) return "纸质/数字内容";
  if (/silicone/i.test(text)) return "硅胶";
  if (/abs|plastic/i.test(text)) return "ABS/硅胶复合";
  if (/metal|steel/i.test(text)) return "金属";
  return "硅胶";
}

export function shouldRunLbdoMaterialBackfillScript(importMetaUrl: string, argvEntry?: string) {
  if (!argvEntry) return false;
  return path.resolve(argvEntry) === fileURLToPath(importMetaUrl);
}

async function backfillLbdoMaterials() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log("[backfill-lbdo-materials] 开始重算 brand=LBDO 的 recommender_toys.material ...");
    await client.query("BEGIN");

    const result = await client.query<{
      id: string;
      name: string;
      raw_description: string | null;
      current_material: string | null;
    }>(`
      SELECT id, name, raw_description, material AS current_material
      FROM public.recommender_toys
      WHERE lower(brand) = 'lbdo'
      ORDER BY name
    `);

    let updated = 0;
    for (const row of result.rows) {
      const nextMaterial = inferLbdoMaterialFromRow({
        name: row.name,
        raw_description: row.raw_description,
      });

      if ((row.current_material || null) === nextMaterial) continue;

      await client.query(
        `
          UPDATE public.recommender_toys
          SET material = $2,
              updated_at = NOW()
          WHERE id = $1
        `,
        [row.id, nextMaterial],
      );
      updated += 1;
      console.log(`[backfill-lbdo-materials] ${row.name}: ${row.current_material} -> ${nextMaterial}`);
    }

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          scanned: result.rows.length,
          updated,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

if (shouldRunLbdoMaterialBackfillScript(import.meta.url, process.argv[1])) {
  backfillLbdoMaterials().catch((error) => {
    console.error("[backfill-lbdo-materials] 执行失败:", error);
    process.exitCode = 1;
  });
}
