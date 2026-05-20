import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findLeloAliasCanonicalName,
  normalizeLooseToyName,
} from './backfill-lelo-alias-raw-descriptions.ts';

test('normalizeLooseToyName strips punctuation, spaces, and trademark symbols', () => {
  assert.equal(normalizeLooseToyName('TIANI™ Harmony'), 'tianiharmony');
  assert.equal(normalizeLooseToyName('Mia3 米娅三代口红'), 'mia3米娅三代口红');
  assert.equal(normalizeLooseToyName('TOR 3代 环'), 'tor3代环');
});

test('findLeloAliasCanonicalName resolves known Chinese LELO aliases', () => {
  assert.equal(findLeloAliasCanonicalName('SONA3 汐汐贝吮吸'), 'SONA™ 3');
  assert.equal(findLeloAliasCanonicalName('lyla2'), 'LYLA™ 2');
  assert.equal(findLeloAliasCanonicalName('F1S V3'), 'F1S™ V3');
  assert.equal(findLeloAliasCanonicalName('Mia3 米娅三代口红'), 'MIA™ 3');
  assert.equal(findLeloAliasCanonicalName('TOR 3代 环'), 'TOR™ 3');
  assert.equal(findLeloAliasCanonicalName('TIANI™Harmony'), 'TIANI™ Harmony');
  assert.equal(findLeloAliasCanonicalName('Tiani Duo 夫妻共用体感遥控'), 'TIANI™ DUO');
  assert.equal(findLeloAliasCanonicalName('beads缩阴球'), 'LELO Beads™');
  assert.equal(findLeloAliasCanonicalName('gigi3 G点按摩'), 'GIGI™ 3');
});

test('findLeloAliasCanonicalName returns null for unrelated names', () => {
  assert.equal(findLeloAliasCanonicalName('Random Product'), null);
});
