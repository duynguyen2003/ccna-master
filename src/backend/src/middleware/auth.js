/**
 * ============================================================
 * MIDDLEWARE: auth.js
 * PURPOSE: Token verification and role-based access control
 * ============================================================
 */

const jwt = require('jsonwebtoken');
const { getPrisma } = require('../config/database');
const { isAccountActive } = require('../security/session');

/**
 * @desc    Verify JWT from Authorization header
 */
const authenticate = (optional) => async (req, res, next) => {
  const reject = () => {
    req.user = null;
    return optional
      ? next()
      : res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.' });
  };
  let decoded;
  try {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return reject();
    }

    // Verify token
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    return reject();
  }
  if (!Number.isSafeInteger(decoded.id) || !Number.isSafeInteger(decoded.sessionVersion))
    return reject();
  try {
    const user = await getPrisma().user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        deletedAt: true,
        sessionVersion: true,
      },
    });
    if (!isAccountActive(user) || user.sessionVersion !== decoded.sessionVersion) return reject();
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Verify JWT optionally (Guest access)
 */
module.exports.verifyToken = authenticate(false);
module.exports.optionalAuth = authenticate(true);

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
