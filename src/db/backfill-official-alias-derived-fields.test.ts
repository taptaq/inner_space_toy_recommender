import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOfficialAliasDerivedFieldPatch,
} from './backfill-official-alias-derived-fields.ts';

test('buildOfficialAliasDerivedFieldPatch copies canonical derived fields for Lovense alias rows', () => {
  const patch = buildOfficialAliasDerivedFieldPatch({
    id: 'toy-1',
    name: 'Diamo 环',
    current_price: null,
    current_gender: null,
    current_type_code: null,
    current_subtype_code: null,
    current_max_db: null,
    current_waterproof: null,
    current_recommendation_features: null,
    raw_description: '蓝牙震动环',
    canonical_name: 'Diamo',
    canonical_price: 605,
    canonical_gender: 'male',
    canonical_type_code: 'cock_ring',
    canonical_subtype_code: 'vibrating_cock_ring',
    canonical_max_db: 50,
    canonical_waterproof: 7,
    canonical_recommendation_features: { foo: 'bar' },
  });

  assert.equal(patch.price, 605);
  assert.equal(patch.type_code, 'cock_ring');
  assert.equal(patch.subtype_code, 'vibrating_cock_ring');
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
  assert.deepEqual(patch.recommendation_features, { foo: 'bar' });
});

test('buildOfficialAliasDerivedFieldPatch keeps existing filled values and only fills missing fields', () => {
  const patch = buildOfficialAliasDerivedFieldPatch({
    id: 'toy-2',
    name: 'Jive 2',
    current_price: 999,
    current_gender: 'female',
    current_type_code: 'insertable',
    current_subtype_code: null,
    current_max_db: 42,
    current_waterproof: null,
    current_recommendation_features: null,
    raw_description: 'G点震动器',
    canonical_name: 'We-Vibe Jive 2',
    canonical_price: 777,
    canonical_gender: 'female',
    canonical_type_code: 'insertable',
    canonical_subtype_code: 'insertable_vibe',
    canonical_max_db: 50,
    canonical_waterproof: 7,
    canonical_recommendation_features: { hey: 'there' },
  });

  assert.equal(patch.price, 999);
  assert.equal(patch.type_code, 'insertable');
  assert.equal(patch.subtype_code, 'insertable_vibe');
  assert.equal(patch.max_db, 42);
  assert.equal(patch.waterproof, 7);
  assert.deepEqual(patch.recommendation_features, { hey: 'there' });
});

test('buildOfficialAliasDerivedFieldPatch also fills missing gender from canonical rows', () => {
  const patch = buildOfficialAliasDerivedFieldPatch({
    id: 'toy-3',
    name: 'Perfect Pair 2',
    current_price: 555,
    current_type_code: 'couples',
    current_subtype_code: null,
    current_max_db: 50,
    current_waterproof: 7,
    current_recommendation_features: null,
    raw_description: '情侣共玩',
    current_gender: null,
    canonical_name: 'Satisfyer Perfect Pair 2',
    canonical_price: 666,
    canonical_type_code: 'couples',
    canonical_subtype_code: 'external_couples',
    canonical_max_db: 50,
    canonical_waterproof: 7,
    canonical_recommendation_features: { x: 1 },
    canonical_gender: 'unisex',
  });

  assert.equal(patch.gender, 'unisex');
  assert.equal(patch.subtype_code, 'external_couples');
});

test('buildOfficialAliasDerivedFieldPatch copies canonical Lovehoney fields for alias rows', () => {
  const patch = buildOfficialAliasDerivedFieldPatch({
    id: 'toy-4',
    name: 'Pleasure Trip Silicone Rechargeable Wand （硅胶充电棒振动器）',
    current_price: null,
    current_gender: null,
    current_type_code: null,
    current_subtype_code: null,
    current_max_db: null,
    current_waterproof: null,
    current_recommendation_features: null,
    raw_description: '旧中文描述',
    canonical_name: 'Lovehoney Pleasure Trip Silicone Rechargeable Wand Vibrator',
    canonical_price: 459,
    canonical_gender: 'female',
    canonical_type_code: 'wand',
    canonical_subtype_code: 'vibrating_wand',
    canonical_max_db: 50,
    canonical_waterproof: 7,
    canonical_recommendation_features: { strong: true },
  });

  assert.equal(patch.price, 459);
  assert.equal(patch.type_code, 'wand');
  assert.equal(patch.subtype_code, 'vibrating_wand');
  assert.equal(patch.max_db, 50);
  assert.equal(patch.waterproof, 7);
  assert.deepEqual(patch.recommendation_features, { strong: true });
});
