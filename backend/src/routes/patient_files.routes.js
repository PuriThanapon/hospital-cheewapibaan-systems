// src/routes/patient_files.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/patient_files.controller');

const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// เส้นทางที่เป็นคงรูป ต้องมาก่อน "/:patients_id"
router.get('/download/:id', ctrl.download);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

// รายการ / อัปโหลด ต่อผู้ป่วย
router.get('/:patients_id', ctrl.list);
router.post('/:patients_id', upload.single('file'), ctrl.upload);

module.exports = router;
