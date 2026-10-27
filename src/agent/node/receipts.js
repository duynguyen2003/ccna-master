const { createHash, randomUUID } = require('node:crypto');
const { VERSION, schemas, assertBindings } = require('@ccna/shared/aiLabContract');
const { fail } = require('./quota');
const {
  locked,
  canRetain,
  pending,
  event,
  releaseSlot,
  terminal,
  fenced,
  clearCallContent,
} = require('./lifecycle');
const { settle, costOf } = require('./settlement');
const localBudget = require('./localGeminiBudget');
// Canonical without dropping nulls or normalizing text: every changed receipt is a conflict.
const canonical = (v) =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])])
        )
      : v;
const digest = (v) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(v)))
    .digest('hex');
function receipts(prisma, config) {
  const { environment, providers = {} } = config;
  function provider(call) {
    // Price/accounting remains available even after content has been purged.
    const p =
      providers[call.analyzeInput?.providerConfigId] ||
      Object.values(providers).find(
        (entry) =>
          entry.provider === call.provider &&
          entry.versions.modelVersion === call.model &&
          entry.versions.priceVersion === call.priceVersion
      );
    if (
      !p ||
      p.versions.modelVersion !== call.model ||
      p.versions.priceVersion !== call.priceVersion
    )
      throw fail('AI_DISABLED');
    return p;
  }
  async function finalizeLocked(tx, c, worker) {
    if (!pending(c.row)) return false;
    if (worker) fenced(c, worker.workerId, worker.leaseVersion);
    const call = c.call;
    if (!call?.receiptHash || !['RECEIVED', 'KNOWN_FAILURE'].includes(call.state)) return false;
    const p = provider(call);
    const receipt = call.receiptPayload;
    let result = null;
    if (
      c.row.status === 'RUNNING' &&
      canRetain(c) &&
      receipt?.outcome === 'RECEIVED' &&
      c.row.deadlineAt > c.now &&
      c.row.leaseVersion === call.leaseVersion
    ) {
      try {
        assertBindings(call.analyzeInput, receipt);
        if (
          p.validateOutput?.(call.analyzeInput, receipt, {
            row: c.row,
            secrets: config.redactionValues,
          }) === true
        ) {
          const messageId = randomUUID();
          const ids = new Set(receipt.output.evidenceIds);
          const commands = new Set(
            receipt.output.nextSteps.map((s) => s.commandId).filter(Boolean)
          );
          result = {
            messageId,
            answer: receipt.output,
            evidence: call.analyzeInput.facts
              .filter((f) => ids.has(f.evidenceId))
              .map(({ provenance, ...f }) => f),
            commands: call.analyzeInput.allowedCommands.filter((cmd) =>
              commands.has(cmd.commandId)
            ),
            versions: receipt.versions,
          };
        }
      } catch {
        result = null;
      }
    }
    // Keep database writes outside the validation catch: any storage failure
    // rolls message/status/quota/outbox back together.
    if (result) {
      await tx.aiMessage.create({
        data: {
          id: result.messageId,
          requestId: c.row.id,
          conversationId: c.row.conversationId,
          epoch: c.row.conversationEpoch,
          role: 'ASSISTANT',
          structuredAnswer: result,
          sourceRevision: c.row.sourceRevision,
        },
      });
    }
    const status = !canRetain(c)
      ? c.conversation?.deletedAt
        ? 'DELETED'
        : 'REVOKED'
      : result
        ? 'COMPLETED'
        : 'FAILED';
    await tx.aiRequest.update({
      where: { id: c.row.id },
      data: {
        status,
        responseMode: result ? p.responseMode : 'NONE',
        finishedAt: c.now,
        leaseOwner: null,
        leaseExpiresAt: null,
        errorCode: result ? null : 'AI_RESULT_UNAVAILABLE',
      },
    });
    await settle(
      tx,
      c.row,
      call.costMicros !== null && call.costMicros <= call.maxCostMicros ? call.costMicros : null,
      Boolean(result && p.responseMode === 'LLM'),
      c.now
    );
    await releaseSlot(tx, c.row.id);
    await clearCallContent(tx, call.id, status);
    await event(tx, `AI_REQUEST_${status}`, c.row.id);
    return true;
  }
  return {
    async record(value) {
      const receipt = schemas.ProviderReceipt.parse(value);
      if (Buffer.byteLength(JSON.stringify(receipt)) > 65536) throw fail('AI_CONTEXT_TOO_LARGE');
      const hash = digest(receipt);
      let localLedgerFile;
      const response = await locked(prisma, environment, receipt.requestId, async (tx, c) => {
        const call = c.call;
        if (
          !call ||
          call.id !== receipt.callId ||
          call.contextHash !== receipt.contextHash ||
          call.leaseVersion !== receipt.leaseVersion ||
          digest(c.row.versions) !== digest(receipt.versions)
        )
          throw fail('AI_LEASE_LOST');
        localLedgerFile = provider(call).localLedgerFile;
        if (call.receiptHash) {
          if (call.receiptHash !== hash) {
            await event(tx, 'AI_RECEIPT_CONFLICT', c.row.id, { callId: call.id });
            return { conflict: true };
          }
          return {
            contractVersion: VERSION,
            data: { callId: call.id, receiptHash: hash, recorded: true },
          };
        }
        if (
          !['DISPATCHED', 'OUTCOME_UNKNOWN'].includes(call.state) ||
          +c.now > +call.dispatchedAt + 86400000
        )
          throw fail('AI_LEASE_LOST');
        const p = provider(call);
        const cost = costOf(p, receipt.usage);
        const keep = pending(c.row) && canRetain(c) && c.row.deadlineAt > c.now;
        let retainPayload = keep;
        if (keep && receipt.outcome === 'RECEIVED') {
          try {
            retainPayload =
              p.validateOutput?.(call.analyzeInput, receipt, {
                row: c.row,
                secrets: config.redactionValues,
              }) === true;
          } catch {
            retainPayload = false;
          }
          if (!retainPayload) await event(tx, 'AI_OUTPUT_REJECTED', c.row.id, { callId: call.id });
        }
        await tx.aiProviderCall.update({
          where: { id: call.id },
          data: {
            state: receipt.outcome,
            receiptHash: hash,
            ...(retainPayload
              ? { receiptPayload: receipt, receiptExpiresAt: new Date(+c.now + 86400000) }
              : {
                  suppressionReason: keep ? 'OUTPUT_REJECTED' : 'TERMINAL_OR_REVOKED',
                }),
            providerRequestId: receipt.providerRequestId,
            finishReason: receipt.finishReason,
            inputTokens: receipt.usage.inputTokens,
            outputTokens: receipt.usage.outputTokens,
            reasoningTokens: receipt.usage.reasoningTokens,
            costMicros: cost,
            usageStatus: cost === null ? 'UNRESOLVED' : 'FINAL',
            receivedAt: c.now,
          },
        });
        if (cost !== null && cost > call.maxCostMicros) {
          await tx.aiRuntimePolicy.update({
            where: { environment },
            data: { admissionEnabled: false, dispatchEnabled: false },
          });
          await event(tx, 'AI_COST_CAP_EXCEEDED', c.row.id, { callId: call.id });
        }
        // Late receipt never changes a terminal request or creates content.
        if (!pending(c.row))
          await settle(
            tx,
            c.row,
            cost !== null && cost <= call.maxCostMicros ? cost : null,
            false,
            c.now
          );
        if (receipt.outcome !== 'OUTCOME_UNKNOWN') await releaseSlot(tx, c.row.id);
        await event(tx, 'AI_RECEIPT_RECORDED', c.row.id, { callId: call.id });
        return {
          contractVersion: VERSION,
          data: { callId: call.id, receiptHash: hash, recorded: true },
        };
      });
      if (response.conflict) throw fail('AI_RECEIPT_CONFLICT');
      if (localLedgerFile) localBudget.recordReceipt(receipt, localLedgerFile);
      return schemas.ReceiptResponse.parse(response);
    },
    finalize(requestId, worker) {
      return locked(prisma, environment, requestId, (tx, c) => finalizeLocked(tx, c, worker));
    },
    // Trusted accounting input, never exposed to a browser or generation adapter.
    reconcile(requestId, key, usage) {
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(key)) throw fail('AI_INVALID_REQUEST');
      const checked = schemas.ProviderReceipt.options[0].shape.usage.parse(usage);
      if (checked.status !== 'FINAL') throw fail('AI_INVALID_REQUEST');
      return locked(prisma, environment, requestId, async (tx, c) => {
        const call = c.call;
        if (!call?.dispatchedAt || pending(c.row)) throw fail('AI_INVALID_REQUEST');
        const idempotencyKey = `${call.id}:reconcile:${key}`;
        const reason = `FINAL:${digest(checked)}`;
        const old = await tx.aiUsageAdjustment.findUnique({ where: { idempotencyKey } });
        if (old) {
          if (old.reason !== reason) throw fail('AI_RECEIPT_CONFLICT');
          return;
        }
        const cost = costOf(provider(call), checked);
        if (cost > call.maxCostMicros) throw fail('AI_BUDGET_PAUSED');
        const reservations = await tx.aiReservation.findMany({
          where: { requestId },
          orderBy: { bucketId: 'asc' },
        });
        const prior = call.costMicros;
        if (call.usageStatus === 'FINAL' && prior !== cost) throw fail('AI_RECEIPT_CONFLICT');
        const delta = cost - (prior || 0n);
        for (const r of reservations) {
          if (['SETTLED', 'RELEASED'].includes(r.status))
            await tx.aiQuotaBucket.update({
              where: { id: r.bucketId },
              data: { spentMicros: { increment: delta } },
            });
        }
        await settle(tx, c.row, cost, false, c.now);
        await tx.aiUsageAdjustment.create({
          data: { providerCallId: call.id, idempotencyKey, deltaMicros: delta, reason },
        });
        await tx.aiProviderCall.update({
          where: { id: call.id },
          data: {
            usageStatus: 'FINAL',
            costMicros: cost,
            inputTokens: checked.inputTokens,
            outputTokens: checked.outputTokens,
            reasoningTokens: checked.reasoningTokens,
          },
        });
        await event(tx, 'AI_USAGE_RECONCILED', requestId, { callId: call.id });
      });
    },
    async estimate(requestId) {
      return locked(prisma, environment, requestId, async (tx, c) => {
        const call = c.call;
        if (
          !call?.dispatchedAt ||
          +c.now < +call.dispatchedAt + 86400000 ||
          !['PENDING', 'UNRESOLVED'].includes(call.usageStatus) ||
          pending(c.row)
        )
          return false;
        await settle(tx, c.row, call.maxCostMicros, false, c.now);
        await tx.aiProviderCall.update({
          where: { id: call.id },
          data: { usageStatus: 'ESTIMATED', costMicros: call.maxCostMicros },
        });
        await tx.aiUsageAdjustment.create({
          data: {
            providerCallId: call.id,
            idempotencyKey: `${call.id}:estimate`,
            deltaMicros: 0n,
            reason: 'RESERVED_ESTIMATE',
          },
        });
        return true;
      });
    },
    async cancel(requestId, principal, attemptId) {
      return locked(prisma, environment, requestId, async (tx, c) => {
        if (
          principal &&
          (principal.id !== c.row.userId ||
            attemptId !== c.row.attemptId ||
            principal.sessionVersion !== c.user?.sessionVersion ||
            !canRetain(c))
        )
          throw fail('AI_RESOURCE_NOT_FOUND');
        if (!pending(c.row)) return;
        const beforeDispatch = !c.call || c.call.state === 'PLANNED';
        if (c.call && beforeDispatch)
          await tx.aiProviderCall.update({
            where: { id: c.call.id },
            data: { state: 'KNOWN_FAILURE', suppressionReason: 'CANCELLED_BEFORE_DISPATCH' },
          });
        await terminal(tx, c, 'CANCELLED');
        await settle(tx, c.row, beforeDispatch ? 0n : c.call.costMicros, false, c.now);
        if (beforeDispatch || ['RECEIVED', 'KNOWN_FAILURE'].includes(c.call.state))
          await releaseSlot(tx, requestId);
      });
    },
  };
}
module.exports = { receipts, digest };
