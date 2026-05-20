import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleaner from './cleaner.ts';
import * as helpers from '../nomitang-official/cleaner-helpers.ts';

const getBuildNormalizedSpecs = () => {
  const buildNormalizedSpecs = (cleaner as Record<string, unknown>).buildNormalizedSpecs;
  assert.equal(typeof buildNormalizedSpecs, 'function');

  return buildNormalizedSpecs as (
    item: Record<string, unknown>,
    fx: { rate: number; source: string; date: string | null },
  ) => Record<string, unknown>;
};

const TEST_FX = {
  rate: 7.2,
  source: 'test-fixture',
  date: '2026-05-19',
};

test('prepareUniqueBufferItemsForCleaning keeps one canonical LELO product row', () => {
  const result = helpers.prepareUniqueBufferItemsForCleaning([
    {
      sourceUrl: 'https://www.lelo.com/sona-2-cruise',
      name: 'LELO SONA 2 Cruise',
      rawDescription: 'Name: SONA™ 2 Cruise\nDetails: sonic clitoral massager',
    },
    {
      sourceUrl: 'https://www.lelo.com/zh-hant/sona-2-cruise',
      name: 'SONA 2 Cruise',
      rawDescription: 'Name: SONA™ 2 Cruise\nDescription: cruise control sonic waves',
    },
  ]);

  assert.equal(result.items.length, 1);
  assert.equal(result.skippedDuplicateNames.length, 1);
  assert.equal(result.skippedDuplicateNames[0]?.canonicalName, 'SONA™ 2 Cruise');
});

test('buildNormalizedSpecs classifies LELO sonic suction products', () => {
  const buildNormalizedSpecs = getBuildNormalizedSpecs();

  const specs = buildNormalizedSpecs(
    {
      name: 'SONA™ 2 Cruise',
      priceText: 'USD 149',
      rawDescription:
        'Body-safe silicone sonic clitoral massager with SenSonic technology, waterproof design and Cruise Control.',
      genderHint: 'female',
    },
    TEST_FX,
  );

  assert.equal(specs.material, '硅胶');
  assert.equal(specs.type_code, 'suction');
  assert.equal(specs.subtype_code, 'suction_pure');
});

test('buildNormalizedSpecs classifies LELO insertable G-spot products', () => {
  const buildNormalizedSpecs = getBuildNormalizedSpecs();

  const specs = buildNormalizedSpecs(
    {
      name: 'GIGI™ 2',
      priceText: 'USD 129',
      rawDescription:
        'Body-safe silicone G-spot vibrator with a broad tip for precise internal stimulation. Waterproof and rechargeable.',
      genderHint: 'female',
    },
    TEST_FX,
  );

  assert.equal(specs.material, '硅胶');
  assert.equal(specs.type_code, 'insertable');
  assert.equal(specs.subtype_code, 'gspot_insertable');
});

test('buildNormalizedSpecs classifies LELO dual stimulation products', () => {
  const buildNormalizedSpecs = getBuildNormalizedSpecs();

  const specs = buildNormalizedSpecs(
    {
      name: 'ENIGMA Wave™',
      priceText: 'USD 219',
      rawDescription:
        'Dual stimulation massager combining sonic clitoral stimulation with an insertable G-spot arm in body-safe silicone.',
      genderHint: 'female',
    },
    TEST_FX,
  );

  assert.equal(specs.material, '硅胶');
  assert.equal(specs.type_code, 'dual_stimulation');
  assert.match(String(specs.subtype_code || ''), /rabbit_dual|multi_head_dual|suction_dual/);
});

test('buildNormalizedSpecs prefers explicit waterproof and max_db signals over defaults', () => {
  const buildNormalizedSpecs = getBuildNormalizedSpecs();

  const specs = buildNormalizedSpecs(
    {
      name: 'LELO TEST DEVICE',
      priceText: 'USD 199',
      rawDescription:
        'App-controlled vibrator. Waterproof 5. Noise level 42 dB. Body-safe silicone.',
      genderHint: 'female',
    },
    TEST_FX,
  );

  assert.equal(specs.max_db, 42);
  assert.equal(specs.waterproof, 5);
});

test('buildNormalizedSpecs defaults powered LELO devices to max_db 50 and waterproof 7 when missing', () => {
  const buildNormalizedSpecs = getBuildNormalizedSpecs();

  const specs = buildNormalizedSpecs(
    {
      name: 'LELO TEST DEVICE',
      priceText: 'USD 199',
      rawDescription:
        'Rechargeable vibrator with app control and body-safe silicone.',
      genderHint: 'female',
    },
    TEST_FX,
  );

  assert.equal(specs.max_db, 50);
  assert.equal(specs.waterproof, 7);
});
