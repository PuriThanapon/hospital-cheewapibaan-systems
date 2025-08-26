// backend/src/routes/diagnosis.routes.js
const router = require('express').Router();
const c = require('../controllers/diagnosis.controller');

// list แบบ query: /api/patient_diagnosis?patients_id=HN-xxxx
router.get('/', c.listDiagnosis);

// list แบบ path ที่ชัดเจน: /api/patient_diagnosis/by-patient/HN-xxxx
router.get('/by-patient/:patients_id', c.getDiagnosisByPatient);

// CRUD by diag_id
router.post('/', c.createDiagnosis);
router.patch('/:diag_id', c.updateDiagnosis);
router.delete('/:diag_id', c.deleteDiagnosis);

module.exports = router;
