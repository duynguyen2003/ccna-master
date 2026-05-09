/**
 * Middleware: Logging
 * PURPOSE: Log HTTP requests and admin actions
 */

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
    console.log('[REQUEST LOG]', JSON.stringify(log));
  });

  next();
};

const adminActionLogger = (action, userId, details) => {
  try {
    const log = {
      timestamp: new Date().toISOString(),
      action,
      userId,
      details,
    };
    console.log('[ADMIN ACTION LOG]', JSON.stringify(log));
  } catch (error) {
    console.log('[ADMIN ACTION LOG]', action, userId, details);
  }
};

module.exports = { requestLogger, adminActionLogger };
