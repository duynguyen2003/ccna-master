const test = require('node:test');
const assert = require('node:assert/strict');
const { gradeExam, publicExam } = require('./grading');
const { submitExamSchema } = require('../validation/examSchema');
const snapshot = {
  passingScore: 70,
  questions: [{ id: 1, options: ['a', 'b', 'c'], correctAnswer: [1, 2], explanation: 'secret' }],
};

test('grade requires the complete unordered set, rejecting duplicate or invalid indices', () => {
  assert.equal(gradeExam(snapshot, { 1: [2, 1] }).score, 1000);
  for (const answers of [{ 1: [1] }, { 1: [] }, {}])
    assert.equal(gradeExam(snapshot, answers).score, 0);
  for (const answer of [[1, 1], [3], [-1], [1.5], ['1'], null, {}, '1,2']) {
    assert.throws(() => gradeExam(snapshot, { 1: answer }), { status: 400 });
  }
  assert.throws(() => gradeExam(snapshot, { 2: [1, 2] }), { status: 400 });
  assert.throws(() => gradeExam({ questions: [], passingScore: 70 }, {}), { status: 400 });
  assert.equal(gradeExam({ ...snapshot, passingScore: 0 }, {}).isPassed, true);
});
test('attempt responses hide answers and explanations', () => {
  const data = publicExam(snapshot);
  assert.equal(data.questions[0].answerCount, 2);
  assert.doesNotMatch(JSON.stringify(data), /correctAnswer|explanation|secret/);
});
test('submission contract requires a UUID and integer, unique selections', () => {
  const body = { attemptId: require('crypto').randomUUID(), answers: { 1: [1, 2] } };
  assert.equal(submitExamSchema.safeParse(body).success, true);
  for (const change of [
    { attemptId: undefined },
    { answers: { 1: [1, 1] } },
    { answers: { 1: [-1] } },
    { answers: { 1: [1.5] } },
    { answers: { '1x': [0] } },
  ]) {
    assert.equal(submitExamSchema.safeParse({ ...body, ...change }).success, false);
  }
});
