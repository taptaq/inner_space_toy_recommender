import type { LibraryTypeCode } from './library-product-types.ts';

type ClassificationInput = {
  gender: string | null | undefined;
  physicalForm: string | null | undefined;
  name: string | null | undefined;
  rawDescription: string | null | undefined;
  tags: string[] | null | undefined;
};

const SUCTION_PATTERN = /(吮吸|吸吮|吸感|air\s*pulse|气脉冲)/i;
const MASTURBATOR_PATTERN = /(飞机杯|masturbator|\bcup\b)/i;
const PROSTATE_PATTERN = /(前列腺|prostate|p-spot|后庭前列腺|prostate\s*massager)/i;
const COCK_RING_PATTERN = /(cock\s*ring|penis\s*ring|震动环|锁精环|延时环)/i;
const REMOTE_CONTROL_PATTERN =
  /(远控|远程控制|遥控|\bapp\b|app控制|app连接|蓝牙|bluetooth)/i;
const WEARABLE_PATTERN = /(穿戴|wearable)/i;
const COUPLES_PATTERN = /(情侣|双人|共玩|partner|shared)/i;

function normalizeValue(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

function joinSignals(input: ClassificationInput) {
  return [
    input.name ?? '',
    input.rawDescription ?? '',
    ...(input.tags ?? []),
  ].join('\n');
}

export function classifyLibraryTypeCode(
  input: ClassificationInput,
): LibraryTypeCode {
  const gender = normalizeValue(input.gender);
  const physicalForm = normalizeValue(input.physicalForm);
  const signals = joinSignals(input);

  if (gender === 'female') {
    if (physicalForm === 'external' && SUCTION_PATTERN.test(signals)) {
      return 'suction';
    }
    if (physicalForm === 'external') return 'external_vibe';
    if (physicalForm === 'internal') return 'insertable';
    if (physicalForm === 'composite') return 'dual_stimulation';
  }

  if (gender === 'male') {
    if (PROSTATE_PATTERN.test(signals)) return 'prostate';
    if (COCK_RING_PATTERN.test(signals)) return 'cock_ring';
    if (MASTURBATOR_PATTERN.test(signals)) return 'masturbator';
  }

  if (gender === 'unisex') {
    if (REMOTE_CONTROL_PATTERN.test(signals) && WEARABLE_PATTERN.test(signals)) {
      return 'wearable_remote';
    }
    if (REMOTE_CONTROL_PATTERN.test(signals)) return 'couples';
    if (COUPLES_PATTERN.test(signals)) return 'couples';
  }

  return 'unknown';
}
