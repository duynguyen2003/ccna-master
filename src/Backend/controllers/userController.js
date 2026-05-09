const bcrypt = require('bcrypt');
const { getPrisma } = require('../config/database');
const prisma = getPrisma();

// ── Constants ────────────────────────────────────────────────────────────────
const ROLES = { ADMIN: 'ADMIN', STUDENT: 'STUDENT' };
const STATUS = { ACTIVE: 'active', INACTIVE: 'inactive' };
const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MAX_NOTE_LENGTH = 10000;
const TOTAL_LABS = 50;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get ISO week label from a date
 * @param {Date|string} date
 * @returns {string} e.g. "Tuần 12"
 */
function getISOWeekLabel(date) {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(
      ((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7
    );
    return `Tuần ${week}`;
  } catch {
    return null;
  }
}

/**
 * Clamp a number between min and max
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

// ── Controllers ──────────────────────────────────────────────────────────────

module.exports.getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const { role, status } = req.query;
    const skip = (page - 1) * limit;

    const roleFilter = Object.values(ROLES).includes(role) ? role : undefined;
    const statusFilter =
      status === STATUS.ACTIVE ? true :
        status === STATUS.INACTIVE ? false : undefined;

    const whereParams = {
      deletedAt: null,
      ...(roleFilter !== undefined ? { role: roleFilter } : {}),
      ...(statusFilter !== undefined ? { isActive: statusFilter } : {}),
      ...(search ? {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ]
      } : {})
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereParams,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, fullName: true, email: true, role: true,
          isActive: true, createdAt: true, lastLogin: true,
        }
      }),
      prisma.user.count({ where: whereParams })
    ]);

    res.json({
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true, fullName: true, email: true, role: true,
        isActive: true, createdAt: true, lastLogin: true,
        level: true, streak: true, totalStudyTime: true,
        progress: {
          select: {
            id: true,
            progressPercent: true,
            course: { select: { id: true, title: true, level: true } }
          }
        },
        examResults: true,
      }
    });

    if (!user || user.deletedAt) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports.getProfileMe = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // ── Chạy song song để tối ưu hiệu năng ───────────────────────────────
    const [user, completedLabs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, fullName: true, email: true, role: true,
          isActive: true, avatarUrl: true, createdAt: true,
          level: true, streak: true, totalStudyTime: true,

          // Tiến độ cấp độ khóa học
          progress: {
            where: { moduleId: null, lessonId: null, labId: null },
            select: {
              progressPercent: true,
              courseId: true,
              course: { select: { id: true, title: true } }
            }
          },

          // Hoạt động trong 7 ngày gần nhất — filter trực tiếp trong DB
          activities: {
            where: { createdAt: { gte: sevenDaysAgo } },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true, title: true, type: true,
              createdAt: true, referenceId: true,
            }
          },

          // Thành tích / Huy hiệu
          badges: {
            orderBy: { earnedAt: 'desc' },
            select: {
              id: true, badgeName: true, badgeIcon: true, earnedAt: true,
            }
          },

          // Kết quả thi — bao gồm date để tính weeklyScores
          examResults: {
            select: {
              percentage: true, isPassed: true,
              takenAt: true, createdAt: true,
            }
          }
        }
      }),

      // Lab đã hoàn thành
      prisma.userProgress.count({
        where: { userId, labId: { not: null }, status: 'COMPLETED' }
      })
    ]);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ── weeklyScores: nhóm điểm thi theo tuần, lấy 7 tuần gần nhất ───────
    const weeklyMap = {};
    user.examResults.forEach(r => {
      const dateRef = r.takenAt || r.createdAt;
      if (!dateRef) return;

      const week = getISOWeekLabel(dateRef);
      if (!week) return;

      if (!weeklyMap[week]) weeklyMap[week] = [];
      weeklyMap[week].push(Number(r.percentage));
    });

    const weeklyScores = Object.entries(weeklyMap)
      .map(([week, scores]) => ({
        week,
        score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      }))
      .slice(-7);

    // ── dailyStudyTime: ước tính thời gian học theo ngày trong tuần ───────
    const dailyMap = Object.fromEntries(DAY_LABELS.map(d => [d, 0]));
    user.activities.forEach(act => {
      const label = DAY_LABELS[new Date(act.createdAt).getDay()];
      // Ước tính: 20 phút cho lesson/lab hoàn thành, 5 phút cho hành động khác
      dailyMap[label] += act.type.includes('COMPLETED') ? 20 : 5;
    });
    const dailyStudyTime = DAY_LABELS.map(day => ({
      day,
      minutes: dailyMap[day],
    }));

    // ── Summary metrics ───────────────────────────────────────────────────
    const courseProgress = user.progress.map(p => ({
      courseId: p.courseId,
      courseName: p.course?.title || String(p.courseId),
      progressPercent: p.progressPercent,
    }));

    const totalProgress = courseProgress.length > 0
      ? Math.round(
        courseProgress.reduce((s, p) => s + p.progressPercent, 0) / courseProgress.length
      )
      : 0;

    const averageScore = user.examResults.length > 0
      ? Math.round(
        user.examResults.reduce((s, r) => s + Number(r.percentage), 0) / user.examResults.length
      )
      : 0;

    // ── Loại bỏ các field đã xử lý trước khi spread ──────────────────────
    const { examResults, progress, activities, ...baseUser } = user;

    return res.json({
      data: {
        ...baseUser,
        progress: courseProgress,
        totalProgress,
        weeklyScores,
        dailyStudyTime,
        recentActivities: user.activities,
        badges: user.badges,
        stats: {
          totalStudyTime: user.totalStudyTime, // unit: minutes
          avgScore: averageScore,
          examCount: user.examResults.length,
          labsDone: completedLabs,
          totalLabs: TOTAL_LABS,
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports.getUserProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const progressList = await prisma.userProgress.findMany({
      where: { userId }
    });
    res.json({ data: progressList });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports.updateProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { courseId, moduleId, lessonId, labId, status } = req.body;

    // ── Validate ──────────────────────────────────────────────────────────
    if (!courseId) {
      return res.status(400).json({ message: 'courseId là bắt buộc' });
    }

    // Clamp progressPercent về khoảng [0, 100]
    const progressPercent = clamp(req.body.progressPercent, 0, 100);
    const isCompleted = status === 'COMPLETED' || progressPercent >= 95;

    // ── Upsert tiến độ ────────────────────────────────────────────────────
    const existing = await prisma.userProgress.findFirst({
      where: {
        userId,
        courseId,
        moduleId: moduleId || null,
        lessonId: lessonId || null,
        labId: labId || null,
      }
    });

    let result;

    if (existing) {
      result = await prisma.userProgress.update({
        where: { id: existing.id },
        data: {
          // Không cho phép giảm tiến độ (tua lại video không reset %)
          progressPercent: Math.max(existing.progressPercent, progressPercent),
          status: isCompleted ? 'COMPLETED' : (status || existing.status),
          completedAt: isCompleted && !existing.completedAt ? new Date() : existing.completedAt,
        }
      });
    } else {
      result = await prisma.userProgress.create({
        data: {
          userId,
          courseId,
          moduleId: moduleId || null,
          lessonId: lessonId || null,
          labId: labId || null,
          progressPercent,
          status: isCompleted ? 'COMPLETED' : (status || 'ACTIVE'),
          completedAt: isCompleted ? new Date() : null,
        }
      });
    }

    // ── Ghi activity nếu vừa hoàn thành lần đầu ──────────────────────────
    const isFirstCompletion = isCompleted && (!existing || existing.status !== 'COMPLETED');
    if (isFirstCompletion) {
      const activityType =
        lessonId ? 'LESSON_COMPLETED' :
          labId ? 'LAB_COMPLETED' : 'COURSE_COMPLETED';

      await prisma.userActivity.create({
        data: {
          userId,
          title: `Đã hoàn thành: ${lessonId || labId || courseId}`,
          type: activityType,
          referenceId: lessonId || labId || null,
        }
      });
    }

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports.createUser = async (req, res, next) => {
  try {
    const { fullName, email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng cung cấp email và mật khẩu' });
    }

    const assignedRole = Object.values(ROLES).includes(role) ? role : ROLES.STUDENT;

    const existingUser = await prisma.user.findUnique({ where: { email } });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Nếu email đã tồn tại nhưng đã bị soft-delete → khôi phục
    if (existingUser?.deletedAt) {
      const restoredUser = await prisma.user.update({
        where: { email },
        data: { fullName, passwordHash, role: assignedRole, deletedAt: null, isActive: true },
        select: { id: true, fullName: true, email: true, role: true, isActive: true }
      });
      return res.status(201).json({ message: 'Tạo tài khoản thành công', user: restoredUser });
    }

    if (existingUser) {
      return res.status(409).json({ message: 'Email này đã được sử dụng' });
    }

    const newUser = await prisma.user.create({
      data: { fullName, email, passwordHash, role: assignedRole },
      select: { id: true, fullName: true, email: true, role: true, isActive: true }
    });

    res.status(201).json({ message: 'Tạo tài khoản thành công', user: newUser });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports.updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ message: 'Role không hợp lệ' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { role },
      select: { id: true, fullName: true, email: true, role: true }
    });

    res.json({ message: 'Cập nhật quyền thành công', user: updatedUser });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports.toggleActive = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { isActive: !user.isActive },
      select: { id: true, fullName: true, email: true, isActive: true }
    });

    res.json({
      message: `Đã ${updatedUser.isActive ? 'kích hoạt' : 'vô hiệu hóa'} tài khoản`,
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.user.update({
      where: { id: parseInt(id) },
      data: { deletedAt: new Date(), isActive: false }
    });

    res.json({ message: 'Xóa tài khoản thành công' });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports.getUserNote = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const lessonId = parseInt(req.params.lessonId);

    if (!lessonId || isNaN(lessonId)) {
      return res.status(400).json({ message: 'lessonId không hợp lệ.' });
    }

    const note = await prisma.userNote.findUnique({
      where: { userId_lessonId: { userId, lessonId } }
    });

    res.json({ content: note?.content ?? '' });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports.upsertUserNote = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { lessonId, content } = req.body;

    const parsedLessonId = parseInt(lessonId);
    if (!parsedLessonId || isNaN(parsedLessonId)) {
      return res.status(400).json({ message: 'lessonId không hợp lệ.' });
    }
    if (typeof content !== 'string') {
      return res.status(400).json({ message: 'content phải là chuỗi.' });
    }
    if (content.length > MAX_NOTE_LENGTH) {
      return res.status(400).json({
        message: `Ghi chú không được vượt quá ${MAX_NOTE_LENGTH} ký tự.`
      });
    }

    await prisma.userNote.upsert({
      where: { userId_lessonId: { userId, lessonId: parsedLessonId } },
      update: { content, updatedAt: new Date() },
      create: { userId, lessonId: parsedLessonId, content }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};