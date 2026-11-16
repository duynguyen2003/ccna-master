const { VERSION: diagnosticVersion } = require('./diagnostics/catalog');
const localBudget = require('./localGeminiBudget');
function runtimeConfig(env = process.env) {
  let local = false;
  let appGemini = false;
  let postgres = false;
  try {
    const url = new URL(env.DATABASE_URL);
    postgres =
      ['postgres:', 'postgresql:'].includes(url.protocol) &&
      Boolean(url.hostname) &&
      url.pathname.length > 1;
    local =
      ['postgres:', 'postgresql:'].includes(url.protocol) &&
      url.hostname === '127.0.0.1' &&
      /^\/ai_lab_(local|be01_(fresh|upgrade)_[a-f0-9]+)$/.test(url.pathname);
    appGemini =
      ['postgres:', 'postgresql:'].includes(url.protocol) &&
      env.AI_WORKER_MODE === 'app-gemini' &&
      env.AI_ENVIRONMENT === 'admin-test' &&
      Boolean(env.GEMINI_API_KEY?.trim()) &&
      (!env.GEMINI_MODEL || env.GEMINI_MODEL === localBudget.policy.model);
  } catch {
    /* No implicit database fallback for the worker. */
  }
  const release = env.RENDER_GIT_COMMIT || env.AI_RELEASE_SHA || '';
  const secret = (value) => typeof value === 'string' && value.length >= 32 && !/\s/.test(value);
  const production =
    postgres &&
    env.NODE_ENV === 'production' &&
    env.AI_ENVIRONMENT === 'production' &&
    env.AI_WORKER_MODE === 'production-gemini' &&
    env.AI_PRODUCTION_ENABLED === 'true' &&
    Boolean(env.GEMINI_API_KEY?.trim()) &&
    env.GEMINI_MODEL === localBudget.policy.model &&
    secret(env.AI_SERVICE_SECRET) &&
    secret(env.AI_OWNER_SECRET) &&
    secret(env.JWT_SECRET) &&
    env.AI_SERVICE_SECRET !== env.AI_OWNER_SECRET &&
    env.AI_SERVICE_SECRET !== env.JWT_SECRET &&
    env.AI_OWNER_SECRET !== env.JWT_SECRET &&
    /^[a-f0-9]{40}$/.test(release) &&
    (!env.AI_RELEASE_SHA ||
      !env.RENDER_GIT_COMMIT ||
      env.AI_RELEASE_SHA === env.RENDER_GIT_COMMIT) &&
    /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(env.AI_RECOVERY_EPOCH || '') &&
    ['off', 'deterministic'].includes(env.LAB_AI_MODE);
  const localEnabled =
    env.NODE_ENV !== 'production' &&
    Boolean(env.GEMINI_API_KEY?.trim()) &&
    (!env.GEMINI_MODEL || env.GEMINI_MODEL === localBudget.policy.model) &&
    ((env.AI_WORKER_MODE === 'python-gemini' && local) || appGemini);
  const provider = {
    provider: 'gemini',
    responseMode: 'LLM',
    inputBudgetOwner: 'python-preflight',
    executionWindowMs: 55000,
    versions: {
      contextSchemaVersion: '1.0.0',
      diagnosticVersion,
      promptVersion: 'gemini-r1-v3',
      modelVersion: localBudget.policy.model,
      priceVersion: localBudget.policy.priceVersion,
    },
    caps: { maxInputTokens: 6000, maxOutputTokens: 800, maxReasoningTokens: 800 },
    prices: {
      input: localBudget.policy.inputMicroUsdPerMillionTokens,
      output: localBudget.policy.outputIncludingThinkingMicroUsdPerMillionTokens,
      reasoning: localBudget.policy.outputIncludingThinkingMicroUsdPerMillionTokens,
    },
    // Launchers only read configuration; load the validator when a receipt needs it.
    validateOutput: (...args) => require('./outputVerifier').verifyOutput(...args),
  };
  return {
    streamEnabled: env.AI_STATUS_STREAM_ENABLED === 'true',
    timingsEnabled: env.AI_TIMINGS_ENABLED === 'true',
    environment: env.AI_ENVIRONMENT || 'local',
    recoveryEpoch: env.AI_RECOVERY_EPOCH,
    redactionValues: [
      'AI_SERVICE_SECRET',
      'AI_OWNER_SECRET',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'GEMINI_API_KEY',
      'DATABASE_URL',
    ]
      .map((key) => env[key])
      .filter(Boolean),
    enabled: localEnabled || production,
    auth: {
      secret: env.AI_SERVICE_SECRET,
      issuer: 'ccna-node',
      subject: 'ai-python',
      keyId: env.AI_ENVIRONMENT === 'production' ? 'production-v1' : 'local-v1',
    },
    providers: {
      'local-gemini-v1': {
        ...provider,
        dispatchEnabled: localEnabled,
        localLedgerFile: localBudget.ledgerFile,
      },
      'gemini-production-v1': {
        ...provider,
        dispatchEnabled: production,
        // Production uses the shared DB reservations, never the local test ledger.
        versions: { ...provider.versions, appCommit: release },
      },
    },
  };
}
module.exports = { runtimeConfig };
