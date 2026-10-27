const jwt = require('jsonwebtoken');
const { withAttempt } = require('../../backend/src/simulation/attemptAccess');
const { isAccountActive } = require('../../backend/src/security/session');

const denied = (status, code) => Object.assign(new Error(code), { status, code });

// Deliberately takes only the header; a query token cannot authenticate AI.
function readPrincipal(authorization, secret) {
  try {
    if (typeof authorization !== 'string' || !/^Bearer [^\s]+$/.test(authorization))
      throw new Error('Invalid authorization');
    const claims = jwt.verify(authorization.slice(7), secret, { algorithms: ['HS256'] });
    if (
      !Number.isSafeInteger(claims.id) ||
      claims.id <= 0 ||
      !Number.isSafeInteger(claims.sessionVersion) ||
      claims.sessionVersion < 0
    )
      throw new Error('Invalid claims');
    return { id: claims.id, sessionVersion: claims.sessionVersion };
  } catch {
    throw denied(401, 'UNAUTHORIZED');
  }
}

// Server-selected environment and principal only. Callback must stay DB-local.
async function withAiAccess(prisma, scope, callback) {
  const { principal, attemptId, environment, conversationId, epoch } = scope;
  if (
    !principal ||
    !Number.isSafeInteger(principal.id) ||
    !Number.isSafeInteger(principal.sessionVersion)
  )
    throw denied(401, 'UNAUTHORIZED');
  const current = await prisma.user.findUnique({ where: { id: principal.id } });
  if (!isAccountActive(current) || current.sessionVersion !== principal.sessionVersion)
    throw denied(401, 'UNAUTHORIZED');
  return withAttempt(prisma, attemptId, principal.id, async (tx, attempt) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${principal.id} FOR SHARE`;
    const user = await tx.user.findUnique({
      where: { id: principal.id },
      select: {
        id: true,
        isActive: true,
        deletedAt: true,
        sessionVersion: true,
      },
    });
    if (!isAccountActive(user) || user.sessionVersion !== principal.sessionVersion)
      throw denied(401, 'UNAUTHORIZED');
    if (attempt.lab.deletedAt || attempt.lab.status !== 'PUBLISHED')
      throw denied(404, 'AI_RESOURCE_NOT_FOUND');
    let conversation = null;
    if (conversationId) {
      conversation = await tx.aiConversation.findFirst({
        where: {
          id: conversationId,
          userId: principal.id,
          attemptId,
          deletedAt: null,
        },
      });
      if (!conversation) throw denied(404, 'AI_RESOURCE_NOT_FOUND');
      if (!Number.isInteger(epoch) || conversation.epoch !== epoch)
        throw denied(409, 'AI_CONVERSATION_CHANGED');
    }
    await tx.$queryRaw`SELECT environment FROM ai_runtime_policies WHERE environment = ${environment} FOR SHARE`;
    const policy = await tx.aiRuntimePolicy.findUnique({ where: { environment } });
    const rules = policy?.eligibilityRules;
    if (
      !policy?.admissionEnabled ||
      !Array.isArray(rules?.userIds) ||
      !Array.isArray(rules?.labIds) ||
      !rules.userIds.includes(principal.id) ||
      !rules.labIds.includes(attempt.labId)
    )
      throw denied(403, 'AI_NOT_ELIGIBLE');
    return callback(tx, { attempt, conversation, policy, user });
  });
}

module.exports = { readPrincipal, withAiAccess };
