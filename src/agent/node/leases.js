const { clock, locked, pending, eligible, releaseSlot, terminal, event } = require('./lifecycle');
const { settle } = require('./settlement');
const { receipts } = require('./receipts');
const { fail } = require('./quota');
function leases(prisma, config) {
  const { environment } = config;
  const results = receipts(prisma, config);
  return {
    claim(workerId) {
      if (!/^[A-Za-z0-9_-]{1,160}$/.test(workerId)) throw fail('AI_INVALID_REQUEST');
      if (!config.enabled) return null;
      return prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw`SELECT r.id FROM ai_requests r
          WHERE r.status = 'QUEUED' AND r.deadline_at > clock_timestamp()
            AND (r.started_at IS NOT NULL OR r.created_at > clock_timestamp() - interval '10 seconds')
            AND EXISTS (SELECT 1 FROM ai_reservations z
            JOIN ai_quota_buckets b ON b.id=z.bucket_id
            WHERE z.request_id=r.id AND b.scope_type='GLOBAL_DAY' AND b.scope_key=${environment})
          ORDER BY r.created_at, r.id FOR UPDATE OF r SKIP LOCKED LIMIT 1`;
        if (!rows.length) return null;
        const now = await clock(tx);
        const row = await tx.aiRequest.findUnique({ where: { id: rows[0].id } });
        return tx.aiRequest.update({
          where: { id: row.id },
          data: {
            status: 'RUNNING',
            leaseOwner: workerId,
            leaseVersion: { increment: 1 },
            startedAt: row.startedAt || now,
            heartbeatAt: now,
            leaseExpiresAt: new Date(+now + 15000),
          },
        });
      });
    },
    heartbeat(requestId, workerId, leaseVersion) {
      return prisma.$transaction(async (tx) => {
        // Read DB time after acquiring the row; lock wait must not revive an
        // already expired lease using a timestamp captured before the wait.
        await tx.$queryRaw`SELECT id FROM ai_requests WHERE id = ${requestId}::uuid FOR UPDATE`;
        const now = await clock(tx);
        const changed = await tx.aiRequest.updateMany({
          where: {
            id: requestId,
            status: 'RUNNING',
            leaseOwner: workerId,
            leaseVersion,
            leaseExpiresAt: { gt: now },
          },
          data: { heartbeatAt: now, leaseExpiresAt: new Date(+now + 15000) },
        });
        if (!changed.count) throw fail('AI_LEASE_LOST');
      });
    },
    async reap() {
      const scope = {
        reservations: { some: { bucket: { scopeType: 'GLOBAL_DAY', scopeKey: environment } } },
      };
      const jobs = await prisma.aiRequest.findMany({
        where: { ...scope, status: { in: ['QUEUED', 'RUNNING'] } },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: 256,
      });
      for (const { id } of jobs) {
        await results.finalize(id); // A durable receipt wins over a lost worker ACK.
        await locked(prisma, environment, id, async (tx, c) => {
          if (!pending(c.row)) return;
          const preDispatch = !c.call || c.call.state === 'PLANNED';
          let stop = null;
          if (!eligible(c) || c.row.recoveryEpoch !== config.recoveryEpoch)
            stop = c.conversation?.deletedAt ? 'DELETED' : 'REVOKED';
          else if (
            c.row.status === 'QUEUED' &&
            (c.row.deadlineAt <= c.now || (!c.row.startedAt && +c.now - +c.row.createdAt > 10000))
          )
            stop = 'EXPIRED';
          else if (c.row.status === 'RUNNING') {
            const executionEnd = c.call?.analyzeInput?.deadlineAt || c.row.deadlineAt;
            if (!preDispatch && +c.now >= +new Date(executionEnd) + 5000) stop = 'OUTCOME_UNKNOWN';
            else if (preDispatch && c.row.deadlineAt <= c.now) stop = 'FAILED';
            else if (preDispatch && c.row.leaseExpiresAt <= c.now) {
              await tx.aiRequest.update({
                where: { id },
                data: { status: 'QUEUED', leaseOwner: null, leaseExpiresAt: null },
              });
              await event(tx, 'AI_REQUEST_REQUEUED', id);
              return;
            }
          }
          if (!stop) return;
          if (c.call?.state === 'PLANNED')
            await tx.aiProviderCall.update({
              where: { id: c.call.id },
              data: { state: 'KNOWN_FAILURE', suppressionReason: 'STOPPED_BEFORE_DISPATCH' },
            });
          else if (c.call?.state === 'DISPATCHED' && stop === 'OUTCOME_UNKNOWN')
            await tx.aiProviderCall.update({
              where: { id: c.call.id },
              data: { state: 'OUTCOME_UNKNOWN', usageStatus: 'UNRESOLVED' },
            });
          await terminal(tx, c, stop);
          const cost = preDispatch ? 0n : c.call.costMicros;
          await settle(
            tx,
            c.row,
            cost !== null && cost <= c.row.maxCostMicros ? cost : null,
            false,
            c.now
          );
          if (preDispatch || ['RECEIVED', 'KNOWN_FAILURE'].includes(c.call.state))
            await releaseSlot(tx, id);
        });
      }
      // Occupied unknown slots survive lease loss and are released only at deadline + grace.
      const expiredSlots = await prisma.aiExecutionSlot.findMany({
        where: { environment, requestId: { not: null }, expiresAt: { lte: new Date() } },
        select: { requestId: true },
      });
      for (const { requestId } of expiredSlots)
        await locked(prisma, environment, requestId, async (tx, c) => {
          await tx.aiExecutionSlot.updateMany({
            where: { requestId, environment, expiresAt: { lte: c.now } },
            data: { requestId: null, callId: null, acquiredAt: null, expiresAt: null },
          });
        });
      const unknown = await prisma.aiRequest.findMany({
        where: {
          ...scope,
          status: { notIn: ['QUEUED', 'RUNNING'] },
          providerCalls: {
            some: {
              usageStatus: { in: ['PENDING', 'UNRESOLVED'] },
              dispatchedAt: { not: null },
            },
          },
        },
        select: { id: true },
        take: 256,
      });
      for (const { id } of unknown) await results.estimate(id);
    },
    failBeforeDispatch(requestId, workerId, leaseVersion) {
      return locked(prisma, environment, requestId, async (tx, c) => {
        if (
          c.row.status !== 'RUNNING' ||
          c.row.leaseVersion !== leaseVersion ||
          c.row.leaseOwner !== workerId ||
          c.row.leaseExpiresAt <= c.now
        )
          throw fail('AI_LEASE_LOST');
        if (c.call && c.call.state !== 'PLANNED') return false;
        if (c.call)
          await tx.aiProviderCall.update({
            where: { id: c.call.id },
            data: { state: 'KNOWN_FAILURE', suppressionReason: 'PRE_DISPATCH_FAILURE' },
          });
        await terminal(tx, c, 'FAILED', 'AI_RESULT_UNAVAILABLE');
        await settle(tx, c.row, 0n, false, c.now);
        return true;
      });
    },
  };
}
module.exports = { leases };
