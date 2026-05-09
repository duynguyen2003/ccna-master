/**
 * ============================================================
 * MIDDLEWARE: auth.js
 * PURPOSE: Token verification and role-based access control
 * ============================================================
 */

const jwt = require('jsonwebtoken');

/**
 * @desc    Verify JWT from Authorization header
 */
module.exports.verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Không có quyền truy cập (Missing token)' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ccna_master_secret_2024');
    
    // Attach user to request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};

/**
 * @desc    Verify JWT optionally (Guest access)
 */
module.exports.optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      req.user = null;
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ccna_master_secret_2024');
    req.user = decoded;
    next();
  } catch (error) {
    req.user = null; // Ignore invalid tokens for optional routes
    next();
  }
};

/**
 * @desc    Check user role
 * @param   {string[]} roles - Allowed roles
 */
module.exports.checkRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
  }
  next();
};
