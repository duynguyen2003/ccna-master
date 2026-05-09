const express = require('express');
const router = express.Router();
const learningController = require('../controllers/learningController');
const { verifyToken, checkRole, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public (Optional Login for Guests)
router.get('/courses', optionalAuth, learningController.getCourses);
router.get('/labs', optionalAuth, learningController.getLabs);
router.get('/resources', optionalAuth, learningController.getResources);
router.get('/resources/:id/download', optionalAuth, learningController.downloadResource);
router.get('/courses/:courseId/modules', optionalAuth, learningController.getModulesByCourse);
router.get('/modules/:moduleId/lessons', optionalAuth, learningController.getLessonsByModule);
router.get('/courses/:courseId/topics', optionalAuth, learningController.getTopicsByCourse);

// Admin Restricted
router.use(verifyToken);
router.use(checkRole(['ADMIN']));

// Course management
router.post('/courses', upload.single('thumbnail'), learningController.createCourse);
router.put('/courses/:id', upload.single('thumbnail'), learningController.updateCourse);
router.delete('/courses/:id', learningController.deleteCourse);

// Lab management
router.post('/labs', upload.fields([
  { name: 'filePka', maxCount: 1 },
  { name: 'topologyImg', maxCount: 1 },
  { name: 'thumbnailImg', maxCount: 1 }
]), learningController.createLab);

router.put('/labs/:id', upload.fields([
  { name: 'filePka', maxCount: 1 },
  { name: 'topologyImg', maxCount: 1 },
  { name: 'thumbnailImg', maxCount: 1 }
]), learningController.updateLab);
router.delete('/labs/:id', learningController.deleteLab);

// Module (Chương) management
router.post('/courses/:courseId/modules', learningController.createModule);
router.put('/modules/:id', learningController.updateModule);
router.delete('/modules/:id', learningController.deleteModule);

// Lesson (Bài học) management
router.post('/modules/:moduleId/lessons', learningController.createLesson);
router.put('/lessons/:id', learningController.updateLesson);
router.delete('/lessons/:id', learningController.deleteLesson);

// CourseTopic (Chủ đề) management
router.post('/courses/:courseId/topics', learningController.createTopic);
router.delete('/topics/:id', learningController.deleteTopic);

// Resource (Tài liệu) management
router.post('/resources', upload.single('file'), learningController.createResource);
router.delete('/resources/:id', learningController.deleteResource);

module.exports = router;
