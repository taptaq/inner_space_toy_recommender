import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLovenseDerivedPatch,
} from './backfill-lovense-derived-fields.ts';

test('buildLovenseDerivedPatch classifies Hush 2 as insertable_vibe', () => {
  const patch = buildLovenseDerivedPatch({
    name: 'Hush 2',
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: 50,
    current_waterproof: 7,
    raw_description: '应用程序远程控制震动肛门塞，四种尺寸可选。',
  });

  assert.equal(patch.type_code, 'insertable');
  assert.equal(patch.subtype_code, 'insertable_vibe');
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
});

test('buildLovenseDerivedPatch classifies Lush 3 as insertable_vibe', () => {
  const patch = buildLovenseDerivedPatch({
    name: 'Lush 3',
    current_type_code: 'dual_stimulation',
    current_subtype_code: null,
    current_max_db: 50,
    current_waterproof: 7,
    raw_description: '经典蓝牙遥控强力G点振动棒，强劲深入的G点振动。',
  });

  assert.equal(patch.type_code, 'insertable');
  assert.equal(patch.subtype_code, 'insertable_vibe');
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
});

test('buildLovenseDerivedPatch classifies Nora as rabbit_dual', () => {
  const patch = buildLovenseDerivedPatch({
    name: 'Nora',
    current_type_code: 'dual_stimulation',
    current_subtype_code: null,
    current_max_db: 50,
    current_waterproof: 7,
    raw_description: '蓝牙遥控长距离兔形振动器，双重刺激。',
  });

  assert.equal(patch.type_code, 'dual_stimulation');
  assert.equal(patch.subtype_code, 'rabbit_dual');
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
});

test('buildLovenseDerivedPatch leaves obvious accessories as unknown/null', () => {
  const patch = buildLovenseDerivedPatch({
    name: 'USB Bluetooth Adapter',
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: null,
    current_waterproof: null,
    raw_description: '将任何玩具连接到视窗电脑的蓝牙适配器。',
  });

  assert.equal(patch.type_code, 'unknown');
  assert.equal(patch.subtype_code, null);
  assert.equal(patch.max_db, null);
  assert.equal(patch.waterproof, null);
});

test('buildLovenseDerivedPatch classifies Lush Anal as insertable_vibe', () => {
  const patch = buildLovenseDerivedPatch({
    name: 'Lush',
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: 50,
    current_waterproof: 7,
    raw_description: '适合初学者的遥控小型肛门振动器，配备 LED 灯尾塞。',
  });

  assert.equal(patch.type_code, 'insertable');
  assert.equal(patch.subtype_code, 'insertable_vibe');
});

test('buildLovenseDerivedPatch classifies Max 2 and Edge 2 gay set as insertable_couples', () => {
  const patch = buildLovenseDerivedPatch({
    name: 'Max 2 and Edge 2Gay s',
    current_type_code: 'prostate',
    current_subtype_code: null,
    current_max_db: 40,
    current_waterproof: 7,
    raw_description: '阴茎与前列腺玩具组合。攻用 Max 2，受用 Edge 2。',
  });

  assert.equal(patch.type_code, 'couples');
  assert.equal(patch.subtype_code, 'insertable_couples');
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
});

test('buildLovenseDerivedPatch classifies localized Max and Edge copy as insertable_couples', () => {
  const patch = buildLovenseDerivedPatch({
    name: 'Max 2 and Edge 2Gay s',
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: null,
    current_waterproof: null,
    raw_description: '麦克斯2与艾吉2同性恋性玩具。阴茎与前列腺玩具。',
  });

  assert.equal(patch.type_code, 'couples');
  assert.equal(patch.subtype_code, 'insertable_couples');
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
});

test('buildLovenseDerivedPatch classifies Gush 2 and Diamo as external couples bundle', () => {
  const patch = buildLovenseDerivedPatch({
    name: 'Gush 2 & Diamo',
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: 50,
    current_waterproof: 7,
    raw_description: '最佳带互动功能的伴侣用男性性玩具。阴茎刺激器与震动环套装。',
  });

  assert.equal(patch.type_code, 'couples');
  assert.equal(patch.subtype_code, 'external_couples');
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
});

test('buildLovenseDerivedPatch classifies sex machines as insertable_vibe', () => {
  const patch = buildLovenseDerivedPatch({
    name: 'Lovense Mini Sex Machine',
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: 40,
    current_waterproof: 7,
    raw_description: '应用程序控制的紧凑型抽插性爱机，强大自动抽插。',
  });

  assert.equal(patch.type_code, 'insertable');
  assert.equal(patch.subtype_code, 'insertable_vibe');
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
});

test('buildLovenseDerivedPatch classifies Nora and Gemini as multi-head dual bundle', () => {
  const patch = buildLovenseDerivedPatch({
    name: 'Nora & Gemini',
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: 50,
    current_waterproof: 7,
    raw_description: '蓝牙遥控兔子振动器与振动乳头夹，全身刺激套装。',
  });

  assert.equal(patch.type_code, 'dual_stimulation');
  assert.equal(patch.subtype_code, 'multi_head_dual');
});

test('buildLovenseDerivedPatch classifies Spinel as insertable_vibe and defaults waterproof to 7', () => {
  const patch = buildLovenseDerivedPatch({
    name: 'Spinel',
    current_type_code: 'dual_stimulation',
    current_subtype_code: null,
    current_max_db: 50,
    current_waterproof: 6,
    raw_description: '应用程序控制、多功能头、抽插、震动及加热假阳具机。',
  });

  assert.equal(patch.type_code, 'insertable');
  assert.equal(patch.subtype_code, 'insertable_vibe');
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
});

test('buildLovenseDerivedPatch keeps webcam as non-toy accessory without electrical toy specs', () => {
  const patch = buildLovenseDerivedPatch({
    name: 'Lovense 4K Webcam 2',
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: 50,
    current_waterproof: 0,
    raw_description: '专业网络摄像头，适用于主播和直播。',
  });

  assert.equal(patch.type_code, 'unknown');
  assert.equal(patch.subtype_code, null);
  assert.equal(patch.max_db, null);
  assert.equal(patch.waterproof, null);
});

test('buildLovenseDerivedPatch classifies single-product Lovense series before noisy recommendations', () => {
  const cases = [
    ['Ambi', 'external_vibe', 'bullet_vibe'],
    ['Domi2', 'external_vibe', 'wand_massager'],
    ['Diamo 环', 'cock_ring', 'vibrating_cock_ring'],
    ['Gush 2', 'masturbator', 'interactive_masturbator'],
    ['Max 2', 'masturbator', 'interactive_masturbator'],
    ['Nora', 'dual_stimulation', 'rabbit_dual'],
    ['Tenera 2', 'suction', 'suction_pure'],
  ] as const;

  for (const [name, typeCode, subtypeCode] of cases) {
    const patch = buildLovenseDerivedPatch({
      name,
      current_type_code: 'dual_stimulation',
      current_subtype_code: 'multi_head_dual',
      current_max_db: 50,
      current_waterproof: 7,
      raw_description: [
        '[基础信息]',
        `商品名: ${name}`,
        '页面描述: 正品详情。',
        '[英文正文摘录]',
        'Nora & Gemini G-Spot & Nipple Vibrator Set recommendation noise.',
      ].join('\n'),
    });

    assert.equal(patch.type_code, typeCode);
    assert.equal(patch.subtype_code, subtypeCode);
    assert.equal(patch.max_db, 50);
    assert.equal(patch.waterproof, 7);
  }
});
