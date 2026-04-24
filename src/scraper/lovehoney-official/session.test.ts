import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLovehoneySessionBootstrap } from './session.ts';

test('resolveLovehoneySessionBootstrap prefers storage state path over cookie header', () => {
  const result = resolveLovehoneySessionBootstrap(
    {
      LOVEHONEY_STORAGE_STATE_PATH: '/tmp/lovehoney-state.json',
      LOVEHONEY_COOKIE: 'foo=bar',
    },
    {
      existsSync: (targetPath) => targetPath === '/tmp/lovehoney-state.json',
    },
  );

  assert.deepEqual(result, {
    storageStatePath: '/tmp/lovehoney-state.json',
    cookieHeader: '',
    source: 'storage-state',
  });
});

test('resolveLovehoneySessionBootstrap throws a clear error when storage state path is missing', () => {
  assert.throws(
    () =>
      resolveLovehoneySessionBootstrap(
        {
          LOVEHONEY_STORAGE_STATE_PATH: '/tmp/missing-lovehoney-state.json',
        },
        {
          existsSync: () => false,
        },
      ),
    /LOVEHONEY_STORAGE_STATE_PATH 文件不存在: \/tmp\/missing-lovehoney-state\.json/,
  );
});
