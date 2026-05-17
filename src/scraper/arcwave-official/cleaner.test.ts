import test from 'node:test';
import assert from 'node:assert/strict';

test('arcwave placeholder test for module presence', async () => {
  const mod = await import('./cleaner.ts');
  assert.equal(typeof mod.runCleaner, 'function');
});
