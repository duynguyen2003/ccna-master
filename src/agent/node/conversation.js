const { createHmac, timingSafeEqual } = require('node:crypto');
const { schemas, VERSION } = require('@ccna/shared/aiLabContract');
const { withAiAccess } = require('./access');
const { fail } = require('./quota');
const { redactor } = require('./redaction');
const { clock, pending, terminal, releaseSlot } = require('./lifecycle');
const { settle } = require('./settlement');

function cursorCodec(secret, environment) {
  const signature = (value) =>
    createHmac('sha256', secret)
      .update(`ai-history-v1:${environment}:${value}`)
      .digest('base64url');
  return {
    encode(binding) {
      const value = Buffer.from(JSON.stringify(binding)).toString('base64url');
      return `${value}.${signature(value)}`;
    },
    decode(cursor, scope) {
      try {
        if (typeof cursor !== 'string' || cursor.length > 1000) throw new Error();
        const [value, mac, extra] = cursor.split('.');
        if (extra !== undefined || !value || !mac) throw new Error();
        const expected = Buffer.from(signature(value));
        const actual = Buffer.from(mac);
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
          throw new Error();
        const data = JSON.parse(Buffer.from(value, 'base64url').toString());
        if (
          data.c !== scope.c ||
          data.e !== scope.e ||
          data.u !== scope.u ||
          data.a !== scope.a ||
          !/^[0-9a-f-]{36}$/i.test(data.i) ||
          !Number.isFinite(Date.parse(data.t))
        )
          throw new Error();
        return data;
      } catch {
        throw fail('AI_INVALID_REQUEST');
      }
    },
  };
}

function conversationService(prisma, config) {
  const { environment, ownerSecret } = config;
  const authorize = (principal, attemptId, callback) => {
    if (!ownerSecret || ownerSecret.length < 32) throw fail('AI_DISABLED');
    return withAiAccess(prisma, { principal, attemptId, environment }, async (tx, context) => {
      const conversation = await tx.aiConversation.findFirst({
        where: { userId: principal.id, attemptId, deletedAt: null },
      });
      if (!conversation) throw fail('AI_RESOURCE_NOT_FOUND');
      await tx.$queryRaw`SELECT id FROM ai_conversations WHERE id = ${conversation.id}::uuid FOR SHARE`;
      const current = await tx.aiConversation.findFirst({
        where: {
          id: conversation.id,
          userId: principal.id,
          attemptId,
          epoch: conversation.epoch,
          deletedAt: null,
        },
      });
      if (!current) throw fail('AI_CONVERSATION_CHANGED');
      return callback(tx, { ...context, conversation });
    });
  };
  return {
    reset(principal, attemptId, conversationId, epoch) {
      if (!Number.isSafeInteger(epoch) || epoch < 0) throw fail('AI_INVALID_REQUEST');
      return authorize(principal, attemptId, async (tx, { conversation }) => {
        if (conversation.id !== conversationId || conversation.epoch !== epoch)
          throw fail('AI_CONVERSATION_CHANGED');
        await tx.$queryRaw`SELECT id FROM ai_conversations WHERE id = ${conversationId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`ai-admission:${environment}`}, 1))::text`;
        const now = await clock(tx);
        const rows = await tx.aiRequest.findMany({
          where: { conversationId },
          orderBy: { id: 'asc' },
        });
        for (const row of rows) {
          const call = await tx.aiProviderCall.findUnique({
            where: { requestId_stepIndex: { requestId: row.id, stepIndex: 0 } },
          });
          if (pending(row)) {
            const beforeDispatch = !call || call.state === 'PLANNED';
            if (call && beforeDispatch)
              await tx.aiProviderCall.update({
                where: { id: call.id },
                data: { state: 'KNOWN_FAILURE', suppressionReason: 'CONVERSATION_RESET' },
              });
            await terminal(tx, { row, call, now }, 'DELETED');
            await settle(tx, row, beforeDispatch ? 0n : call.costMicros, false, now);
            if (beforeDispatch || ['RECEIVED', 'KNOWN_FAILURE'].includes(call.state))
              await releaseSlot(tx, row.id);
          }
        }
        // Purge content now, retain request IDs/usage/reservations for late receipts.
        await tx.aiMessage.deleteMany({ where: { conversationId } });
        await tx.$executeRaw`UPDATE ai_provider_calls SET analyze_input = NULL, receipt_payload = NULL, suppression_reason = 'CONVERSATION_RESET'
          WHERE request_id IN (SELECT id FROM ai_requests WHERE conversation_id = ${conversationId}::uuid)`;
        await tx.$executeRaw`UPDATE ai_requests SET snapshot = NULL, purged_at = ${now} WHERE conversation_id = ${conversationId}::uuid`;
        await tx.aiConversation.update({
          where: { id: conversationId },
          data: { epoch: { increment: 1 } },
        });
        await tx.aiEventOutbox.create({
          data: {
            type: 'AI_CONVERSATION_RESET',
            payload: { conversationId, conversationEpoch: epoch + 1 },
          },
        });
        return schemas.DeleteConversationResponse.parse({
          contractVersion: VERSION,
          data: {
            conversationId,
            conversationEpoch: epoch + 1,
            deleted: true,
            purgeBy: now.toISOString(),
          },
        });
      });
    },
    history(principal, attemptId, query = {}) {
      if (
        Object.keys(query).some((key) => !['cursor', 'limit'].includes(key)) ||
        (query.limit !== undefined && !/^(?:[1-9]|[1-4][0-9]|50)$/.test(String(query.limit))) ||
        (query.cursor !== undefined && typeof query.cursor !== 'string')
      )
        throw fail('AI_INVALID_REQUEST');
      const limit = Number(query.limit || 20);
      return authorize(principal, attemptId, async (tx, { conversation }) => {
        const codec = cursorCodec(ownerSecret, environment);
        const scope = { c: conversation.id, e: conversation.epoch, u: principal.id, a: attemptId };
        const before = query.cursor ? codec.decode(query.cursor, scope) : null;
        const rows = await tx.aiMessage.findMany({
          where: {
            conversationId: conversation.id,
            epoch: conversation.epoch,
            request: { userId: principal.id, attemptId, status: { notIn: ['DELETED', 'REVOKED'] } },
            ...(before
              ? {
                  OR: [
                    { createdAt: { lt: new Date(before.t) } },
                    { createdAt: new Date(before.t), id: { lt: before.i } },
                  ],
                }
              : {}),
          },
          include: { request: { select: { responseMode: true, sourceRevision: true } } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
        });
        const page = rows.slice(0, limit);
        const last = page.at(-1);
        const items = page.map((row) =>
          row.role === 'USER'
            ? {
                messageId: row.id,
                requestId: row.requestId,
                role: 'USER',
                content: row.content,
                createdAt: row.createdAt.toISOString(),
              }
            : {
                messageId: row.id,
                requestId: row.requestId,
                role: 'ASSISTANT',
                responseMode: row.request.responseMode,
                sourceRevision: row.request.sourceRevision,
                result: row.structuredAnswer,
                createdAt: row.createdAt.toISOString(),
              }
        );
        return schemas.HistoryResponse.parse({
          contractVersion: VERSION,
          data: {
            conversationId: conversation.id,
            conversationEpoch: conversation.epoch,
            items,
            nextCursor:
              rows.length > limit && last
                ? codec.encode({ ...scope, t: last.createdAt.toISOString(), i: last.id })
                : null,
          },
        });
      });
    },
    feedback(principal, attemptId, messageId, input) {
      const parsed = schemas.FeedbackRequest.safeParse(input);
      if (!parsed.success) throw fail('AI_INVALID_REQUEST');
      return authorize(principal, attemptId, async (tx, { conversation }) => {
        const message = await tx.aiMessage.findFirst({
          where: {
            id: messageId,
            role: 'ASSISTANT',
            conversationId: conversation.id,
            epoch: conversation.epoch,
            request: {
              userId: principal.id,
              attemptId,
              status: { in: ['COMPLETED', 'OUTCOME_UNKNOWN'] },
            },
          },
        });
        if (!message) throw fail('AI_RESOURCE_NOT_FOUND');
        const data = {
          helpful: parsed.data.helpful,
          reasonCode: parsed.data.reasonCode,
          optionalComment:
            parsed.data.comment == null ? null : redactor([]).text(parsed.data.comment, 1000),
        };
        const row = await tx.aiFeedback.upsert({
          where: { messageId_userId: { messageId, userId: principal.id } },
          create: { messageId, userId: principal.id, ...data },
          update: data,
        });
        return schemas.FeedbackResponse.parse({
          contractVersion: VERSION,
          data: { messageId, helpful: row.helpful, updatedAt: row.updatedAt.toISOString() },
        });
      });
    },
  };
}
module.exports = { conversationService, cursorCodec };
