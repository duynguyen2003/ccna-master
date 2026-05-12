const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { verifyToken, checkRole, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const validate = require('../middleware/validate');
const { examSubmitLimiter } = require('../middleware/rateLimiter');
const { submitExamSchema } = require('../validation/examSchema');

// Public (Optional Login)
router.get('/', optionalAuth, examController.getExams);
router.get('/detail/:id', optionalAuth, examController.getExamById);

// Requires Login
router.get('/history/me', verifyToken, examController.getMyExamHistory);
router.get('/result/:resultId', verifyToken, examController.getExamResultById);

// Cho phép cả STUDENT và ADMIN nộp bài thi
router.post('/:id/submit', verifyToken, examSubmitLimiter, validate(submitExamSchema), checkRole(['STUDENT', 'ADMIN']), examController.submitExam);

// Các route bên dưới CHỈ dành cho ADMIN
router.use(verifyToken);
router.use(checkRole(['ADMIN']));
router.post('/question-image', upload.single('image'), examController.uploadQuestionImage);
router.post('/', examController.createExam);
router.put('/:id', examController.updateExam);
router.delete('/:id', examController.deleteExam);

module.exports = router;
