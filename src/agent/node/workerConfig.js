const { verifyOutput } = require('./outputVerifier');
const { fakeInputTokens } = require('./context');
const { VERSION: diagnosticVersion } = require('./diagnostics/catalog');
const localBudget = require('./localGeminiBudget');
function runtimeConfig(env = process.env) {
  let local = false;
  try {
    const url = new URL(env.DATABASE_URL);
    local =
      url.hostname === '127.0.0.1' &&
      /^\/ai_lab_(local|be01_(fresh|upgrade)_[a-f0-9]+)$/.test(url.pathname);
  } catch {
    /* No implicit database fallback for the worker. */
  }
  return {
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
    enabled:
      ['fake', 'python-fake', 'python-gemini'].includes(env.AI_WORKER_MODE) &&
      env.NODE_ENV !== 'production' &&
      local,
    auth: {
      secret: env.AI_SERVICE_SECRET,
      issuer: 'ccna-node',
      subject: 'ai-python',
      keyId: 'local-v1',
    },
    providers: {
      'local-gemini-v1': {
        provider: 'gemini',
        dispatchEnabled: env.AI_WORKER_MODE === 'python-gemini',
        responseMode: 'LLM',
        inputBudgetOwner: 'python-preflight',
        localLedgerFile: localBudget.ledgerFile,
        versions: {
          contextSchemaVersion: '1.0.0',
          diagnosticVersion,
          promptVersion: 'gemini-r1-v2',
          modelVersion: localBudget.policy.model,
          priceVersion: localBudget.policy.priceVersion,
        },
        // Each category is bounded by 800; the API caps their combined total
        // at 800. DB reserves the more conservative 800 + 800 maximum.
        caps: { maxInputTokens: 6000, maxOutputTokens: 800, maxReasoningTokens: 800 },
        prices: {
          input: localBudget.policy.inputMicroUsdPerMillionTokens,
          output: localBudget.policy.outputIncludingThinkingMicroUsdPerMillionTokens,
          reasoning: localBudget.policy.outputIncludingThinkingMicroUsdPerMillionTokens,
        },
        validateOutput: verifyOutput,
      },
      'local-fake-v1': {
        provider: 'fake',
        responseMode: 'DETERMINISTIC',
        versions: {
          contextSchemaVersion: '1.0.0',
          diagnosticVersion,
          promptVersion: 'fake-be04',
          modelVersion: 'fake-be04',
          priceVersion: 'fake-zero-v1',
        },
        caps: { maxInputTokens: 6000, maxOutputTokens: 800, maxReasoningTokens: 0 },
        prices: { input: 0, output: 0, reasoning: 0 },
        // Fake-only synthetic token budget, not a provider tokenizer.
        // PY-02 must count the full provider prompt/schema before a live call.
        measureInput: fakeInputTokens,
        validateOutput: verifyOutput,
      },
    },
  };
}
module.exports = { runtimeConfig };
