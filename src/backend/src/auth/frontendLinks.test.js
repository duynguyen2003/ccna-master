const test = require('node:test');
const assert = require('node:assert/strict');
const { buildResetPasswordUrl } = require('./frontendLinks');

test('creates path links from current or legacy frontend base URLs', () => {
  for (const base of [
    'https://app.test',
    'https://app.test/',
    'https://app.test/#',
    'https://app.test/#/',
  ])
    assert.equal(
      buildResetPasswordUrl('synthetic-token', base),
      'https://app.test/reset-password/synthetic-token'
    );
  assert.equal(
    buildResetPasswordUrl('a/b?', 'https://app.test/ccna/#'),
    'https://app.test/ccna/reset-password/a%2Fb%3F'
  );
  assert.equal(buildResetPasswordUrl('test'), 'http://localhost:3000/reset-password/test');
});
