import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLovehoneyToyUpdatePlan,
  buildLovehoneyDerivedFieldPatch,
  extractLovehoneyPrice,
  hasLovehoneyDerivedFieldPatch,
} from './backfill-lovehoney-derived-fields.ts';

test('buildLovehoneyDerivedFieldPatch maps fleshlight and stroker rows to manual masturbator', () => {
  for (const name of [
    'Lovehoney Head Master Double Texture Blow Job Stroker',
    'Fleshlight Riley Reid Utopia Texture',
  ]) {
    const patch = buildLovehoneyDerivedFieldPatch({
      name,
      current_type_code: 'masturbator',
      current_subtype_code: null,
      current_max_db: 40,
      current_waterproof: null,
      raw_description: '页面价格(GBP): 7.99',
    });

    assert.equal(patch.type_code, 'masturbator', name);
    assert.equal(patch.subtype_code, 'manual_masturbator', name);
    assert.equal(patch.max_db, null, name);
    assert.equal(patch.waterproof, null, name);
  }
});

test('buildLovehoneyDerivedFieldPatch ignores recommendation noise when classifying stroker rows', () => {
  const patch = buildLovehoneyDerivedFieldPatch({
    name: 'Lovehoney Clear Transparent Textured Stroker',
    current_type_code: 'care_accessory',
    current_subtype_code: 'lube_care',
    current_max_db: 40,
    current_waterproof: 7,
    raw_description: '页面描述: 男性自慰器。顾客还购买：肛门冲洗器。您可能还会喜欢 自动口交自慰器。页面价格(GBP): 0.00\n页面价格(GBP): 22.99',
  });

  assert.equal(patch.type_code, 'masturbator');
  assert.equal(patch.subtype_code, 'manual_masturbator');
  assert.equal(patch.price, 22.99);
  assert.equal(patch.max_db, null);
  assert.equal(patch.waterproof, null);
});

test('buildLovehoneyDerivedFieldPatch treats Fleshlight lubricant as care instead of masturbator', () => {
  const patch = buildLovehoneyDerivedFieldPatch({
    name: 'Fleshlight Fleshlube Water-Based Lubricant 100ml',
    current_type_code: 'masturbator',
    current_subtype_code: 'vibrating_masturbator',
    current_max_db: null,
    current_waterproof: null,
    raw_description: '相关分类 Fleshlights 男性性玩具 页面价格(GBP): 7.99',
  });

  assert.equal(patch.type_code, 'care_accessory');
  assert.equal(patch.subtype_code, 'lube_care');
  assert.equal(patch.max_db, null);
  assert.equal(patch.waterproof, null);
});

test('buildLovehoneyDerivedFieldPatch treats rechargeable thrusting male masturbators as powered', () => {
  const patch = buildLovehoneyDerivedFieldPatch({
    name: 'Blowmotion Rechargeable Thrusting Rotating Male Masturbator',
    current_type_code: 'masturbator',
    current_subtype_code: 'manual_masturbator',
    current_max_db: null,
    current_waterproof: null,
    raw_description: '页面价格(GBP): 139.99',
  });

  assert.equal(patch.type_code, 'masturbator');
  assert.equal(patch.subtype_code, 'vibrating_masturbator');
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
});

test('buildLovehoneyDerivedFieldPatch corrects clearly powered device rows that were misclassified as care', () => {
  const cases = [
    {
      name: 'Mantric Rechargeable Bullet Vibrator',
      type_code: 'external_vibe',
      subtype_code: 'bullet_vibe',
    },
    {
      name: 'Lovehoney Deluxe Rechargeable Mini Massage Wand Vibrator',
      type_code: 'external_vibe',
      subtype_code: 'wand_massager',
    },
    {
      name: 'Womanizer X Lovehoney InsideOut Rechargeable G-Spot and Clitoral Stimulator',
      type_code: 'dual_stimulation',
      subtype_code: 'suction_dual',
    },
    {
      name: 'Lovehoney Twin Silicone Vibrating Cock Ring',
      type_code: 'cock_ring',
      subtype_code: 'vibrating_cock_ring',
    },
    {
      name: 'Lovehoney Double Fun Vibrating Rabbit Double Penetration Strap-On',
      type_code: 'dual_stimulation',
      subtype_code: 'rabbit_dual',
    },
    {
      name: 'njoy Pure Wand Stainless Steel Dildo',
      type_code: 'insertable',
      subtype_code: 'gspot_insertable',
      max_db: null,
      waterproof: null,
    },
  ];

  for (const fixture of cases) {
    const patch = buildLovehoneyDerivedFieldPatch({
      name: fixture.name,
      current_type_code: 'care_accessory',
      current_subtype_code: 'lube_care',
      current_max_db: 40,
      current_waterproof: 7,
      raw_description: '页面价格(GBP): 29.99',
    });

    assert.equal(patch.type_code, fixture.type_code, fixture.name);
    assert.equal(patch.subtype_code, fixture.subtype_code, fixture.name);
    assert.equal(
      patch.max_db,
      Object.hasOwn(fixture, 'max_db') ? fixture.max_db : 50,
      fixture.name,
    );
    assert.equal(
      patch.waterproof,
      Object.hasOwn(fixture, 'waterproof') ? fixture.waterproof : 7,
      fixture.name,
    );
  }
});

test('buildLovehoneyDerivedFieldPatch maps butt plug and prostate rows', () => {
  const patch = buildLovehoneyDerivedFieldPatch({
    name: 'Lovehoney Butt Tingler 10 Function Vibrating Butt Plug 3.5 Inch',
    current_type_code: 'unknown',
    current_subtype_code: null,
    current_max_db: 40,
    current_waterproof: null,
    raw_description: '页面价格(GBP): 18.99',
  });

  assert.equal(patch.type_code, 'prostate');
  assert.equal(patch.subtype_code, 'prostate_vibe');
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
});

test('extractLovehoneyPrice parses numeric page prices from raw description text', () => {
  assert.equal(extractLovehoneyPrice('页面价格(GBP): 22.99'), 22.99);
  assert.equal(extractLovehoneyPrice('页面价格(英镑): 14.99'), 14.99);
  assert.equal(extractLovehoneyPrice('页面价格(GBP): 0.00\n页面价格(GBP): 22.99'), 22.99);
  assert.equal(
    extractLovehoneyPrice('消费满60英镑即可获赠免费礼品 0.00英镑 22.99英镑 您节省：22.99英镑 您可能还会喜欢 7.99英镑'),
    22.99,
  );
});

test('buildLovehoneyToyUpdatePlan overwrites stale type and subtype values when a Lovehoney rule matches', () => {
  const plan = buildLovehoneyToyUpdatePlan(
    {
      type_code: 'masturbator',
      subtype_code: 'manual_masturbator',
      max_db: null,
      waterproof: null,
    },
    2,
  );

  assert.deepEqual(plan.updateParts, [
    'type_code = $2::text',
    'subtype_code = $3::text',
    'max_db = $4::integer',
    'waterproof = $5::integer',
  ]);
  assert.deepEqual(plan.values, ['masturbator', 'manual_masturbator', null, null]);
});

test('buildLovehoneyToyUpdatePlan overwrites stale electric specs with Lovehoney defaults', () => {
  const plan = buildLovehoneyToyUpdatePlan(
    {
      type_code: 'external_vibe',
      subtype_code: 'bullet_vibe',
      max_db: 50,
      waterproof: 7,
    },
    2,
  );

  assert.deepEqual(plan.updateParts, [
    'type_code = $2::text',
    'subtype_code = $3::text',
    'max_db = $4::integer',
    'waterproof = $5::integer',
  ]);
  assert.deepEqual(plan.values, ['external_vibe', 'bullet_vibe', 50, 7]);
});

test('buildLovehoneyDerivedFieldPatch normalizes existing Lovehoney powered subtype specs', () => {
  const patch = buildLovehoneyDerivedFieldPatch({
    name: 'Lovehoney Silencer Whisper Quiet Classic 7 Inch',
    current_type_code: 'external_vibe',
    current_subtype_code: 'bullet_vibe',
    current_max_db: 40,
    current_waterproof: 7,
    raw_description: '页面价格(GBP): 19.99',
  });

  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
});

test('hasLovehoneyDerivedFieldPatch treats spec-only patches as updates', () => {
  assert.equal(hasLovehoneyDerivedFieldPatch({ max_db: 50, waterproof: 7 }), true);
  assert.equal(hasLovehoneyDerivedFieldPatch({}), false);
});
