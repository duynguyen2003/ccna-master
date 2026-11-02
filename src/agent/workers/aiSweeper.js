const { setTimeout: delay } = require('node:timers/promises');
const { leases } = require('../node/leases');

// Runs without a provider key or a generation worker. Never dispatches model calls.
async function runSweeper(prisma, config, { signal, intervalMs = 2000, onError = () => {} } = {}) {
  const queue = leases(prisma, config);
  while (!signal?.aborted) {
    try {
      await queue.reap();
    } catch (error) {
      onError(error);
    }
    try {
      await delay(intervalMs, undefined, { signal });
    } catch {
      break;
    }
  }
}
async function main() {
  require('../../backend/src/config/env');
  const { runtimeConfig } = require('../node/workerConfig');
  const { getPrisma, disconnectDatabase } = require('../../backend/src/config/database');
  const config = runtimeConfig();
  if (!config.recoveryEpoch) throw new Error('AI_RECOVERY_EPOCH is required');
  const abort = new AbortController();
  const stop = () => abort.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await runSweeper(getPrisma(), config, {
      signal: abort.signal,
      onError: () => console.error('AI_SWEEPER_FAILED'),
    });
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    await disconnectDatabase();
  }
}
if (require.main === module)
  main().catch(() => {
    console.error('AI_SWEEPER_STOPPED');
    process.exitCode = 1;
  });
module.exports = { runSweeper };
