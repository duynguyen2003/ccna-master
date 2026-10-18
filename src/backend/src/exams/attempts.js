const { snapshotExam, publicExam, gradeExam } = require('./grading');
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const presentAttempt = (attempt) => ({
  id: attempt.id,
  startedAt: attempt.startedAt,
  expiresAt: attempt.expiresAt,
  serverTime: new Date(),
  submittedAt: attempt.submittedAt,
  resultId: attempt.result?.id ?? null,
  exam: publicExam(attempt.examSnapshot),
});

const startAttempt = (prisma, userId, examId) =>
  prisma.$transaction(async (tx) => {
    // Serialize starts for an exam so retries/tabs resume the same active attempt.
    await tx.$queryRaw`SELECT id FROM exams WHERE id = ${examId} FOR UPDATE`;
    const exam = await tx.exam.findFirst({
      where: { id: examId, deletedAt: null, status: 'OPEN' },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!exam) fail(404, 'Không tìm thấy bài thi đang mở');
    const now = new Date();
    const active = await tx.examAttempt.findFirst({
      where: { userId, examId, submittedAt: null, expiresAt: { gt: now } },
      include: { result: true },
    });
    if (active) return presentAttempt(active);
    const snapshot = snapshotExam(exam);
    gradeExam(snapshot, {}); // Refuse unusable published definitions before starting the clock.
    if (!Number.isInteger(exam.durationMinutes) || exam.durationMinutes <= 0)
      fail(400, 'Thời gian thi không hợp lệ');
    const attempt = await tx.examAttempt.create({
      data: {
        userId,
        examId,
        examSnapshot: snapshot,
        startedAt: now,
        expiresAt: new Date(now.getTime() + exam.durationMinutes * 60000),
      },
    });
    return presentAttempt(attempt);
  });

const submitAttempt = (prisma, userId, examId, attemptId, answers) =>
  prisma.$transaction(async (tx) => {
    // Lock before reading: simultaneous submissions return the single committed result.
    await tx.$queryRaw`SELECT id FROM exam_attempts WHERE id = ${attemptId}::uuid AND user_id = ${userId} FOR UPDATE`;
    const attempt = await tx.examAttempt.findFirst({
      where: { id: attemptId, userId, examId },
      include: { result: true },
    });
    if (!attempt) fail(404, 'Không tìm thấy phiên thi');
    if (attempt.result) return attempt.result.id;
    const now = new Date();
    if (now > attempt.expiresAt)
      fail(409, 'Phiên thi đã hết thời gian nộp bài. Vui lòng bắt đầu lượt thi mới.');
    const grade = gradeExam(attempt.examSnapshot, answers);
    const result = await tx.examResult.create({
      data: {
        userId,
        examId,
        attemptId,
        answers,
        ...grade,
        examSnapshot: attempt.examSnapshot,
        timeSpent: Math.max(0, Math.floor((now - attempt.startedAt) / 1000)),
        takenAt: now,
      },
    });
    await tx.examAttempt.update({ where: { id: attemptId }, data: { submittedAt: now } });
    return result.id;
  });

module.exports = { startAttempt, submitAttempt, presentAttempt };
