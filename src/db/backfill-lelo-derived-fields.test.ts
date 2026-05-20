import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLeloDerivedFieldPatch,
  buildLeloRecommendationFeaturePayload,
} from './backfill-lelo-derived-fields.ts';

test('buildLeloDerivedFieldPatch fills price and subtype from canonical product signals', () => {
  const patch = buildLeloDerivedFieldPatch({
    id: 'toy-1',
    name: 'SONA™ 2',
    current_price: null,
    current_type_code: 'suction',
    current_subtype_code: null,
    current_max_db: null,
    current_waterproof: null,
    current_recommendation_features: null,
    raw_description: '声波阴蒂刺激器，防水设计，可充电。',
    product_name: 'SONA™ 2',
    product_price: 888,
    product_tags: ['Suction'],
    product_raw_description: '声波阴蒂刺激器，定点刺激。',
    gender: 'female',
    physical_form: 'external',
    appearance: 'normal',
    motor_type: 'gentle',
    brand: 'LELO',
    material: '硅胶',
    image_url: null,
  });

  assert.equal(patch.price, 888);
  assert.equal(patch.subtype_code, 'suction_pure');
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
});

test('buildLeloRecommendationFeaturePayload emits recommendation feature json for LELO toy rows', () => {
  const payload = buildLeloRecommendationFeaturePayload({
    id: 'toy-2',
    name: 'TIANI™ 3',
    current_price: 999,
    current_type_code: 'wearable_remote',
    current_subtype_code: 'dual_wearable_remote',
    current_max_db: 50,
    current_waterproof: 7,
    current_recommendation_features: null,
    raw_description: '远程控制情侣振动器，可穿戴，防水，可充电。',
    product_name: 'TIANI™ 3',
    product_price: 999,
    product_tags: ['Remote'],
    product_raw_description: '远程控制情侣振动器，可穿戴，防水，可充电。',
    gender: 'unisex',
    physical_form: 'composite',
    appearance: 'normal',
    motor_type: 'gentle',
    brand: 'LELO',
    material: '硅胶',
    image_url: null,
  });

  assert.equal(payload.toyId, 'toy-2');
  assert.equal(payload.features.supportsAppOrRemote, true);
  assert.equal(payload.features.isCoupleOriented, true);
  assert.ok(payload.features.evidence.length > 0);
});

test('buildLeloDerivedFieldPatch classifies LELO condom rows as care_accessory/condom', () => {
  const patch = buildLeloDerivedFieldPatch({
    id: 'toy-3',
    name: 'HEX™ Original',
    current_price: 203,
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: null,
    current_waterproof: null,
    current_recommendation_features: null,
    raw_description: '超薄避孕套。材质：天然乳胶。',
    product_name: 'HEX™ Original',
    product_price: 203,
    product_tags: ['Condom'],
    product_raw_description: '超薄避孕套，天然乳胶。',
    gender: 'unisex',
    physical_form: 'external',
    appearance: 'normal',
    motor_type: 'gentle',
    brand: 'LELO',
    material: '乳胶',
    image_url: null,
  });

  assert.equal(patch.type_code, 'care_accessory');
  assert.equal(patch.subtype_code, 'condom');
  assert.equal(patch.max_db, null);
  assert.equal(patch.waterproof, null);
});

test('buildLeloDerivedFieldPatch classifies LELO TOR rows as cock_ring/vibrating_cock_ring', () => {
  const patch = buildLeloDerivedFieldPatch({
    id: 'toy-4',
    name: 'TOR™ 3',
    current_price: 1149,
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: null,
    current_waterproof: null,
    current_recommendation_features: null,
    raw_description: '快乐环。人体安全硅胶。频率 130赫兹。最大噪音级别 60分贝。',
    product_name: 'TOR™ 3',
    product_price: 1149,
    product_tags: ['Cock ring'],
    product_raw_description: '振动阴茎环，适合情侣共玩。',
    gender: 'male',
    physical_form: 'external',
    appearance: 'normal',
    motor_type: 'gentle',
    brand: 'LELO',
    material: '硅胶',
    image_url: null,
  });

  assert.equal(patch.type_code, 'cock_ring');
  assert.equal(patch.subtype_code, 'vibrating_cock_ring');
  assert.equal(patch.max_db, 60);
});

test('buildLeloDerivedFieldPatch classifies LELO sonic oral rows as external_vibe/bullet_vibe', () => {
  const patch = buildLeloDerivedFieldPatch({
    id: 'toy-5',
    name: 'ORA™ 3',
    current_price: 1285,
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: null,
    current_waterproof: null,
    current_recommendation_features: null,
    raw_description: '智能口交模拟器。材料：身体安全硅胶。最大噪音水平：50分贝。',
    product_name: 'ORA™ 3',
    product_price: 1285,
    product_tags: ['Oral stimulator'],
    product_raw_description: '逼真的舔舌动作，适合阴蒂刺激。',
    gender: 'female',
    physical_form: 'external',
    appearance: 'normal',
    motor_type: 'gentle',
    brand: 'LELO',
    material: '硅胶',
    image_url: null,
  });

  assert.equal(patch.type_code, 'external_vibe');
  assert.equal(patch.subtype_code, 'bullet_vibe');
  assert.equal(patch.max_db, 50);
});

test('buildLeloDerivedFieldPatch clears powered defaults for non-powered care accessory rows', () => {
  const patch = buildLeloDerivedFieldPatch({
    id: 'toy-6',
    name: 'HEX™ Respect XL',
    current_price: 197,
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: 50,
    current_waterproof: 7,
    current_recommendation_features: null,
    raw_description: '特大号安全套。材质：天然乳胶。',
    product_name: 'HEX™ Respect XL',
    product_price: 197,
    product_tags: ['Condom'],
    product_raw_description: '避孕套，天然乳胶。',
    gender: 'unisex',
    physical_form: 'external',
    appearance: 'normal',
    motor_type: 'gentle',
    brand: 'LELO',
    material: '乳胶',
    image_url: null,
  });

  assert.equal(patch.type_code, 'care_accessory');
  assert.equal(patch.subtype_code, 'condom');
  assert.equal(patch.max_db, null);
  assert.equal(patch.waterproof, null);
});

test('buildLeloDerivedFieldPatch classifies SONA 3 as suction with explicit spec values', () => {
  const patch = buildLeloDerivedFieldPatch({
    id: 'toy-7',
    name: 'SONA™ 3',
    current_price: 1081,
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: null,
    current_waterproof: null,
    current_recommendation_features: null,
    raw_description: '森声技术，实现精准刺激。最大噪音等级：60分贝。防水。',
    product_name: 'SONA™ 3',
    product_price: 1081,
    product_tags: ['Suction'],
    product_raw_description: '阴蒂刺激器，SenSonic 技术。',
    gender: 'female',
    physical_form: 'external',
    appearance: 'normal',
    motor_type: 'gentle',
    brand: 'LELO',
    material: '硅胶',
    image_url: null,
  });

  assert.equal(patch.type_code, 'suction');
  assert.equal(patch.subtype_code, 'suction_pure');
  assert.equal(patch.max_db, 60);
  assert.equal(patch.waterproof, 7);
});

test('buildLeloDerivedFieldPatch recognizes Chinese condom wording even without english tags', () => {
  const patch = buildLeloDerivedFieldPatch({
    id: 'toy-8',
    name: 'HEX™ Original',
    current_price: 203,
    current_type_code: 'care_accessory',
    current_subtype_code: null,
    current_max_db: null,
    current_waterproof: null,
    current_recommendation_features: null,
    raw_description: '乐洛六边形是超薄避孕套。材质：天然乳胶。',
    product_name: 'HEX™ Original',
    product_price: 203,
    product_tags: [],
    product_raw_description: '超薄避孕套，天然乳胶。',
    gender: 'unisex',
    physical_form: 'external',
    appearance: 'normal',
    motor_type: 'gentle',
    brand: 'LELO',
    material: '乳胶',
    image_url: null,
  });

  assert.equal(patch.type_code, 'care_accessory');
  assert.equal(patch.subtype_code, 'condom');
  assert.equal(patch.max_db, null);
  assert.equal(patch.waterproof, null);
});

test('buildLeloDerivedFieldPatch keeps powered defaults for device rows even when accessories are listed in contents', () => {
  const patch = buildLeloDerivedFieldPatch({
    id: 'toy-8',
    name: 'LELO BOOMERANG™',
    current_price: 1557,
    current_type_code: 'couples',
    current_subtype_code: 'insertable_couples',
    current_max_db: 60,
    current_waterproof: null,
    current_recommendation_features: null,
    raw_description: '双头振动器。内容：USB充电线，缎面收纳袋，润滑剂小袋。最大噪音水平：60分贝。',
    product_name: 'LELO BOOMERANG™',
    product_price: 1557,
    product_tags: ['Couples'],
    product_raw_description: '用于共享愉悦的奢华双头振动器。',
    gender: 'unisex',
    physical_form: 'internal',
    appearance: 'normal',
    motor_type: 'gentle',
    brand: 'LELO',
    material: '硅胶',
    image_url: null,
  });

  assert.equal(patch.max_db, 60);
  assert.equal(patch.waterproof, 7);
});
