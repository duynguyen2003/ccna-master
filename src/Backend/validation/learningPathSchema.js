const { z } = require('zod');

const contentId = z.string().trim().min(1).max(10);
const numericId = z
  .union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
  .pipe(z.number().int().positive().max(2147483647));
const progressSchema = z
  .object({
    courseId: contentId,
    moduleId: contentId.nullish(),
    lessonId: numericId.nullish(),
    labId: numericId.nullish(),
    progressPercent: z.number().int().min(0).max(100).default(0),
    status: z.enum(['ACTIVE', 'COMPLETED']).default('ACTIVE'),
  })
  .strict()
  .refine((value) => !(value.lessonId != null && value.labId != null), {
    message: 'Chỉ cập nhật một bài học hoặc một Lab trong mỗi yêu cầu.',
  });
const moduleProgressSchema = z.object({ completed: z.literal(true) }).strict();
const videoProgressSchema = z
  .object({
    lessonId: numericId,
    sessionId: z.string().uuid(),
    sessionStartedAt: z.string().datetime({ offset: true }),
    sequence: z.number().int().positive().max(2147483647),
    sessionWatchedSeconds: z.number().int().min(0).max(604800),
    lastPosition: z.number().int().min(0).max(86400),
    capturedAt: z.string().datetime({ offset: true }),
    isCompleted: z.boolean().optional(),
  })
  .strict();

module.exports = {
  contentId,
  numericId,
  progressSchema,
  moduleProgressSchema,
  videoProgressSchema,
};
