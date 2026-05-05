import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldReuseCurrentInteractivePage } from './runtime.ts';

test('shouldReuseCurrentInteractivePage returns true for the same category url in interactive mode', () => {
  assert.equal(
    shouldReuseCurrentInteractivePage(
      true,
      'https://www.lovehoney.co.uk/\x73ex-toys/\x73ex-toys-for-women/',
      'https://www.lovehoney.co.uk/\x73ex-toys/\x73ex-toys-for-women/',
    ),
    true,
  );
});

test('shouldReuseCurrentInteractivePage returns false when interactive mode is off or urls differ', () => {
  assert.equal(
    shouldReuseCurrentInteractivePage(
      false,
      'https://www.lovehoney.co.uk/\x73ex-toys/\x73ex-toys-for-women/',
      'https://www.lovehoney.co.uk/\x73ex-toys/\x73ex-toys-for-women/',
    ),
    false,
  );
  assert.equal(
    shouldReuseCurrentInteractivePage(
      true,
      'https://www.lovehoney.co.uk/\x73ex-toys/\x73ex-toys-for-women/',
      'https://www.lovehoney.co.uk/\x73ex-toys/male-\x73ex-toys/',
    ),
    false,
  );
});
