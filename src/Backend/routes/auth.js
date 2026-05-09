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

// Public routes
router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/google', controller.googleLogin);
router.post('/forgot-password', controller.forgotPassword);
router.get('/reset-password/:token/validate', controller.validateResetPasswordToken);
router.post('/reset-password', controller.resetPassword);

// Protected routes
router.get('/profile', verifyToken, controller.getProfile);

module.exports = router;
