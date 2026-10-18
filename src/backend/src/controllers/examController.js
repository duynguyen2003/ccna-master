const { getPrisma } = require('../config/database');
const { uploadBufferToCloudinary } = require('../config/cloudinary');
const { ValidationError } = require('../errors/validation-error');
const { adminActionLogger } = require('../middleware/logging');
const { validSelection } = require('../exams/grading');
const { startAttempt, submitAttempt, presentAttempt } = require('../exams/attempts');

const prisma = getPrisma();

// ─── Helpers ────────────────────────────────────────────────────────────────

// [OPT-05] Tránh lặp parseInt + isNaN ở mọi controller
const parseId = (raw, label = 'ID') => {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) {
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
    const normalizedOptions = rawOptions.map((opt) => `${opt || ''}`.trim());
    const questionText = `${questionItem.question || ''}`.trim();

    // Hỗ trợ chọn nhiều đáp án (lưu dạng mảng index)
    let correctAnswers = questionItem.correctAnswer;
    if (!Array.isArray(correctAnswers)) {
      correctAnswers = Number.isInteger(correctAnswers) ? [correctAnswers] : [];
    }

    const imageUrl = `${questionItem.imageUrl || ''}`.trim() || null;

    if (!questionText) {
      throw new ValidationError(`Câu hỏi ${index + 1} không được để trống`);
    }
    if (normalizedOptions.length < 2 || normalizedOptions.some((option) => !option)) {
      throw new ValidationError(`Câu hỏi ${index + 1} cần ít nhất 2 đáp án`);
    }
    if (correctAnswers.length === 0) {
      throw new ValidationError(`Câu hỏi ${index + 1} chưa chọn đáp án đúng`);
    }
    if (!validSelection(correctAnswers, normalizedOptions.length)) {
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

const validateSettings = ({ durationMinutes, passingScore }) => {
  if (
    durationMinutes !== undefined &&
    (!Number.isInteger(Number(durationMinutes)) ||
      Number(durationMinutes) < 1 ||
      Number(durationMinutes) > 600)
  ) {
    throw new ValidationError('Thời gian thi phải từ 1 đến 600 phút');
  }
  if (
    passingScore !== undefined &&
    (!Number.isInteger(Number(passingScore)) ||
      Number(passingScore) < 0 ||
      Number(passingScore) > 100)
  ) {
    throw new ValidationError('Điểm đạt phải từ 0 đến 100 phần trăm');
  }
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
      title,
      examCode,
      durationMinutes,
      passingScore,
      difficulty,
      courseId,
      moduleId,
      status,
      questions,
    } = req.body;

    if (!title || !durationMinutes) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ: Tên và Thời gian thi' });
    }

    validateSettings({ durationMinutes, passingScore });
    const sanitizedQuestions = sanitizeQuestionsInput(questions || []);

    const exam = await prisma.exam.create({
      data: {
        title,
        examCode: examCode || null,
        totalQuestions: sanitizedQuestions.length,
        durationMinutes: parseInt(durationMinutes, 10),
        passingScore: passingScore === undefined ? 70 : Number(passingScore),
        difficulty: difficulty || null,
        courseId: courseId || null,
        moduleId: moduleId || null,
        status: status || 'DRAFT',
        questions: { create: sanitizedQuestions },
      },
      include: { questions: true },
    });

    // Log action
    await adminActionLogger(
      'CREATE_EXAM',
      req.user.id,
      `Tạo đề thi mới: ${exam.title}`,
      'exams',
      exam.id
    );

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
    try {
      examId = parseId(req.params.id, 'ID bài thi');
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

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
    exam.questions = exam.questions.map((q) => {
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
    try {
      examId = parseId(req.params.id, 'ID bài thi');
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

    const {
      title,
      examCode,
      durationMinutes,
      passingScore,
      difficulty,
      courseId,
      moduleId,
      status,
      questions,
    } = req.body;

    validateSettings({ durationMinutes, passingScore });
    const sanitizedQuestions = questions !== undefined ? sanitizeQuestionsInput(questions) : null;

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

    // Log action
    await adminActionLogger(
      'UPDATE_EXAM',
      req.user.id,
      `Cập nhật đề thi: ${exam.title}`,
      'exams',
      exam.id
    );

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
    try {
      examId = parseId(req.params.id, 'ID bài thi');
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

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

    // Log action
    await adminActionLogger(
      'DELETE_EXAM',
      req.user.id,
      `Xóa đề thi (soft delete): ${existing.title}`,
      'exams',
      examId
    );

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

module.exports.startAttempt = async (req, res, next) => {
  try {
    const attempt = await startAttempt(prisma, req.user.id, parseId(req.params.id));
    res.json({ attempt });
  } catch (error) {
    next(error);
  }
};

module.exports.getAttempt = async (req, res, next) => {
  try {
    const attempt = await prisma.examAttempt.findFirst({
      where: { id: req.params.attemptId, userId: req.user.id, examId: parseId(req.params.id) },
      include: { result: true },
    });
    if (!attempt) return res.status(404).json({ message: 'Không tìm thấy phiên thi' });
    res.json({ attempt: presentAttempt(attempt) });
  } catch (error) {
    next(error);
  }
};

module.exports.submitExam = async (req, res, next) => {
  try {
    const resultId = await submitAttempt(
      prisma,
      req.user.id,
      parseId(req.params.id),
      req.body.attemptId,
      req.body.answers
    );
    res.json({ message: 'Nộp bài thành công', resultId });
  } catch (error) {
    next(error);
  }
};

// ─── Get Exam Result ─────────────────────────────────────────────────────────

module.exports.getExamResultById = async (req, res, next) => {
  try {
    let resultId;
    try {
      resultId = parseId(req.params.resultId, 'ID kết quả');
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

    const userId = req.user.id;

    const result = await prisma.examResult.findFirst({
      where: { id: resultId, userId },
    });

    if (!result) {
      return res.status(404).json({ message: 'Không tìm thấy kết quả bài thi' });
    }

    const { examSnapshot, ...data } = result;
    res.json({
      data: {
        ...data,
        exam: examSnapshot || {
          id: result.examId,
          title: 'Đề thi cũ',
          questions: [],
          legacyUnavailable: true,
        },
      },
    });
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
      data: history.map(({ examSnapshot, ...item }) => ({
        ...item,
        exam: examSnapshot
          ? {
              id: examSnapshot.id,
              title: examSnapshot.title,
              examCode: examSnapshot.examCode,
              passingScore: examSnapshot.passingScore,
              durationMinutes: examSnapshot.durationMinutes,
              legacyBackfill: examSnapshot.legacyBackfill,
            }
          : { ...item.exam, legacyUnavailable: true },
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};
