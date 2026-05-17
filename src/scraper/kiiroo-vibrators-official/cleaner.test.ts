import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleaner from './cleaner.ts';

const TEST_FX = {
  rate: 7.2,
  source: 'test-fixture',
  date: '2026-05-16',
};

test('resolveRmbPrice converts USD prices to rounded RMB', () => {
  assert.equal(cleaner.resolveRmbPrice(89, 7.2), 641);
  assert.equal(cleaner.resolveRmbPrice(119, 7.2), 857);
  assert.equal(cleaner.resolveRmbPrice(null, 7.2), null);
});

test('buildNormalizedSpecs fixes gender to female and preserves FX metadata', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Pearl 2',
      subtitle: 'App-controlled clitoral vibrator',
      priceUsd: 89,
      originalPriceUsd: 99,
      rawDescription:
        'App-controlled clitoral vibrator with deep rumbly vibrations, rechargeable waterproof silicone body, and partner sync.',
      genderHint: 'female',
      categoryHints: ['vibrator', 'clitoral', 'app'],
    },
    TEST_FX,
  );

  assert.equal(specs.gender, 'female');
  assert.equal(specs.price_usd, 89);
  assert.equal(specs.price_rmb, 641);
  assert.equal(specs.original_price_rmb, 713);
  assert.equal(specs.fx_rate_usd_cny, 7.2);
  assert.equal(specs.fx_rate_source, 'test-fixture');
  assert.equal(specs.fx_rate_date, '2026-05-16');
  assert.equal(specs.type_code, 'external_vibe');
  assert.equal(specs.subtype_code, 'bullet_vibe');
  assert.ok(specs.function_tags.includes('阴蒂刺激'));
  assert.ok(specs.function_tags.includes('APP控制'));
});

test('buildNormalizedSpecs keeps suction stimulators in suction classification instead of unknown', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Cliona',
      subtitle: 'Clitoral suction stimulator',
      priceUsd: 119,
      rawDescription: 'Clitoral suction stimulator with app sync, quiet waterproof design, and body-safe silicone.',
      categoryHints: ['suction', 'clitoral', 'app'],
    },
    TEST_FX,
  );

  assert.equal(specs.gender, 'female');
  assert.equal(specs.type_code, 'suction');
  assert.equal(specs.subtype_code, 'suction_pure');
  assert.ok(specs.function_tags.includes('吮吸刺激'));
});

test('formatKiirooVibratorsRawDescription separates common section labels', () => {
  const formatted = cleaner.formatKiirooVibratorsRawDescription(
    'Features app-controlled vibes Details waterproof silicone Materials silicone',
  );

  assert.equal(
    formatted,
    'Features: app-controlled vibes\nDetails: waterproof silicone\nMaterials: silicone',
  );
});
