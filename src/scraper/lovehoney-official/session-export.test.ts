import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLovehoneySessionExportConfig } from './session-export.ts';

test('resolveLovehoneySessionExportConfig falls back to the default output path and launch url', () => {
  const result = resolveLovehoneySessionExportConfig({}, '/repo');

  assert.deepEqual(result, {
    storageStatePath: '/repo/src/data/lovehoney-official-storage-state.json',
    launchUrl: 'https://www.lovehoney.co.uk/sex-toys/sex-toys-for-women/',
  });
});

test('resolveLovehoneySessionExportConfig respects explicit output path and launch url', () => {
  const result = resolveLovehoneySessionExportConfig(
    {
      LOVEHONEY_STORAGE_STATE_PATH: './tmp/custom-state.json',
      LOVEHONEY_SESSION_CAPTURE_URL: 'https://www.lovehoney.co.uk/',
    },
    '/repo',
  );

  assert.deepEqual(result, {
    storageStatePath: '/repo/tmp/custom-state.json',
    launchUrl: 'https://www.lovehoney.co.uk/',
  });
});
