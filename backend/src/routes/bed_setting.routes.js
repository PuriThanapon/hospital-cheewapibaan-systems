// routes/bed_settings.routes.js
const express = require('express');
const ctrl = require('../controllers/bed_settings.controller');

const router = express.Router();

// สรุปจำนวนเตียงแยกตามฝั่ง + เมตาประเภท
router.get('/summary', ctrl.getSummary);

// จัดการเมตาประเภท (ชื่อไทย / prefix / สี / ลำดับ)
router.post('/types', ctrl.upsertType);
router.delete('/types/:code', ctrl.removeType);

// ปรับจำนวนเตียงจริง (สร้างเพิ่ม/retire เฉพาะว่าง)
router.post('/types/:code/reconcile', ctrl.reconcileOne); // รายประเภท
router.post('/reconcile', ctrl.reconcileBulk);            // หลายประเภท

module.exports = router;
