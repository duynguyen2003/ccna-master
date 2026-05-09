const { getPrisma } = require('../config/database');
const { uploadBufferToCloudinary } = require('../config/cloudinary');
const { ValidationError } = require('../errors/validation-error');

const prisma = getPrisma();

// ─── Helpers ────────────────────────────────────────────────────────────────

// [OPT-05] Tránh lặp parseInt + isNaN ở mọi controller
const parseId = (raw, label = 'ID') => {
  const id = parseInt(raw, 10);
  if (Number.isNaN(id)) {
    throw Object.assign(new Error(`${label} không hợp lệ`), { status: 400 });
  }
  return id;
};

// ─── Sanitizer ───────────────────────────────────────────────────────────────

const sanitizeQuestionsInput = (questions) => {
  if (!Array.isArray(questions)) {
    throw new ValidationError('Danh sách câu hỏi không hợp lệ');
  }
  if (questions.length === 0) {
    throw new ValidationError('Cần ít nhất 1 câu hỏi cho bài thi');
  }

  return questions.map((questionItem, index) => {
    const rawOptions = Array.isArray(questionItem.options) ? questionItem.options : [];
    const normalizedOptions = rawOptions
      .map(opt => `${opt || ''}`.trim())
      .filter(opt => opt !== '');
    const questionText = `${questionItem.question || ''}`.trim();

    // Hỗ trợ chọn nhiều đáp án (lưu dạng mảng index)
    let correctAnswers = questionItem.correctAnswer;
    if (!Array.isArray(correctAnswers)) {
      const single = parseInt(correctAnswers, 10);
      correctAnswers = Number.isNaN(single) ? [] : [single];
    } else {
      correctAnswers = correctAnswers
        .map(ans => parseInt(ans, 10))
        .filter(ans => !Number.isNaN(ans));
    }

    const imageUrl = `${questionItem.imageUrl || ''}`.trim() || null;

    if (!questionText) {
      throw new ValidationError(`Câu hỏi ${index + 1} không được để trống`);
    }
    if (normalizedOptions.length < 2) {
      throw new ValidationError(`Câu hỏi ${index + 1} cần ít nhất 2 đáp án`);
    }
    if (correctAnswers.length === 0) {
      throw new ValidationError(`Câu hỏi ${index + 1} chưa chọn đáp án đúng`);
    }
    if (correctAnswers.some(ans => ans < 0 || ans >= normalizedOptions.length)) {
      throw new ValidationError(`Câu hỏi ${index + 1} có đáp án đúng không hợp lệ`);
    }

    return {
      question: questionText,
      options: normalizedOptions,
      correctAnswer: correctAnswers,
      explanation: `${questionItem.explanation || ''}`.trim() || null,
      imageUrl,
      orderIndex: index + 1,
    };
  });
};

// ─── Controllers ─────────────────────────────────────────────────────────────

module.exports.getExams = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const whereClause = { deletedAt: null };
    if (!req.user || req.user.role !== 'ADMIN') {
      whereClause.status = 'OPEN';
    }

    const [exams, total] = await Promise.all([
      prisma.exam.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { questions: true, results: true } },
          course: { select: { title: true, code: true } },
          module: { select: { id: true, title: true } },
        },
      }),
      prisma.exam.count({ where: whereClause }),
    ]);

    res.json({
      data: exams,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

module.exports.createExam = async (req, res, next) => {
  try {
    const {
      title, examCode, durationMinutes, passingScore,
      difficulty, courseId, moduleId, status, questions,
    } = req.body;

    if (!title || !durationMinutes) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ: Tên và Thời gian thi' });
    }

    const sanitizedQuestions = sanitizeQuestionsInput(questions || []);

    const exam = await prisma.exam.create({
      data: {
        title,
        examCode: examCode || null,
        totalQuestions: sanitizedQuestions.length,
        durationMinutes: parseInt(durationMinutes, 10),
        passingScore: parseInt(passingScore, 10) || 70,
        difficulty: difficulty || null,
        courseId: courseId || null,
        moduleId: moduleId || null,
        status: status || 'DRAFT',
        questions: { create: sanitizedQuestions },
      },
      include: { questions: true },
    });

    res.status(201).json({ message: 'Tạo bài thi thành công', exam });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(error.statusCode || 400).json({ message: error.message });
    }
    next(error);
  }
};

module.exports.getExamById = async (req, res, next) => {
  try {
    // [OPT-05] Dùng parseId helper
    let examId;
    try { examId = parseId(req.params.id, 'ID bài thi'); }
    catch (e) { return res.status(400).json({ message: e.message }); }

    const isAdmin = req.user?.role === 'ADMIN';
    const whereClause = { id: examId, deletedAt: null };
    if (!isAdmin) whereClause.status = 'OPEN';

    const exam = await prisma.exam.findFirst({
      where: whereClause,
      include: {
        questions: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { questions: true, results: true } },
        course: { select: { title: true, code: true } },
        module: { select: { id: true, title: true } },
      },
    });

    if (!exam) {
      return res.status(404).json({ message: 'Không tìm thấy bài thi' });
    }

    // Thêm answerCount; ẩn correctAnswer và explanation với học viên
    exam.questions = exam.questions.map(q => {
      const answerCount = Array.isArray(q.correctAnswer) ? q.correctAnswer.length : 1;
      if (!isAdmin) {
        const { correctAnswer, explanation, ...rest } = q;
        return { ...rest, answerCount };
      }
      return { ...q, answerCount };
    });

    res.json({ exam });
  } catch (error) {
    next(error);
  }
};

module.exports.updateExam = async (req, res, next) => {
  try {
    let examId;
    try { examId = parseId(req.params.id, 'ID bài thi'); }
    catch (e) { return res.status(400).json({ message: e.message }); }

    const {
      title, examCode, durationMinutes, passingScore,
      difficulty, courseId, moduleId, status, questions,
    } = req.body;

    const sanitizedQuestions = questions !== undefined
      ? sanitizeQuestionsInput(questions)
      : null;

    const exam = await prisma.exam.update({
      where: { id: examId },
      data: {
        title,
        examCode: examCode || null,
        totalQuestions: sanitizedQuestions ? sanitizedQuestions.length : undefined,
        durationMinutes: durationMinutes !== undefined ? parseInt(durationMinutes, 10) : undefined,
        passingScore: passingScore !== undefined ? parseInt(passingScore, 10) : undefined,
        difficulty: difficulty || null,
        courseId: courseId || null,
        moduleId: moduleId || null,
        status,
        ...(sanitizedQuestions
          ? { questions: { deleteMany: {}, create: sanitizedQuestions } }
          : {}),
      },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    });

    res.json({ message: 'Cập nhật bài thi thành công', exam });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Không tìm thấy bài thi' });
    }
    next(error);
  }
};

module.exports.deleteExam = async (req, res, next) => {
  try {
    let examId;
    try { examId = parseId(req.params.id, 'ID bài thi'); }
    catch (e) { return res.status(400).json({ message: e.message }); }

    const existing = await prisma.exam.findFirst({
      where: { id: examId, deletedAt: null },
    });
    if (!existing) {
      return res.status(404).json({ message: 'Không tìm thấy bài thi' });
    }

    await prisma.exam.update({
      where: { id: examId },
      data: { deletedAt: new Date() },
    });

    res.json({ message: 'Xóa bài thi thành công' });
  } catch (error) {
    next(error);
  }
};

module.exports.uploadQuestionImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng chọn ảnh để tải lên.' });
    }

    const uploadResult = await uploadBufferToCloudinary(req.file, {
      folder: 'ccna/exams/questions',
      resourceType: 'image',
    });

    res.status(201).json({
      message: 'Tải ảnh câu hỏi thành công',
      imageUrl: uploadResult.secure_url,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Submit Exam ─────────────────────────────────────────────────────────────

module.exports.submitExam = async (req, res, next) => {
  try {
    let examId;
    try { examId = parseId(req.params.id, 'ID bài thi'); }
    catch (e) { return res.status(400).json({ message: e.message }); }

    const userId = req.user.id;
    const { answers, timeSpent } = req.body;

    // [OPT-03] Validate answers trước khi xử lý
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return res.status(400).json({ message: 'Dữ liệu đáp án không hợp lệ' });
    }

    // Validate timeSpent
    const safeTimeSpent = Math.max(0, parseInt(timeSpent, 10) || 0);

    console.log('>>> [BACKEND] submitExam called:', {
      examId,
      userId,
      answersCount: Object.keys(answers).length,
      timeSpent: safeTimeSpent,
    });

    // [BUG-02] Idempotency — tăng window lên 5 phút để tránh duplicate do timeout mạng
    // TODO: Nâng cấp lên attemptToken (UUID) để chính xác hơn
    const recentAttempt = await prisma.examResult.findFirst({
      where: {
        examId,
        userId,
        takenAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });
    if (recentAttempt) {
      return res.json({ message: 'Nộp bài thành công', resultId: recentAttempt.id });
    }

    const exam = await prisma.exam.findFirst({
      where: { id: examId, deletedAt: null },
      include: { questions: true },
    });
    if (!exam) {
      return res.status(404).json({ message: 'Không tìm thấy bài thi' });
    }

    // Chấm điểm server-side
    let correctCount = 0;
    const totalQuestions = exam.questions.length;

    exam.questions.forEach((q) => {
      // [BUG-01] Explicit String() — JSON key luôn là string, q.id từ Prisma là number
      const userAns = answers[String(q.id)] ?? [];
      const correctAns = q.correctAnswer || [];

      // [OPT-06] Bỏ kiểm tra 2 chiều thừa — length + every một chiều là đủ
      if (
        userAns.length === correctAns.length &&
        userAns.every(v => correctAns.includes(v))
      ) {
        correctCount++;
      }
    });

    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 1000) : 0;
    const percentage = totalQuestions > 0
      ? parseFloat(((correctCount / totalQuestions) * 100).toFixed(2))
      : 0;

    // passingScore lưu dưới dạng % (ví dụ: 70 = 70%)
    const passingScorePercent = exam.passingScore || 70;
    const isPassed = percentage >= passingScorePercent;

    const result = await prisma.examResult.create({
      data: {
        userId,
        examId,
        score,
        totalQuestions,
        percentage,
        isPassed,
        answers,
        timeSpent: safeTimeSpent,
      },
    });

    res.json({ message: 'Nộp bài thành công', resultId: result.id });
  } catch (error) {
    next(error);
  }
};

// ─── Get Exam Result ─────────────────────────────────────────────────────────

module.exports.getExamResultById = async (req, res, next) => {
  try {
    let resultId;
    try { resultId = parseId(req.params.resultId, 'ID kết quả'); }
    catch (e) { return res.status(400).json({ message: e.message }); }

    const userId = req.user.id;

    const result = await prisma.examResult.findFirst({
      where: { id: resultId, userId },
      include: {
        exam: {
          include: { questions: { orderBy: { orderIndex: 'asc' } } },
        },
      },
    });

    if (!result) {
      return res.status(404).json({ message: 'Không tìm thấy kết quả bài thi' });
    }

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

// ─── Get Exam History ────────────────────────────────────────────────────────

module.exports.getMyExamHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // [OPT-04] Thêm pagination — tránh trả về toàn bộ bảng
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const [history, total] = await Promise.all([
      prisma.examResult.findMany({
        where: { userId },
        orderBy: { takenAt: 'desc' },
        skip,
        take: limit,
        include: {
          exam: {
            select: {
              title: true,
              examCode: true,
              passingScore: true,
              durationMinutes: true,
            },
          },
        },
      }),
      prisma.examResult.count({ where: { userId } }),
    ]);

    res.json({
      data: history,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};