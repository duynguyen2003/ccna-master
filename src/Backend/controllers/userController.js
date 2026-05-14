const bcrypt = require('bcrypt');
const { getPrisma } = require('../config/database');
const { adminActionLogger } = require('../middleware/logging');
const prisma = getPrisma();

// ── Constants ────────────────────────────────────────────────────────────────
const ROLES = { ADMIN: 'ADMIN', STUDENT: 'STUDENT' };
const STATUS = { ACTIVE: 'active', INACTIVE: 'inactive' };
const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MAX_NOTE_LENGTH = 10000;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get ISO week label from a date → "Tuần 12"
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

/**
 * Normalize a date to midnight (YYYY-MM-DD 00:00:00)
 */
function toMidnight(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
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
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
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

    const [user, completedLabs, totalLabsCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, fullName: true, email: true, role: true,
          isActive: true, avatarUrl: true, createdAt: true,
          level: true, streak: true, totalStudyTime: true,
          // ... (rest of the fields)
          progress: {
            where: { moduleId: null, lessonId: null, labId: null, progressPercent: { gt: 0 } },
            select: {
              progressPercent: true,
              courseId: true,
              course: { select: { id: true, title: true } }
            }
          },
          activities: {
            where: { createdAt: { gte: sevenDaysAgo } },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true, title: true, type: true,
              createdAt: true, referenceId: true,
            }
          },
          badges: {
            orderBy: { earnedAt: 'desc' },
            select: { id: true, badgeName: true, badgeIcon: true, earnedAt: true }
          },
          examResults: {
            select: { percentage: true, isPassed: true, takenAt: true }
          },
          studyLogs: {
            where: { date: { gte: sevenDaysAgo } },
            orderBy: { date: 'asc' },
            select: { date: true, duration: true }
          }
        }
      }),
      prisma.userProgress.count({
        where: { userId, labId: { not: null }, status: 'COMPLETED' }
      }),
      prisma.lab.count({ where: { deletedAt: null } })
    ]);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ── weeklyScores ──────────────────────────────────────────────────────
    const weeklyMap = {};
    user.examResults.forEach(r => {
      if (!r.takenAt) return;
      const week = getISOWeekLabel(r.takenAt);
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

    // ── dailyStudyTime từ StudyLog (chính xác 100%) ───────────────────────
    // [FIX] Dùng reduce để cộng dồn nếu có nhiều log cùng ngày
    const dailyMap = Object.fromEntries(DAY_LABELS.map(d => [d, 0]));
    user.studyLogs.forEach(log => {
      const label = DAY_LABELS[new Date(log.date).getDay()];
      dailyMap[label] += Math.round((log.duration || 0) / 60); // giây → phút
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

    // [FIX] Destructure studyLogs ra khỏi baseUser để không bị lộ raw data
    const { examResults, progress, activities, studyLogs, ...baseUser } = user;

    return res.json({
      data: {
        ...baseUser,
        progress: courseProgress,
        totalProgress,
        weeklyScores,
        dailyStudyTime,
        recentActivities: activities,
        badges: user.badges,
        stats: {
          totalStudyTime: user.totalStudyTime, // unit: minutes
          avgScore: averageScore,
          examCount: examResults.length,
          labsDone: completedLabs,
          totalLabs: totalLabsCount,
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
    const progressList = await prisma.userProgress.findMany({ where: { userId } });
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

    if (!courseId) {
      return res.status(400).json({ message: 'courseId là bắt buộc' });
    }

    const progressPercent = clamp(req.body.progressPercent, 0, 100);
    const isCompleted = status === 'COMPLETED' || progressPercent >= 95;

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

    // Ghi activity khi hoàn thành lần đầu
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

    // Cập nhật tiến độ tổng quát của khóa học
    const [totalLessons, totalLabs, completedLessons, completedLabsInCourse] = await Promise.all([
      prisma.lesson.count({ where: { module: { courseId } } }),
      prisma.lab.count({ where: { courseId } }),
      prisma.userProgress.count({
        where: { userId, courseId, lessonId: { not: null }, status: 'COMPLETED' }
      }),
      prisma.userProgress.count({
        where: { userId, courseId, labId: { not: null }, status: 'COMPLETED' }
      })
    ]);

    const totalItems = totalLessons + totalLabs;
    const completedItems = completedLessons + completedLabsInCourse;
    const overallPercent = totalItems > 0
      ? Math.round((completedItems / totalItems) * 100)
      : 0;

    const summaryRecord = await prisma.userProgress.findFirst({
      where: { userId, courseId, moduleId: null, lessonId: null, labId: null }
    });

    if (summaryRecord) {
      await prisma.userProgress.update({
        where: { id: summaryRecord.id },
        data: {
          progressPercent: overallPercent,
          status: overallPercent >= 100 ? 'COMPLETED' : 'ACTIVE'
        }
      });
    } else {
      await prisma.userProgress.create({
        data: {
          userId, courseId,
          moduleId: null, lessonId: null, labId: null,
          progressPercent: overallPercent,
          status: 'ACTIVE'
        }
      });
    }

    res.json({ data: result, overallPercent });
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

    // Log action
    await adminActionLogger('CREATE', req.user.id, `Tạo người dùng mới: ${email}`, 'users');

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

    // Log action
    await adminActionLogger('UPDATE_ROLE', req.user.id, `Cập nhật quyền cho ${updatedUser.email} thành ${role}`, 'users');

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

    // Log action
    await adminActionLogger(
      updatedUser.isActive ? 'ACTIVATE' : 'DEACTIVATE', 
      req.user.id, 
      `${updatedUser.isActive ? 'Kích hoạt' : 'Vô hiệu hóa'} người dùng: ${updatedUser.email}`, 
      'users'
    );

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
    const deletedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { deletedAt: new Date(), isActive: false }
    });

    // Log action
    await adminActionLogger('DELETE', req.user.id, `Xóa người dùng (soft delete): ${deletedUser.email}`, 'users');

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

// ── Video Progress ────────────────────────────────────────────────────────────

module.exports.getVideoProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const lessonId = parseInt(req.params.lessonId);

    // [FIX] Validate lessonId trước khi query
    if (!lessonId || isNaN(lessonId)) {
      return res.status(400).json({ message: 'lessonId không hợp lệ.' });
    }

    const progress = await prisma.videoProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } }
    });

    res.json({ data: progress || { lastPosition: 0, watchedSeconds: 0 } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports.updateVideoProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // [FIX] Validate đầu vào trước khi làm bất cứ điều gì
    const lessonId = parseInt(req.body.lessonId);
    if (!req.body.lessonId || isNaN(lessonId)) {
      return res.status(400).json({
        message: 'lessonId không hợp lệ hoặc bị thiếu.',
        received: req.body.lessonId
      });
    }

    // [FIX] Clamp và validate watchedSeconds, lastPosition
    const watchedSeconds = clamp(req.body.watchedSeconds, 0, 86400); // max 24h
    const lastPosition = clamp(req.body.lastPosition, 0, 86400);

    const today = toMidnight(); // [FIX] Dùng helper thay vì inline

    // ── Chạy song song: VideoProgress + StudyLog ──────────────────────────
    await Promise.all([
      // 1. Upsert VideoProgress — lưu vị trí xem + tổng giây xem theo lesson
      prisma.videoProgress.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        update: {
          // [FIX] Chỉ tăng watchedSeconds, không giảm nếu tua lùi
          watchedSeconds: { increment: watchedSeconds },
          lastPosition,
        },
        create: {
          userId,
          lessonId,
          watchedSeconds,
          lastPosition,
        }
      }),

      // 2. Upsert StudyLog — cộng dồn giây học theo ngày
      prisma.studyLog.upsert({
        where: { userId_date: { userId, date: today } },
        update: { duration: { increment: watchedSeconds } },
        create: { userId, date: today, duration: watchedSeconds }
      })
    ]);

    // 3. Cập nhật totalStudyTime trên User (đơn vị: phút)
    // [FIX] Tính lại từ StudyLog để đảm bảo chính xác, không bị lệch khi increment nhiều lần
    const totalSeconds = await prisma.studyLog.aggregate({
      where: { userId },
      _sum: { duration: true }
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        totalStudyTime: Math.floor((totalSeconds._sum.duration || 0) / 60)
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};