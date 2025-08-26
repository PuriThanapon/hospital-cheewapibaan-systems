const router = require('express').Router();
const c = require('../controllers/diagnosis.controller');

// ---------------------- Diagnosis ทั่วไป ----------------------
// list แบบ query: /api/patient_diagnosis?patients_id=HN-xxxx
router.get('/', c.listDiagnosis);

// list แบบ path: /api/patient_diagnosis/by-patient/HN-xxxx
router.get('/by-patient/:patients_id', c.getDiagnosisByPatient);

// CRUD by diag_id
router.post('/', c.createDiagnosis);
router.patch('/:diag_id', c.updateDiagnosis);
router.delete('/:diag_id', c.deleteDiagnosis);

// ---------------------- Diagnosis ที่ผูกกับ Encounter ----------------------
// list วินิจฉัยของ encounter: GET /api/patient_diagnosis/by-encounter/123
router.get('/by-encounter/:encounter_id', c.listByEncounter);

// create วินิจฉัยใต้ encounter: POST /api/patient_diagnosis/by-encounter/123
router.post('/by-encounter/:encounter_id', c.createForEncounter);

module.exports = router;
