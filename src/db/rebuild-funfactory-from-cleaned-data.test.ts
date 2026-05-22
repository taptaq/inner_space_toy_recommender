import test from 'node:test';
import assert from 'node:assert/strict';

import {
  rebuildFunFactoryPrice,
} from './rebuild-funfactory-from-cleaned-data.ts';

test('rebuildFunFactoryPrice keeps decimal EUR source prices unchanged', () => {
  assert.equal(rebuildFunFactoryPrice(32.95, 'EUR'), 32.95);
});

test('rebuildFunFactoryPrice converts cent-style source prices to decimal EUR', () => {
  assert.equal(rebuildFunFactoryPrice(3295, 'EUR'), 32.95);
  assert.equal(rebuildFunFactoryPrice(1995, 'EUR'), 19.95);
});

test('rebuildFunFactoryPrice prefers numeric source amounts over derived toy prices', () => {
  assert.equal(rebuildFunFactoryPrice(4295, 'EUR'), 42.95);
  assert.equal(rebuildFunFactoryPrice(null, 'EUR'), null);
});
