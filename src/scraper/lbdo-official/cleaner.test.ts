import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleaner from './cleaner.ts';

const TEST_FX = {
  rate: 7.2,
  source: 'test-fixture',
  date: '2026-05-17',
  currency: 'USD',
};

test('resolveRmbPrice converts USD prices to rounded RMB', () => {
  assert.equal(cleaner.resolveRmbPrice(237.96, 7.2), 1713);
  assert.equal(cleaner.resolveRmbPrice(51, 7.2), 367);
  assert.equal(cleaner.resolveRmbPrice(null, 7.2), null);
});

test('buildNormalizedSpecs converts USD prices and preserves FX metadata', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Pulse Duo',
      subtitle: 'Bundle',
      priceSourceAmount: 237.96,
      originalPriceSourceAmount: 279.95,
      priceCurrency: 'USD',
      rawDescription: 'Couples bundle with app-controlled toy and accessories.',
      genderHint: 'unisex',
      categoryHints: ['Bundle'],
    },
    TEST_FX,
  );

  assert.equal(specs.price_source_currency, 'USD');
  assert.equal(specs.price_source_amount, 237.96);
  assert.equal(specs.price_rmb, 1713);
  assert.equal(specs.original_price_rmb, 2016);
  assert.equal(specs.fx_rate_to_cny, 7.2);
});

test('buildNormalizedSpecs keeps bundle rows from collapsing into unknown when toy signals are strong', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Connection Series',
      subtitle: 'Bundle',
      priceSourceAmount: 156,
      originalPriceSourceAmount: 195,
      priceCurrency: 'USD',
      rawDescription: 'Bundle with vibrator, massage candle, and intimacy prompts for couples.',
      genderHint: 'unisex',
      categoryHints: ['Bundle'],
    },
    TEST_FX,
  );

  assert.notEqual(specs.type_code, 'unknown');
  assert.ok(specs.function_tags.includes('套装'));
});

test('buildNormalizedSpecs classifies water-based lubricant material away from silicone', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Flow Water-Based',
      subtitle: 'Lubricant',
      priceSourceAmount: 30,
      originalPriceSourceAmount: null,
      priceCurrency: 'USD',
      rawDescription: 'Natural water-based lubricant with organic aloe vera, pH balanced, toy-friendly.',
      genderHint: 'unisex',
      categoryHints: ['Lubricant'],
    },
    TEST_FX,
  );

  assert.equal(specs.material, '水基配方');
});

test('buildNormalizedSpecs classifies massage candle material away from silicone', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Melt',
      subtitle: 'Massage Candle',
      priceSourceAmount: 40,
      originalPriceSourceAmount: null,
      priceCurrency: 'USD',
      rawDescription: 'Massage candle made with shea butter, soy wax, jojoba oil and macadamia oil.',
      genderHint: 'unisex',
      categoryHints: ['Massage Candle'],
    },
    TEST_FX,
  );

  assert.equal(specs.material, '大豆蜡/油脂复合');
});

test('buildNormalizedSpecs classifies card game content away from silicone', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Journey Deeper: Intimacy Edition',
      subtitle: 'Card game',
      priceSourceAmount: 49,
      originalPriceSourceAmount: null,
      priceCurrency: 'USD',
      rawDescription: 'A card game with 100 prompt cards designed to deepen intimacy and communication.',
      genderHint: 'unisex',
      categoryHints: ['Card game'],
    },
    TEST_FX,
  );

  assert.equal(specs.material, '纸质/数字内容');
});
