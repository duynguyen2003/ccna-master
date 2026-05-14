const { getPrisma } = require('../config/database');
const prisma = getPrisma();

module.exports.getStats = async (req, res, next) => {
  try {
    const totalUsers = await prisma.user.count({ where: { role: 'STUDENT', deletedAt: null } });
    const totalCourses = await prisma.course.count({ where: { deletedAt: null } });
    const totalExams = await prisma.exam.count({ where: { deletedAt: null } });
    
    // Users joined in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentUsers = await prisma.user.count({
      where: { 
        role: 'STUDENT',
        deletedAt: null,
        createdAt: { gte: sevenDaysAgo }
      }
    });

    res.json({
      totalUsers,
      totalCourses,
      totalExams,
      recentUsers
    });
  } catch (error) {
    next(error);
  }
};

module.exports.getAdminLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.adminLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: { id: true, fullName: true, email: true }
          }
        }
      }),
      prisma.adminLog.count()
    ]);

    res.json({
      data: logs,
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
// --- MODULAR DASHBOARD ENDPOINTS ---

/**
 * GET /dashboard/summary
 * Returns basic counts for users, courses, exams, and storage usage
 */
module.exports.getDashboardSummary = async (req, res, next) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalCourses,
      totalExams,
      recentUsersCount,
      onlineToday,
      completedLessons,
      totalResults,
      passedResults,
      avgProgressResult
    ] = await Promise.all([
      // Tổng học viên
      prisma.user.count({ where: { role: 'STUDENT', deletedAt: null } }),
      // Tổng khóa học
      prisma.course.count({ where: { deletedAt: null } }),
      // Tổng bài kiểm tra
      prisma.exam.count({ where: { deletedAt: null } }),
      // Học viên mới trong 7 ngày
      prisma.user.count({
        where: {
          role: 'STUDENT',
          deletedAt: null,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      }),
      // Học viên login trong 24h qua (dựa trên lastLogin)
      prisma.user.count({
        where: {
          role: 'STUDENT',
          deletedAt: null,
          lastLogin: { gte: oneDayAgo }
        }
      }),
      // Số bài học đã hoàn thành (UserProgress có lessonId và status COMPLETED)
      prisma.userProgress.count({
        where: {
          status: 'COMPLETED',
          lessonId: { not: null }
        }
      }),
      // Tổng lượt thi
      prisma.examResult.count(),
      // Số lượt thi đạt
      prisma.examResult.count({ where: { isPassed: true } }),
      // Tiến độ trung bình các học viên đang học (course-level progress)
      prisma.userProgress.aggregate({
        _avg: { progressPercent: true },
        where: {
          status: 'ACTIVE',
          lessonId: null,
          labId: null
        }
      })
    ]);

    const examPassRate = totalResults > 0
      ? Math.round((passedResults / totalResults) * 100)
      : 0;

    const avgProgress = Math.round(avgProgressResult._avg.progressPercent || 0);

    res.json({
      totalUsers,
      totalCourses,
      totalExams,
      recentUsersCount,
      onlineToday,
      completedLessons,
      examPassRate,
      avgProgress
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /dashboard/activity
 * Returns study logs for the last 7 days
 */
module.exports.getDashboardActivity = async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Nhóm theo ngày: đếm số học viên học mỗi ngày trong 7 ngày qua
    const logs = await prisma.studyLog.groupBy({
      by: ['date'],
      where: { date: { gte: sevenDaysAgo } },
      _count: { userId: true },
      _sum: { duration: true },
      orderBy: { date: 'asc' }
    });

    // Format cho biểu đồ — 7 ngày liên tiếp, điền 0 nếu không có dữ liệu
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const chartData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      const dateStr = d.toISOString().split('T')[0];

      const logEntry = logs.find(l => {
        const logDate = new Date(l.date);
        return logDate.toISOString().split('T')[0] === dateStr;
      });

      return {
        name: days[d.getDay()],
        value: logEntry ? logEntry._count.userId : 0, // Số học viên active ngày đó
        duration: logEntry ? Math.round((logEntry._sum.duration || 0) / 60) : 0 // Tổng phút học
      };
    });

    res.json(chartData);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /dashboard/distribution
 * Returns student count per course
 */
module.exports.getDashboardDistribution = async (req, res, next) => {
  try {
    const courses = await prisma.course.findMany({
      where: { deletedAt: null },
      select: { 
        id: true, 
        title: true,
        _count: {
          select: { progress: { where: { status: 'ACTIVE' } } }
        }
      }
    });

    const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444'];
    const chartData = courses.map((c, i) => ({
      name: c.title,
      value: c._count.progress,
      color: colors[i % colors.length]
    }));

    res.json(chartData);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /dashboard/trends
 * Returns user registration counts for the last 6 months
 */
module.exports.getDashboardTrends = async (req, res, next) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const users = await prisma.user.findMany({
      where: { 
        role: 'STUDENT',
        createdAt: { gte: sixMonthsAgo }
      },
      select: { createdAt: true }
    });

    // Group by month
    const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
    const chartData = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const month = d.getMonth();
      const count = users.filter(u => u.createdAt.getMonth() === month).length;
      return {
        name: months[month],
        value: count
      };
    });

    res.json(chartData);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /dashboard/students
 * Returns top 5 recent students with their overall progress
 */
module.exports.getRecentStudents = async (req, res, next) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT', deletedAt: null },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        createdAt: true,
        progress: {
          take: 1,
          orderBy: { updatedAt: 'desc' },
          include: { course: { select: { title: true } } }
        }
      }
    });

    const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444'];
    const formatted = students.map((s, i) => {
      const initials = s.fullName ? s.fullName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : '??';
      const latestProgress = s.progress[0];
      
      // Calculate relative time (simple version)
      const diffDays = Math.floor((new Date() - s.createdAt) / (1000 * 60 * 60 * 24));
      const timeStr = diffDays === 0 ? 'Hôm nay' : `${diffDays} ngày trước`;

      return {
        id: s.id,
        name: s.fullName || 'Ẩn danh',
        initials,
        course: latestProgress?.course?.title || 'Chưa tham gia',
        progress: latestProgress?.progressPercent || 0,
        time: timeStr,
        color: colors[i % colors.length]
      };
    });

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};
