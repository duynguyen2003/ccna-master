const fail = (message) => {
  throw Object.assign(new Error(message), { status: 400 });
};

const validSelection = (selection, optionCount) =>
  Array.isArray(selection) &&
  new Set(selection).size === selection.length &&
  selection.every((index) => Number.isInteger(index) && index >= 0 && index < optionCount);

const publicExam = (snapshot) => ({
  ...snapshot,
  questions: snapshot.questions.map(({ correctAnswer, explanation, ...question }) => ({
    ...question,
    answerCount: correctAnswer.length,
  })),
});

const snapshotExam = (exam) => ({
  id: exam.id,
  title: exam.title,
  examCode: exam.examCode,
  durationMinutes: exam.durationMinutes,
  passingScore: exam.passingScore,
  questions: exam.questions.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    imageUrl: q.imageUrl,
    orderIndex: q.orderIndex,
  })),
});

const gradeExam = (snapshot, answers) => {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers))
    fail('Dữ liệu đáp án không hợp lệ');
  const questions = snapshot.questions;
  if (!questions.length) fail('Đề thi chưa có câu hỏi');
  const ids = new Set(questions.map((q) => String(q.id)));
  if (Object.keys(answers).some((id) => !ids.has(id)))
    fail('Đáp án chứa câu hỏi không thuộc phiên thi');
  let correctCount = 0;
  for (const q of questions) {
    const selected = Object.hasOwn(answers, String(q.id)) ? answers[String(q.id)] : [];
    if (!validSelection(selected, q.options.length))
      fail('Đáp án chứa chỉ số trùng hoặc không hợp lệ');
    if (!validSelection(q.correctAnswer, q.options.length) || !q.correctAnswer.length)
      fail('Đề thi có đáp án không hợp lệ');
    if (
      selected.length === q.correctAnswer.length &&
      q.correctAnswer.every((i) => selected.includes(i))
    )
      correctCount++;
  }
  const percentage = Number(((correctCount / questions.length) * 100).toFixed(2));
  return {
    totalQuestions: questions.length,
    score: Math.round((correctCount / questions.length) * 1000),
    percentage,
    isPassed: (correctCount / questions.length) * 100 >= snapshot.passingScore,
  };
};

module.exports = { validSelection, snapshotExam, publicExam, gradeExam };
