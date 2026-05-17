import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleaner from './cleaner.ts';

const TEST_FX = {
  rate: 7.2,
  source: 'test-fixture',
  date: '2026-05-16',
};

test('resolveRmbPrice converts USD prices to rounded RMB', () => {
  assert.equal(cleaner.resolveRmbPrice(199, 7.2), 1433);
  assert.equal(cleaner.resolveRmbPrice(89, 7.2), 641);
  assert.equal(cleaner.resolveRmbPrice(null, 7.2), null);
});

test('buildNormalizedSpecs fixes gender to male and preserves FX metadata', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'KEON',
      subtitle: 'Interactive male masturbator machine',
      priceUsd: 199,
      originalPriceUsd: 219,
      rawDescription:
        'Interactive male masturbator machine with app sync, body-safe sleeve, quiet operation, and long-distance interactive content.',
      genderHint: 'male',
      categoryHints: ['masturbator', 'interactive', 'app'],
    },
    TEST_FX,
  );

  assert.equal(specs.gender, 'male');
  assert.equal(specs.price_usd, 199);
  assert.equal(specs.price_rmb, 1433);
  assert.equal(specs.original_price_rmb, 1577);
  assert.equal(specs.fx_rate_usd_cny, 7.2);
  assert.equal(specs.fx_rate_source, 'test-fixture');
  assert.equal(specs.fx_rate_date, '2026-05-16');
  assert.equal(specs.type_code, 'masturbator');
  assert.equal(specs.subtype_code, 'interactive_masturbator');
  assert.ok(specs.function_tags.includes('APP控制'));
  assert.ok(specs.function_tags.includes('互动联动'));
});

test('buildNormalizedSpecs keeps manual sleeves in masturbator classification instead of unknown', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Feel Stroker',
      subtitle: 'Textured manual sleeve',
      priceUsd: 49,
      rawDescription: 'Textured male stroker sleeve with body-safe silicone feel and manual stimulation.',
      categoryHints: ['stroker', 'manual'],
    },
    TEST_FX,
  );

  assert.equal(specs.gender, 'male');
  assert.equal(specs.type_code, 'masturbator');
  assert.equal(specs.subtype_code, 'manual_masturbator');
  assert.ok(specs.function_tags.includes('通道刺激'));
});

test('formatKiirooRawDescription separates common section labels', () => {
  const formatted = cleaner.formatKiirooRawDescription(
    'Features interactive sync Details body-safe sleeve Materials silicone',
  );

  assert.equal(
    formatted,
    'Features: interactive sync\nDetails: body-safe sleeve\nMaterials: silicone',
  );
});
