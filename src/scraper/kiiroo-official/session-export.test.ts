import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveKiirooSessionExportConfig } from './session-export.ts';

test('resolveKiirooSessionExportConfig falls back to the default output path and launch url', () => {
  const result = resolveKiirooSessionExportConfig({}, '/repo');

  assert.deepEqual(result, {
    storageStatePath: '/repo/src/data/kiiroo-official-storage-state.json',
    launchUrl: 'https://www.kiiroo.com/collections/male-masturbators',
  });
});

test('resolveKiirooSessionExportConfig respects explicit output path and launch url', () => {
  const result = resolveKiirooSessionExportConfig(
    {
      KIIROO_STORAGE_STATE_PATH: './tmp/custom-kiiroo-state.json',
      KIIROO_SESSION_CAPTURE_URL: 'https://www.kiiroo.com/collections/for-couples',
    },
    '/repo',
  );

  assert.deepEqual(result, {
    storageStatePath: '/repo/tmp/custom-kiiroo-state.json',
    launchUrl: 'https://www.kiiroo.com/collections/for-couples',
  });
});
