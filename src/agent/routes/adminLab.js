const express = require('express');
const { z } = require('zod');
const { ErrorStatuses } = require('@ccna/shared/aiLabContract');
const { adminLabService } = require('../node/admin');
module.exports = (prisma, config) => {
  const router = express.Router({ mergeParams: true });
  const service = adminLabService(prisma, config);
  const body = z.object({ enabled: z.boolean(), version: z.number().int().positive() }).strict();
  const handle = (fn) => async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      res.json({ data: await fn(req, Number(req.params.id)) });
    } catch (error) {
      const code =
        error instanceof z.ZodError
          ? 'AI_INVALID_REQUEST'
          : ErrorStatuses[error.code]
            ? error.code
            : 'AI_INTERNAL_ERROR';
      res.status(ErrorStatuses[code]).json({ code, message: code });
    }
  };
  router.get(
    '/',
    handle((req, id) => service.read(req.user, id))
  );
  router.patch(
    '/',
    handle((req, id) => service.update(req.user, id, body.parse(req.body)))
  );
  return router;
};
