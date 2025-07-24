const express = require('express');
const router = express.Router();

router.use('/drive', require('./driveRoutes'));
router.use('/calendar', require('./calendarRoutes'));
router.use('/webhook', require('./webhookRoutes'));
router.use('/users', require('./userRoutes'));

module.exports = router; 