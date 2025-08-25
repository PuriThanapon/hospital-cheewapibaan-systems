// routes/templates.routes.js
const express = require('express');
const ctrl = require('../controllers/templates.controller');

const router = express.Router();

// list / get
router.get('/', ctrl.listTemplates);
router.get('/:id', ctrl.getOneTemplate);
router.get('/:id/file', ctrl.downloadTemplateFile);

// create / update / delete
router.post('/', ctrl.uploadTemplateFile, ctrl.createTemplate);
router.put('/:id', ctrl.uploadTemplateFile, ctrl.updateTemplate);
router.delete('/:id', ctrl.deleteTemplate);

module.exports = router;
