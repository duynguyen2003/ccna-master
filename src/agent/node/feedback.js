const { explainWithGemini } = require('./localGemini');

async function explainFeedback(feedback, config = process.env, fetcher = fetch, options = {}) {
  try {
    return await explainWithGemini(feedback, config, fetcher, options);
  } catch (error) {
    const code = /^[A-Z][A-Z0-9_]+$/.test(error.code || '') ? error.code : 'PROVIDER_UNAVAILABLE';
    const exhausted = code === 'LOCAL_BUDGET_EXHAUSTED';
    const limited = ['LOCAL_RATE_LIMIT', 'LOCAL_BUSY', 'GEMINI_HTTP_429'].includes(code);
    throw Object.assign(new Error('Trợ lý AI chưa khả dụng. Hãy thử lại sau.'), {
      status: exhausted || limited ? 429 : 503,
      code: exhausted ? 'AI_QUOTA_EXHAUSTED' : limited ? 'AI_USER_RATE_LIMITED' : code,
      ...(limited ? { retryAfterSeconds: 60 } : {}),
    });
  }
}
module.exports = { explainFeedback };
