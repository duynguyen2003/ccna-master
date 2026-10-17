const { z } = require('zod');

const submitExamSchema = z.object({
  attemptId: z.uuid(),
  answers: z
    .record(
      z.string().regex(/^[1-9]\d*$/),
      z
        .array(z.number().int().nonnegative())
        .refine((a) => new Set(a).size === a.length, 'Đáp án không được trùng')
    )
    .describe('Dữ liệu đáp án phải là Object { [questionId]: [optionIndices] }'),
  timeSpent: z.number().int().nonnegative().optional(),
});

module.exports = {
  submitExamSchema,
};
