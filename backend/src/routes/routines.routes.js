const express = require('express');
const ctrl = require('../controllers/routines.controller');
const router = express.Router();

// เดิมมี (\\d+) → ลบออกทั้งหมด!
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
