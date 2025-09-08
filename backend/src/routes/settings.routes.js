const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/settings.controller');

// form
router.get('/patient-form', ctrl.getPatientForm);
router.put('/patient-form', ctrl.updatePatientForm);

// table (👈 เส้นทางใหม่)
router.get('/patient-table', ctrl.getPatientTable);
router.put('/patient-table', ctrl.updatePatientTable);

module.exports = router;
