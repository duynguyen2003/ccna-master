const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { VERSION, schemas } = require('@ccna/shared/aiLabContract');
const { leases } = require('../node/leases');
const { dispatch } = require('../node/dispatch');
const { receipts } = require('../node/receipts');
const { serviceAuth } = require('../node/serviceAuth');
const { projectContext, contextPreparer } = require('../node/context');
const { diagnosticAnswer } = require('../node/diagnostics');

function createWorker(prisma, config, adapters) {
  const workerId = adapters.workerId || `worker_${randomUUID()}`;
  const queue = leases(prisma, config);
  const permits = dispatch(prisma, config);
  const results = receipts(prisma, config);
  const auth = serviceAuth(config.auth || {});
  const prepare = adapters.prepare || contextPreparer(prisma, config);
  return {
    workerId,
    async tick() {
      await queue.reap();
      const row = await queue.claim(workerId);
      if (!row) return false;
      let heartbeat = Promise.resolve();
      let leaseLost = false;
      const timer = setInterval(() => {
        heartbeat = heartbeat
          .then(() => queue.heartbeat(row.id, workerId, row.leaseVersion))
          .catch(() => {
            leaseLost = true;
          });
      }, 5000);
      try {
        // Diagnostics/context building, HTTP, sleeps and provider execution are
        // deliberately OUTSIDE all transactions. The BE-05 projector/history
        // reader is the default; transport remains fake until PY-01/PY-02.
        const prepared = await prepare(row);
        const input = await permits.plan(row.id, workerId, row.leaseVersion, prepared);
        const ack = schemas.InternalAnalyzeResponse.parse(
          await adapters.analyze(input, {
            claimToken: auth.sign('CLAIM', input, input.deadlineAt),
            receiptToken: auth.sign('RECEIPT', input, new Date(+new Date(input.deadlineAt) + 5000)),
          })
        );
        if (ack.callId !== input.callId || ack.contextHash !== input.contextHash || leaseLost)
          throw new Error('AI_LEASE_LOST');
        const call = await prisma.aiProviderCall.findUnique({ where: { id: input.callId } });
        if (call?.receiptHash !== ack.receiptHash) throw new Error('AI_RECEIPT_MISSING');
        await results.finalize(row.id, { workerId, leaseVersion: row.leaseVersion });
      } catch (error) {
        adapters.onError?.(error);
        // If a permit was claimed, only receipt/reaper can determine outcome.
        // Never repeat analyze/generation on a transport error.
        try {
          await queue.failBeforeDispatch(row.id, workerId, row.leaseVersion);
        } catch (error) {
          if (error.code !== 'AI_LEASE_LOST') throw error;
        }
      } finally {
        clearInterval(timer);
        await heartbeat;
      }
      return true;
    },
  };
}

// Kept as a fixture helper for BE-04 crash/recovery tests. It now uses the real
// BE-05 public projection; only the execution transport below remains fake.
function fakePrepare(row) {
  return projectContext(row);
}
function fakeAnalyze(base, sleepMs = 300) {
  const url = new URL(base);
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/internal/v1/ai'
  )
    throw new Error('Fake worker internal URL must be loopback /internal/v1/ai');
  return async (input, tokens) => {
    const binding = schemas.ClaimRequest.parse({
      contractVersion: VERSION,
      requestId: input.requestId,
      callId: input.callId,
      contextHash: input.contextHash,
      leaseVersion: input.leaseVersion,
    });
    const send = async (operation, method, body, token) => {
      const response = await fetch(`${base}/provider-calls/${input.callId}/${operation}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-AI-Contract-Version': VERSION,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) throw new Error('AI_INTERNAL_CALL_REJECTED');
      return response.json();
    };
    await send('claim', 'POST', binding, tokens.claimToken);
    await delay(sleepMs);
    const receipt = {
      ...binding,
      outcome: 'RECEIVED',
      providerRequestId: null,
      usage: { status: 'FINAL', inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
      versions: input.versions,
      finishReason: 'fake',
      output: diagnosticAnswer(input) || {
        summary: 'Luồng AI giả đã hoàn tất. Chưa có phân tích bài lab bằng model thật.',
        claimType: 'INSUFFICIENT_CONTEXT',
        evidenceIds: [],
        nextSteps: [],
        verification: 'Tiếp tục kiểm tra bài lab bằng công cụ mô phỏng.',
        hintLevel: 1,
      },
    };
    const saved = schemas.ReceiptResponse.parse(
      await send('receipt', 'PUT', receipt, tokens.receiptToken)
    );
    return {
      contractVersion: VERSION,
      callId: input.callId,
      contextHash: input.contextHash,
      receiptHash: saved.data.receiptHash,
    };
  };
}
async function main() {
  require('../../backend/src/config/env');
  const { runtimeConfig } = require('../node/workerConfig');
  const { getPrisma, disconnectDatabase } = require('../../backend/src/config/database');
  const config = runtimeConfig();
  if (!config.enabled)
    throw new Error(
      'Worker disabled: explicit fake mode and isolated loopback AI database required'
    );
  let stopping = false;
  process.on('SIGINT', () => {
    stopping = true;
  });
  process.on('SIGTERM', () => {
    stopping = true;
  });
  const worker = createWorker(getPrisma(), config, {
    analyze: fakeAnalyze(process.env.AI_INTERNAL_URL || 'http://127.0.0.1:5500/internal/v1/ai'),
  });
  try {
    while (!stopping) {
      await worker.tick();
      await delay(1000);
    }
  } finally {
    await disconnectDatabase();
  }
}
if (require.main === module)
  main().catch(() => {
    console.error('AI worker stopped; check server-only worker configuration/database');
    process.exitCode = 1;
  });
module.exports = { createWorker, fakePrepare, fakeAnalyze };
