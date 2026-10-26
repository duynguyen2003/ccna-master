const { mayAccess } = require('../../backend/src/simulation/attemptAccess');
const { isAccountActive } = require('../../backend/src/security/session');
const { fail } = require('./quota');
const pending = (r) => ['QUEUED', 'RUNNING'].includes(r.status);
// The pg adapter can interpret raw timestamptz as UTC wall time in a non-UTC
// session. Epoch milliseconds avoid that conversion while retaining DB time.
const clock = async (tx) =>
  new Date(
    Number(
      (
        await tx.$queryRaw`
  SELECT (extract(epoch FROM clock_timestamp()) * 1000)::bigint AS milliseconds
`
      )[0].milliseconds
    )
  );
const event = (tx, type, requestId, extra = {}) =>
  tx.aiEventOutbox.create({ data: { type, payload: { requestId, ...extra } } });

// Queue claim is a separate short transaction. Every other lifecycle operation
// uses attempt -> conversation -> user/policy -> request -> environment/buckets.
async function locked(prisma, environment, requestId, fn) {
  const hint = await prisma.aiRequest.findUnique({ where: { id: requestId } });
  if (!hint) throw fail('AI_RESOURCE_NOT_FOUND');
  return prisma.$transaction(
    async (tx) => {
      if (hint.attemptId)
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${hint.attemptId}, 0))::text`;
      if (hint.conversationId)
        await tx.$queryRaw`SELECT id FROM ai_conversations WHERE id = ${hint.conversationId}::uuid FOR UPDATE`;
      if (hint.userId) await tx.$queryRaw`SELECT id FROM users WHERE id = ${hint.userId} FOR SHARE`;
      await tx.$queryRaw`SELECT environment FROM ai_runtime_policies WHERE environment = ${environment} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM ai_requests WHERE id = ${requestId}::uuid FOR UPDATE`;
      const row = await tx.aiRequest.findUnique({ where: { id: requestId } });
      const own = await tx.aiReservation.findFirst({
        where: {
          requestId,
          bucket: {
            scopeType: 'GLOBAL_DAY',
            scopeKey: environment,
          },
        },
      });
      if (
        !row ||
        !own ||
        row.attemptId !== hint.attemptId ||
        row.conversationId !== hint.conversationId
      )
        throw fail('AI_RESOURCE_NOT_FOUND');
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`ai-admission:${environment}`}, 1))::text`;
      const attempt = row.attemptId
        ? await tx.labAttempt.findUnique({
            where: { id: row.attemptId },
            include: { lab: true },
          })
        : null;
      const conversation = row.conversationId
        ? await tx.aiConversation.findUnique({ where: { id: row.conversationId } })
        : null;
      const user = row.userId ? await tx.user.findUnique({ where: { id: row.userId } }) : null;
      const policy = await tx.aiRuntimePolicy.findUnique({ where: { environment } });
      const call = await tx.aiProviderCall.findUnique({
        where: { requestId_stepIndex: { requestId, stepIndex: 0 } },
      });
      return fn(tx, { row, attempt, conversation, user, policy, call, now: await clock(tx) });
    },
    { timeout: 15000, maxWait: 10000 }
  );
}
function canRetain(c) {
  const { row, user, attempt, conversation } = c;
  const rules = c.policy?.eligibilityRules;
  return Boolean(
    isAccountActive(user) &&
    user.sessionVersion === row.sessionVersionAtAdmission &&
    mayAccess(attempt, row.userId) &&
    attempt.lab.status === 'PUBLISHED' &&
    !attempt.lab.deletedAt &&
    conversation &&
    !conversation.deletedAt &&
    conversation.userId === row.userId &&
    conversation.attemptId === row.attemptId &&
    conversation.epoch === row.conversationEpoch &&
    Array.isArray(rules?.userIds) &&
    rules.userIds.includes(row.userId) &&
    Array.isArray(rules?.labIds) &&
    rules.labIds.includes(attempt.labId)
  );
}
function eligible(c) {
  const rules = c.policy?.eligibilityRules;
  return (
    canRetain(c) &&
    c.policy?.admissionEnabled &&
    Array.isArray(rules?.userIds) &&
    rules.userIds.includes(c.row.userId) &&
    Array.isArray(rules?.labIds) &&
    rules.labIds.includes(c.attempt.labId)
  );
}
function fenced(c, workerId, leaseVersion) {
  if (
    c.row.status !== 'RUNNING' ||
    c.row.leaseOwner !== workerId ||
    c.row.leaseVersion !== leaseVersion ||
    c.row.leaseExpiresAt <= c.now
  )
    throw fail('AI_LEASE_LOST');
}
async function releaseSlot(tx, requestId) {
  await tx.aiExecutionSlot.updateMany({
    where: { requestId },
    data: {
      requestId: null,
      callId: null,
      acquiredAt: null,
      expiresAt: null,
    },
  });
}
async function terminal(tx, c, status, errorCode = null) {
  if (!pending(c.row)) return false;
  await tx.aiRequest.update({
    where: { id: c.row.id },
    data: {
      status,
      responseMode: 'NONE',
      errorCode,
      finishedAt: c.now,
      leaseOwner: null,
      leaseExpiresAt: null,
    },
  });
  await clearCallContent(tx, c.call?.id, status);
  await event(tx, `AI_REQUEST_${status}`, c.row.id);
  return true;
}
async function clearCallContent(tx, callId, reason) {
  if (callId)
    await tx.$executeRaw`UPDATE ai_provider_calls SET
    analyze_input = NULL, receipt_payload = NULL, suppression_reason = ${reason}
    WHERE id = ${callId}::uuid`;
}
module.exports = {
  pending,
  clock,
  event,
  locked,
  canRetain,
  eligible,
  fenced,
  releaseSlot,
  terminal,
  clearCallContent,
};
