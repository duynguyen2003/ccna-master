const { z } = require('zod');
const fail = (status, message) => Object.assign(new Error(message), { status });
const mayAccess = (attempt, userId) => attempt && (attempt.userId === userId || (attempt.members || []).includes(userId));
// Shared DB locks work across backend replicas; validate/read only after acquiring lock.
async function withAttempt(prisma, id, userId, callback) {
  if (!z.string().uuid().safeParse(id).success) throw fail(400, 'Invalid attempt ID');
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))::text AS locked`;
    const attempt = await tx.labAttempt.findUnique({ where: { id }, include: { lab: true } });
    if (!mayAccess(attempt, userId)) throw fail(404, 'Không tìm thấy phiên Lab');
    return callback(tx, attempt);
  }, { timeout: 15000, maxWait: 10000 });
}
module.exports = { fail, mayAccess, withAttempt };
