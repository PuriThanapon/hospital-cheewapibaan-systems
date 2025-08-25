const express = require('express');
const router = express.Router();
const deathController = require('../controllers/deaths.controller');

// /api/deaths
router.get('/', deathController.list);
router.get('/:id', deathController.getOne);
router.post('/:id', deathController.createOrMark);   // mark เป็นเสียชีวิต
router.patch('/:id', deathController.update);        // แก้ไขข้อมูลการเสียชีวิต
router.delete('/:id', deathController.unset);        // ยกเลิกสถานะเสียชีวิต

module.exports = router;
