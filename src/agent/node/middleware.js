const { readPrincipal, withAiAccess } = require('./access');
const { VERSION, ErrorStatuses } = require('@ccna/shared/aiLabContract');
function aiAccessMiddleware(prisma, environment, secret) {
  return async (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    res.set('X-AI-Contract-Version', VERSION);
    try {
      const principal = readPrincipal(req.headers.authorization, secret);
      await withAiAccess(
        prisma,
        { principal, attemptId: req.params.attemptId, environment },
        async () => {}
      );
      req.aiPrincipal = principal;
      next();
    } catch (error) {
      const code = ErrorStatuses[error.code]
        ? error.code
        : error.status === 404
          ? 'AI_RESOURCE_NOT_FOUND'
          : error.status === 400
            ? 'AI_INVALID_REQUEST'
            : 'AI_INTERNAL_ERROR';
      res
        .status(ErrorStatuses[code])
        .json({ contractVersion: VERSION, error: { code, message: code } });
    }
  };
}
module.exports = { aiAccessMiddleware };
