import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLovehoneyCookies } from './cookies.ts';

test('buildLovehoneyCookies expands a cookie header into both Lovehoney domains', () => {
  const cookies = buildLovehoneyCookies('foo=bar; token=abc123; foo=bar', [
    '.lovehoney.co.uk',
    'www.lovehoney.co.uk',
  ]);

  assert.equal(cookies.length, 4);
  assert.deepEqual(
    cookies.map((cookie) => ({ name: cookie.name, value: cookie.value, domain: cookie.domain, path: cookie.path })),
    [
      { name: 'foo', value: 'bar', domain: '.lovehoney.co.uk', path: '/' },
      { name: 'token', value: 'abc123', domain: '.lovehoney.co.uk', path: '/' },
      { name: 'foo', value: 'bar', domain: 'www.lovehoney.co.uk', path: '/' },
      { name: 'token', value: 'abc123', domain: 'www.lovehoney.co.uk', path: '/' },
    ],
  );
});
