const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtimeConfig } = require('./workerConfig');
const { costOf } = require('./settlement');
test('worker has no implicit live provider or application database activation', () => {
  assert.equal(runtimeConfig({}).enabled, false);
  const env = { AI_WORKER_MODE: 'fake', DATABASE_URL: 'postgresql://127.0.0.1:55432/ai_lab_local' };
  assert.equal(runtimeConfig(env).enabled, true);
  assert.equal(runtimeConfig({ ...env, NODE_ENV: 'production' }).enabled, false);
  assert.equal(
    runtimeConfig({ ...env, DATABASE_URL: 'postgresql://example.invalid/ai_lab_local' }).enabled,
    false
  );
  assert.equal(
    runtimeConfig({ ...env, DATABASE_URL: 'postgresql://127.0.0.1/app' }).enabled,
    false
  );
  assert.equal(runtimeConfig({ ...env, AI_WORKER_MODE: 'gemini' }).enabled, false);
});
test('trusted prices use integer micro-USD with conservative rounding; unknown is never zero', () => {
  const provider = { prices: { input: 1, output: 2, reasoning: 3 } };
  assert.equal(
    costOf(provider, { status: 'FINAL', inputTokens: 1, outputTokens: 0, reasoningTokens: 0 }),
    1n
  );
  assert.equal(
    costOf(provider, {
      status: 'FINAL',
      inputTokens: 1000000,
      outputTokens: 1000000,
      reasoningTokens: 1000000,
    }),
    6n
  );
  assert.equal(
    costOf(provider, {
      status: 'UNRESOLVED',
      inputTokens: null,
      outputTokens: null,
      reasoningTokens: null,
    }),
    null
  );
  assert.throws(
    () =>
      costOf(
        { prices: {} },
        { status: 'FINAL', inputTokens: 1, outputTokens: 0, reasoningTokens: 0 }
      ),
    { code: 'AI_DISABLED' }
  );
});
