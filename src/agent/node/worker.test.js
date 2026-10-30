const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtimeConfig } = require('./workerConfig');
const { costOf } = require('./settlement');
const { workerAnalyze } = require('../workers/aiWorker');
test('worker has no implicit live provider or application database activation', () => {
  assert.equal(runtimeConfig({}).enabled, false);
  const env = { AI_WORKER_MODE: 'fake', DATABASE_URL: 'postgresql://127.0.0.1:55432/ai_lab_local' };
  assert.equal(runtimeConfig(env).enabled, false);
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

test('removed fake modes are always disabled and expose no fake provider', () => {
  for (const mode of ['fake', 'python-fake', 'app-fake', 'off', 'unknown']) {
    for (const database of [
      'postgresql://127.0.0.1:55432/ai_lab_local',
      'postgresql://example.invalid/app',
    ]) {
      const config = runtimeConfig({
        DATABASE_URL: database,
        AI_WORKER_MODE: mode,
        AI_ENVIRONMENT: 'admin-test',
        GEMINI_API_KEY: 'synthetic-key',
      });
      assert.equal(config.enabled, false);
      assert.equal(config.providers['local-fake-v1'], undefined);
      assert.equal(config.providers['local-gemini-v1'].dispatchEnabled, false);
    }
  }
});

test('local Gemini requires a server key and a valid PostgreSQL URL/model', () => {
  const env = {
    AI_WORKER_MODE: 'python-gemini',
    DATABASE_URL: 'postgresql://127.0.0.1:55432/ai_lab_local',
    GEMINI_API_KEY: 'synthetic-key',
  };
  assert.equal(runtimeConfig(env).enabled, true);
  for (const change of [
    { GEMINI_API_KEY: '' },
    { GEMINI_API_KEY: ' ' },
    { GEMINI_MODEL: 'other' },
    { DATABASE_URL: 'http://127.0.0.1/ai_lab_local' },
  ]) {
    assert.equal(runtimeConfig({ ...env, ...change }).enabled, false);
    assert.equal(
      runtimeConfig({ ...env, ...change }).providers['local-gemini-v1'].dispatchEnabled,
      false
    );
  }
});

test('application Gemini requires explicit admin-test, a server key and the pinned model', () => {
  const env = {
    DATABASE_URL: 'postgresql://example.invalid/app',
    AI_WORKER_MODE: 'app-gemini',
    AI_ENVIRONMENT: 'admin-test',
    GEMINI_API_KEY: 'synthetic-server-key',
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
  };
  assert.equal(runtimeConfig(env).enabled, true);
  assert.equal(runtimeConfig(env).providers['local-gemini-v1'].dispatchEnabled, true);
  assert.equal(runtimeConfig(env).providers['local-gemini-v1'].executionWindowMs, 55000);
  for (const change of [
    { AI_ENVIRONMENT: 'local' },
    { AI_ENVIRONMENT: 'production' },
    { NODE_ENV: 'production' },
    { GEMINI_API_KEY: '' },
    { GEMINI_API_KEY: ' ' },
    { GEMINI_MODEL: 'unreviewed-model' },
    { DATABASE_URL: 'http://example.invalid/app' },
  ]) {
    const config = runtimeConfig({ ...env, ...change });
    assert.equal(config.enabled, false);
    assert.equal(config.providers['local-gemini-v1'].dispatchEnabled, false);
  }
});

test('Gemini uses Python transport and every removed mode rejects without transport calls', () => {
  const chosen = [];
  const adapters = {
    pythonAnalyze: (url) => {
      chosen.push(url);
      return 'python';
    },
  };
  for (const mode of ['app-gemini', 'python-gemini'])
    assert.equal(workerAnalyze({ AI_WORKER_MODE: mode }, adapters), 'python');
  assert.equal(chosen.length, 2);
  assert.match(chosen[0], /^http:\/\/127\.0\.0\.1:8001\//);
  for (const mode of ['fake', 'python-fake', 'app-fake', 'off', undefined, 'unknown'])
    assert.throws(() => workerAnalyze({ AI_WORKER_MODE: mode }, adapters), /AI_DISABLED/);
  assert.equal(chosen.length, 2);
});
