const express = require('express');
const ctrl = require('../controllers/patients.controller');
const homeNeedsCtrl = require('../controllers/home_needs.controller');
const router = express.Router();

/**
 * ⛳️ หลักการ:
 * 1) เส้นทาง static/specific ต้องมาก่อน :id
 * 2) ไม่ใช้ regex ใน path เพื่อหลีกเลี่ยง path-to-regexp version mismatch
 */

// static/specific
router.get('/next-id', ctrl.getNextPatientId);
router.get('/search', ctrl.search);
router.get('/recent', ctrl.recent);

// list ทั้งหมด
router.get('/', ctrl.listPatients);

// เส้นทางย่อยที่ขึ้นต้นด้วย :id (อย่ามี regex)
router.get('/:id/file/:field', ctrl.downloadPatientFile);
router.patch('/:id/deceased', ctrl.markDeceased);
router.get('/:id/home-needs/latest', homeNeedsCtrl.latestForPatient);

// รายการเดียว (วางท้ายสุด)
router.get('/:id', ctrl.getOnePatient);
router.delete('/:id', ctrl.deletePatient);
// เขียน/แก้ไข (multipart)
router.post('/', ctrl.uploadPatientFiles, ctrl.createPatient);
router.put('/:id', ctrl.uploadPatientFiles, ctrl.updatePatient);

module.exports = router;
