const express = require('express');
const ctrl = require('../controllers/drug_codes.controller');

const router = express.Router();

// ให้ค้นหาได้ทั้งที่ root และ /search
router.get('/', ctrl.search);          // GET /api/drug-codes?q=... หรือ ?code_24=...
router.get('/search', ctrl.search);    // GET /api/drug-codes/search?q=...
router.get('/:id', ctrl.getOne);       // GET /api/drug-codes/:id
router.post('/', ctrl.create);         // POST /api/drug-codes

module.exports = router;
