const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pythonAnalyze } = require('./pythonTransport');
const budget = require('./localGeminiBudget');
const { runtimeConfig } = require('./workerConfig');
const inputFixture = require('../contracts/ai-lab/v1/examples/internal-analyze.json');

test('Python transport sends three scoped tokens, bounded body and no redirect/retry', async () => {
  const input = {
    ...structuredClone(inputFixture),
    deadlineAt: new Date(Date.now() + 10000).toISOString(),
  };
  let calls = 0;
  const analyze = pythonAnalyze(
    'http://127.0.0.1:8001/internal/v1/lab-assistant/analyze',
    async (url, options) => {
      calls++;
      assert.equal(url.hostname, '127.0.0.1');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, 'Bearer analyze');
      assert.equal(options.headers['X-AI-Claim-Token'], 'claim');
      assert.equal(options.headers['X-AI-Receipt-Token'], 'receipt');
      assert.deepEqual(JSON.parse(options.body), input);
      return new Response(
        JSON.stringify({
          contractVersion: '1.0.0',
          callId: input.callId,
          contextHash: input.contextHash,
          receiptHash: 'a'.repeat(64),
        }),
        { headers: { 'x-ai-contract-version': '1.0.0' } }
      );
    }
  );
  await analyze(input, { analyzeToken: 'analyze', claimToken: 'claim', receiptToken: 'receipt' });
  assert.equal(calls, 1);
});

test('Python transport refuses remote or injected endpoints and expired work', async () => {
  for (const url of [
    'http://example.invalid:8001/internal/v1/lab-assistant/analyze',
    'http://user:password@127.0.0.1:8001/internal/v1/lab-assistant/analyze',
    'http://127.0.0.1:8001/other',
    'http://127.0.0.1:8001/internal/v1/lab-assistant/analyze?endpoint=other',
  ])
    assert.throws(() => pythonAnalyze(url));
  let calls = 0;
  const send = pythonAnalyze('http://127.0.0.1:8001/internal/v1/lab-assistant/analyze', () => {
    calls++;
    throw new Error('network');
  });
  await assert.rejects(
    send({ ...inputFixture, deadlineAt: new Date(0).toISOString() }, { analyzeToken: 'x' })
  );
  assert.equal(calls, 0);
  await assert.rejects(
    send(
      { ...inputFixture, deadlineAt: new Date(Date.now() - 1000).toISOString() },
      { analyzeToken: 'x' }
    )
  );
  assert.equal(calls, 0);
  await assert.rejects(
    send(
      { ...inputFixture, deadlineAt: new Date(Date.now() + 10000).toISOString() },
      { analyzeToken: 'x' }
    )
  );
  assert.equal(calls, 1);
});

test('Gemini is dispatched only by explicit local Python worker mode', () => {
  const common = {
    DATABASE_URL: 'postgresql://user:unused@127.0.0.1:55432/ai_lab_local',
    GEMINI_API_KEY: 'synthetic-key',
  };
  assert.equal(runtimeConfig({ ...common, AI_WORKER_MODE: 'python-gemini' }).enabled, true);
  assert.equal(
    runtimeConfig({ ...common, AI_WORKER_MODE: 'python-gemini', NODE_ENV: 'production' }).enabled,
    false
  );
  assert.equal(
    runtimeConfig({ ...common, AI_WORKER_MODE: 'fake' }).providers['local-gemini-v1']
      .dispatchEnabled,
    false
  );
  assert.equal(
    runtimeConfig({
      ...common,
      AI_WORKER_MODE: 'python-gemini',
      DATABASE_URL: 'postgresql://user:unused@remote.invalid/app',
    }).enabled,
    false
  );
});

test('R1 ledger shares lifetime commitments, rejects duplicate call and keeps unknown usage', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ccna-py02-budget-'));
  const file = path.join(directory, 'budget.json');
  try {
    budget.initializeBudget(file);
    const binding = { callId: inputFixture.callId, requestId: inputFixture.requestId };
    budget.reserve(file, Date.now(), binding);
    assert.throws(() => budget.reserve(file, Date.now() + 61000, binding));
    const receipt = {
      ...binding,
      outcome: 'OUTCOME_UNKNOWN',
      finishReason: 'PROVIDER_TIMEOUT_OR_NETWORK',
      usage: { status: 'UNRESOLVED', inputTokens: null, outputTokens: null, reasoningTokens: null },
    };
    budget.recordReceipt(receipt, file);
    assert.equal(budget.readBudget(file).calls[0].status, 'UNKNOWN');
    assert.equal(budget.readBudget(file).calls[0].usage, null);
    budget.recordReceipt(
      {
        ...receipt,
        outcome: 'RECEIVED',
        finishReason: 'STOP',
        usage: { status: 'FINAL', inputTokens: 120, outputTokens: 30, reasoningTokens: 10 },
      },
      file
    );
    budget.recordReceipt(
      {
        ...receipt,
        outcome: 'RECEIVED',
        finishReason: 'STOP',
        usage: { status: 'FINAL', inputTokens: 120, outputTokens: 30, reasoningTokens: 10 },
      },
      file
    );
    const ledger = budget.readBudget(file);
    assert.equal(ledger.calls.length, 1);
    assert.equal(ledger.calls[0].reservedMicroUsd, budget.reserveMicroUsd);
    assert.equal(ledger.calls[0].usage.estimatedMicroUsd, 136);
    budget.recordReceipt(
      {
        ...receipt,
        outcome: 'KNOWN_FAILURE',
        finishReason: 'STOP',
        usage: { status: 'FINAL', inputTokens: 120, outputTokens: 801, reasoningTokens: 0 },
      },
      file
    );
    assert.equal(budget.readBudget(file).circuitOpen, true);
    assert.throws(() => budget.reserve(file, Date.now() + 61000));
  } finally {
    fs.unlinkSync(file);
    fs.rmdirSync(directory);
  }
});
