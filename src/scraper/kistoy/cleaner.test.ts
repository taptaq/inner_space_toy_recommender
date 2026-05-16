import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleaner from './cleaner.ts';

test('normalizePersistedRawDescription converts placeholder text to null', () => {
  const normalizePersistedRawDescription = (cleaner as Record<string, unknown>).normalizePersistedRawDescription;
  assert.equal(typeof normalizePersistedRawDescription, 'function');

  assert.equal((normalizePersistedRawDescription as (value: unknown) => string | null)('信息未获取'), null);
  assert.equal((normalizePersistedRawDescription as (value: unknown) => string | null)(' 信息未获取 '), null);
});

test('normalizePersistedRawDescription keeps real description text', () => {
  const normalizePersistedRawDescription = (cleaner as Record<string, unknown>).normalizePersistedRawDescription;
  assert.equal(typeof normalizePersistedRawDescription, 'function');

  assert.equal(
    (normalizePersistedRawDescription as (value: unknown) => string | null)('参数信息完整，支持低噪运行'),
    '参数信息完整，支持低噪运行',
  );
});
