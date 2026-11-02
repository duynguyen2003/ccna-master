const { verifyOutput } = require('./outputVerifier');
const { VERSION: diagnosticVersion } = require('./diagnostics/catalog');
const localBudget = require('./localGeminiBudget');
function runtimeConfig(env = process.env) {
  let local = false;
  let appGemini = false;
  try {
    const url = new URL(env.DATABASE_URL);
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
      env.NODE_ENV !== 'production' &&
      Boolean(env.GEMINI_API_KEY?.trim()) &&
      (!env.GEMINI_MODEL || env.GEMINI_MODEL === localBudget.policy.model) &&
      ((env.AI_WORKER_MODE === 'python-gemini' && local) || appGemini),
    auth: {
      secret: env.AI_SERVICE_SECRET,
      issuer: 'ccna-node',
      subject: 'ai-python',
      keyId: 'local-v1',
    },
    providers: {
      'local-gemini-v1': {
        provider: 'gemini',
        dispatchEnabled:
          env.NODE_ENV !== 'production' &&
          Boolean(env.GEMINI_API_KEY?.trim()) &&
          (!env.GEMINI_MODEL || env.GEMINI_MODEL === localBudget.policy.model) &&
          ((env.AI_WORKER_MODE === 'python-gemini' && local) || appGemini),
        responseMode: 'LLM',
        inputBudgetOwner: 'python-preflight',
        executionWindowMs: 55000,
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
    },
  };
}
module.exports = { runtimeConfig };
