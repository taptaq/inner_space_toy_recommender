import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendCapturedRecords,
  buildManualCaptureRecord,
  buildManualSnapshotScript,
  isCapturableLovehoneyProductUrl,
  resolveLovehoneyManualCaptureConfig,
  resolveLovehoneyPersistenceMode,
  type LovehoneyManualPageSnapshot,
} from './manual-capture.ts';

test('isCapturableLovehoneyProductUrl only accepts Lovehoney product detail pages', () => {
  assert.equal(
    isCapturableLovehoneyProductUrl(
      'https://www.lovehoney.co.uk/sex-toys/vibrators/rabbit-vibrators/p/example/a41131g74956.html',
    ),
    true,
  );
  assert.equal(isCapturableLovehoneyProductUrl('https://www.lovehoney.co.uk/sex-toys/vibrators/'), false);
  assert.equal(isCapturableLovehoneyProductUrl('https://example.com/p/example.html'), false);
});

test('buildManualCaptureRecord converts a live DOM snapshot into a cleaner buffer record', () => {
  const snapshot: LovehoneyManualPageSnapshot = {
    url: 'https://www.lovehoney.co.uk/sex-toys/vibrators/rabbit-vibrators/p/example/a41131g74956.html',
    title: 'Fifty Shades of Grey Greedy Girl Thrusting Rabbit Vibrator',
    metaTitle: 'Fifty Shades of Grey Greedy Girl | Lovehoney',
    metaDescription: 'A thrusting rabbit vibrator with silicone curves and waterproof design.',
    bodyText:
      'Fifty Shades of Grey Greedy Girl Thrusting Rabbit Vibrator\n£54.99\nWaterproof\nSilicone\nRechargeable rabbit vibrator with powerful dual stimulation.',
    headings: ['Product Description', 'Key Features'],
    images: ['https://media.lovehoney.co.uk/example.jpg'],
  };

  const record = buildManualCaptureRecord(snapshot);

  assert.equal(record?.sourceUrl, snapshot.url);
  assert.equal(record?.name, 'Fifty Shades of Grey Greedy Girl Thrusting Rabbit Vibrator');
  assert.equal(record?.price, 54.99);
  assert.equal(record?.priceCurrency, 'GBP');
  assert.equal(record?.genderHint, 'female');
  assert.match(String(record?.rawDescription), /页面描述: A thrusting rabbit vibrator/);
  assert.match(String(record?.rawDescription), /Waterproof/);
});

test('buildManualCaptureRecord rejects blocked Lovehoney technical difficulty pages', () => {
  const snapshot: LovehoneyManualPageSnapshot = {
    url: 'https://www.lovehoney.co.uk/sex-toys/vibrators/rabbit-vibrators/p/example/a41131g74956.html',
    title: 'Blocked request',
    metaTitle: '',
    metaDescription: '',
    bodyText:
      'We are currently experiencing technical difficulties with our website. Reference Number: 18.8ab82917.1779248881.ad4c57d6 Host: www.lovehoney.co.uk',
    headings: [],
    images: [],
  };

  assert.equal(buildManualCaptureRecord(snapshot), null);
});

test('appendCapturedRecords dedupes by normalized sourceUrl while preserving existing rows', () => {
  const existing = [
    { sourceUrl: 'https://www.lovehoney.co.uk/p/a.html', name: 'Existing' },
  ];
  const incoming = [
    { sourceUrl: 'https://www.lovehoney.co.uk/p/a.html/', name: 'Duplicate' },
    { sourceUrl: 'https://www.lovehoney.co.uk/p/b.html', name: 'New' },
  ];

  assert.deepEqual(appendCapturedRecords(existing, incoming), [
    { sourceUrl: 'https://www.lovehoney.co.uk/p/a.html', name: 'Existing' },
    { sourceUrl: 'https://www.lovehoney.co.uk/p/b.html', name: 'New' },
  ]);
});

test('resolveLovehoneyManualCaptureConfig applies defaults and env overrides', () => {
  const config = resolveLovehoneyManualCaptureConfig(
    {
      LOVEHONEY_CDP_ENDPOINT: 'http://localhost:9333',
      LOVEHONEY_MANUAL_RUN_CLEANER: 'true',
      LOVEHONEY_MANUAL_MAX_CAPTURES: '3',
    },
    '/repo',
  );

  assert.equal(config.cdpEndpoint, 'http://localhost:9333');
  assert.equal(config.runCleaner, true);
  assert.equal(config.maxCaptures, 3);
  assert.equal(config.bufferPath, '/repo/src/data/lovehoney-official-review-buffer.json');
});

test('buildManualSnapshotScript is safe to evaluate inside a browser page', () => {
  const script = buildManualSnapshotScript();

  assert.match(script, /window\.location\.href/);
  assert.doesNotMatch(script, /__name/);
});

test('resolveLovehoneyPersistenceMode updates existing products instead of skipping them', () => {
  assert.equal(resolveLovehoneyPersistenceMode({ existingProductId: 'product-1' }), 'update');
  assert.equal(resolveLovehoneyPersistenceMode({ existingProductId: null }), 'create');
});
