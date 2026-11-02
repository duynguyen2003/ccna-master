// Synthetic provider for context/accounting tests only.
const { verifyOutput } = require('../../node/outputVerifier');
const { VERSION: diagnosticVersion } = require('../../node/diagnostics/catalog');
const fakeInputTokens = (value) =>
  (JSON.stringify(value).match(/[A-Za-z0-9_]+|[^\s]/gu) || []).length;
module.exports = {
  provider: {
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
};
