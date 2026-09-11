const { z } = require('zod');
const service = require('../services/learningPathService');
const {
  contentId,
  moduleProgressSchema,
  progressSchema,
  videoProgressSchema,
} = require('../validation/learningPathSchema');

const handle = (fn) => async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof z.ZodError)
      return res.status(400).json({
        code: 'INVALID_PAYLOAD',
        message: 'Dữ liệu không hợp lệ.',
        errors: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    if (error.status && error.status >= 400 && error.status < 500) {
      return res.status(error.status).json({ code: error.code, message: error.message });
    }
    console.error('Learning progress request failed:', error.code || error.name);
    return res.status(500).json({
      code: 'LEARNING_PATH_ERROR',
      message: 'Không thể xử lý tiến độ học tập. Vui lòng thử lại.',
    });
  }
};

const getLearningPath = handle(async (req, res) => {
  res.json({ data: await service.getLearningPath(req.user.id) });
});
const completeModule = handle(async (req, res) => {
  const moduleId = contentId.parse(req.params.moduleId);
  moduleProgressSchema.parse(req.body);
  const result = await service.completeModule(req.user.id, moduleId);
  res.json({ data: { ...result.transition, learningPath: result.learningPath } });
});
const updateProgress = handle(async (req, res) => {
  const result = await service.updateProgress(req.user.id, progressSchema.parse(req.body));
  res.json({
    data: result.record,
    overallPercent: result.transition.courseProgress,
    transition: result.transition,
    learningPath: result.learningPath,
  });
});
const updateVideoProgress = handle(async (req, res) => {
  const video = await service.updateVideoProgress(req.user.id, videoProgressSchema.parse(req.body));
  res.json({ success: true, data: video });
});

module.exports = { getLearningPath, completeModule, updateProgress, updateVideoProgress };
