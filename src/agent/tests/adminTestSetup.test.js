const { test } = require('node:test');
const assert = require('node:assert/strict');
const { patchEnv, adminProvider } = require('../scripts/enable-admin-test.cjs');
const { pythonEnvironment } = require('../scripts/start-python.cjs');

test('admin setup preserves unrelated dotenv values and is idempotent with LF or CRLF', () => {
  for (const eol of ['\n', '\r\n']) {
    const source = [
      '# existing config',
      'DATABASE_URL="postgres://example.invalid/db"',
      'AI_WORKER_MODE=off # old',
      'OTHER="a=b"',
      'export AI_WORKER_MODE=off',
      '',
    ].join(eol);
    const values = { AI_WORKER_MODE: 'app-gemini', AI_OWNER_SECRET: 'synthetic' };
    const output = patchEnv(source, values);
    assert.equal(patchEnv(output, values), output);
    assert.ok(output.includes(`DATABASE_URL="postgres://example.invalid/db"${eol}`));
    assert.ok(output.includes(`OTHER="a=b"${eol}`));
    assert.ok(output.includes('# existing config'));
    assert.doesNotMatch(output, /AI_WORKER_MODE=off/);
    assert.equal(output.match(/AI_WORKER_MODE="app-gemini"/g).length, 2);
    assert.ok(output.endsWith(`AI_OWNER_SECRET="synthetic"${eol}`));
    if (eol === '\r\n') assert.doesNotMatch(output, /(?<!\r)\n/);
  }
});

test('Admin setup always selects Gemini and reserves conservative costs', () => {
  const env = {
    DATABASE_URL: 'postgresql://example.invalid/app',
    GEMINI_API_KEY: 'synthetic-key',
  };
  const live = adminProvider(env, true);
  assert.equal(live.id, 'local-gemini-v1');
  assert.equal(live.limits.maxCostMicros, 5800);
  assert.equal(live.limits.globalDayMicros, 50000);
  assert.equal(live.limits.globalMonthMicros, 100000);
  assert.equal(live.limits.globalConcurrency, 1);
  assert.equal(live.limits.userMinute, 2);
  assert.equal(live.limits.userDay, 20);
  assert.equal(adminProvider(env).limits.maxCostMicros, 5800);
  for (const change of [
    { GEMINI_API_KEY: '' },
    { NODE_ENV: 'production' },
    { GEMINI_MODEL: 'unreviewed-model' },
  ])
    assert.throws(() => adminProvider({ ...env, ...change }, true));
});

test('Python launcher forwards Gemini/service credentials only and refuses remote callbacks', () => {
  const env = {
    AI_WORKER_MODE: 'app-gemini',
    AI_ENVIRONMENT: 'admin-test',
    DATABASE_URL: 'postgresql://example.invalid/app',
    AI_SERVICE_SECRET: 'synthetic-service-secret-at-least-32-characters',
    GEMINI_API_KEY: 'synthetic-provider-key',
    JWT_SECRET: 'must-not-forward',
    AI_OWNER_SECRET: 'must-not-forward',
    CLOUDINARY_API_SECRET: 'must-not-forward',
    PATH: 'synthetic-path',
    AI_PYTHON_MODE: 'fake',
    AI_PYTHON_LIVE_ENABLED: 'false',
  };
  const child = pythonEnvironment(env);
  assert.equal(child.AI_PYTHON_MODE, 'gemini');
  assert.equal(child.AI_PYTHON_LIVE_ENABLED, 'true');
  assert.equal(child.AI_PYTHON_MAX_REQUEST_MS, '55000');
  assert.equal(child.AI_PYTHON_TRACE_TIMINGS, 'false');
  assert.equal(
    pythonEnvironment({ ...env, AI_TRACE_TIMINGS: 'true' }).AI_PYTHON_TRACE_TIMINGS,
    'true'
  );
  assert.equal(child.GEMINI_API_KEY, env.GEMINI_API_KEY);
  assert.equal(child.AI_SERVICE_SECRET, env.AI_SERVICE_SECRET);
  for (const key of ['DATABASE_URL', 'JWT_SECRET', 'AI_OWNER_SECRET', 'CLOUDINARY_API_SECRET'])
    assert.equal(child[key], undefined);
  assert.throws(() =>
    pythonEnvironment({ ...env, AI_INTERNAL_URL: 'http://example.invalid:5500/internal/v1/ai' })
  );
  assert.throws(() =>
    pythonEnvironment({
      ...env,
      AI_ANALYZE_URL: 'http://127.0.0.1:8001/internal/v1/lab-assistant/analyze?key=secret',
    })
  );
  assert.throws(() => pythonEnvironment({ ...env, NODE_ENV: 'production' }));
  for (const mode of ['fake', 'python-fake', 'app-fake', 'off', 'unknown']) {
    assert.throws(() => pythonEnvironment({ ...env, AI_WORKER_MODE: mode }));
  }
  assert.throws(() => pythonEnvironment({ ...env, GEMINI_API_KEY: '' }));
  assert.throws(() => pythonEnvironment({ ...env, GEMINI_API_KEY: ' ' }));
});
