import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSatisfyerDerivedPatch,
} from './backfill-satisfyer-derived-fields.ts';

test('buildSatisfyerDerivedPatch classifies masturbator egg rows as manual_masturbator', () => {
  const patch = buildSatisfyerDerivedPatch({
    name: '3-piece Egg Set - Crunchy',
    current_type_code: 'masturbator',
    current_subtype_code: null,
    current_max_db: 40,
    current_waterproof: null,
    raw_description: '蛋形自慰器，仿肤质感，男性使用。',
  });

  assert.equal(patch.type_code, 'masturbator');
  assert.equal(patch.subtype_code, 'manual_masturbator');
  assert.equal(patch.max_db, null);
  assert.equal(patch.waterproof, null);
});

test('buildSatisfyerDerivedPatch classifies Tongue Genius as multi_head_dual', () => {
  const patch = buildSatisfyerDerivedPatch({
    name: 'Satisfyer Tongue Genius',
    current_type_code: 'dual_stimulation',
    current_subtype_code: null,
    current_max_db: 40,
    current_waterproof: 7,
    raw_description: '灵活舌头与可插入轴，同时刺激阴蒂与阴道。',
  });

  assert.equal(patch.type_code, 'dual_stimulation');
  assert.equal(patch.subtype_code, 'multi_head_dual');
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
});

test('buildSatisfyerDerivedPatch classifies app-connected anal plug rows as insertable_vibe', () => {
  const patch = buildSatisfyerDerivedPatch({
    name: 'Satisfyer Intensity Plug Connect App',
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: 40,
    current_waterproof: 7,
    raw_description: '肛门塞，兼容应用程序，带振动功能。',
  });

  assert.equal(patch.type_code, 'insertable');
  assert.equal(patch.subtype_code, 'insertable_vibe');
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
});

test('buildSatisfyerDerivedPatch classifies male vibration app rows as interactive_masturbator', () => {
  const patch = buildSatisfyerDerivedPatch({
    name: 'Satisfyer Men Vibration+ Connect App',
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: 40,
    current_waterproof: 7,
    raw_description: '男性振动自慰器，兼容应用程序，刺激阴茎。',
  });

  assert.equal(patch.type_code, 'masturbator');
  assert.equal(patch.subtype_code, 'interactive_masturbator');
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
});

test('buildSatisfyerDerivedPatch classifies G-Spot Flex 3 as insertable_vibe', () => {
  const patch = buildSatisfyerDerivedPatch({
    name: 'Satisfyer G-Spot Flex 3',
    current_type_code: 'dual_stimulation',
    current_subtype_code: null,
    current_max_db: 40,
    current_waterproof: 7,
    raw_description: 'G点振动器，同时刺激多个热点，阴蒂、阴道。',
  });

  assert.equal(patch.type_code, 'insertable');
  assert.equal(patch.subtype_code, 'insertable_vibe');
  assert.equal(patch.max_db, 50);
});

test('buildSatisfyerDerivedPatch leaves unknown swordsman row unchanged when evidence is still too weak', () => {
  const patch = buildSatisfyerDerivedPatch({
    name: 'Satisfyer Swordsman',
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: 40,
    current_waterproof: null,
    raw_description: '满足者剑士。',
  });

  assert.equal(patch.type_code, 'unknown');
  assert.equal(patch.subtype_code, null);
  assert.equal(patch.max_db, 40);
});

test('buildSatisfyerDerivedPatch classifies treasure bag rows as care_accessory', () => {
  const patch = buildSatisfyerDerivedPatch({
    name: 'Satisfyer Treasure Bag M',
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: 40,
    current_waterproof: null,
    raw_description: '情趣玩具收纳袋，尼龙与聚酯纤维材质。',
  });

  assert.equal(patch.type_code, 'care_accessory');
  assert.equal(patch.subtype_code, 'lube_care');
  assert.equal(patch.max_db, null);
  assert.equal(patch.waterproof, null);
});

test('buildSatisfyerDerivedPatch classifies menstrual cup rows as care_accessory', () => {
  const patch = buildSatisfyerDerivedPatch({
    name: 'Satisfyer Feel secure',
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: 40,
    current_waterproof: null,
    raw_description: '月经杯，医用级硅胶，易于置入。',
  });

  assert.equal(patch.type_code, 'care_accessory');
  assert.equal(patch.subtype_code, 'lube_care');
  assert.equal(patch.max_db, null);
  assert.equal(patch.waterproof, null);
});

test('buildSatisfyerDerivedPatch classifies tri ball and love birds rows as multi_head_dual', () => {
  const triBall = buildSatisfyerDerivedPatch({
    name: 'Satisfyer Tri Ball 2',
    current_type_code: 'dual_stimulation',
    current_subtype_code: null,
    current_max_db: 40,
    current_waterproof: 7,
    raw_description: '刺激阴蒂与阴道口的全能选手。',
  });

  const loveBirds = buildSatisfyerDerivedPatch({
    name: 'Satisfyer Love Birds 1 Connect App',
    current_type_code: 'dual_stimulation',
    current_subtype_code: null,
    current_max_db: 40,
    current_waterproof: 7,
    raw_description: '凯格尔球，阴道训练，带振动。',
  });

  assert.equal(triBall.subtype_code, 'multi_head_dual');
  assert.equal(loveBirds.subtype_code, 'multi_head_dual');
});

test('buildSatisfyerDerivedPatch classifies male power masturbator rows as interactive_masturbator', () => {
  const patch = buildSatisfyerDerivedPatch({
    name: 'Satisfyer Power Connect App',
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: 40,
    current_waterproof: 7,
    raw_description: '男性自慰器，刺激阴茎，兼容应用程序，强烈震动。',
  });

  assert.equal(patch.type_code, 'masturbator');
  assert.equal(patch.subtype_code, 'interactive_masturbator');
  assert.equal(patch.max_db, 50);
});

test('buildSatisfyerDerivedPatch classifies glass crystal rows as static insertable', () => {
  const patch = buildSatisfyerDerivedPatch({
    name: 'Satisfyer Dazzling Crystal 1',
    current_type_code: 'external_vibe',
    current_subtype_code: null,
    current_max_db: 40,
    current_waterproof: null,
    raw_description: '玻璃假阳具，高硼硅玻璃材质，不带振动。',
  });

  assert.equal(patch.type_code, 'insertable');
  assert.equal(patch.subtype_code, 'gspot_insertable');
  assert.equal(patch.max_db, null);
  assert.equal(patch.waterproof, null);
});

test('buildSatisfyerDerivedPatch classifies lubricant rows as care_accessory', () => {
  const patch = buildSatisfyerDerivedPatch({
    name: 'Satisfyer Gentle Classic',
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: 40,
    current_waterproof: null,
    raw_description: '水基润滑液，亲密护理用品。',
  });

  assert.equal(patch.type_code, 'care_accessory');
  assert.equal(patch.subtype_code, 'lube_care');
  assert.equal(patch.max_db, null);
  assert.equal(patch.waterproof, null);
});

test('buildSatisfyerDerivedPatch does not misclassify device rows as care_accessory from noisy care navigation', () => {
  const patch = buildSatisfyerDerivedPatch({
    name: 'Mission Control',
    current_type_code: 'care_accessory',
    current_subtype_code: 'lube_care',
    current_max_db: null,
    current_waterproof: null,
    raw_description: [
      '[基础信息]',
      '商品名: Satisfyer Mission Control',
      '副标题: 女性 | 阴蒂刺激带压力波：是',
      '页面标题: Satisfyer Mission Control 空气脉冲按摩棒',
      '页面描述: 空气脉冲按摩棒体验宇宙级高潮。亲肤材质。亲密护理导航。',
    ].join('\n'),
  });

  assert.equal(patch.type_code, 'suction');
  assert.equal(patch.subtype_code, 'suction_pure');
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
});
