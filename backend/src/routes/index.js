const express = require('express');
const router = express.Router();

const deathController = require('../controllers/deaths.controller');
const homeNeedsController = require('../controllers/home_needs.controller');
// sub-routers
router.use('/patients', require('./patients.routes'));
router.use('/treatment', require('./treatment.routes'));
router.use('/appointments', require('./appointments.routes'));
router.use('/deaths', require('./deaths.routes'));
router.use('/templates', require('./templates.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/stats', require('./stats.routes'));
router.use('/notification', require('./notification.routes'));
router.use('/home_needs', require('./home_needs.routes'));
router.get('/patients/:id/home-needs/latest', homeNeedsController.latestForPatient);

router.patch('/patients/:id/deceased', deathController.aliasMarkFromPatients);

module.exports = router;