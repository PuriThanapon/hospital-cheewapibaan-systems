const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/settings.controller');

// ดึง/บันทึกค่าตั้งค่าฟอร์มผู้ป่วย
router.get('/patient-form', ctrl.getPatientForm);
router.put('/patient-form', ctrl.updatePatientForm);

module.exports = router;