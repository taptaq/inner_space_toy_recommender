import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveKiirooSessionBootstrap } from './session.ts';

test('resolveKiirooSessionBootstrap prefers storage state path over cookie header', () => {
  const result = resolveKiirooSessionBootstrap(
    {
      KIIROO_STORAGE_STATE_PATH: '/tmp/kiiroo-state.json',
      KIIROO_COOKIE: 'foo=bar',
    },
    {
      existsSync: (targetPath) => targetPath === '/tmp/kiiroo-state.json',
    },
  );

  assert.deepEqual(result, {
    storageStatePath: '/tmp/kiiroo-state.json',
    cookieHeader: '',
    source: 'storage-state',
  });
});

test('resolveKiirooSessionBootstrap throws a clear error when storage state path is missing', () => {
  assert.throws(
    () =>
      resolveKiirooSessionBootstrap(
        {
          KIIROO_STORAGE_STATE_PATH: '/tmp/missing-kiiroo-state.json',
        },
        {
          existsSync: () => false,
        },
      ),
    /KIIROO_STORAGE_STATE_PATH 文件不存在: \/tmp\/missing-kiiroo-state\.json/,
  );
});
