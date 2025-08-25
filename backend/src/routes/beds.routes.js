const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/beds.controller');

router.get('/', ctrl.list);
router.get('/available', ctrl.available);
router.post('/', ctrl.create);

module.exports = router;
