const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { schemas } = require('@ccna/shared/aiLabContract');
const { leases } = require('../node/leases');
const { dispatch } = require('../node/dispatch');
const { receipts } = require('../node/receipts');
const { serviceAuth } = require('../node/serviceAuth');
const { contextPreparer } = require('../node/context');
const { pythonAnalyze } = require('../node/pythonTransport');

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
        // reader is the default; execution uses the Python Gemini service.
        const prepared = await prepare(row);
        const input = await permits.plan(row.id, workerId, row.leaseVersion, prepared);
        const ack = schemas.InternalAnalyzeResponse.parse(
          await adapters.analyze(input, {
            analyzeToken: auth.sign('ANALYZE', input, input.deadlineAt),
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

async function main() {
  require('../../backend/src/config/env');
  const { runtimeConfig } = require('../node/workerConfig');
  const { getPrisma, disconnectDatabase } = require('../../backend/src/config/database');
  const config = runtimeConfig();
  if (!config.enabled)
    throw new Error(
      'Worker disabled: select an isolated local mode or explicit admin-test application mode'
    );
  let stopping = false;
  process.on('SIGINT', () => {
    stopping = true;
  });
  process.on('SIGTERM', () => {
    stopping = true;
  });
  const worker = createWorker(getPrisma(), config, {
    analyze: workerAnalyze(process.env),
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
function workerAnalyze(env, adapters = { pythonAnalyze }) {
  if (!['python-gemini', 'app-gemini'].includes(env.AI_WORKER_MODE)) throw new Error('AI_DISABLED');
  return adapters.pythonAnalyze(
    env.AI_ANALYZE_URL || 'http://127.0.0.1:8001/internal/v1/lab-assistant/analyze'
  );
}
if (require.main === module)
  main().catch(() => {
    console.error('AI worker stopped; check server-only worker configuration/database');
    process.exitCode = 1;
  });
module.exports = { createWorker, workerAnalyze };
