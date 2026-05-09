const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/users', require('./users'));
router.use('/learning', require('./learning'));
router.use('/exams', require('./exams'));
router.use('/admin', require('./admin'));
router.use('/tools', require('./tools'));

module.exports = router;
