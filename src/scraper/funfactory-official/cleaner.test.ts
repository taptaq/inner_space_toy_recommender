import test from 'node:test';
import assert from 'node:assert/strict';

import * as cleaner from './cleaner.ts';

test('resolveRmbPrice converts EUR prices to rounded CNY', () => {
  assert.equal(cleaner.resolveRmbPrice(59.9, 7.8), 467);
  assert.equal(cleaner.resolveRmbPrice(null, 7.8), null);
});

test('buildNormalizedSpecs keeps source currency and produces CNY price', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'BOOTIE FEM',
      subtitle: 'Anal toy with ergonomic shape',
      priceSourceAmount: 59.9,
      originalPriceSourceAmount: 79.9,
      priceCurrency: 'EUR',
      rawDescription:
        'Body-safe silicone anal toy. Ergonomic curve for comfortable insertion. Waterproof.',
      genderHint: 'unisex',
      categoryHints: ['anal toy'],
    },
    {
      rate: 7.8,
      source: 'test',
      date: '2026-05-21',
      currency: 'EUR',
    },
  );

  assert.equal(specs.price_source_currency, 'EUR');
  assert.equal(specs.price_source_amount, 59.9);
  assert.equal(specs.price_rmb, 467);
  assert.equal(specs.original_price_rmb, 623);
});

test('buildLocalizedDescription produces a Chinese-oriented normalized description', () => {
  const localized = cleaner.buildLocalizedDescription({
    name: 'BOOTIE FEM',
    subtitle: 'Anal toy with ergonomic shape',
    rawDescription:
      'Body-safe silicone anal toy. Ergonomic curve for comfortable insertion. Waterproof.',
    translatedRawDescription:
      '采用亲肤硅胶材质的后庭玩具，弧线设计更贴合，插入更舒适，并支持防水使用。',
  });

  assert.match(localized, /BOOTIE FEM/);
  assert.match(localized, /亲肤硅胶/);
  assert.match(localized, /防水/);
});

test('normalizeFunFactorySourceAmount converts cent-based EUR prices to decimal', () => {
  assert.equal(cleaner.normalizeFunFactorySourceAmount(3295, 'EUR'), 32.95);
  assert.equal(cleaner.normalizeFunFactorySourceAmount('1995', 'EUR'), 19.95);
  assert.equal(cleaner.normalizeFunFactorySourceAmount(32.95, 'EUR'), 32.95);
  assert.equal(cleaner.normalizeFunFactorySourceAmount(null, 'EUR'), null);
});

test('inferFunFactoryGender prefers male and couples signals over default', () => {
  assert.equal(cleaner.inferFunFactoryGender('male toy for him'), 'male');
  assert.equal(cleaner.inferFunFactoryGender('couples toy for two'), 'unisex');
  assert.equal(cleaner.inferFunFactoryGender('silicone vibrator'), 'female');
});

test('inferFunFactoryGender keeps female clitoral products out of male categories', () => {
  assert.equal(
    cleaner.inferFunFactoryGender('Klitoris Auflegevibrator Cunnilingus Blowjob-Upgrade'),
    'female',
  );
});

test('buildNormalizedSpecs extracts waterproof and db from cleaner signal text', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'LAYA III',
      subtitle: 'Auflegevibrator',
      priceSourceAmount: 32.95,
      originalPriceSourceAmount: null,
      priceCurrency: 'EUR',
      rawDescription:
        'Klitoris Auflegevibrator. Wasserdicht (IPX7). Max noise 45 dB. Wiederaufladbar.',
      genderHint: 'unisex',
      categoryHints: ['Auflegevibrator', 'Klitoris'],
    },
    {
      rate: 7.8,
      source: 'test',
      date: '2026-05-22',
      currency: 'EUR',
    },
  );

  assert.equal(specs.gender, 'female');
  assert.equal(specs.waterproof, 7);
  assert.equal(specs.max_db, 45);
});

test('inferFunFactoryGender keeps female anal plug copy out of male classification', () => {
  assert.equal(
    cleaner.inferFunFactoryGender(
      '女性肛门塞 同时进行阴道插入 纤细外形 适合双人游戏',
    ),
    'female',
  );
});

test('buildNormalizedSpecs keeps female anal plug rows conservative when taxonomy has no anal bucket', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'BOOTIE FEM',
      subtitle: 'Analplug',
      priceSourceAmount: 11.95,
      originalPriceSourceAmount: null,
      priceCurrency: 'EUR',
      rawDescription:
        '女性肛门塞。纤细外形，便于简易插入。单侧缩短底座，在同时进行阴道插入时提供更多舒适感。',
      genderHint: 'unisex',
      categoryHints: ['Analplug'],
    },
    {
      rate: 7.8,
      source: 'test',
      date: '2026-05-22',
      currency: 'EUR',
    },
  );

  assert.equal(specs.gender, 'female');
  assert.equal(specs.type_code, 'unknown');
  assert.equal(specs.subtype_code, null);
});

test('buildNormalizedSpecs recognizes G-point and clitoral simultaneous stimulation as dual', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'BI STRONIC EMBRACE',
      subtitle: 'Pulsator',
      priceSourceAmount: 79.95,
      originalPriceSourceAmount: null,
      priceCurrency: 'EUR',
      rawDescription:
        '同时刺激 G 点与阴蒂。8 种冲击模式与 6 种振动模式。防水（IPX7）处理并支持充电（USB-C）。',
      genderHint: 'unisex',
      categoryHints: ['Pulsator'],
    },
    {
      rate: 7.8,
      source: 'test',
      date: '2026-05-22',
      currency: 'EUR',
    },
  );

  assert.equal(specs.gender, 'female');
  assert.equal(specs.type_code, 'dual_stimulation');
});

test('buildNormalizedSpecs defaults max_db to 50 for powered products when db is missing', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'LAYA III',
      subtitle: 'Auflegevibrator',
      priceSourceAmount: 32.95,
      originalPriceSourceAmount: null,
      priceCurrency: 'EUR',
      rawDescription:
        '阴蒂贴放式振动器。10种振动程序。防水（IPX7）& 可充电（USB-C）。',
      genderHint: 'unisex',
      categoryHints: ['Auflegevibrator', 'Klitoris'],
    },
    {
      rate: 7.8,
      source: 'test',
      date: '2026-05-22',
      currency: 'EUR',
    },
  );

  assert.equal(specs.max_db, 50);
});

test('buildNormalizedSpecs keeps max_db null for manual or non-vibration products', () => {
  const specs = cleaner.buildNormalizedSpecs(
    {
      name: 'BOOTIE',
      subtitle: 'Analplug',
      priceSourceAmount: 11.95,
      originalPriceSourceAmount: null,
      priceCurrency: 'EUR',
      rawDescription:
        '肛门塞。Keine Vibration。柔软亲肤的硅胶。防水（IPX7）处理。',
      genderHint: 'unisex',
      categoryHints: ['Analplug'],
    },
    {
      rate: 7.8,
      source: 'test',
      date: '2026-05-22',
      currency: 'EUR',
    },
  );

  assert.equal(specs.max_db, null);
});
