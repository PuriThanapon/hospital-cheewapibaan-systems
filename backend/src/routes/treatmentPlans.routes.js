const express = require('express');
const multer = require('multer');
const ctrl = require('../controllers/treatmentPlans.controller');

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.get('/', ctrl.list);
router.post('/', upload.any(), ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', upload.any(), ctrl.update);
router.delete('/:id', ctrl.remove);

router.get('/:id/files/:fileId', ctrl.downloadFile);
router.delete('/:id/files/:fileId', ctrl.removeFile);

module.exports = router;