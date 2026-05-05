import test from 'node:test';
import assert from 'node:assert/strict';
import { isRompBrandLikeText } from './brand-rules.ts';

test('isRompBrandLikeText accepts ROMP brand aliases', () => {
  assert.equal(isRompBrandLikeText('ROMP德国绒谱Pulse女生性玩具'), true);
  assert.equal(isRompBrandLikeText('绒谱普\u6210\u4eba女性自慰\u60c5\u8da3兔耳朵'), true);
  assert.equal(isRompBrandLikeText('绒镨\u6210\u4eba女生玩具'), true);
});

test('isRompBrandLikeText rejects unrelated titles', () => {
  assert.equal(isRompBrandLikeText('会员充值 100 元 全店通用'), false);
  assert.equal(isRompBrandLikeText('We-Vibe 遥控穿戴跳蛋'), false);
});
