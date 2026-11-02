/* global BigInt */
const { createHash, createHmac } = require('node:crypto');
const { schemas, VERSION, canonicalAdmissionPayload } = require('@ccna/shared/aiLabContract');
const { withAiAccess } = require('./access');
const { captureSnapshot } = require('./snapshot');
const { fail, limitsOf, userQuota, reserve } = require('./quota');
const { clock } = require('./lifecycle');
const hash = (v) => createHash('sha256').update(v).digest('hex');
function service(prisma, config) {
  const { environment, recoveryEpoch, ownerSecret } = config;
  const requireProvider = (policy) => {
    const provider = config.providers?.[policy.providerConfigId];
    if (
      config.enabled === false ||
      (config.providers && (!provider || provider.dispatchEnabled === false))
    )
      throw fail('AI_DISABLED');
  };
  const checked = (principal, attemptId, fn) => {
    if (
      !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(recoveryEpoch || '') ||
      !ownerSecret ||
      ownerSecret.length < 32
    )
      throw fail('AI_DISABLED');
    return withAiAccess(prisma, { principal, attemptId, environment }, async (tx, context) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`ai-admission:${environment}`}, 1))::text`;
      const now = await clock(tx);
      const owner = createHmac('sha256', ownerSecret)
        .update(`${environment}:${principal.id}`)
        .digest('hex');
      return fn(tx, { ...context, now, owner });
    });
  };
  async function resource(tx, row, c) {
    const conversation = await tx.aiConversation.findFirst({
      where: {
        id: row.conversationId,
        userId: c.user.id,
        attemptId: c.attempt.id,
        deletedAt: null,
        epoch: row.conversationEpoch,
      },
    });
    if (!conversation) throw fail('AI_RESOURCE_NOT_FOUND');
    const pending = ['QUEUED', 'RUNNING'].includes(row.status);
    const message =
      row.responseMode !== 'NONE'
        ? await tx.aiMessage.findUnique({
            where: { requestId_role: { requestId: row.id, role: 'ASSISTANT' } },
          })
        : null;
    return schemas.RequestResponse.parse({
      contractVersion: VERSION,
      data: {
        requestId: row.id,
        conversationId: row.conversationId,
        conversationEpoch: row.conversationEpoch,
        recoveryEpoch: row.recoveryEpoch,
        intent: row.intent,
        sourceRevision: row.sourceRevision,
        currentRevision: c.attempt.deviceState.revision,
        stale:
          row.sourceRevision === null
            ? null
            : row.sourceRevision !== c.attempt.deviceState.revision,
        sourceProvenance: row.sourceProvenance,
        quota: await userQuota(tx, environment, c.owner, c.policy, c.now),
        serverTime: c.now.toISOString(),
        status: row.status,
        responseMode: row.responseMode,
        result: message?.structuredAnswer || null,
        ...(pending ? { pollAfterMs: 2000 } : {}),
      },
    });
  }
  return {
    async cancel(principal, attemptId, requestId) {
      const { receipts } = require('./receipts');
      const { runtimeConfig } = require('./workerConfig');
      await receipts(prisma, { ...runtimeConfig(), ...config }).cancel(
        requestId,
        principal,
        attemptId
      );
      return this.read(principal, attemptId, 'id', requestId);
    },
    create(principal, attemptId, input) {
      const parsed = schemas.CreateRequest.safeParse(input);
      if (!parsed.success) throw fail('AI_INVALID_REQUEST');
      const body = parsed.data;
      const payloadHash = hash(canonicalAdmissionPayload(attemptId, body));
      return checked(principal, attemptId, async (tx, c) => {
        const old = await tx.aiRequest.findUnique({
          where: {
            ownerKey_clientRequestId: { ownerKey: c.owner, clientRequestId: body.clientRequestId },
          },
        });
        if (old) {
          if (old.payloadHash !== payloadHash) throw fail('AI_IDEMPOTENCY_CONFLICT');
          return resource(tx, old, c);
        }
        requireProvider(c.policy);
        if (body.recoveryEpoch !== recoveryEpoch) throw fail('AI_RECOVERY_RECONFIRM');
        let conversation = await tx.aiConversation.findUnique({
          where: { userId_attemptId: { userId: principal.id, attemptId } },
        });
        if (conversation?.deletedAt || body.conversationEpoch !== (conversation?.epoch || 0))
          throw fail('AI_CONVERSATION_CHANGED');
        if (body.expectedRevision !== c.attempt.deviceState.revision)
          throw fail('AI_STALE_CONTEXT');
        for (const device of [body.selectedDeviceId, body.target?.deviceId])
          if (device && !Object.hasOwn(c.attempt.deviceState.devices, device))
            throw fail('AI_INVALID_REQUEST');
        const snapshot = captureSnapshot(c.attempt, body.intent);
        if (body.taskId && !snapshot.publicMetadata?.tasks?.some((t) => t.id === body.taskId))
          throw fail('AI_INVALID_REQUEST');
        if (Buffer.byteLength(JSON.stringify({ ...snapshot, request: body })) > 65536)
          throw fail('AI_CONTEXT_TOO_LARGE');
        if (
          await tx.aiRequest.findFirst({
            where: { userId: principal.id, status: { in: ['QUEUED', 'RUNNING'] } },
          })
        )
          throw fail('AI_CONCURRENT_LIMIT');
        const limits = limitsOf(c.policy);
        const versionCheck = schemas.InternalAnalyzeRequest.shape.versions.safeParse({
          ...limits.versions,
          simulatorVersion: c.attempt.simulatorVersion,
          policyVersion: String(c.policy.version),
        });
        if (!versionCheck.success) throw fail('AI_DISABLED');
        if (!conversation)
          conversation = await tx.aiConversation.create({
            data: { userId: principal.id, attemptId, ownerKey: c.owner },
          });
        const row = await tx.aiRequest.create({
          data: {
            userId: principal.id,
            attemptId,
            conversationId: conversation.id,
            ownerKey: c.owner,
            conversationEpoch: conversation.epoch,
            recoveryEpoch,
            clientRequestId: body.clientRequestId,
            payloadHash,
            intent: body.intent,
            requestedHintLevel: body.requestedHintLevel,
            effectiveHintLevel: 1,
            sourceRevision: snapshot.sourceRevision,
            sourceProvenance: snapshot.sourceProvenance,
            snapshot: { ...snapshot, request: body },
            contextHash: hash(JSON.stringify({ snapshot, request: body })),
            versions: versionCheck.data,
            sessionVersionAtAdmission: principal.sessionVersion,
            maxCostMicros: BigInt(limits.maxCostMicros),
            deadlineAt: new Date(+c.now + 60000),
          },
        });
        await reserve(tx, row.id, environment, c.owner, c.policy, c.now);
        await tx.aiMessage.create({
          data: {
            requestId: row.id,
            conversationId: conversation.id,
            epoch: conversation.epoch,
            role: 'USER',
            content: body.message || body.intent,
          },
        });
        await tx.aiEventOutbox.create({
          data: { type: 'AI_REQUEST_QUEUED', payload: { requestId: row.id } },
        });
        return resource(tx, row, c);
      });
    },
    read(principal, attemptId, key, value) {
      return checked(principal, attemptId, async (tx, c) => {
        const row = await tx.aiRequest.findFirst({
          where: { [key]: value, userId: principal.id, attemptId },
        });
        if (!row) throw fail('AI_RESOURCE_NOT_FOUND');
        return resource(tx, row, c);
      });
    },
    info(principal, attemptId, quotaOnly = false) {
      return checked(principal, attemptId, async (tx, c) => {
        requireProvider(c.policy);
        if (quotaOnly)
          return {
            contractVersion: VERSION,
            data: {
              quota: await userQuota(tx, environment, c.owner, c.policy, c.now),
              serverTime: c.now.toISOString(),
            },
          };
        const conversation = await tx.aiConversation.findUnique({
          where: { userId_attemptId: { userId: principal.id, attemptId } },
        });
        return schemas.CapabilitiesResponse.parse({
          contractVersion: VERSION,
          data: {
            eligible: !conversation?.deletedAt,
            conversationId: conversation?.id || null,
            conversationEpoch: conversation?.epoch || 0,
            recoveryEpoch,
            intents: ['NEXT_STEP', 'DIAGNOSE', 'EXPLAIN_CONCEPT', 'LAB_REVIEW'],
            supportedDeviceIds: Object.keys(c.attempt.deviceState.devices),
            supportedTopics: [],
            limits: { questionCharacters: 2000, contextBytes: 65536, userConcurrent: 1 },
            serverTime: c.now.toISOString(),
          },
        });
      });
    },
  };
}
module.exports = { service };
