/**
 * ============================================================
 * CONTROLLER: authController.js
 * PURPOSE: Handle user registration and login logic
 * ============================================================
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { getPrisma } = require('../config/database');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const prisma = getPrisma();
const RESET_TOKEN_TTL_MINUTES = 30;

const buildResetPasswordUrl = (token) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  return frontendUrl.includes('#')
    ? `${frontendUrl}/reset-password/${token}`
    : `${frontendUrl}/#/reset-password/${token}`;
};

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const createResetTokenPair = () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  return {
    rawToken,
    tokenHash: hashResetToken(rawToken)
  };
};

const genericForgotPasswordMessage = 'Nếu email tồn tại trong hệ thống, chúng tôi đã tạo yêu cầu đặt lại mật khẩu.';

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
module.exports.register = async (req, res, next) => {
  try {
    const { fullName, password } = req.body;
    const email = `${req.body?.email || ''}`.trim().toLowerCase();

    // 1. Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng cung cấp email và mật khẩu' });
    }

    // 2. Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive'
        }
      }
    });

    if (existingUser) {
      return res.status(409).json({ message: 'Email này đã được sử dụng' });
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Create user
    const newUser = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: 'STUDENT'
      }
    });

    // 5. Remove password hash from response
    const { passwordHash: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      message: 'Đăng ký tài khoản thành công',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Registration error:', error);
    next(error);
  }
};

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
module.exports.login = async (req, res, next) => {
  try {
    const { password } = req.body;
    const email = `${req.body?.email || ''}`.trim().toLowerCase();

    // 1. Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng cung cấp email và mật khẩu' });
    }

    // 2. Find user by email
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive'
        }
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác' });
    }

    // 3. Compare passwords
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác' });
    }

    // 4. Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'ccna_master_secret_2024',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // 5. Update last login (optional but good)
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // 6. Return user and token
    const { passwordHash: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Đăng nhập thành công',
      accessToken: token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};

/**
 * @desc    Create a forgot-password request
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
module.exports.forgotPassword = async (req, res, next) => {
  try {
    const email = `${req.body?.email || ''}`.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: 'Vui lòng nhập email.' });
    }

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive'
        }
      }
    });

    if (!user || !user.isActive) {
      return res.json({ message: genericForgotPasswordMessage });
    }

    const { rawToken, tokenHash } = createResetTokenPair();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({
        where: {
          userId: user.id,
          usedAt: null
        }
      }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt
        }
      })
    ]);

    const resetUrl = buildResetPasswordUrl(rawToken);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[forgot-password] Reset link for ${user.email}: ${resetUrl}`);
    }

    return res.json({
      message: genericForgotPasswordMessage,
      ...(process.env.NODE_ENV !== 'production' ? { resetUrl } : {})
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    next(error);
  }
};

/**
 * @desc    Validate a reset-password token
 * @route   GET /api/auth/reset-password/:token/validate
 * @access  Public
 */
module.exports.validateResetPasswordToken = async (req, res, next) => {
  try {
    const token = `${req.params?.token || ''}`.trim();

    if (!token) {
      return res.status(400).json({ message: 'Liên kết đặt lại mật khẩu không hợp lệ.' });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) }
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Liên kết đặt lại mật khẩu đã hết hạn hoặc không hợp lệ.' });
    }

    return res.json({
      valid: true,
      expiresAt: resetToken.expiresAt
    });
  } catch (error) {
    console.error('Validate reset token error:', error);
    next(error);
  }
};

/**
 * @desc    Reset password using a reset token
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
module.exports.resetPassword = async (req, res, next) => {
  try {
    const token = `${req.body?.token || ''}`.trim();
    const password = `${req.body?.password || ''}`;

    if (!token || !password) {
      return res.status(400).json({ message: 'Vui lòng cung cấp token và mật khẩu mới.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
      include: { user: true }
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Liên kết đặt lại mật khẩu đã hết hạn hoặc không hợp lệ.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash }
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() }
      }),
      prisma.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          id: { not: resetToken.id }
        }
      }),
      prisma.refreshToken.deleteMany({
        where: { userId: resetToken.userId }
      })
    ]);

    return res.json({
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    next(error);
  }
};

/**
 * @desc    Get current user profile (Placeholder for now)
 * @route   GET /api/auth/profile
 * @access  Private
 */
module.exports.getProfile = async (req, res, next) => {
  try {
    // req.user sẽ được set bởi authMiddleware
    if (!req.user) {
      return res.status(401).json({ message: 'Không được phép truy cập' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }

    const { passwordHash: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user via Google
 * @route   POST /api/auth/google
 * @access  Public
 */
module.exports.googleLogin = async (req, res, next) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: 'Không có token từ Google' });
    }

    // Verify the Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ message: 'Không thể lấy email từ tài khoản Google' });
    }

    // Check if user exists
    let user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive'
        }
      }
    });

    // If user doesn't exist, create a new one
    if (!user) {
      // Create a cryptographically secure random password since they logged in with Google
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(randomPassword, salt);

      user = await prisma.user.create({
        data: {
          fullName: name,
          email: email.toLowerCase(),
          passwordHash: passwordHash,
          avatarUrl: picture,
          role: 'STUDENT',
          isActive: true
        }
      });
    } else {
      // Update last login and avatar if missing
      user = await prisma.user.update({
        where: { id: user.id },
        data: { 
          lastLogin: new Date(),
          ...( !user.avatarUrl && picture ? { avatarUrl: picture } : {} )
        }
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ message: 'Tài khoản của bạn đã bị khóa' });
    }

    // Generate our system JWT
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'ccna_master_secret_2024',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const { passwordHash: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Đăng nhập Google thành công',
      accessToken,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ message: 'Xác thực Google thất bại' });
  }
};
