const router = require('express').Router();
const c = require('../controllers/diagnosis.controller');

// แบบ query: GET /api/patient_diagnosis?patients_id=HN-xxxx
router.get('/', c.listDiagnosis);

// (ทางเลือก) แบบ path: GET /api/patient_diagnosis/:id
router.get('/:id', c.getDiagnosisByPatient);

// CRUD
router.post('/', c.createDiagnosis);
router.patch('/:diag_id', c.updateDiagnosis);
router.delete('/:diag_id', c.deleteDiagnosis);

module.exports = router;
