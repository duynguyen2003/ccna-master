const { test } = require('node:test');
const assert = require('node:assert/strict');
const { publicProgress, setProgress } = require('./progress');
test('public phases use only server fields, task device wins, quota units are separate from cost', () => {
  const row = {
    status: 'RUNNING',
    streamVersion: 7,
    progressPhase: 'ANALYZING',
    deadlineAt: new Date(),
    snapshot: { taskFocus: { deviceId: 'R2' }, request: { selectedDeviceId: 'R1' } },
  };
  assert.equal(publicProgress(row).deviceId, 'R2');
  assert.equal(publicProgress(row).unitStatus, 'RESERVED');
  assert.equal(publicProgress({ ...row, progressPhase: null }).phase, 'RUNNING');
  assert.equal(
    publicProgress({ ...row, status: 'COMPLETED', responseMode: 'LLM' }).unitStatus,
    'CONSUMED'
  );
  for (const status of ['CANCELLED', 'FAILED', 'EXPIRED', 'OUTCOME_UNKNOWN'])
    assert.equal(publicProgress({ ...row, status }).unitStatus, 'RELEASED');
  assert.equal(publicProgress({ ...row, status: 'QUEUED' }).phase, 'QUEUED');
});
test('phase writes are fenced by worker, lease and deadline; arbitrary text is rejected', async () => {
  let write;
  const tx = {
    $queryRaw: async () => [{ milliseconds: Date.now() }],
    aiRequest: {
      updateMany: async (value) => {
        write = value;
        return { count: 1 };
      },
    },
  };
  const db = { $transaction: (f) => f(tx) };
  await setProgress(db, { id: 'id', leaseVersion: 2 }, 'worker', 'ANALYZING');
  assert.equal(write.where.leaseVersion, 2);
  assert.equal(write.where.leaseOwner, 'worker');
  assert.ok(write.where.leaseExpiresAt.gt instanceof Date);
  assert.ok(write.where.deadlineAt.gt instanceof Date);
  assert.deepEqual(write.data.streamVersion, { increment: 1 });
  await assert.rejects(setProgress(db, {}, 'worker', 'model-provided-text'), {
    code: 'AI_INVALID_REQUEST',
  });
  tx.aiRequest.updateMany = async () => ({ count: 0 });
  await assert.rejects(setProgress(db, { id: 'id' }, 'worker', 'ANALYZING'), {
    code: 'AI_LEASE_LOST',
  });
});
