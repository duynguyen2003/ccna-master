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
