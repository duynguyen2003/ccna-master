const express = require('express');
const { z } = require('zod');
const { VERSION, ErrorStatuses } = require('@ccna/shared/aiLabContract');
const { service } = require('../node/requests');
module.exports = (prisma, config) => {
  const router = express.Router({ mergeParams: true });
  const api = service(prisma, config);
  const handle = (fn) => async (req, res) => {
    res.set('X-AI-Contract-Version', VERSION);
    try {
      const data = await fn(req);
      const pending = ['QUEUED', 'RUNNING'].includes(data.data.status);
      if (pending)
        res.set(
          'Location',
          `/api/lab-attempts/${req.params.attemptId}/ai/requests/${data.data.requestId}`
        );
      res.status(req.method === 'POST' && pending ? 202 : 200).json(data);
    } catch (e) {
      const code = ErrorStatuses[e.code]
        ? e.code
        : e.status === 404
          ? 'AI_RESOURCE_NOT_FOUND'
          : e.status === 400
            ? 'AI_INVALID_REQUEST'
            : 'AI_INTERNAL_ERROR';
      res
        .status(ErrorStatuses[code])
        .json({ contractVersion: VERSION, error: { code, message: code } });
    }
  };
  const uuid = (s) => {
    if (!z.string().uuid().safeParse(s).success)
      throw Object.assign(new Error(), { code: 'AI_INVALID_REQUEST' });
    return s;
  };
  router.post(
    '/requests',
    handle((r) => api.create(r.aiPrincipal, r.params.attemptId, r.body))
  );
  router.get(
    '/requests/by-client-id/:id',
    handle((r) => api.read(r.aiPrincipal, r.params.attemptId, 'clientRequestId', uuid(r.params.id)))
  );
  router.get(
    '/requests/:id',
    handle((r) => api.read(r.aiPrincipal, r.params.attemptId, 'id', uuid(r.params.id)))
  );
  router.post(
    '/requests/:id/cancel',
    handle((r) => api.cancel(r.aiPrincipal, r.params.attemptId, uuid(r.params.id)))
  );
  router.get(
    '/capabilities',
    handle((r) => api.info(r.aiPrincipal, r.params.attemptId))
  );
  router.get(
    '/quota',
    handle((r) => api.info(r.aiPrincipal, r.params.attemptId, true))
  );
  return router;
};
