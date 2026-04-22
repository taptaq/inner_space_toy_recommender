import test from 'node:test';
import assert from 'node:assert/strict';
import * as cleanerHelpers from './cleaner-helpers.ts';

test('prepareUniqueBufferItemsForCleaning keeps the first canonical item and skips later duplicates', () => {
  const prepareUniqueBufferItemsForCleaning = (cleanerHelpers as Record<string, unknown>).prepareUniqueBufferItemsForCleaning;
  assert.equal(typeof prepareUniqueBufferItemsForCleaning, 'function');

  const result = (
    prepareUniqueBufferItemsForCleaning as (rows: Array<Record<string, unknown>>) => {
      items: Array<Record<string, unknown>>;
      skippedDuplicateNames: Array<{ canonicalName: string; sourceUrl: string }>;
    }
  )([
    {
      name: 'Wild Rabbit 2',
      sourceUrl: 'https://www.nomitang.com/Wild-Rabbit-2/NT-MB-003-bk',
      rawDescription: '[基础信息]\n商品名: Wild Rabbit 2\n颜色: Black',
    },
    {
      name: 'USB Charging Cable',
      sourceUrl: 'https://www.nomitang.com/USB-Charging-Cable/NT-AC-001-wt',
      rawDescription: '[基础信息]\n商品名: USB Charging Cable',
    },
    {
      name: 'Wild Rabbit 2',
      sourceUrl: 'https://www.nomitang.com/Wild-Rabbit-2/NT-MB-003-hp',
      rawDescription: '[基础信息]\n商品名: Wild Rabbit 2\n颜色: Hot Pink',
    },
  ]);

  assert.equal(result.items.length, 2);
  assert.deepEqual(
    result.items.map((item) => item.sourceUrl),
    [
      'https://www.nomitang.com/Wild-Rabbit-2/NT-MB-003-bk',
      'https://www.nomitang.com/USB-Charging-Cable/NT-AC-001-wt',
    ],
  );
  assert.deepEqual(result.skippedDuplicateNames, [
    {
      canonicalName: 'Wild Rabbit 2',
      sourceUrl: 'https://www.nomitang.com/Wild-Rabbit-2/NT-MB-003-hp',
    },
  ]);
});

test('resolvePersistedRawDescription prefers translated Chinese and falls back to the source text', () => {
  const resolvePersistedRawDescription = (cleanerHelpers as Record<string, unknown>).resolvePersistedRawDescription;
  assert.equal(typeof resolvePersistedRawDescription, 'function');

  assert.equal(
    (resolvePersistedRawDescription as (translated: string, source: string) => string)(
      '[基础信息]\n商品名: 狂野兔 2',
      '[基础信息]\n商品名: Wild Rabbit 2',
    ),
    '[基础信息]\n商品名: 狂野兔 2',
  );

  assert.equal(
    (resolvePersistedRawDescription as (translated: string, source: string) => string)('', '[基础信息]\n商品名: Wild Rabbit 2'),
    '[基础信息]\n商品名: Wild Rabbit 2',
  );
});

test('hasMeaningfulEnglish only flags substantial untranslated English', () => {
  const hasMeaningfulEnglish = (cleanerHelpers as Record<string, unknown>).hasMeaningfulEnglish;
  assert.equal(typeof hasMeaningfulEnglish, 'function');

  assert.equal((hasMeaningfulEnglish as (input: string) => boolean)('[基础信息]\n商品名: Wild Rabbit 2'), false);
  assert.equal(
    (hasMeaningfulEnglish as (input: string) => boolean)(
      '[基础信息]\n商品名: Wild Rabbit 2\n副标题: Rechargeable rabbit vibrator for g-spot exploration',
    ),
    true,
  );
  assert.equal((hasMeaningfulEnglish as (input: string) => boolean)('[基础信息]\n商品名: USB 充电线\n价格: USD 39'), false);
  assert.equal((hasMeaningfulEnglish as (input: string) => boolean)('[基础信息]\n副标题: 专为阴蒂刺激设计的可充电玩具'), false);
});
