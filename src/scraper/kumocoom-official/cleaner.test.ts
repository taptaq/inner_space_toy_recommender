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
  assert.equal(cleaner.resolveRmbPrice(66, 7.2), 475);
  assert.equal(cleaner.resolveRmbPrice(72, 7.2), 518);
  assert.equal(cleaner.resolveRmbPrice(null, 7.2), null);
});

test('buildNormalizedSpecs converts USD prices and preserves FX metadata', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Abyssal Glow Silicone Toy',
      subtitle: 'Fantasy toy',
      priceSourceAmount: 66,
      originalPriceSourceAmount: 80,
      priceCurrency: 'USD',
      rawDescription: 'Phosphorescent platinum silicone fantasy toy with soft glow.',
      genderHint: 'female',
      categoryHints: [],
    },
    TEST_FX,
  );

  assert.equal(specs.price_source_currency, 'USD');
  assert.equal(specs.price_source_amount, 66);
  assert.equal(specs.price_rmb, 475);
  assert.equal(specs.original_price_rmb, 576);
  assert.equal(specs.fx_rate_to_cny, 7.2);
});

test('buildNormalizedSpecs infers silicone and fantasy/glow tags', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'Abyssal Glow Silicone Toy',
      subtitle: 'Fantasy toy',
      priceSourceAmount: 66,
      originalPriceSourceAmount: null,
      priceCurrency: 'USD',
      rawDescription: 'Phosphorescent platinum silicone fantasy toy with luminous glow.',
      genderHint: 'female',
      categoryHints: [],
    },
    TEST_FX,
  );

  assert.equal(specs.material, '硅胶');
  assert.ok(specs.function_tags.includes('夜光'));
  assert.ok(specs.function_tags.includes('幻想造型'));
});
