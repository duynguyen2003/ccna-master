/**
 * Middleware: Logging
 * PURPOSE: Log HTTP requests and admin actions
 */

const { getPrisma } = require('../config/database');
const prisma = getPrisma();

const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
    // Chỉ log console để tránh làm nặng DB với request thông thường
    console.log('[REQUEST LOG]', JSON.stringify(log));
  });

  next();
};

/**
 * Ghi log hành động admin vào Database
 */
const adminActionLogger = async (action, adminId, details, targetTable = '', targetId = null) => {
  try {
    const logData = {
      action,
      adminId: parseInt(adminId),
      details: typeof details === 'string' ? details : JSON.stringify(details),
      targetTable,
      targetId: targetId ? String(targetId) : null,
      ipAddress: ''
    };

    const newLog = await prisma.adminLog.create({
      data: logData
    });

    console.log('[ADMIN ACTION LOG SAVED]', newLog.id);
    return newLog;
  } catch (error) {
    console.error('[ADMIN ACTION LOG ERROR]', error.message);
  }
};

module.exports = { requestLogger, adminActionLogger };
