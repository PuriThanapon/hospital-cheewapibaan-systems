// backend/src/routes/patients.routes.js
const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/patients.controller');
const homeNeedsCtrl = require('../controllers/home_needs.controller');
const encounters = require('../controllers/encounters.controller'); // ✅ ต้อง export เป็นฟังก์ชันจริง

/**
 * ⛳️ แนวทางจัดลำดับ:
 * 1) เส้นทาง static/specific มาก่อน
 * 2) เส้นทางย่อยของ :id ไว้รวมกัน
 * 3) เส้นทาง generic '/:id' วางท้ายกลุ่ม GET/DELETE
 * 4) เขียน/แก้ไข (POST/PUT) ปิดท้าย
 */

// ---------- Static / specific ----------
router.get('/next-id', ctrl.getNextPatientId);
router.get('/search', ctrl.search);
router.get('/recent', ctrl.recent);

// ---------- List ทั้งหมด ----------
router.get('/', ctrl.listPatients);

// ---------- เส้นทางย่อยที่ขึ้นต้นด้วย :id ----------
router.get('/:id/file/:field', ctrl.downloadPatientFile);
router.patch('/:id/deceased', ctrl.markDeceased);
router.get('/:id/home-needs/latest', homeNeedsCtrl.latestForPatient);

// Encounters (ของผู้ป่วย)
router.get('/:id/encounters/summary',    encounters.getSummary);
router.post('/:id/encounters/baseline',  encounters.upsertBaseline);
router.post('/:id/encounters/treatments', encounters.addTreatment);

// ---------- รายการเดียว ----------
router.get('/:id', ctrl.getOnePatient);
router.delete('/:id', ctrl.deletePatient);

// ---------- เขียน/แก้ไข (multipart) ----------
router.post('/', ctrl.uploadPatientFiles, ctrl.createPatient);
router.put('/:id', ctrl.uploadPatientFiles, ctrl.updatePatient);

module.exports = router;
