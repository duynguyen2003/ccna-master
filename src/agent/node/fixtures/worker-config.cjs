const { runtimeConfig } = require('../workerConfig');
module.exports = () => {
  const config = runtimeConfig();
  config.enabled = true;
  config.ownerSecret = process.env.AI_OWNER_SECRET;
  const base = config.providers['local-fake-v1'];
  config.providers['synthetic-paid'] = {
    ...base,
    provider: 'synthetic',
    responseMode: 'LLM',
    versions: {
      contextSchemaVersion: '1.0.0',
      diagnosticVersion: base.versions.diagnosticVersion,
      promptVersion: 'synthetic',
      modelVersion: 'synthetic',
      priceVersion: 'synthetic',
    },
    caps: { maxInputTokens: 10, maxOutputTokens: 10, maxReasoningTokens: 0 },
    prices: { input: 1000000, output: 1000000, reasoning: 0 },
    // This provider exists only in isolated accounting/fault tests.
    measureInput: () => 1,
  };
  return config;
};
