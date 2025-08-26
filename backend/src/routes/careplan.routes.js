const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/careplan.controller');

/** Care Plans */
router.get('/', ctrl.listCarePlans);            // GET    /api/careplans?status=active&q=...&patient_id=HN-...
router.get('/:id', ctrl.getCarePlan);           // GET    /api/careplans/:id
router.post('/', ctrl.createCarePlan);          // POST   /api/careplans
router.patch('/:id', ctrl.updateCarePlan);      // PATCH  /api/careplans/:id
router.delete('/:id', ctrl.deleteCarePlan);     // DELETE /api/careplans/:id?hard=true

/** Progress */
router.get('/:id/progress', ctrl.listProgress);                               // GET    /api/careplans/:id/progress
router.post('/:id/progress', ctrl.addProgress);                               // POST   /api/careplans/:id/progress
router.patch('/:id/progress/:progressId', ctrl.updateProgress);               // PATCH  /api/careplans/:id/progress/:progressId
router.delete('/:id/progress/:progressId', ctrl.deleteProgress);              // DELETE /api/careplans/:id/progress/:progressId

module.exports = router;
