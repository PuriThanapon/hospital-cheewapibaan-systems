const express = require('express');
const { deathsByYear } = require('../controllers/stats.controller');
const router = express.Router();

router.get('/deaths-by-year', deathsByYear);

module.exports = router;
