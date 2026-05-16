import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleaner from './cleaner.ts';

test('resolveRmbPrice converts USD prices to rounded RMB', () => {
  assert.equal(cleaner.resolveRmbPrice(95, 7.2), 684);
  assert.equal(cleaner.resolveRmbPrice(20, 7.2), 144);
  assert.equal(cleaner.resolveRmbPrice(null, 7.2), null);
});

test('buildNormalizedSpecs classifies fantasy toy signals', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'ANUBIS',
      subtitle: 'Fantasy dual-density dildo',
      priceUsd: 95,
      rawDescription: 'Body-safe silicone fantasy dildo with internal firmness and insertable shape.',
      genderHint: 'unisex',
    },
    { rate: 7.2, source: 'test-fixture', date: '2026-05-15' },
  );

  assert.equal(specs.price_rmb, 684);
  assert.equal(specs.type_code, 'dildo');
  assert.ok(Array.isArray(specs.function_tags));
});

test('buildNormalizedSpecs classifies accessory and apparel signals', () => {
  const accessory = cleaner.buildNormalizedSpecs(
    {
      name: 'Alien Egg Mold',
      subtitle: 'Casting accessory',
      priceUsd: 20,
      rawDescription: 'Silicone casting mold accessory for fantasy eggs.',
      genderHint: 'unisex',
    },
    { rate: 7.2, source: 'test-fixture', date: '2026-05-15' },
  );

  const apparel = cleaner.buildNormalizedSpecs(
    {
      name: 'Black Blood Harness',
      subtitle: 'Adjustable fantasy harness wear',
      priceUsd: 65,
      rawDescription: 'Harness apparel with adjustable straps for fantasy wear.',
      genderHint: 'unisex',
    },
    { rate: 7.2, source: 'test-fixture', date: '2026-05-15' },
  );

  assert.equal(accessory.type_code, 'care_accessory');
  assert.ok(accessory.function_tags.includes('配件') || accessory.function_tags.includes('便携'));
  assert.equal(apparel.type_code, 'care_accessory');
  assert.equal(apparel.subtype_code, 'lingerie');
});

test('buildNormalizedSpecs preserves toy signals after translated and normalized text formatting', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'ANUBIS',
      subtitle: '奇幻双密度假阳具',
      priceUsd: 95,
      rawDescription: '产品描述\n硅胶奇幻假阳具，适合入体探索，具备内部支撑感。\n材质\nBody-safe silicone',
      genderHint: 'unisex',
    },
    { rate: 7.2, source: 'test-fixture', date: '2026-05-15' },
  );

  assert.equal(specs.type_code, 'dildo');
  assert.ok(specs.function_tags.includes('入体探索'));
});

test('buildNormalizedSpecs does not misclassify wearable toys as apparel', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Succubus Remote',
      subtitle: 'Wearable remote vibrator',
      priceUsd: 79,
      rawDescription: 'Wearable remote vibrator for couples with insertable tip and body-safe silicone.',
      genderHint: 'unisex',
    },
    { rate: 7.2, source: 'test-fixture', date: '2026-05-15' },
  );

  assert.notEqual(specs.type_code, 'care_accessory');
  assert.notEqual(specs.subtype_code, 'lingerie');
});

test('buildNormalizedSpecs does not misclassify mixed apparel words when toy signals are present', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Lace Remote',
      subtitle: 'Lace remote vibrator',
      priceUsd: 89,
      rawDescription: 'Lace remote vibrator with wearable clip, insertable tip, and silicone body.',
      genderHint: 'unisex',
    },
    { rate: 7.2, source: 'test-fixture', date: '2026-05-15' },
  );

  assert.notEqual(specs.type_code, 'care_accessory');
  assert.notEqual(specs.subtype_code, 'lingerie');
});

test('formatMaster4FancyRawDescription keeps persistence text structured for downstream toy classification', () => {
  const persisted = cleaner.formatMaster4FancyRawDescription(
    'Features:  body-safe silicone  Details: wearable remote vibrator  Specifications: insertable tip',
  );

  assert.equal(
    persisted,
    'Features: body-safe silicone\nDetails: wearable remote vibrator\nSpecifications: insertable tip',
  );

  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Succubus Remote',
      subtitle: 'Remote vibrator',
      priceUsd: 79,
      rawDescription: persisted,
      genderHint: 'unisex',
    },
    { rate: 7.2, source: 'test-fixture', date: '2026-05-15' },
  );

  assert.notEqual(specs.type_code, 'care_accessory');
});
