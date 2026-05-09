const express = require('express');
const router = express.Router();
const toolController = require('../controllers/toolController');
const { verifyToken, checkRole } = require('../middleware/auth');

// Public: Get tools (for student sidebar)
router.get('/', verifyToken, toolController.getTools);

// Admin only
router.use(verifyToken);
router.use(checkRole(['ADMIN']));
router.post('/', toolController.createTool);
router.put('/:id', toolController.updateTool);
router.patch('/:id/toggle', toolController.toggleToolActive);
router.delete('/:id', toolController.deleteTool);

module.exports = router;
