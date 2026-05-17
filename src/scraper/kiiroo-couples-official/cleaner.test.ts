import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNormalizedSpecs, formatKiirooCouplesRawDescription, resolveRmbPrice } from './cleaner.ts';

test('resolveRmbPrice converts USD prices to rounded RMB for couples items', () => {
  assert.equal(resolveRmbPrice(149, 7.2), 1073);
});

test('buildNormalizedSpecs keeps couples products as unisex and marks remote-play tags', () => {
  const specs = buildNormalizedSpecs(
    {
      name: 'Fuse',
      genderHint: 'unisex',
      rawDescription:
        'Interactive dual-stimulation vibrator for couples with app sync, partner control, rechargeable waterproof design.',
      priceUsd: 149,
      originalPriceUsd: 169,
      categoryHints: ['interactive', 'couples', 'vibrator'],
    },
    {
      rate: 7.2,
      source: 'test',
      date: '2026-05-16',
    },
  );

  assert.equal(specs.gender, 'unisex');
  assert.equal(specs.price_rmb, 1073);
  assert.match(specs.type_code || '', /dual_stimulation|external_vibe/);
  assert.ok(specs.function_tags.includes('远程互动'));
  assert.ok(specs.function_tags.includes('伴侣共玩'));
});

test('formatKiirooCouplesRawDescription separates common section labels', () => {
  const formatted = formatKiirooCouplesRawDescription(
    'Description Interactive couples toy Features app sync Materials silicone',
  );

  assert.match(formatted, /Description:/);
  assert.match(formatted, /Features:/);
  assert.match(formatted, /Materials:/);
});
