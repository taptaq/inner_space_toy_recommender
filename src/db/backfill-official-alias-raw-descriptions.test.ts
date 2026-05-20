import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOfficialCanonicalSourceMap,
  findOfficialAliasCanonicalName,
  normalizeAliasKey,
  type OfficialCanonicalSourceRow,
} from './backfill-official-alias-raw-descriptions.ts';

function makeCanonicalSourceRow(overrides: Partial<OfficialCanonicalSourceRow>): OfficialCanonicalSourceRow {
  return {
    name: 'Canonical',
    price: null,
    max_db: null,
    waterproof: null,
    appearance: null,
    physical_form: null,
    motor_type: null,
    gender: null,
    material: null,
    image_url: null,
    raw_description: null,
    type_code: null,
    subtype_code: null,
    recommendation_features: null,
    ...overrides,
  };
}

test('normalizeAliasKey removes punctuation and spaces for alias matching', () => {
  assert.equal(normalizeAliasKey('Diamo 环'), 'diamo环');
  assert.equal(normalizeAliasKey('G-Spot Wave 4'), 'gspotwave4');
  assert.equal(normalizeAliasKey('Moxie+'), 'moxie');
  assert.equal(
    normalizeAliasKey('Pleasure Trip Silicone Rechargeable Wand （硅胶充电棒振动器）'),
    'pleasuretripsiliconerechargeablewand硅胶充电棒振动器',
  );
});

test('findOfficialAliasCanonicalName resolves Lovense aliases', () => {
  assert.equal(findOfficialAliasCanonicalName('Diamo 环'), 'Diamo');
  assert.equal(findOfficialAliasCanonicalName('Lush 器'), 'Lush Anal');
  assert.equal(findOfficialAliasCanonicalName('Ambi震动器'), 'Ambi');
  assert.equal(findOfficialAliasCanonicalName('Domi2'), 'Domi 2Bluetooth app-controlled wand vibrator suitable for everyone');
});

test('findOfficialAliasCanonicalName resolves We-Vibe aliases', () => {
  assert.equal(findOfficialAliasCanonicalName('Jive 2'), 'We-Vibe Jive 2');
  assert.equal(findOfficialAliasCanonicalName('Melt2'), 'We-Vibe Melt 2');
  assert.equal(findOfficialAliasCanonicalName('Moxie+'), 'We-Vibe Moxie+');
  assert.equal(findOfficialAliasCanonicalName('temp'), 'We-Vibe Temp');
});

test('findOfficialAliasCanonicalName resolves Satisfyer aliases', () => {
  assert.equal(findOfficialAliasCanonicalName('G-Spot Wave 4'), 'Satisfyer G-Spot Wave 4');
  assert.equal(findOfficialAliasCanonicalName('Mission Control'), 'Satisfyer Mission Control');
  assert.equal(findOfficialAliasCanonicalName('Perfect Pair 2'), 'Satisfyer Perfect Pair 2');
  assert.equal(findOfficialAliasCanonicalName('Playful Four'), 'Satisfyer Playful Four');
  assert.equal(findOfficialAliasCanonicalName('Spot On 1'), 'Satisfyer Spot On 1');
});

test('findOfficialAliasCanonicalName resolves Lovehoney aliases', () => {
  assert.equal(
    findOfficialAliasCanonicalName('Arcwave Zing男式免提振动器'),
    'Arcwave Zing Rechargeable Vibrating Male Masturbator',
  );
  assert.equal(
    findOfficialAliasCanonicalName('Lovehoney Rose Suction Stimulator（玫瑰型 吮吸器'),
    'Lovehoney Rose Clitoral Suction Stimulator',
  );
  assert.equal(
    findOfficialAliasCanonicalName('Dual Embrace Pulsing Suction Dual Stimulator（脉动双效 吮吸 ）'),
    'Lovehoney Dual Embrace Pulsing Clitoral Suction Dual Stimulator',
  );
  assert.equal(
    findOfficialAliasCanonicalName('Pleasure Trip Silicone Rechargeable Wand （硅胶充电棒振动器）'),
    'Lovehoney Pleasure Trip Silicone Rechargeable Wand Vibrator',
  );
});

test('buildOfficialCanonicalSourceMap falls back to products rows when recommender canonical row is absent', () => {
  const canonicalMap = buildOfficialCanonicalSourceMap(
    [],
    [makeCanonicalSourceRow({ name: 'Blowmotion Warming Vibrating Male Masturbator', raw_description: 'product raw' })],
  );

  assert.equal(canonicalMap.get('Blowmotion Warming Vibrating Male Masturbator')?.raw_description, 'product raw');
});

test('buildOfficialCanonicalSourceMap prefers recommender rows over product fallbacks', () => {
  const canonicalMap = buildOfficialCanonicalSourceMap(
    [makeCanonicalSourceRow({ name: 'Canonical', raw_description: 'recommender raw' })],
    [makeCanonicalSourceRow({ name: 'Canonical', raw_description: 'product raw' })],
  );

  assert.equal(canonicalMap.get('Canonical')?.raw_description, 'recommender raw');
});
