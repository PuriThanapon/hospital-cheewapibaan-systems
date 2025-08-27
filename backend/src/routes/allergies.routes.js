// src/routes/allergies.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/allergies.controller'); // path ต้องตรงชื่อไฟล์

// (ดีบั๊กชั่วคราว ถ้าจะเช็ค)
if (!ctrl || typeof ctrl.list !== 'function') {
  console.error('allergies.controller loaded as:', ctrl);
  throw new Error('allergies.controller missing handlers');
}

// GET /api/allergies?hn=HN-00000001
router.get('/', ctrl.list);

// GET /api/allergies/:id
router.get('/:id', ctrl.getOne);

// POST /api/allergies
router.post('/', ctrl.create);

// PUT /api/allergies/:id
router.put('/:id', ctrl.update);

// DELETE /api/allergies/:id
router.delete('/:id', ctrl.remove);

module.exports = router;
    