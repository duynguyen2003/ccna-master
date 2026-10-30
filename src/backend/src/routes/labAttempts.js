const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { cliCommandLimiter } = require('../middleware/rateLimiter');
const controller = require('../controllers/labAttemptController');

const router = express.Router();
const { aiAccessMiddleware } = require('@ccna/agent/node/middleware');
const { getPrisma } = require('../config/database');

router.use(
  '/:attemptId/ai',
  aiAccessMiddleware(getPrisma(), process.env.AI_ENVIRONMENT || 'local', process.env.JWT_SECRET)
);

router.use(verifyToken);
router.use(
  '/:attemptId/ai',
  require('@ccna/agent/routes/aiLab')(getPrisma(), {
    ...require('@ccna/agent/node/workerConfig').runtimeConfig(),
    environment: process.env.AI_ENVIRONMENT || 'local',
    recoveryEpoch: process.env.AI_RECOVERY_EPOCH,
    ownerSecret: process.env.AI_OWNER_SECRET,
  })
);
router.get('/achievements', controller.achievements);
router.post('/:attemptId/actions', cliCommandLimiter, controller.executeAttemptCommand);
router.get('/:attemptId/replay', cliCommandLimiter, controller.replayAttempt);
router.post('/:attemptId/members', cliCommandLimiter, controller.updateMembers);
router.post('/:attemptId/explain', cliCommandLimiter, controller.explainAttempt);
router.post('/labs/:labId/start', controller.startAttempt);
router.get('/:attemptId', controller.getAttempt);
router.post('/:attemptId/commands', cliCommandLimiter, controller.executeAttemptCommand);
router.get('/:attemptId/completions', cliCommandLimiter, controller.getAttemptCompletions);
router.post('/:attemptId/submit', cliCommandLimiter, controller.submitAttempt);
router.post('/:attemptId/restart', cliCommandLimiter, controller.restartAttempt);

module.exports = router;
