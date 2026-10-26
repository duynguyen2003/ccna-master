const express = require('express');
const { z } = require('zod');
const { VERSION, ErrorStatuses, schemas } = require('@ccna/shared/aiLabContract');
const { dispatch } = require('../node/dispatch');
const { receipts } = require('../node/receipts');
const { serviceAuth } = require('../node/serviceAuth');
const { fail } = require('../node/quota');
module.exports = (prisma, config) => {
  const router = express.Router();
  const auth = serviceAuth(config.auth || {});
  const permits = dispatch(prisma, config);
  const results = receipts(prisma, config);
  router.use(express.json({ limit: '64kb' }));
  const handle = (operation, schema, fn) => async (req, res) => {
    res.set({ 'X-AI-Contract-Version': VERSION, 'Cache-Control': 'private, no-store' });
    try {
      const claims = auth.verify(req.headers.authorization, operation);
      if (
        req.headers['x-ai-contract-version'] !== VERSION ||
        !z.string().uuid().safeParse(req.params.callId).success
      )
        throw fail('AI_INVALID_REQUEST');
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) throw fail('AI_INVALID_REQUEST');
      const body = parsed.data;
      for (const key of ['requestId', 'callId', 'contextHash', 'leaseVersion'])
        if (claims[key] !== body[key]) throw fail('UNAUTHORIZED');
      if (body.callId !== req.params.callId) throw fail('AI_INVALID_REQUEST');
      res.json(await fn(body));
    } catch (error) {
      const code = ErrorStatuses[error.code] ? error.code : 'AI_INTERNAL_ERROR';
      res
        .status(ErrorStatuses[code])
        .json({ contractVersion: VERSION, error: { code, message: code } });
    }
  };
  router.post(
    '/provider-calls/:callId/claim',
    handle('CLAIM', schemas.ClaimRequest, permits.claim)
  );
  router.put(
    '/provider-calls/:callId/receipt',
    handle('RECEIPT', schemas.ProviderReceipt, results.record)
  );
  router.use((error, req, res, next) => {
    if (!error) return next();
    const code = error.type === 'entity.too.large' ? 'AI_CONTEXT_TOO_LARGE' : 'AI_INVALID_REQUEST';
    res
      .set({ 'X-AI-Contract-Version': VERSION, 'Cache-Control': 'private, no-store' })
      .status(ErrorStatuses[code])
      .json({ contractVersion: VERSION, error: { code, message: code } });
  });
  return router;
};
