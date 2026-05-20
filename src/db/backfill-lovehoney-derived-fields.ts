import dotenv from 'dotenv';
import pg from 'pg';
import { pathToFileURL } from 'node:url';

dotenv.config();

const { Pool } = pg;

export type LovehoneyDerivedFieldRow = {
  id?: string;
  name: string;
  current_price?: number | string | null;
  current_type_code?: string | null;
  current_subtype_code?: string | null;
  current_max_db?: number | null;
  current_waterproof?: number | null;
  raw_description?: string | null;
  product_raw_description?: string | null;
};

export type LovehoneyDerivedFieldPatch = {
  price?: number | null;
  type_code?: string | null;
  subtype_code?: string | null;
  max_db?: number | null;
  waterproof?: number | null;
};

export type LovehoneyToyUpdatePlan = {
  updateParts: string[];
  values: Array<number | string | null>;
  nextValueIndex: number;
};

const LOVEHONEY_POWERED_SUBTYPE_CODES = new Set([
  'vibrating_masturbator',
  'interactive_masturbator',
  'prostate_vibe',
  'vibrating_cock_ring',
  'bullet_vibe',
  'wand_massager',
  'suction_pure',
  'suction_dual',
  'rabbit_dual',
  'insertable_vibe',
]);

function normalizeWhitespace(value: string): string {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function buildLovehoneySignalText(row: Pick<LovehoneyDerivedFieldRow, 'name' | 'raw_description' | 'product_raw_description'>) {
  return [row.name, row.raw_description, row.product_raw_description]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n');
}

function buildLovehoneyNameSignal(row: Pick<LovehoneyDerivedFieldRow, 'name' | 'raw_description' | 'product_raw_description'>) {
  const titleSignals = [row.name];
  for (const raw of [row.raw_description, row.product_raw_description]) {
    const titleMatches = String(raw || '').matchAll(/(?:商品名|页面标题):\s*([^\n]+)/g);
    for (const match of titleMatches) {
      titleSignals.push(match[1]);
    }
  }

  return titleSignals.filter(Boolean).join('\n');
}

export function extractLovehoneyPrice(text: string | null | undefined): number | null {
  const source = normalizeWhitespace(String(text || ''));
  const freeGiftPriceMatch = source.match(/0(?:\.00)?\s*英镑\s+([0-9]+(?:\.[0-9]+)?)\s*英镑/i);
  if (freeGiftPriceMatch) {
    const freeGiftPrice = Number(freeGiftPriceMatch[1]);
    if (Number.isFinite(freeGiftPrice) && freeGiftPrice >= 1) return freeGiftPrice;
  }

  const patterns = [
    /页面价格\((?:GBP|英镑)\):\s*([0-9]+(?:\.[0-9]+)?)/i,
    /页面价格[:：]\s*([0-9]+(?:\.[0-9]+)?)/i,
    /\b([0-9]+(?:\.[0-9]+)?)\s*英镑\b/i,
    /([0-9]+(?:\.[0-9]+)?)\s*英镑/i,
  ];

  const candidates: number[] = [];
  for (const pattern of patterns) {
    for (const match of source.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))) {
      const numeric = Number(match[1]);
      if (Number.isFinite(numeric) && numeric > 0) candidates.push(numeric);
    }
  }

  if (candidates.length === 0) return null;
  const meaningfulCandidates = candidates.filter((value) => value >= 1);
  if (meaningfulCandidates.length === 0) return null;
  return Math.min(...meaningfulCandidates);
}

function applyLovehoneyNonPoweredSpecs(patch: LovehoneyDerivedFieldPatch) {
  patch.max_db = null;
  patch.waterproof = null;
}

function applyLovehoneyPoweredSpecs(patch: LovehoneyDerivedFieldPatch) {
  patch.max_db = 50;
  patch.waterproof = 7;
}

export function buildLovehoneyDerivedFieldPatch(row: LovehoneyDerivedFieldRow): LovehoneyDerivedFieldPatch {
  const source = buildLovehoneySignalText(row).toLowerCase();
  const nameSource = buildLovehoneyNameSignal(row).toLowerCase();
  const patch: LovehoneyDerivedFieldPatch = {};

  const extractedPrice = extractLovehoneyPrice(`${row.raw_description || ''}\n${row.product_raw_description || ''}`);
  if (row.current_price == null && extractedPrice != null) {
    patch.price = extractedPrice;
  }

  if (/\b(lube|lubricant|fleshlube|toy cleaner|cleaner)\b|润滑|清洁剂/i.test(nameSource)) {
    patch.type_code = 'care_accessory';
    patch.subtype_code = 'lube_care';
    applyLovehoneyNonPoweredSpecs(patch);
    return patch;
  }

  if (/\b(lace|lingerie|briefs|panty|bodysuit|sleepwear)\b|内衣|蕾丝|睡衣/i.test(nameSource)) {
    patch.type_code = 'care_accessory';
    patch.subtype_code = 'lingerie';
    applyLovehoneyNonPoweredSpecs(patch);
    return patch;
  }

  if (/\bdouche\b|灌肠|冲洗器|enema/i.test(nameSource)) {
    patch.type_code = 'care_accessory';
    patch.subtype_code = 'lube_care';
    applyLovehoneyNonPoweredSpecs(patch);
    return patch;
  }

  if (/\b(womanizer|insideout)\b/i.test(nameSource) && /\b(g-?spot|clitoral|stimulator)\b|阴蒂|g点/i.test(nameSource)) {
    patch.type_code = 'dual_stimulation';
    patch.subtype_code = 'suction_dual';
    applyLovehoneyPoweredSpecs(patch);
    return patch;
  }

  if (/\b(rabbit|double penetration strap-on|strapless strap-on)\b|兔|双插入|无绑带/i.test(nameSource)) {
    patch.type_code = 'dual_stimulation';
    patch.subtype_code = 'rabbit_dual';
    applyLovehoneyPoweredSpecs(patch);
    return patch;
  }

  if (/\b(suction|rose glow|rose suction|stimulator)\b|吮吸|吸吮/i.test(nameSource)) {
    patch.type_code = 'suction';
    patch.subtype_code = 'suction_pure';
    applyLovehoneyPoweredSpecs(patch);
    return patch;
  }

  if (/\b(cock ring|stamina ring)\b|阴茎环/i.test(nameSource)) {
    patch.type_code = 'cock_ring';
    patch.subtype_code = /\b(vibrat(?:e|ing|or)?|rechargeable|remote)\b|振动|充电|遥控/i.test(nameSource)
      ? 'vibrating_cock_ring'
      : 'classic_cock_ring';
    if (patch.subtype_code === 'vibrating_cock_ring') {
      applyLovehoneyPoweredSpecs(patch);
    } else {
      applyLovehoneyNonPoweredSpecs(patch);
    }
    return patch;
  }

  if (/\b(dildo|g-?spot|realistic)\b|假阳具|震动棒|仿真/i.test(nameSource)) {
    patch.type_code = 'insertable';
    patch.subtype_code = /\b(vibrat|rechargeable)\b|振动|震动|充电/i.test(nameSource)
      ? 'insertable_vibe'
      : 'gspot_insertable';
    if (patch.subtype_code === 'insertable_vibe') {
      applyLovehoneyPoweredSpecs(patch);
    } else {
      applyLovehoneyNonPoweredSpecs(patch);
    }
    return patch;
  }

  if (/\b(bullet|egg)\b|子弹|跳蛋/i.test(nameSource)) {
    patch.type_code = 'external_vibe';
    patch.subtype_code = 'bullet_vibe';
    applyLovehoneyPoweredSpecs(patch);
    return patch;
  }

  if (/\b(wand|massage wand)\b|魔杖|按摩棒/i.test(nameSource)) {
    patch.type_code = 'external_vibe';
    patch.subtype_code = 'wand_massager';
    applyLovehoneyPoweredSpecs(patch);
    return patch;
  }

  if (/\b(stroker|blow job stroker|male masturbator|pocket pussy|masturbator)\b|\bfleshlight\b.*\btexture\b|自慰套|男性自慰器/i.test(nameSource)) {
    patch.type_code = 'masturbator';
    if (/\b(vibrat|warming|heated|rechargeable|thrusting|rotating)\b|振动|加热|充电|伸缩|旋转/i.test(nameSource)) {
      patch.subtype_code = 'vibrating_masturbator';
      applyLovehoneyPoweredSpecs(patch);
    } else if (/\b(ai|autoblow|vacu?glide|machine|remote control|interactive)\b/i.test(nameSource)) {
      patch.subtype_code = 'interactive_masturbator';
      applyLovehoneyPoweredSpecs(patch);
    } else {
      patch.subtype_code = 'manual_masturbator';
      applyLovehoneyNonPoweredSpecs(patch);
    }
    return patch;
  }

  if (/\b(prostate massager|rotating prostate|prostate toy)\b/i.test(nameSource)) {
    patch.type_code = 'prostate';
    if (/\b(vibrat|remote control|rotat)\b/i.test(nameSource)) {
      patch.subtype_code = 'prostate_vibe';
      applyLovehoneyPoweredSpecs(patch);
    } else {
      patch.subtype_code = 'prostate_plug';
      applyLovehoneyNonPoweredSpecs(patch);
    }
    return patch;
  }

  if (/\bbutt tingler\b|\bbutt plug\b|\banal beads\b|\bbeads\b|肛门塞|肛塞/i.test(nameSource)) {
    patch.type_code = 'prostate';
    if (/\bvibrat|振动/i.test(nameSource)) {
      patch.subtype_code = 'prostate_vibe';
      applyLovehoneyPoweredSpecs(patch);
    } else {
      patch.subtype_code = 'prostate_plug';
      applyLovehoneyNonPoweredSpecs(patch);
    }
    return patch;
  }

  if (row.current_subtype_code && LOVEHONEY_POWERED_SUBTYPE_CODES.has(row.current_subtype_code)) {
    applyLovehoneyPoweredSpecs(patch);
  }

  return patch;
}

export function buildLovehoneyToyUpdatePlan(
  patch: LovehoneyDerivedFieldPatch,
  startingValueIndex = 2,
): LovehoneyToyUpdatePlan {
  const updateParts: string[] = [];
  const values: Array<number | string | null> = [];
  let valueIndex = startingValueIndex;

  if (patch.price !== undefined) {
    updateParts.push(`price = COALESCE(price, $${valueIndex++}::numeric)`);
    values.push(patch.price);
  }

  if (patch.type_code !== undefined) {
    updateParts.push(`type_code = $${valueIndex++}::text`);
    values.push(patch.type_code);
  }

  if (patch.subtype_code !== undefined) {
    updateParts.push(`subtype_code = $${valueIndex++}::text`);
    values.push(patch.subtype_code);
  }

  if (patch.max_db !== undefined) {
    updateParts.push(`max_db = $${valueIndex++}::integer`);
    values.push(patch.max_db);
  }

  if (patch.waterproof !== undefined) {
    updateParts.push(`waterproof = $${valueIndex++}::integer`);
    values.push(patch.waterproof);
  }

  return {
    updateParts,
    values,
    nextValueIndex: valueIndex,
  };
}

export function hasLovehoneyDerivedFieldPatch(patch: LovehoneyDerivedFieldPatch) {
  return Object.values(patch).some((value) => value !== undefined);
}

export function shouldRunLovehoneyDerivedFieldsScript(importMetaUrl: string, argvEntry?: string) {
  if (!argvEntry) return false;
  return importMetaUrl === pathToFileURL(argvEntry).href;
}

async function backfillLovehoneyDerivedFields() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    console.log('[backfill-lovehoney-derived-fields] 开始回填 Lovehoney 专属派生字段 ...');
    await client.query('BEGIN');
    await client.query('SET statement_timeout TO 0');
    await client.query("SET lock_timeout TO '5s'");

    const rows = await client.query<LovehoneyDerivedFieldRow>(
      `
        SELECT
          t.id,
          t.name,
          t.price::text AS current_price,
          t.type_code AS current_type_code,
          t.subtype_code AS current_subtype_code,
          t.max_db AS current_max_db,
          t.waterproof AS current_waterproof,
          t.raw_description,
          p.specs::jsonb ->> 'rawDescription' AS product_raw_description
        FROM public.recommender_toys AS t
        LEFT JOIN public.products AS p
          ON t.original_id = p.id
        WHERE lower(regexp_replace(split_part(coalesce(p.link, ''), '/', 3), '^www\\.', '')) = 'lovehoney.co.uk'
      `,
    );

    let updated = 0;
    const updatedNames: string[] = [];

    for (const row of rows.rows) {
      const patch = buildLovehoneyDerivedFieldPatch(row);
      if (!hasLovehoneyDerivedFieldPatch(patch)) continue;

      const plan = buildLovehoneyToyUpdatePlan(patch);
      const values: Array<number | string | null> = [row.id, ...plan.values];

      if (plan.updateParts.length === 0) continue;

      await client.query(
        `
          UPDATE public.recommender_toys
          SET ${plan.updateParts.join(', ')},
              updated_at = NOW()
          WHERE id = $1::uuid
        `,
        values,
      );

      if (patch.price !== undefined && row.id) {
        await client.query(
          `
            UPDATE public.products
            SET price = COALESCE(price, $2::numeric)
            WHERE id = (
              SELECT original_id
              FROM public.recommender_toys
              WHERE id = $1::uuid
            )
              AND price IS NULL
          `,
          [row.id, patch.price],
        );
      }

      updated += 1;
      updatedNames.push(row.name);
    }

    await client.query('COMMIT');

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
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

if (shouldRunLovehoneyDerivedFieldsScript(import.meta.url, process.argv[1])) {
  backfillLovehoneyDerivedFields().catch((error) => {
    console.error('[backfill-lovehoney-derived-fields] 执行失败:', error);
    process.exitCode = 1;
  });
}
