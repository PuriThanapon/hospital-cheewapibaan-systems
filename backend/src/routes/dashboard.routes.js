const express = require('express');
const ctrl = require('../controllers/dashboard.controller');

const router = express.Router();

const stats = require('../controllers/stats.controller');

// safety check (optional)
if (typeof stats.deathsByYear !== 'function') {
  throw new Error(
    'stats.deathsByYear is not a function (got ' + typeof stats.deathsByYear + '). ' +
    'ตรวจการ export ใน controllers/stats.controller.js'
  );
}

router.get('/deaths-by-year', stats.deathsByYear);

router.get('/summary', ctrl.getSummary);
router.get('/trends', ctrl.getTrends);
router.get('/top-diseases', ctrl.getTopDiseases);
router.get('/patients-by-type', ctrl.getPatientsByType);
router.get('/appointments', ctrl.getAppointmentsWidget);
router.get('/patients-gender', ctrl.getPatientsByGender);
router.get('/target-groups', ctrl.getPatientsByType);

module.exports = router;
