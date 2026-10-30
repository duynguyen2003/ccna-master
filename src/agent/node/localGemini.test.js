const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const budget = require('./localGeminiBudget');
const { explainFeedback } = require('./feedback');
const { buildRequest, usageFrom } = require('./localGemini');

const config = {
  NODE_ENV: 'development',
  LAB_AI_MODE: 'local-live',
  GEMINI_API_KEY: 'unit-test-only',
};
const feedback = {
  score: 0,
  checks: [{ passed: false, message: 'Missing return route', hint: 'Inspect routes' }],
};
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
const validBody = () => ({
  candidates: [
    {
      finishReason: 'STOP',
      content: {
        parts: [
          {
            text: JSON.stringify({
              explanation: 'Kiểm tra đường về và gateway trước khi thử ping lại.',
            }),
          },
        ],
      },
    },
  ],
  usageMetadata: {
    promptTokenCount: 200,
    candidatesTokenCount: 40,
    totalTokenCount: 248,
    thoughtsTokenCount: 8,
  },
});

function sandbox(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ccna-gemini-test-'));
  const file = path.join(directory, 'budget.json');
  budget.initializeBudget(file);
  t.after(() => {
    for (const name of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, name));
    fs.rmdirSync(directory);
  });
  return file;
}

test('live mode is explicit, legacy URL never dispatches, and production/test stay offline', async () => {
  for (const env of [
    {},
    { LAB_AI_URL: 'https://evil.invalid', LAB_AI_KEY: 'x', LAB_AI_MODEL: 'x' },
    { ...config, NODE_ENV: 'production' },
    { ...config, NODE_ENV: 'test' },
    { ...config, GEMINI_MODEL: 'other' },
    { ...config, GEMINI_API_KEY: '' },
  ]) {
    await assert.rejects(
      explainFeedback(feedback, env, () => assert.fail('must not fetch')),
      { status: 503, code: 'LOCAL_LIVE_DISABLED' }
    );
  }
});

test('projection excludes rubric/account/state and redacts embedded keys/email/password', () => {
  const secret = 'AQ.' + 'a'.repeat(40);
  const body = JSON.stringify(
    buildRequest({
      rubric: 'PRIVATE_RUBRIC',
      deviceState: 'PRIVATE_STATE',
      email: 'PRIVATE_ACCOUNT',
      checks: [
        {
          ...feedback.checks[0],
          expected: 'PRIVATE_ANSWER',
          message: `Route ${secret} learner@example.org password=PRIVATE_PASSWORD`,
        },
      ],
    })
  );
  for (const value of [
    'PRIVATE_RUBRIC',
    'PRIVATE_STATE',
    'PRIVATE_ACCOUNT',
    'PRIVATE_ANSWER',
    secret,
    'learner@example.org',
    'PRIVATE_PASSWORD',
  ])
    assert.ok(!body.includes(value), value);
  assert.equal(JSON.parse(body).generationConfig.maxOutputTokens, 800);
});

test('Gemini call counts full request, validates JSON, records usage including thinking, preserves grading', async (t) => {
  const file = sandbox(t);
  const before = structuredClone(feedback);
  const requests = [];
  const result = await explainFeedback(
    feedback,
    config,
    async (url, req) => {
      requests.push({ url, req });
      return response(url.endsWith(':countTokens') ? { totalTokens: 200 } : validBody());
    },
    { ledgerFile: file }
  );
  assert.equal(result.provider, 'gemini');
  assert.equal(result.model, budget.policy.model);
  assert.deepEqual(feedback, before);
  assert.equal(requests.length, 2);
  assert.equal(
    requests[0].url,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:countTokens'
  );
  for (const { req } of requests) {
    assert.equal(req.redirect, 'error');
    assert.equal(req.headers['x-goog-api-key'], config.GEMINI_API_KEY);
    assert.ok(!req.body.includes(config.GEMINI_API_KEY));
    assert.ok(req.signal instanceof AbortSignal);
  }
  assert.deepEqual(
    JSON.parse(requests[0].req.body).generateContentRequest.contents,
    JSON.parse(requests[1].req.body).contents
  );
  const call = budget.readBudget(file).calls[0];
  assert.equal(call.status, 'COMPLETE');
  assert.equal(call.usage.thinkingTokens, 8);
  assert.equal(call.usage.estimatedMicroUsd, 180);
  assert.equal(call.reservedMicroUsd, 3800);
});

test('oversized token preflight never generates and keeps a conservative commitment', async (t) => {
  const file = sandbox(t);
  let calls = 0;
  await assert.rejects(
    explainFeedback(
      feedback,
      config,
      async () => {
        calls++;
        return response({ totalTokens: 6001 });
      },
      { ledgerFile: file }
    ),
    { status: 503, code: 'INPUT_TOKEN_LIMIT' }
  );
  assert.equal(calls, 1);
  assert.equal(budget.readBudget(file).calls[0].reservedMicroUsd, 3800);
});

for (const scenario of ['429', 'network', 'timeout', 'invalid', 'truncated', 'no-usage']) {
  test(`provider ${scenario}: no generation retry or fabricated success/usage`, async (t) => {
    const file = sandbox(t);
    let calls = 0;
    const pending = explainFeedback(
      feedback,
      config,
      async (url) => {
        calls++;
        if (url.endsWith(':countTokens')) return response({ totalTokens: 200 });
        if (scenario === '429') return response({}, 429);
        if (scenario === 'network') throw new Error(config.GEMINI_API_KEY);
        if (scenario === 'timeout') throw new DOMException('Timeout', 'TimeoutError');
        const body = validBody();
        if (scenario === 'invalid') body.candidates[0].content.parts[0].text = '{broken';
        if (scenario === 'truncated') body.candidates[0].finishReason = 'MAX_TOKENS';
        if (scenario === 'no-usage') delete body.usageMetadata;
        return response(body);
      },
      { ledgerFile: file }
    );
    if (scenario === 'no-usage') {
      assert.equal((await pending).provider, 'gemini');
    } else {
      await assert.rejects(pending, (error) => {
        assert.equal(error.status, scenario === '429' ? 429 : 503);
        assert.ok(!error.message.includes(config.GEMINI_API_KEY));
        assert.equal(error.explanation, undefined);
        return true;
      });
    }
    assert.equal(calls, 2);
    assert.equal(budget.readBudget(file).calls[0].reservedMicroUsd, 3800);
    if (scenario === 'no-usage') assert.equal(budget.readBudget(file).calls[0].usage, null);
  });
}

test('overspending usage trips persistent circuit and stops subsequent requests', async (t) => {
  const file = sandbox(t);
  await assert.rejects(
    explainFeedback(
      feedback,
      config,
      async (url) => {
        if (url.endsWith(':countTokens')) return response({ totalTokens: 200 });
        const body = validBody();
        body.usageMetadata = {
          promptTokenCount: 200,
          candidatesTokenCount: 801,
          totalTokenCount: 1001,
        };
        return response(body);
      },
      { ledgerFile: file }
    ),
    { status: 503, code: 'USAGE_EXCEEDS_RESERVATION' }
  );
  assert.equal(budget.readBudget(file).circuitOpen, true);
  assert.throws(() => budget.reserve(file), { code: 'LOCAL_CIRCUIT_OPEN' });
});

test('budget survives readers/restarts, counts failures, enforces UTC day and 20-call lifetime cap', (t) => {
  const file = sandbox(t);
  const start = Date.UTC(2026, 9, 22);
  for (let i = 0; i < 13; i++) {
    const id = budget.reserve(file, start + i * 70000);
    budget.finish(id, { status: 'UNKNOWN', usage: null }, file);
    if (i === 0) assert.throws(() => budget.reserve(file, start + 7000), { code: 'LOCAL_BUSY' });
  }
  assert.throws(() => budget.reserve(file, start + 14 * 70000), { code: 'LOCAL_BUDGET_EXHAUSTED' });
  for (let i = 0; i < 7; i++) {
    const id = budget.reserve(file, start + 86400000 + i * 7000);
    budget.finish(id, { status: 'COMPLETE', usage: null }, file);
  }
  assert.equal(budget.readBudget(file).calls.length, 20);
  assert.throws(() => budget.reserve(file, start + 2 * 86400000), {
    code: 'LOCAL_BUDGET_EXHAUSTED',
  });
  assert.throws(() => budget.initializeBudget(file), { code: 'EEXIST' });
});

test('one pending call, rate limit, corrupt/missing ledger and existing locks fail closed', (t) => {
  const file = sandbox(t);
  const now = Date.now();
  const id = budget.reserve(file, now);
  assert.throws(() => budget.reserve(file, now + 100), { code: 'LOCAL_BUSY' });
  budget.finish(id, { status: 'COMPLETE' }, file);
  assert.throws(() => budget.reserve(file, now + 100), { code: 'LOCAL_RATE_LIMIT' });
  fs.writeFileSync(`${file}.lock`, '');
  assert.throws(() => budget.reserve(file, now + 7000), { code: 'EEXIST' });
  fs.unlinkSync(`${file}.lock`);
  fs.writeFileSync(file, '{"calls":[]}');
  assert.throws(() => budget.reserve(file, now + 7000), { code: 'LOCAL_BUDGET_INVALID' });
  fs.unlinkSync(file);
  assert.throws(() => budget.reserve(file), { code: 'ENOENT' });
});

test('two independent processes cannot both reserve one global local slot', async (t) => {
  const file = sandbox(t);
  const code = `try {require(${JSON.stringify(require.resolve('./localGeminiBudget'))}).reserve(process.argv[1]); console.log('RESERVED');} catch {console.log('BLOCKED');}`;
  const child = () =>
    new Promise((resolve, reject) => {
      const proc = spawn(process.execPath, ['-e', code, file], { windowsHide: true });
      let result = '';
      proc.stdout.on('data', (chunk) => {
        result += chunk;
      });
      proc.on('error', reject);
      proc.on('close', () => resolve(result.trim()));
    });
  assert.deepEqual((await Promise.all([child(), child()])).sort(), ['BLOCKED', 'RESERVED']);
  assert.equal(budget.readBudget(file).calls.length, 1);
});

test('unknown usage stays unknown and thinking absence requires an exact total', () => {
  assert.equal(usageFrom({}), null);
  assert.equal(
    usageFrom({
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, totalTokenCount: 9 },
    }),
    null
  );
  assert.equal(
    usageFrom({
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, totalTokenCount: 7 },
    }).thinkingTokens,
    0
  );
});
