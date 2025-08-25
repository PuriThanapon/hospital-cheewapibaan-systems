const express = require('express');
const ctrl = require('../controllers/patients.controller')
const homeNeedsCtrl = require('../controllers/home_needs.controller')
const router = express.Router();

// /api/patients/next-id
router.get('/next-id', ctrl.getNextPatientId);

// /api/patients
router.get('/', ctrl.listPatients);

// /api/patients/:id
router.get('/:id', ctrl.getOnePatient);

// ✅ รองรับ multipart/form-data และไฟล์แนบ
router.post('/', ctrl.uploadPatientFiles, ctrl.createPatient);
router.put('/:id', ctrl.uploadPatientFiles, ctrl.updatePatient);

// ✅ ดาวน์โหลดไฟล์แนบ: field = patient_id_card | house_registration | patient_photo | relative_id_card
router.get('/:id/file/:field', ctrl.downloadPatientFile);

// ✅ เปลี่ยนสถานะเป็นเสียชีวิต
router.patch('/:id/deceased', ctrl.markDeceased);

router.get('/:id/home-needs/latest', homeNeedsCtrl.latestForPatient);

module.exports = router;
