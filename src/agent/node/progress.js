const { clock } = require('./lifecycle');
const { fail } = require('./quota');
const phases = new Set(['PREPARING_CONTEXT', 'ANALYZING', 'FINALIZING']);

// Only server-owned codes, fenced by the current worker lease. Not derived from logs/model text.
async function setProgress(prisma, row, workerId, phase) {
  if (!phases.has(phase)) throw fail('AI_INVALID_REQUEST');
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM ai_requests WHERE id = ${row.id}::uuid FOR UPDATE`;
    const now = await clock(tx);
    const changed = await tx.aiRequest.updateMany({
      where: {
        id: row.id,
        status: 'RUNNING',
        leaseOwner: workerId,
        leaseVersion: row.leaseVersion,
        leaseExpiresAt: { gt: now },
        deadlineAt: { gt: now },
      },
      data: { progressPhase: phase, streamVersion: { increment: 1 } },
    });
    if (!changed.count) throw fail('AI_LEASE_LOST');
  });
}

function publicProgress(row) {
  const pending = ['QUEUED', 'RUNNING'].includes(row.status);
  const deviceId = row.snapshot?.taskFocus?.deviceId || row.snapshot?.request?.selectedDeviceId;
  return {
    streamVersion: row.streamVersion ?? 1,
    phase:
      row.status === 'QUEUED' ? 'QUEUED' : pending ? row.progressPhase || 'RUNNING' : 'FINISHED',
    ...(deviceId && /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(deviceId) ? { deviceId } : {}),
    unitStatus: pending
      ? 'RESERVED'
      : row.status === 'COMPLETED' && row.responseMode === 'LLM'
        ? 'CONSUMED'
        : 'RELEASED',
    reasonCode: row.errorCode || null,
    recoveryAction: pending
      ? 'RECONNECT'
      : ['FAILED', 'EXPIRED'].includes(row.status)
        ? 'NEW_REQUEST'
        : 'NONE',
    deadlineAt: row.deadlineAt.toISOString(),
  };
}
module.exports = { setProgress, publicProgress };
