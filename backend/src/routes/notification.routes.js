// src/routes/notification.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notification.controller');

// นัดหมายวันนี้
router.get('/today', ctrl.getTodayAppointments);

// นัดหมายแบบ timeline (ช่วงวัน)
router.get('/timeline', ctrl.getTimelineAppointments);

// badge สรุปของวัน
router.get('/badge', ctrl.getTodayBadge);

// ✅ ใหม่: นัดที่ "เลยวัน" แล้วยังเป็นสถานะรอดำเนินการ (pending)
router.get('/overdue', ctrl.getOverdueAppointments);

// ✅ ใหม่: ยกเลิกอัตโนมัติกรณีเกิน 7 วัน (ยัง pending)
// - Dry run:  POST /api/notification/auto-cancel-overdue?dry=1  → นับว่าจะอัปเดตกี่รายการ
// - จริง:     POST /api/notification/auto-cancel-overdue        → เปลี่ยนสถานะเป็น cancelled
router.post('/auto-cancel-overdue', ctrl.autoCancelOverdue);

module.exports = router;
