/**
 * ============================================================
 * ROUTE: auth.js
 * PURPOSE: Authentication routes (Register, Login, etc.)
 * ============================================================
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter, forgotPasswordLimiter } = require('../middleware/rateLimiter');
const { 
  registerSchema, 
  loginSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema 
} = require('../validation/authSchema');

// Public routes
router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login', authLimiter, validate(loginSchema), controller.login);
router.post('/google', authLimiter, controller.googleLogin);
router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), controller.forgotPassword);
router.get('/reset-password/:token/validate', controller.validateResetPasswordToken);
router.post('/reset-password', validate(resetPasswordSchema), controller.resetPassword);

// Protected routes
router.get('/profile', verifyToken, controller.getProfile);
router.post('/logout', verifyToken, controller.logout);

module.exports = router;
