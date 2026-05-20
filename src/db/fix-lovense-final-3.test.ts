import test from 'node:test';
import assert from 'node:assert/strict';
import { getLovenseFinalPatch } from './fix-lovense-final-3.ts';

test('getLovenseFinalPatch returns the expected manual corrections for Lush', () => {
  assert.deepEqual(getLovenseFinalPatch('Lush'), {
    type_code: 'insertable',
    subtype_code: 'insertable_vibe',
    gender: 'unisex',
    max_db: 50,
    waterproof: 7,
  });
});

test('getLovenseFinalPatch returns the expected manual corrections for Max 2 and Edge 2Gay s', () => {
  assert.deepEqual(getLovenseFinalPatch('Max 2 and Edge 2Gay s'), {
    type_code: 'couples',
    subtype_code: 'insertable_couples',
    gender: 'male',
    max_db: 40,
    waterproof: 7,
  });
});

test('getLovenseFinalPatch returns the expected manual corrections for USB Bluetooth Adapter', () => {
  assert.deepEqual(getLovenseFinalPatch('USB Bluetooth Adapter'), {
    type_code: 'unknown',
    subtype_code: null,
    gender: 'unisex',
    max_db: null,
    waterproof: null,
  });
});
