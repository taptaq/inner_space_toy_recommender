import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSvakomLivePatch,
  buildSvakomRawDescription,
  buildSvakomSnapshotScript,
  isCapturableSvakomProductUrl,
  type SvakomLiveSnapshot,
} from './backfill-svakom-live-products.ts';

const snapshot: SvakomLiveSnapshot = {
  url: 'https://www.svakom.com/zh-hans/products/thrusting-rabbit-vibrator',
  title: 'AVERY',
  metaTitle: 'AVERY | SVAKOM',
  metaDescription: 'Thrusting rabbit vibrator with G-spot and clitoral stimulation.',
  bodyText:
    'AVERY\n$99.99\nThrusting Rabbit Vibrator\nG-spot and clitoral stimulation\nIPX7 Waterproof\nRechargeable\nSilicone',
  headings: ['Product Features', 'Specifications'],
  images: ['https://www.svakom.com/cdn/shop/files/avery.jpg'],
};

test('isCapturableSvakomProductUrl accepts only SVAKOM product URLs', () => {
  assert.equal(isCapturableSvakomProductUrl('https://www.svakom.com/zh-hans-cn/products/beatrice'), true);
  assert.equal(isCapturableSvakomProductUrl('https://www.svakom.com/zh-hans/products/beatrice'), true);
  assert.equal(isCapturableSvakomProductUrl('https://www.svakom.com/zh-hans/collections/all'), false);
  assert.equal(isCapturableSvakomProductUrl('https://example.com/zh-hans/products/beatrice'), false);
});

test('buildSvakomRawDescription turns a live DOM snapshot into structured raw_description', () => {
  const rawDescription = buildSvakomRawDescription(snapshot, {
    name: 'Avery',
    currentGender: 'female',
  });

  assert.match(rawDescription, /商品名: Avery/);
  assert.match(rawDescription, /页面描述: Thrusting rabbit vibrator/);
  assert.match(rawDescription, /页面价格\(USD\): 99\.99/);
  assert.match(rawDescription, /IPX7 Waterproof/);
});

test('buildSvakomLivePatch classifies SVAKOM slugs and applies electric defaults', () => {
  const patch = buildSvakomLivePatch({
    name: 'Avery',
    currentGender: 'female',
    currentTypeCode: 'unknown',
    currentSubtypeCode: null,
    snapshot,
  });

  assert.equal(patch.gender, 'female');
  assert.equal(patch.type_code, 'dual_stimulation');
  assert.equal(patch.subtype_code, 'rabbit_dual');
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
  assert.match(String(patch.raw_description), /商品名: Avery/);
});

test('buildSvakomLivePatch handles male masturbator and panty wearable examples', () => {
  const neo = buildSvakomLivePatch({
    name: 'Neo 2 pro',
    currentGender: 'male',
    currentTypeCode: 'unknown',
    currentSubtypeCode: null,
    snapshot: {
      ...snapshot,
      url: 'https://www.svakom.com/zh-hans-cn/products/male-masturbator',
      title: 'NEO 2 PRO',
      metaDescription: 'Male masturbator with heating, vibration, and app control.',
      bodyText: 'NEO 2 PRO\nMale masturbator\nHeating\nVibration\nAPP Control\nIPX7 Waterproof',
    },
  });
  const edeny = buildSvakomLivePatch({
    name: 'Edeny',
    currentGender: 'female',
    currentTypeCode: 'unknown',
    currentSubtypeCode: null,
    snapshot: {
      ...snapshot,
      url: 'https://www.svakom.com/zh-hans-cn/products/clitoral-panty-vibrator',
      title: 'EDENY',
      metaDescription: 'Clitoral panty vibrator for wearable remote play.',
      bodyText: 'EDENY\nClitoral Panty Vibrator\nWearable\nRemote Control\nRechargeable',
    },
  });

  assert.equal(neo.type_code, 'masturbator');
  assert.equal(neo.subtype_code, 'interactive_masturbator');
  assert.equal(neo.gender, 'male');
  assert.equal(neo.max_db, 50);
  assert.equal(neo.waterproof, 7);
  assert.equal(edeny.type_code, 'wearable_remote');
  assert.equal(edeny.subtype_code, 'panty_wearable');
  assert.equal(edeny.gender, 'female');
  assert.equal(edeny.max_db, 50);
  assert.equal(edeny.waterproof, 7);
});

test('buildSvakomLivePatch applies slug-level overrides for the seven SVAKOM refetch rows', () => {
  const cases = [
    ['https://www.svakom.com/zh-hans-cn/products/beatrice', 'female', 'external_vibe', 'bullet_vibe'],
    ['https://www.svakom.com/zh-hans-cn/products/beginers-vibrator-cici-2', 'female', 'insertable', 'insertable_vibe'],
    ['https://www.svakom.com/zh-hans-cn/products/clitoral-panty-vibrator', 'female', 'wearable_remote', 'panty_wearable'],
    ['https://www.svakom.com/zh-hans-cn/products/male-masturbator', 'male', 'masturbator', 'interactive_masturbator'],
    ['https://www.svakom.com/zh-hans-cn/products/mini-bullet-vibrator', 'female', 'external_vibe', 'bullet_vibe'],
    ['https://www.svakom.com/zh-hans-cn/products/thrusting-rabbit-vibrator', 'female', 'dual_stimulation', 'rabbit_dual'],
    ['https://www.svakom.com/zh-hans-cn/products/wearable-vibrator', 'female', 'wearable_remote', 'insertable_remote'],
  ] as const;

  for (const [url, gender, typeCode, subtypeCode] of cases) {
    const patch = buildSvakomLivePatch({
      name: url.split('/').at(-1) || 'SVAKOM product',
      currentGender: null,
      currentTypeCode: 'unknown',
      currentSubtypeCode: null,
      snapshot: {
        ...snapshot,
        url,
        bodyText: `${snapshot.bodyText}\nApp Control\nRechargeable\nIPX7 Waterproof`,
      },
    });

    assert.equal(patch.gender, gender, url);
    assert.equal(patch.type_code, typeCode, url);
    assert.equal(patch.subtype_code, subtypeCode, url);
    assert.equal(patch.max_db, 50, url);
    assert.equal(patch.waterproof, 7, url);
  }
});

test('buildSvakomSnapshotScript is safe to evaluate inside a browser page', () => {
  const script = buildSvakomSnapshotScript();

  assert.match(script, /window\.location\.href/);
  assert.doesNotMatch(script, /__name/);
});
