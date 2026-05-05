import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLovehoneyRuntimeConfig } from './runtime.ts';

test('resolveLovehoneyRuntimeConfig defaults to headless mode', () => {
  const result = resolveLovehoneyRuntimeConfig({}, '/repo');

  assert.deepEqual(result, {
    mode: 'headless',
    interactive: false,
    cdpEndpoint: '',
    persistentProfileDir: '/repo/src/data/lovehoney-official-browser-profile',
    interactiveStartUrl: 'https://www.lovehoney.co.uk/\x73ex-toys/\x73ex-toys-for-women/',
  });
});

test('resolveLovehoneyRuntimeConfig enables persistent interactive mode when requested', () => {
  const result = resolveLovehoneyRuntimeConfig(
    {
      LOVEHONEY_INTERACTIVE: '1',
      LOVEHONEY_PERSISTENT_PROFILE_DIR: './tmp/lovehoney-profile',
      LOVEHONEY_INTERACTIVE_START_URL: 'https://www.lovehoney.co.uk/',
    },
    '/repo',
  );

  assert.deepEqual(result, {
    mode: 'interactive',
    interactive: true,
    cdpEndpoint: '',
    persistentProfileDir: '/repo/tmp/lovehoney-profile',
    interactiveStartUrl: 'https://www.lovehoney.co.uk/',
  });
});

test('resolveLovehoneyRuntimeConfig enables cdp mode when endpoint is provided', () => {
  const result = resolveLovehoneyRuntimeConfig(
    {
      LOVEHONEY_CDP_ENDPOINT: 'http://127.0.0.1:9222',
      LOVEHONEY_INTERACTIVE_START_URL: 'https://www.lovehoney.co.uk/',
    },
    '/repo',
  );

  assert.deepEqual(result, {
    mode: 'cdp',
    interactive: true,
    cdpEndpoint: 'http://127.0.0.1:9222',
    persistentProfileDir: '/repo/src/data/lovehoney-official-browser-profile',
    interactiveStartUrl: 'https://www.lovehoney.co.uk/',
  });
});
