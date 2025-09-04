// backend/src/routes/patients.routes.js
const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/patients.controller');
const homeNeedsCtrl = require('../controllers/home_needs.controller');
const encounters = require('../controllers/encounters.controller');
const deaths = require('../controllers/deaths.controller'); // ✅ ใช้ไฟล์ที่คุณเพิ่ม

// ---------- Static / specific ----------
router.get('/next-id', ctrl.getNextPatientId);
router.get('/search', ctrl.search);
router.get('/recent', ctrl.recent);

// ---------- List ทั้งหมด ----------
router.get('/', ctrl.listPatients);

// ---------- เส้นทางย่อยของ :id ----------
router.get('/:id/file/:field', ctrl.downloadPatientFile);

// ข้อมูลเสียชีวิต (อ่าน/แก้ไข ผ่าน path ของ patients)
router.get('/:id/deceased', deaths.aliasGetFromPatients);      // ✅ โหลดข้อมูลเสียชีวิต
router.patch('/:id/deceased', deaths.aliasMarkFromPatients);   // ✅ mark/update
// ถ้าต้องการยกเลิกสถานะเสียชีวิตด้วย:
router.delete('/:id/deceased', deaths.aliasUnsetFromPatients); // (ออปชัน)

router.get('/:id/home-needs/latest', homeNeedsCtrl.latestForPatient);

// Encounters (ของผู้ป่วย)
router.get('/:id/encounters/summary',   encounters.getSummary);
router.get('/:id/encounters/baseline',  encounters.getBaseline);     // ✅ เพิ่ม GET baseline
router.post('/:id/encounters/baseline', encounters.upsertBaseline);
router.post('/:id/encounters/treatments', encounters.addTreatment);

// ---------- รายการเดียว ----------
router.get('/:id', ctrl.getOnePatient);
router.delete('/:id', ctrl.deletePatient);

// ---------- เขียน/แก้ไข (multipart) ----------
router.post('/', ctrl.uploadPatientFiles, ctrl.createPatient);
router.put('/:id', ctrl.uploadPatientFiles, ctrl.updatePatient);

module.exports = router;
