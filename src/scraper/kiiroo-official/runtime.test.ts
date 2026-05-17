import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveKiirooRuntimeConfig } from './runtime.ts';

test('resolveKiirooRuntimeConfig defaults to headless mode', () => {
  const result = resolveKiirooRuntimeConfig({}, '/repo');

  assert.deepEqual(result, {
    mode: 'headless',
    interactive: false,
    cdpEndpoint: '',
    persistentProfileDir: '/repo/src/data/kiiroo-official-browser-profile',
    interactiveStartUrl: 'https://www.kiiroo.com/collections/male-masturbators',
  });
});

test('resolveKiirooRuntimeConfig enables persistent interactive mode when requested', () => {
  const result = resolveKiirooRuntimeConfig(
    {
      KIIROO_INTERACTIVE: '1',
      KIIROO_PERSISTENT_PROFILE_DIR: './tmp/kiiroo-profile',
      KIIROO_INTERACTIVE_START_URL: 'https://www.kiiroo.com/collections/vibrators',
    },
    '/repo',
  );

  assert.deepEqual(result, {
    mode: 'interactive',
    interactive: true,
    cdpEndpoint: '',
    persistentProfileDir: '/repo/tmp/kiiroo-profile',
    interactiveStartUrl: 'https://www.kiiroo.com/collections/vibrators',
  });
});

test('resolveKiirooRuntimeConfig enables cdp mode when endpoint is provided', () => {
  const result = resolveKiirooRuntimeConfig(
    {
      KIIROO_CDP_ENDPOINT: 'http://127.0.0.1:9222',
      KIIROO_INTERACTIVE_START_URL: 'https://www.kiiroo.com/collections/for-couples',
    },
    '/repo',
  );

  assert.deepEqual(result, {
    mode: 'cdp',
    interactive: true,
    cdpEndpoint: 'http://127.0.0.1:9222',
    persistentProfileDir: '/repo/src/data/kiiroo-official-browser-profile',
    interactiveStartUrl: 'https://www.kiiroo.com/collections/for-couples',
  });
});
