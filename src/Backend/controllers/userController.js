const bcrypt = require('bcrypt');
const { getPrisma } = require('../config/database');
const prisma = getPrisma();

// Helper to get ISO week number for labeling charts
function getISOWeekLabel(date) {
  const d = new Date(date);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `Tuần ${week}`;
}

module.exports.getAll = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const role = req.query.role;
    const status = req.query.status;
    const skip = (page - 1) * limit;

    const roleFilter = ['ADMIN', 'STUDENT'].includes(role) ? role : undefined;
    const statusFilter =
      status === 'active' ? true : status === 'inactive' ? false : undefined;

    const whereParams = {
      deletedAt: null,
      ...(roleFilter ? { role: roleFilter } : {}),
      ...(typeof statusFilter === 'boolean' ? { isActive: statusFilter } : {}),
      ...(search ? {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
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
          isActive: true, createdAt: true, lastLogin: true
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
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

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
            course: {
              select: { id: true, title: true, level: true }
            }
          }
        },
        examResults: true
      }
    });
    if (!user || user.deletedAt) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    next(error);
  }
};

module.exports.getProfileMe = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, fullName: true, email: true, role: true,
        isActive: true, avatarUrl: true, createdAt: true,
        level: true, streak: true, totalStudyTime: true,
        // Tiến độ từng khóa học
        progress: {
          select: {
            progressPercent: true,
            courseId: true,
            course: { select: { id: true, title: true } }
          },
          where: { moduleId: null, lessonId: null, labId: null } // Chỉ lấy progress cấp độ khóa học
        },
        // Hoạt động gần đây (10 hoạt động mới nhất)
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, title: true, type: true, createdAt: true, referenceId: true }
        },
        // Thành tích / Huy hiệu
        badges: {
          orderBy: { earnedAt: 'desc' },
          select: { id: true, badgeName: true, badgeIcon: true, earnedAt: true }
        },
        // Kết quả thi để tính điểm trung bình
        examResults: {
          select: { percentage: true, isPassed: true }
        }
      }
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    // --- 1. weeklyScores: last 7 weeks from ExamResults ---
    const weeklyMap = {};
    user.examResults.forEach(r => {
      const week = getISOWeekLabel(r.takenAt || r.createdAt || new Date()); 
      if (!weeklyMap[week]) weeklyMap[week] = [];
      weeklyMap[week].push(Number(r.percentage));
    });
    const weeklyScores = Object.entries(weeklyMap).map(([week, scores]) => ({
      week,
      score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    })).slice(-7);

    // --- 2. dailyStudyTime: last 7 days from UserActivity ---
    // Since we don't have a 'watchedTime' per event, we estimate study time 
    // based on activity count (e.g., 15 minutes per lesson/lab activity)
    const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const dailyMap = { CN: 0, T2: 0, T3: 0, T4: 0, T5: 0, T6: 0, T7: 0 };
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    user.activities.forEach(act => {
      if (new Date(act.createdAt) >= sevenDaysAgo) {
        const label = DAY_LABELS[new Date(act.createdAt).getDay()];
        // Estimate: 15 mins for lesson/lab, 5 mins for others
        const estimatedMins = act.type.includes('COMPLETED') ? 20 : 5;
        dailyMap[label] += estimatedMins;
      }
    });
    const dailyStudyTime = DAY_LABELS.map(day => ({ day, minutes: dailyMap[day] }));

    // --- 3. Summary metrics ---
    const courseProgress = user.progress.map(p => ({
      courseId: p.courseId,
      courseName: p.course?.title || p.courseId,
      progressPercent: p.progressPercent
    }));

    const totalProgress = courseProgress.length > 0
      ? Math.round(courseProgress.reduce((sum, p) => sum + p.progressPercent, 0) / courseProgress.length)
      : 0;

    const completedLabs = await prisma.userProgress.count({
      where: { userId, labId: { not: null }, status: 'COMPLETED' }
    });

    const averageScore = user.examResults.length > 0
      ? Math.round(user.examResults.reduce((sum, r) => sum + Number(r.percentage), 0) / user.examResults.length)
      : 0;

    const examCount = user.examResults.length;

    const { examResults, progress, activities, ...baseUser } = user;

    res.json({
      data: {
        ...baseUser,
        progress: courseProgress,
        totalProgress,
        completedLabs,
        totalLabs: 50,
        averageScore,
        examCount,
        weeklyScores,
        dailyStudyTime,
        stats: {
          totalStudyTime: user.totalStudyTime * 60, // Phút -> Giây để thống nhất với plan (h:m format)
          avgScore: averageScore,
          examCount: examCount,
          labsDone: completedLabs
        }
      }
    });
  } catch (error) {
    next(error);
  }
};


module.exports.getUserProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const progressList = await prisma.userProgress.findMany({
      where: { userId: userId },
    });
    res.json({ data: progressList });
  } catch (error) {
    next(error);
  }
};

module.exports.updateProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { courseId, moduleId, lessonId, labId, progressPercent, status } = req.body;

    if (!courseId) {
      return res.status(400).json({ message: 'courseId là bắt buộc' });
    }

    // Tìm xem đã có bản ghi tiến độ này chưa
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
    const isCompleted = status === 'COMPLETED' || progressPercent >= 95;

    if (existing) {
      result = await prisma.userProgress.update({
        where: { id: existing.id },
        data: {
          progressPercent: Math.max(existing.progressPercent, progressPercent || 0),
          status: isCompleted ? 'COMPLETED' : (status || existing.status),
          completedAt: isCompleted && !existing.completedAt ? new Date() : existing.completedAt
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
          progressPercent: progressPercent || 0,
          status: isCompleted ? 'COMPLETED' : (status || 'ACTIVE'),
          completedAt: isCompleted ? new Date() : null
        }
      });
    }

    // Nếu bài học hoàn thành, ghi lại hoạt động
    if (isCompleted && (!existing || existing.status !== 'COMPLETED')) {
      await prisma.userActivity.create({
        data: {
          userId,
          title: `Đã hoàn thành bài học: ${lessonId || labId || courseId}`,
          type: lessonId ? 'LESSON_COMPLETED' : (labId ? 'LAB_COMPLETED' : 'COURSE_COMPLETED'),
          referenceId: lessonId || labId || null
        }
      });
    }

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

module.exports.createUser = async (req, res, next) => {
  try {
    const { fullName, email, password, role } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng cung cấp email và mật khẩu' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser && !existingUser.deletedAt) {
      return res.status(409).json({ message: 'Email này đã được sử dụng' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    if (existingUser && existingUser.deletedAt) {
      // Restore user if soft deleted
      const restoredUser = await prisma.user.update({
        where: { email },
        data: {
          fullName,
          passwordHash,
          role: role || 'STUDENT',
          deletedAt: null,
          isActive: true
        },
        select: { id: true, fullName: true, email: true, role: true, isActive: true }
      });
      return res.status(201).json({ message: 'Tạo tài khoản thành công', user: restoredUser });
    }

    const newUser = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: role || 'STUDENT'
      },
      select: { id: true, fullName: true, email: true, role: true, isActive: true }
    });

    res.status(201).json({ message: 'Tạo tài khoản thành công', user: newUser });
  } catch (error) {
    next(error);
  }
};

module.exports.updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['STUDENT', 'ADMIN'].includes(role)) {
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
    res.json({ message: `Đã ${updatedUser.isActive ? 'kích hoạt' : 'vô hiệu hóa'} tài khoản`, user: updatedUser });
  } catch (error) {
    next(error);
  }
};

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

const MAX_NOTE_LENGTH = 10000;

module.exports.getUserNote = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.id;

    if (!lessonId || isNaN(parseInt(lessonId))) {
      return res.status(400).json({ message: 'lessonId không hợp lệ.' });
    }

    const note = await prisma.userNote.findUnique({
      where: {
        userId_lessonId: {
          userId: parseInt(userId),
          lessonId: parseInt(lessonId)
        }
      }
    });

    res.json({ content: note?.content ?? '' });
  } catch (error) {
    next(error);
  }
};

module.exports.upsertUserNote = async (req, res, next) => {
  try {
    const { lessonId, content } = req.body;
    const userId = req.user.id;

    if (!lessonId || isNaN(parseInt(lessonId))) {
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
      where: {
        userId_lessonId: {
          userId: parseInt(userId),
          lessonId: parseInt(lessonId)
        }
      },
      update: {
        content,
        updatedAt: new Date()
      },
      create: {
        userId: parseInt(userId),
        lessonId: parseInt(lessonId),
        content
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
