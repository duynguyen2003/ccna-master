const { z } = require('zod');

const submitExamSchema = z.object({
  answers: z.record(z.string(), z.array(z.number()))
    .describe('Dữ liệu đáp án phải là Object { [questionId]: [optionIndices] }'),
  timeSpent: z.number().min(0, 'Thời gian làm bài không được âm')
});

module.exports = {
  submitExamSchema
};
