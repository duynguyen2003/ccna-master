const { explainWithGemini } = require('./localGemini');

const deterministicExplanation = (feedback) =>
  feedback.checks
    .filter((c) => !c.passed)
    .map((c) => `${c.message}${c.hint ? ` Gợi ý: ${c.hint}` : ''}`)
    .join('\n') || 'Tất cả yêu cầu đã đạt.';
async function explainFeedback(feedback, config = process.env, fetcher = fetch, options = {}) {
  const fallback = { explanation: deterministicExplanation(feedback), provider: 'deterministic' };
  if (config.LAB_AI_MODE !== 'local-live') return fallback;
  try {
    return await explainWithGemini(feedback, config, fetcher, options);
  } catch (error) {
    const reason = /^[A-Z][A-Z0-9_]+$/.test(error.code || '') ? error.code : 'PROVIDER_UNAVAILABLE';
    return { ...fallback, unavailable: true, reason };
  }
}
module.exports = { explainFeedback, deterministicExplanation };
