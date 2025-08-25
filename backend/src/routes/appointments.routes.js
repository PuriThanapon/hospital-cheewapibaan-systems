// backend/src/routes/appointment.routes.js
const express = require('express');
const ctrl = require('../controllers/appointments.controller');

const router = express.Router();

router.get('/', ctrl.list);
router.get('/next-id', ctrl.nextId);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
