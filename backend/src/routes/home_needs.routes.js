const express = require('express');
const ctrl = require('../controllers/home_needs.controller');

const router = express.Router();

// ดึงรายการล่าสุดตามคนไข้ (ใช้บนฟอร์มนัด)
router.get('/patients/:id/home_needs/latest', ctrl.latestByPatient);

// (ทางเลือก) บันทึก/แก้ไขหลังเยี่ยม
router.post('/', ctrl.upsert);
router.put('/:id', ctrl.upsert);

module.exports = router;
