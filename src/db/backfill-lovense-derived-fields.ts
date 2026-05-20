import dotenv from 'dotenv';
import pg from 'pg';
import { fileURLToPath } from 'node:url';

dotenv.config();

const { Pool } = pg;

export type LovenseDerivedRow = {
  name: string;
  current_type_code: string | null;
  current_subtype_code: string | null;
  current_max_db: number | null;
  current_waterproof: number | null;
  raw_description: string | null;
};

function electricLovensePatch(typeCode: string, subtypeCode: string) {
  return {
    type_code: typeCode,
    subtype_code: subtypeCode,
    max_db: 50,
    waterproof: 7,
  };
}

function lovenseAccessoryPatch() {
  return {
    type_code: 'unknown',
    subtype_code: null,
    max_db: null,
    waterproof: null,
  };
}

export function buildLovenseDerivedPatch(row: LovenseDerivedRow) {
  const rawDescription = row.raw_description || '';
  const localDescription = rawDescription.split(/\[英文正文摘录\]|\[英文详情\]/u, 1)[0] || rawDescription;
  const source = `${row.name}\n${localDescription}`.toLowerCase();
  const nameSource = row.name.toLowerCase();
  const leadSource = source.slice(0, 900);
  const trustedSource = `${nameSource}\n${leadSource}`;

  if (/adapter|适配器|webcam|网络摄像头/.test(trustedSource)) {
    return lovenseAccessoryPatch();
  }

  if (/lubricant|润滑剂|润滑液|water[-\s]*based|jelly|lotion/.test(nameSource)) {
    return {
      type_code: 'care_accessory',
      subtype_code: 'lube_care',
      max_db: null,
      waterproof: null,
    };
  }

  if (/harness|attachment|lover set|discount sale|sex toys for beginners|配件|束缚带|套装/.test(nameSource)) {
    return lovenseAccessoryPatch();
  }

  if (/nora.*gemini|gemini.*nora|乳头夹/.test(trustedSource)) {
    return electricLovensePatch('dual_stimulation', 'multi_head_dual');
  }

  if (/gush 2.*diamo|固持2.*迪亚莫|古什2.*迪亚莫|阴茎刺激器.*震动环|伴侣用男性性玩具/.test(trustedSource)) {
    return electricLovensePatch('couples', 'external_couples');
  }

  if (/gush 2.*edge 2|喷射2.*边缘2|古什2.*艾吉2|max 2.*edge 2|麦克斯2.*艾吉2|最大2.*边缘2|阴茎与前列腺玩具组合|攻用.*受用/.test(trustedSource)) {
    return electricLovensePatch('couples', 'insertable_couples');
  }

  if (/nora.*max 2|诺拉.*马克斯2/.test(trustedSource)) {
    return electricLovensePatch('couples', 'external_couples');
  }

  if (/solace pro.*edge 2|索拉斯专业版.*边缘2/.test(trustedSource)) {
    return electricLovensePatch('couples', 'insertable_couples');
  }

  if (/solace pro.*mission 2|舒适专业版.*使命2/.test(trustedSource)) {
    return electricLovensePatch('couples', 'insertable_couples');
  }

  if (/^nora$|^nora\b|诺拉/.test(nameSource)) {
    return electricLovensePatch('dual_stimulation', 'rabbit_dual');
  }

  if (/^ambi|exomoon|hyphy|安比|外月|海菲/.test(nameSource)) {
    return electricLovensePatch('external_vibe', 'bullet_vibe');
  }

  if (/domi/.test(nameSource) && !/attachment/.test(nameSource)) {
    return electricLovensePatch('external_vibe', 'wand_massager');
  }

  if (/diamo|迪亚莫/.test(nameSource)) {
    return electricLovensePatch('cock_ring', 'vibrating_cock_ring');
  }

  if (/^gush 2$|^gush 2\b|古什2|固持2|喷涌2/.test(nameSource)) {
    return electricLovensePatch('masturbator', 'interactive_masturbator');
  }

  if (/^max 2$|^max 2\b|麦克斯2|最大2/.test(nameSource)) {
    return electricLovensePatch('masturbator', 'interactive_masturbator');
  }

  if (/calor|kraken|solace|blowjob machine|自慰器|口交机|男性自慰/.test(nameSource)) {
    return electricLovensePatch('masturbator', 'interactive_masturbator');
  }

  if (/tenera|oscii?|奥西|特内拉|suction|吸吮|吮吸/.test(nameSource)) {
    return electricLovensePatch('suction', 'suction_pure');
  }

  if (/velvo|rabbit|兔形|兔子|双重刺激/.test(nameSource)) {
    return electricLovensePatch('dual_stimulation', 'rabbit_dual');
  }

  if (/sex machine|性爱机|抽插性爱机|automatic thrusting|自动抽插/.test(trustedSource)) {
    return electricLovensePatch('insertable', 'insertable_vibe');
  }

  if (/spinel|尖晶石|vulse|mission 2|gravity|app controlled,?automatic thrusting|假阳具机|假阳具|抽插.*震动/.test(trustedSource)) {
    return electricLovensePatch('insertable', 'insertable_vibe');
  }

  if (/edge 2|前列腺/.test(trustedSource)) {
    return electricLovensePatch('prostate', 'prostate_vibe');
  }

  if (/hush|lush anal|ridge|butt plug|肛门塞|肛塞|肛门振动器|肛门珠/.test(trustedSource)) {
    return electricLovensePatch('insertable', 'insertable_vibe');
  }

  if (/lush mini.*ferri|lush 4.*ferri|lush 4.*hush|lush mini.*gush|lush 4.*gush/.test(trustedSource)) {
    return electricLovensePatch('wearable_remote', 'dual_wearable_remote');
  }

  if (/lush|ferri|flexer|dolce|lapis/.test(trustedSource)) {
    return electricLovensePatch('insertable', 'insertable_vibe');
  }

  if (/ambi|exomoon|hyphy|domi|wand|子弹|魔杖|口红/.test(trustedSource)) {
    return electricLovensePatch('external_vibe', /wand|domi|魔杖/.test(trustedSource) ? 'wand_massager' : 'bullet_vibe');
  }

  if (/gush 2|阴茎按摩器|penis massager/.test(trustedSource)) {
    return electricLovensePatch('masturbator', 'interactive_masturbator');
  }

  if (/max 2|calor|kraken|solace|blowjob machine|自慰器|口交机|男性自慰/.test(trustedSource)) {
    return electricLovensePatch('masturbator', 'interactive_masturbator');
  }

  if (/diamo|cock ring|阴茎环|阳具环/.test(trustedSource)) {
    return electricLovensePatch('cock_ring', 'vibrating_cock_ring');
  }

  if (/tenera|oscii?|suction|吸吮|吮吸/.test(trustedSource)) {
    return electricLovensePatch('suction', 'suction_pure');
  }

  if (/velvo|osci 3|rabbit|兔形|兔子|双重刺激|g点.*阴蒂|阴蒂.*g点/.test(trustedSource)) {
    return electricLovensePatch('dual_stimulation', 'rabbit_dual');
  }

  if (/gemini|乳头夹|nipple/.test(trustedSource)) {
    return electricLovensePatch('dual_stimulation', 'multi_head_dual');
  }

  if (/nora|兔形振动器|兔形/.test(trustedSource)) {
    return electricLovensePatch('dual_stimulation', 'rabbit_dual');
  }

  if (/g点振动棒|g点振动器/.test(trustedSource)) {
    return electricLovensePatch('insertable', 'insertable_vibe');
  }

  return {
    type_code: row.current_type_code,
    subtype_code: row.current_subtype_code,
    max_db: row.current_max_db,
    waterproof: row.current_waterproof,
  };
}

async function backfillLovenseDerivedFields() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  const client = await pool.connect();

  try {
    console.log('[backfill-lovense-derived-fields] 开始回填 Lovense 剩余 subtype ...');
    await client.query('BEGIN');

    const result = await client.query<{
      id: string;
      name: string;
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
          type_code AS current_type_code,
          subtype_code AS current_subtype_code,
          max_db AS current_max_db,
          waterproof AS current_waterproof,
          raw_description
        FROM public.recommender_toys
        WHERE lower(coalesce(brand, '')) = 'lovense'
      `,
    );

    let updated = 0;
    for (const row of result.rows) {
      const patch = buildLovenseDerivedPatch(row);
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
  backfillLovenseDerivedFields().catch((error) => {
    console.error('[backfill-lovense-derived-fields] 执行失败:', error);
    process.exitCode = 1;
  });
}
