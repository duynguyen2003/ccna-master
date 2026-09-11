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
    const week = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `Tuần ${week}`;
  } catch {
    return null;
  }
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
      status === STATUS.ACTIVE ? true : status === STATUS.INACTIVE ? false : undefined;

    const whereParams = {
      deletedAt: null,
      ...(roleFilter !== undefined ? { role: roleFilter } : {}),
      ...(statusFilter !== undefined ? { isActive: statusFilter } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereParams,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLogin: true,
        },
      }),
      prisma.user.count({ where: whereParams }),
    ]);

    res.json({
      data: users,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
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
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
        level: true,
        streak: true,
        totalStudyTime: true,
        progress: {
          select: {
            id: true,
            progressPercent: true,
            course: { select: { id: true, title: true, level: true } },
          },
        },
        examResults: true,
      },
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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [user, completedLabs, totalLabsCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          avatarUrl: true,
          createdAt: true,
          level: true,
          streak: true,
          totalStudyTime: true,
          // ... (rest of the fields)
          progress: {
            where: { moduleId: null, lessonId: null, labId: null, progressPercent: { gt: 0 } },
            select: {
              progressPercent: true,
              courseId: true,
              course: { select: { id: true, title: true } },
            },
          },
          activities: {
            where: { createdAt: { gte: thirtyDaysAgo } },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              id: true,
              title: true,
              type: true,
              createdAt: true,
              referenceId: true,
            },
          },
          badges: {
            orderBy: { earnedAt: 'desc' },
            select: { id: true, badgeName: true, badgeIcon: true, earnedAt: true },
          },
          examResults: {
            select: { percentage: true, isPassed: true, takenAt: true },
          },
          studyLogs: {
            where: { date: { gte: sevenDaysAgo } },
            orderBy: { date: 'asc' },
            select: { date: true, duration: true },
          },
        },
      }),
      prisma.userProgress.count({
        where: { userId, labId: { not: null }, status: 'COMPLETED' },
      }),
      prisma.lab.count({ where: { deletedAt: null } }),
    ]);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ── weeklyScores ──────────────────────────────────────────────────────
    const weeklyMap = {};
    user.examResults.forEach((r) => {
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
    const dailyMap = Object.fromEntries(DAY_LABELS.map((d) => [d, 0]));
    user.studyLogs.forEach((log) => {
      const label = DAY_LABELS[new Date(log.date).getDay()];
      dailyMap[label] += Math.round((log.duration || 0) / 60); // giây → phút
    });

    const dailyStudyTime = DAY_LABELS.map((day) => ({
      day,
      minutes: dailyMap[day],
    }));

    // ── Summary metrics ───────────────────────────────────────────────────
    const courseProgress = user.progress.map((p) => ({
      courseId: p.courseId,
      courseName: p.course?.title || String(p.courseId),
      progressPercent: p.progressPercent,
    }));

    const totalProgress =
      courseProgress.length > 0
        ? Math.round(
            courseProgress.reduce((s, p) => s + p.progressPercent, 0) / courseProgress.length
          )
        : 0;

    const averageScore =
      user.examResults.length > 0
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
        activities: activities,
        badges: user.badges,
        stats: {
          totalStudyTime: user.totalStudyTime, // unit: minutes
          avgScore: averageScore,
          examCount: examResults.length,
          labsDone: completedLabs,
          totalLabs: totalLabsCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /users/stats/study-time?period=week|month|quarter
 * Returns aggregated study time for chart display
 */
module.exports.getStudyTimeStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const period = req.query.period || 'week';

    let daysBack;
    if (period === 'month') daysBack = 30;
    else if (period === 'quarter') daysBack = 90;
    else daysBack = 7; // week

    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const logs = await prisma.studyLog.findMany({
      where: { userId, date: { gte: since } },
      orderBy: { date: 'asc' },
      select: { date: true, duration: true },
    });

    let chartData = [];

    if (period === 'week') {
      // Group by day-of-week label: CN, T2 ... T7
      const map = Object.fromEntries(DAY_LABELS.map((d) => [d, 0]));
      logs.forEach((log) => {
        const label = DAY_LABELS[new Date(log.date).getDay()];
        map[label] += Math.round((log.duration || 0) / 60);
      });
      chartData = DAY_LABELS.map((day) => ({ label: day, minutes: map[day] }));
    } else if (period === 'month') {
      // Group by week-of-month: Tuần 1 → Tuần 4
      const map = { 'Tuần 1': 0, 'Tuần 2': 0, 'Tuần 3': 0, 'Tuần 4': 0 };
      logs.forEach((log) => {
        const date = new Date(log.date);
        const weekNum = Math.ceil(date.getDate() / 7);
        const key = `Tuần ${Math.min(weekNum, 4)}`;
        map[key] += Math.round((log.duration || 0) / 60);
      });
      chartData = Object.entries(map).map(([label, minutes]) => ({ label, minutes }));
    } else if (period === 'quarter') {
      // Group by month: Tháng X
      const map = {};
      logs.forEach((log) => {
        const date = new Date(log.date);
        const key = `T${date.getMonth() + 1}`;
        if (!map[key]) map[key] = 0;
        map[key] += Math.round((log.duration || 0) / 60);
      });
      // Preserve chronological order
      const orderedKeys = [...new Set(logs.map((l) => `T${new Date(l.date).getMonth() + 1}`))];
      chartData = orderedKeys.map((label) => ({ label, minutes: map[label] || 0 }));
    }

    return res.json({ data: chartData });
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

// Shared validation, authorization and transactional learning progress.
module.exports.updateProgress = require('./learningPathController').updateProgress;

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
        select: { id: true, fullName: true, email: true, role: true, isActive: true },
      });
      return res.status(201).json({ message: 'Tạo tài khoản thành công', user: restoredUser });
    }

    if (existingUser) {
      return res.status(409).json({ message: 'Email này đã được sử dụng' });
    }

    const newUser = await prisma.user.create({
      data: { fullName, email, passwordHash, role: assignedRole },
      select: { id: true, fullName: true, email: true, role: true, isActive: true },
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
      select: { id: true, fullName: true, email: true, role: true },
    });

    // Log action
    await adminActionLogger(
      'UPDATE_ROLE',
      req.user.id,
      `Cập nhật quyền cho ${updatedUser.email} thành ${role}`,
      'users'
    );

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
      select: { id: true, fullName: true, email: true, isActive: true },
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
      data: { deletedAt: new Date(), isActive: false },
    });

    // Log action
    await adminActionLogger(
      'DELETE',
      req.user.id,
      `Xóa người dùng (soft delete): ${deletedUser.email}`,
      'users'
    );

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
      where: { userId_lessonId: { userId, lessonId } },
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
        message: `Ghi chú không được vượt quá ${MAX_NOTE_LENGTH} ký tự.`,
      });
    }

    await prisma.userNote.upsert({
      where: { userId_lessonId: { userId, lessonId: parsedLessonId } },
      update: { content, updatedAt: new Date() },
      create: { userId, lessonId: parsedLessonId, content },
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
      where: { userId_lessonId: { userId, lessonId } },
    });

    res.json({ data: progress || { lastPosition: 0, watchedSeconds: 0 } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports.updateVideoProgress = require('./learningPathController').updateVideoProgress;
