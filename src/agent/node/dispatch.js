/* global BigInt */
const { randomUUID } = require('node:crypto');
const { VERSION, schemas } = require('@ccna/shared/aiLabContract');
const { fitBoundary } = require('./context');
const { fail, limitsOf } = require('./quota');
const { locked, eligible, fenced, event } = require('./lifecycle');
const { costOf } = require('./settlement');
const localBudget = require('./localGeminiBudget');
function dispatch(prisma, config) {
  const { environment, recoveryEpoch, providers = {} } = config;
  function providerFor(c) {
    const p = providers[c.policy?.providerConfigId];
    if (
      !config.enabled ||
      !eligible(c) ||
      !c.policy.dispatchEnabled ||
      !p ||
      (p.provider === 'gemini' && !p.dispatchEnabled) ||
      c.row.recoveryEpoch !== recoveryEpoch ||
      c.row.deadlineAt <= c.now
    )
      throw fail('AI_DISABLED');
    for (const [key, value] of Object.entries(p.versions))
      if (c.row.versions[key] !== value) throw fail('AI_DISABLED');
    if (c.row.versions.policyVersion !== String(c.policy.version)) throw fail('AI_DISABLED');
    if (
      costOf(p, {
        status: 'FINAL',
        inputTokens: p.caps.maxInputTokens,
        outputTokens: p.caps.maxOutputTokens,
        reasoningTokens: p.caps.maxReasoningTokens,
      }) > c.row.maxCostMicros
    )
      throw fail('AI_BUDGET_PAUSED');
    return p;
  }
  return {
    plan(requestId, workerId, leaseVersion, prepared) {
      return locked(prisma, environment, requestId, async (tx, c) => {
        fenced(c, workerId, leaseVersion);
        const p = providerFor(c);
        if (p.localLedgerFile) {
          try {
            localBudget.available(p.localLedgerFile);
          } catch {
            throw fail('AI_BUDGET_PAUSED');
          }
        }
        if (c.row.sourceRevision === null) throw fail('AI_INVALID_REQUEST');
        if (c.call && c.call.state !== 'PLANNED') throw fail('AI_DISPATCH_ALREADY_CLAIMED');
        const callId = c.call?.id || randomUUID();
        const input = fitBoundary(
          {
            ...prepared,
            contractVersion: VERSION,
            requestId,
            callId,
            contextHash: c.row.contextHash,
            leaseVersion,
            deadlineAt: new Date(
              Math.min(+c.row.deadlineAt, +c.now + (p.executionWindowMs || 20000))
            ).toISOString(),
            providerConfigId: c.policy.providerConfigId,
            versions: c.row.versions,
            policy: {
              effectiveHintLevel: c.row.effectiveHintLevel,
              maxProviderCalls: 1,
              ...p.caps,
              maxCostMicros: Number(c.row.maxCostMicros),
            },
          },
          p
        );
        if (
          input.context.sourceRevision !== c.row.sourceRevision ||
          input.request.intent !== c.row.intent
        )
          throw fail('AI_INVALID_REQUEST');
        await tx.aiProviderCall.upsert({
          where: { requestId_stepIndex: { requestId, stepIndex: 0 } },
          create: {
            id: callId,
            requestId,
            contextHash: c.row.contextHash,
            leaseVersion,
            provider: p.provider,
            model: p.versions.modelVersion,
            priceVersion: p.versions.priceVersion,
            maxCostMicros: c.row.maxCostMicros,
            analyzeInput: input,
          },
          update: { leaseVersion, analyzeInput: input },
        });
        return input;
      });
    },
    async claim(binding) {
      const body = schemas.ClaimRequest.parse(binding);
      return locked(prisma, environment, body.requestId, async (tx, c) => {
        const call = c.call;
        if (
          !call ||
          call.id !== body.callId ||
          call.contextHash !== body.contextHash ||
          call.leaseVersion !== body.leaseVersion
        )
          throw fail('AI_LEASE_LOST');
        if (call.state !== 'PLANNED') throw fail('AI_DISPATCH_ALREADY_CLAIMED');
        if (
          c.row.status !== 'RUNNING' ||
          c.row.leaseVersion !== body.leaseVersion ||
          c.row.leaseExpiresAt <= c.now
        )
          throw fail('AI_LEASE_LOST');
        const p = providerFor(c);
        if (!call.analyzeInput || new Date(call.analyzeInput.deadlineAt) <= c.now)
          throw fail('AI_LEASE_LOST');
        const reservations = await tx.aiReservation.findMany({
          where: { requestId: c.row.id },
          include: { bucket: true },
        });
        const limits = limitsOf(c.policy);
        if (
          c.row.maxCostMicros > BigInt(limits.maxCostMicros) ||
          reservations.length !== 3 ||
          reservations.some(
            (r) =>
              r.status !== 'RESERVED' ||
              r.costMicros !== c.row.maxCostMicros ||
              r.bucket.reservedMicros < r.costMicros ||
              r.bucket.spentMicros + r.bucket.reservedMicros > r.bucket.limitMicros ||
              (r.bucket.scopeType === 'GLOBAL_DAY' &&
                r.bucket.spentMicros + r.bucket.reservedMicros > BigInt(limits.globalDayMicros)) ||
              (r.bucket.scopeType === 'GLOBAL_MONTH' &&
                r.bucket.spentMicros + r.bucket.reservedMicros >
                  BigInt(limits.globalMonthMicros)) ||
              (r.bucket.scopeType === 'USER_DAY' &&
                r.bucket.usedUnits + r.bucket.reservedUnits > limits.userDay)
          )
        )
          throw fail('AI_BUDGET_PAUSED');
        const capacity = c.policy.limits?.globalConcurrency;
        if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 128)
          throw fail('AI_DISABLED');
        if (
          (await tx.aiExecutionSlot.count({ where: { environment, requestId: { not: null } } })) >=
          capacity
        )
          throw fail('AI_CAPACITY_EXHAUSTED');
        // Provision only idle slot rows, never remove occupied rows when lowering capacity.
        for (let slotNumber = 0; slotNumber < capacity; slotNumber++)
          await tx.aiExecutionSlot.upsert({
            where: { environment_slotNumber: { environment, slotNumber } },
            create: { environment, slotNumber },
            update: {},
          });
        const slots = await tx.$queryRaw`SELECT slot_number FROM ai_execution_slots
          WHERE environment = ${environment} AND slot_number < ${capacity} AND request_id IS NULL
          ORDER BY slot_number FOR UPDATE SKIP LOCKED LIMIT 1`;
        if (!slots.length) throw fail('AI_CAPACITY_EXHAUSTED');
        if (p.localLedgerFile) {
          try {
            localBudget.reserve(p.localLedgerFile, Date.now(), body);
          } catch {
            throw fail('AI_BUDGET_PAUSED');
          }
        }
        const deadlineAt = new Date(call.analyzeInput.deadlineAt);
        await tx.aiExecutionSlot.update({
          where: { environment_slotNumber: { environment, slotNumber: slots[0].slot_number } },
          data: {
            requestId: c.row.id,
            callId: call.id,
            leaseVersion: body.leaseVersion,
            acquiredAt: c.now,
            expiresAt: new Date(+deadlineAt + 5000),
          },
        });
        await tx.aiProviderCall.update({
          where: { id: call.id },
          data: { state: 'DISPATCHED', dispatchedAt: c.now },
        });
        await event(tx, 'AI_PROVIDER_DISPATCHED', c.row.id, { callId: call.id });
        return schemas.ClaimResponse.parse({
          contractVersion: VERSION,
          data: {
            callId: call.id,
            contextHash: call.contextHash,
            leaseVersion: call.leaseVersion,
            dispatchAuthorized: true,
            deadlineAt: deadlineAt.toISOString(),
          },
        });
      });
    },
  };
}
module.exports = { dispatch };
