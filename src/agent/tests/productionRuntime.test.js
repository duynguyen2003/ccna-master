const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtimeConfig } = require('../node/workerConfig');
const { pythonEnvironment } = require('../scripts/start-python.cjs');
const { inAiCohort } = require('../node/eligibility');
const { productionPlan } = require('../node/productionPolicy');
const { productionSettings } = require('../scripts/start-production-ai.cjs');
const { parseArgs } = require('../scripts/production-policy.cjs');

function environment() {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://synthetic:unused@database.invalid/app',
    AI_ENVIRONMENT: 'production',
    AI_WORKER_MODE: 'production-gemini',
    AI_PRODUCTION_ENABLED: 'true',
    AI_RELEASE_SHA: 'a'.repeat(40),
    AI_RECOVERY_EPOCH: 'production_epoch_1',
    AI_SERVICE_SECRET: 's'.repeat(40),
    AI_OWNER_SECRET: 'o'.repeat(40),
    JWT_SECRET: 'j'.repeat(40),
    GEMINI_API_KEY: 'synthetic-provider-key',
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
    LAB_AI_MODE: 'deterministic',
    AI_INTERNAL_URL: 'http://127.0.0.1:5000/internal/v1/ai',
    AI_ANALYZE_URL: 'http://127.0.0.1:8001/internal/v1/lab-assistant/analyze',
  };
}

test('production is opt-in, release-bound and uses durable DB budget instead of the local ledger', () => {
  const config = runtimeConfig(environment());
  assert.equal(config.enabled, true);
  assert.equal(config.providers['local-gemini-v1'].dispatchEnabled, false);
  const provider = config.providers['gemini-production-v1'];
  assert.equal(provider.dispatchEnabled, true);
  assert.equal(provider.localLedgerFile, undefined);
  assert.equal(provider.versions.appCommit, 'a'.repeat(40));
  assert.equal(config.auth.keyId, 'production-v1');
  assert.deepEqual(provider.caps, {
    maxInputTokens: 6000,
    maxOutputTokens: 800,
    maxReasoningTokens: 800,
  });
  assert.equal(provider.executionWindowMs, 55000);
});

test('production refuses incomplete activation and legacy/ambiguous credentials', () => {
  for (const change of [
    { NODE_ENV: 'development' },
    { AI_PRODUCTION_ENABLED: undefined },
    { AI_ENVIRONMENT: 'admin-test' },
    { AI_WORKER_MODE: 'app-gemini' },
    { GEMINI_API_KEY: '' },
    { GEMINI_MODEL: 'unreviewed-model' },
    { DATABASE_URL: 'https://database.invalid/app' },
    { AI_SERVICE_SECRET: 'short' },
    { AI_SERVICE_SECRET: 'o'.repeat(40) },
    { AI_OWNER_SECRET: 'j'.repeat(40) },
    { AI_RELEASE_SHA: '' },
    { RENDER_GIT_COMMIT: 'b'.repeat(40) },
    { AI_RECOVERY_EPOCH: 'invalid epoch' },
    { LAB_AI_MODE: 'gemini' },
  ]) {
    const config = runtimeConfig({ ...environment(), ...change });
    assert.equal(config.enabled, false, JSON.stringify(Object.keys(change)));
    assert.equal(config.providers['gemini-production-v1'].dispatchEnabled, false);
  }
});

test('disabling production dispatch preserves identity for late signed receipts', () => {
  const config = runtimeConfig({ ...environment(), AI_PRODUCTION_ENABLED: 'false' });
  assert.equal(config.enabled, false);
  assert.equal(config.auth.keyId, 'production-v1');
});

test('Python receives production identity and only required service/provider credentials', () => {
  const values = pythonEnvironment(environment());
  assert.equal(values.AI_PYTHON_ENVIRONMENT, 'production');
  assert.equal(values.AI_PYTHON_KEY_ID, 'production-v1');
  assert.equal(values.AI_PYTHON_HOST, '127.0.0.1');
  assert.equal(values.AI_PYTHON_CALLBACK_TIMEOUT_MS, '5000');
  assert.equal(values.DATABASE_URL, undefined);
  assert.equal(values.JWT_SECRET, undefined);
  assert.equal(values.AI_OWNER_SECRET, undefined);
  assert.equal(values.GEMINI_API_KEY, 'synthetic-provider-key');
});

test('student rollout remains scoped to selected labs and current DB role', () => {
  const policy = { eligibilityRules: { studentAccess: true, labIds: [4], disabledLabIds: [5] } };
  assert.equal(inAiCohort(policy, { id: 7, role: 'STUDENT' }, 4), true);
  assert.equal(inAiCohort(policy, { id: 7, role: 'STUDENT' }, 5), false);
  assert.equal(inAiCohort(policy, { id: 7, role: 'STUDENT' }, 6), false);
  assert.equal(inAiCohort(policy, { id: 7, role: 'ADMIN' }, 4), false);
  assert.equal(inAiCohort(policy, { id: 7, role: 'USER' }, 4), false);
  policy.eligibilityRules.disabledLabIds = [4];
  assert.equal(inAiCohort(policy, { id: 7, role: 'STUDENT' }, 4), false);
  policy.eligibilityRules = { studentAccess: true };
  assert.equal(inAiCohort(policy, { id: 7, role: 'STUDENT' }, 4), false);
});

test('rollout requires explicit published lab selection and sustainable per-call budget', () => {
  const proposal = {
    actorId: 1,
    studentAccess: true,
    labIds: [4],
    userIds: [],
    limits: {
      userMinute: 2,
      userDay: 20,
      globalDayMicros: 50000,
      globalMonthMicros: 100000,
      globalConcurrency: 1,
    },
  };
  const plan = productionPlan(environment(), proposal);
  assert.equal(plan.providerConfigId, 'gemini-production-v1');
  assert.equal(plan.eligibilityRules.adminAccess, false);
  assert.equal(plan.limits.maxCostMicros, 5800);
  assert.equal(plan.limits.versions.appCommit, 'a'.repeat(40));
  for (const change of [
    { labIds: [] },
    { labIds: [4, 4] },
    { actorId: 0 },
    { studentAccess: false },
    { unexpected: true },
    { limits: { ...proposal.limits, globalDayMicros: 1 } },
    { limits: { ...proposal.limits, globalConcurrency: 9 } },
  ])
    assert.throws(() => productionPlan(environment(), { ...proposal, ...change }));
});

test('production launcher binds to the host port and keeps internal services on loopback', () => {
  const settings = productionSettings({ ...environment(), PORT: '5000' }, '/app');
  assert.equal(settings.backendUrl.toString(), 'http://127.0.0.1:5000/api/health/ready');
  assert.equal(settings.pythonUrl.toString(), 'http://127.0.0.1:8001/health/ready');
  assert.equal(settings.sweeper, false);
  assert.equal(settings.env.AI_INLINE_SWEEPER, 'true');
  assert.deepEqual(settings.pythonProcess.args, ['-m', 'app']);
  assert.equal(settings.pythonProcess.env.DATABASE_URL, undefined);
  assert.equal(settings.pythonProcess.env.AI_OWNER_SECRET, undefined);
  assert.throws(() => productionSettings({ ...environment(), PORT: '9999' }, '/app'));
  assert.throws(() => productionSettings({ ...environment(), AI_PRODUCTION_ENABLED: '' }, '/app'));
  assert.throws(() => productionSettings({ ...environment(), PORT: '0' }, '/app'));
});

test('policy CLI stays read-only without apply and rejects ambiguous actions', () => {
  assert.equal(parseArgs([]).apply, false);
  assert.equal(parseArgs(['--config', 'reviewed.json']).apply, false);
  assert.deepEqual(parseArgs(['--disable', '--actor', '1', '--apply']), {
    apply: true,
    disable: true,
    actorId: 1,
    config: null,
  });
  for (const args of [
    ['--apply'],
    ['--disable'],
    ['--status', '--apply'],
    ['--config', 'reviewed.json', '--apply', '--apply'],
    ['--actor', '1'],
  ])
    assert.throws(() => parseArgs(args));
});
