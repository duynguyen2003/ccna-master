const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const userController = require('../controllers/userController');
const { verifyToken, checkRole } = require('../middleware/auth');

router.use(verifyToken);
router.use(checkRole(['ADMIN']));

// Admin Stats & Logs
router.get('/stats', adminController.getStats);
router.get('/logs', adminController.getAdminLogs);

// Users Management (Admin)
router.get('/users', userController.getAll);
router.post('/users', userController.createUser);
router.get('/users/:id', userController.getById);
router.patch('/users/:id/role', userController.updateRole);
router.patch('/users/:id/toggle', userController.toggleActive);
router.delete('/users/:id', userController.deleteUser);

module.exports = router;
