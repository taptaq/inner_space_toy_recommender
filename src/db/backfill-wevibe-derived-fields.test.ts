import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWeVibeDerivedPatch,
} from './backfill-wevibe-derived-fields.ts';

test('buildWeVibeDerivedPatch classifies Vector as prostate_vibe', () => {
  const patch = buildWeVibeDerivedPatch({
    name: 'We-Vibe Vector +',
    current_type_code: 'prostate',
    current_subtype_code: null,
    raw_description: 'Vibrating prostate massager designed to stimulate the prostate and perineum simultaneously.',
  });

  assert.equal(patch.type_code, 'prostate');
  assert.equal(patch.subtype_code, 'prostate_vibe');
});

test('buildWeVibeDerivedPatch classifies Play Your Way as wearable_remote/couples-adjacent bundle', () => {
  const patch = buildWeVibeDerivedPatch({
    name: 'Play Your Way',
    current_type_code: 'wearable_remote',
    current_subtype_code: null,
    raw_description: 'Jive 2 & Moxie+ wearable vibrator set designed for discreet desires.',
  });

  assert.equal(patch.type_code, 'wearable_remote');
  assert.equal(patch.subtype_code, 'dual_wearable_remote');
});

test('buildWeVibeDerivedPatch classifies Jive 2 as insertable remote wearable', () => {
  const patch = buildWeVibeDerivedPatch({
    name: 'Jive 2',
    current_type_code: 'wearable_remote',
    current_subtype_code: null,
    raw_description: 'Wearable egg vibrator delivering discreet vibrations to your G-spot.',
  });

  assert.equal(patch.type_code, 'wearable_remote');
  assert.equal(patch.subtype_code, 'insertable_remote');
});

test('buildWeVibeDerivedPatch classifies Temp as external lay-on vibrator', () => {
  const patch = buildWeVibeDerivedPatch({
    name: 'temp',
    current_type_code: 'dual_stimulation',
    current_subtype_code: null,
    raw_description: 'Temperature Play Vibrator. We-Vibe first ergonomic lay-on vibrator with heating.',
  });

  assert.equal(patch.type_code, 'external_vibe');
  assert.equal(patch.subtype_code, 'bullet_vibe');
});

test('buildWeVibeDerivedPatch leaves unrelated rows unchanged', () => {
  const patch = buildWeVibeDerivedPatch({
    name: 'Unknown Row',
    current_type_code: 'unknown',
    current_subtype_code: null,
    raw_description: 'No clear signals.',
  });

  assert.equal(patch.type_code, 'unknown');
  assert.equal(patch.subtype_code, null);
});

test('buildWeVibeDerivedPatch classifies Moving as One as couples/external_couples', () => {
  const patch = buildWeVibeDerivedPatch({
    name: 'Moving as One',
    current_type_code: 'unknown',
    current_subtype_code: null,
    raw_description: 'This kit brings Fifty Shades of Grey and We-Vibe together so you and your perfect match can share thrilling pleasure.',
  });

  assert.equal(patch.type_code, 'couples');
  assert.equal(patch.subtype_code, 'external_couples');
});
