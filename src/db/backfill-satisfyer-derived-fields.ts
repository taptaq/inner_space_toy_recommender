import dotenv from 'dotenv';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import {
  classifyLibrarySubtypeCode,
  classifyLibraryTypeCode,
} from '../lib/library-product-type-classifier.ts';

dotenv.config();

const { Pool } = pg;

export type SatisfyerDerivedRow = {
  name: string;
  gender?: string | null;
  physical_form?: string | null;
  current_type_code: string | null;
  current_subtype_code: string | null;
  current_max_db: number | null;
  current_waterproof: number | null;
  raw_description: string | null;
};

function electricPatch(typeCode: string, subtypeCode: string) {
  return {
    type_code: typeCode,
    subtype_code: subtypeCode,
    max_db: 50,
    waterproof: 7,
  };
}

function nonElectricPatch(typeCode: string, subtypeCode: string) {
  return {
    type_code: typeCode,
    subtype_code: subtypeCode,
    max_db: null,
    waterproof: null,
  };
}

export function buildSatisfyerDerivedPatch(row: SatisfyerDerivedRow) {
  const source = `${row.name}\n${row.raw_description || ''}`.toLowerCase();
  const nameSource = row.name.toLowerCase();

  if (/egg set|satisfyer egg|masturbator egg|自慰蛋|蛋形自慰器/.test(source)) {
    return nonElectricPatch('masturbator', 'manual_masturbator');
  }

  if (/g-spot flex|g-spot wave|g点弯曲|g点波浪/.test(source)) {
    return electricPatch('insertable', 'insertable_vibe');
  }

  if (/tongue genius|tongue expert|tri ball|love birds/.test(source)) {
    return electricPatch('dual_stimulation', 'multi_head_dual');
  }

  if (/plug|booty|肛门塞|肛塞|肛门振动器|肛门/.test(source)) {
    return electricPatch('insertable', 'insertable_vibe');
  }

  if (/men vibration|男性振动自慰器|刺激阴茎|自慰器/.test(source) && /app|应用/.test(source)) {
    return electricPatch('masturbator', 'interactive_masturbator');
  }

  if (/treasure bag|收纳袋|storage bag/.test(source)) {
    return nonElectricPatch('care_accessory', 'lube_care');
  }

  if (/月经杯|menstrual cup|feel secure|feel confident|feel good/.test(source)) {
    return nonElectricPatch('care_accessory', 'lube_care');
  }

  if (/lubricant|lube|润滑液|润滑剂|gentle classic/.test(nameSource)) {
    return nonElectricPatch('care_accessory', 'lube_care');
  }

  if (/dazzling crystal|double crystal|sparkling crystal|glass|玻璃|高硼硅/.test(source)) {
    return nonElectricPatch('insertable', 'gspot_insertable');
  }

  const classifierInput = {
    gender: row.gender,
    physicalForm: row.physical_form,
    name: row.name,
    rawDescription: row.raw_description,
  };
  const classifiedTypeCode = classifyLibraryTypeCode(classifierInput);
  const classifiedSubtypeCode = classifyLibrarySubtypeCode({
    ...classifierInput,
    typeCode: classifiedTypeCode,
  });

  if (classifiedTypeCode !== 'unknown' && classifiedSubtypeCode) {
    if (classifiedTypeCode === 'care_accessory') {
      return nonElectricPatch(classifiedTypeCode, classifiedSubtypeCode);
    }

    return electricPatch(classifiedTypeCode, classifiedSubtypeCode);
  }

  return {
    type_code: row.current_type_code,
    subtype_code: row.current_subtype_code,
    max_db: row.current_max_db,
    waterproof: row.current_waterproof,
  };
}

async function backfillSatisfyerDerivedFields() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    console.log('[backfill-satisfyer-derived-fields] 开始回填 Satisfyer 剩余 subtype / waterproof ...');
    await client.query('BEGIN');

    const result = await client.query<{
      id: string;
      name: string;
      gender: string | null;
      physical_form: string | null;
      current_type_code: string | null;
      current_subtype_code: string | null;
      current_max_db: number | null;
      current_waterproof: number | null;
      raw_description: string | null;
    }>(
      `
        SELECT
          id,
          name,
          gender,
          physical_form,
          type_code AS current_type_code,
          subtype_code AS current_subtype_code,
          max_db AS current_max_db,
          waterproof AS current_waterproof,
          raw_description
        FROM public.recommender_toys
        WHERE lower(coalesce(brand, '')) = 'satisfyer'
      `,
    );

    let updated = 0;
    for (const row of result.rows) {
      const patch = buildSatisfyerDerivedPatch(row);
      if (
        patch.type_code === row.current_type_code &&
        patch.subtype_code === row.current_subtype_code &&
        patch.max_db === row.current_max_db &&
        patch.waterproof === row.current_waterproof
      ) {
        continue;
      }

      await client.query(
        `
          UPDATE public.recommender_toys
          SET type_code = $2,
              subtype_code = $3,
              max_db = $4,
              waterproof = $5,
              updated_at = NOW()
          WHERE id = $1::uuid
        `,
        [row.id, patch.type_code, patch.subtype_code, patch.max_db, patch.waterproof],
      );
      updated += 1;
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({ scanned: result.rowCount ?? 0, updated }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  backfillSatisfyerDerivedFields().catch((error) => {
    console.error('[backfill-satisfyer-derived-fields] 执行失败:', error);
    process.exitCode = 1;
  });
}
