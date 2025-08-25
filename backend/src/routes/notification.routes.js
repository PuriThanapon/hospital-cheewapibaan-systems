// src/routes/notification.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notification.controller');

// นัดหมายวันนี้
router.get('/today', ctrl.getTodayAppointments);

// นัดหมายแบบ timeline (ช่วงวัน)
router.get('/timeline', ctrl.getTimelineAppointments);

router.get('/badge', ctrl.getTodayBadge);

module.exports = router;
