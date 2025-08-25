const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/treatment.controller');

// static routes ควรอยู่ก่อนพวก :param
router.get('/search', ctrl.searchTreatment);

// list & create
router.get('/', ctrl.listTreatment);
router.post('/', ctrl.createTreatment);

// read one
router.get('/:id', ctrl.getTreatment);

// update (ให้ตรงกับ front: PATCH /api/treatment/:id)
// รองรับทั้ง PATCH และ PUT เผื่อมี client เก่า
router.patch('/:id', ctrl.updateTreatment);
router.put('/:id', ctrl.updateTreatment);

// complete
router.patch('/:id/complete', ctrl.completeTreatment);

// delete
router.delete('/:id', ctrl.deleteTreatment);

module.exports = router;
