const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/bed_stays.controller');

// === READS ===
router.get('/current', ctrl.current);
router.get('/patients/:id/history', ctrl.historyByPatient); // <<<< ต้องมีบรรทัดนี้

// === WRITES ===
router.post('/', ctrl.occupy);
router.patch('/:id/end', ctrl.end);
router.post('/:id/transfer', ctrl.transfer);
router.patch('/:id/cancel', ctrl.cancel);

module.exports = router;
