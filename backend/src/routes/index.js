const express = require('express');
const router = express.Router();

const deathController = require('../controllers/deaths.controller');

// sub-routers
router.use('/patients', require('./patients.routes'));
router.use('/treatment', require('./treatment.routes'));
router.use('/appointments', require('./appointments.routes'));
router.use('/deaths', require('./deaths.routes'));
router.use('/templates', require('./templates.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/stats', require('./stats.routes'));
router.use('/notification', require('./notification.routes'));


router.patch('/patients/:id/deceased', deathController.aliasMarkFromPatients);

module.exports = router;