// src/routes/index.js
const express = require('express');
const router = express.Router();
const drugCodesRoutes = require('./drug_codes.routes');
const deathController = require('../controllers/deaths.controller');
const homeNeedsController = require('../controllers/home_needs.controller');

// แพ้ยา
const allergiesRoutes = require('./allergies.routes');
const allergiesCtrl   = require('../controllers/allergies.controller');

// 🔹 ไม่ normalize ใน router แล้ว ปล่อย controller จัดการ
const injectPatientId = (req, res, next) => {
  const id = req.params?.id;
  if (!id) return res.status(400).json({ message: 'Invalid HN' });

  if (req.method === 'GET') {
    req.query = { ...req.query, hn: id };            // controller จะ normalize เอง
  } else if (req.method === 'POST') {
    req.body  = { ...(req.body || {}), patients_id: id };
  }
  next();
};

// alias: /api/patients/:id/allergies → GET list, POST create
router
  .route('/patients/:id/allergies')
  .get(injectPatientId,  allergiesCtrl.list)
  .post(injectPatientId, allergiesCtrl.create);

// sub-routers อื่น ๆ
router.use('/patients', require('./patients.routes'));
router.use('/patient-files', require('./patient_files.routes'));
router.use('/treatment', require('./treatment.routes'));
router.use('/appointments', require('./appointments.routes'));
router.use('/deaths', require('./deaths.routes'));
router.use('/templates', require('./templates.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/stats', require('./stats.routes'));
router.use('/notification', require('./notification.routes'));
router.use('/home_needs', require('./home_needs.routes'));
router.use('/patient_diagnosis', require('./diagnosis.routes'));
router.use('/encounters', require('./encounters.routes'));
router.use('/beds', require('./beds.routes'));
router.use('/bed_stays', require('./bed_stays.routes'));
router.use('/careplans', require('./careplan.routes'));
router.use('/drug-codes', drugCodesRoutes);  // /api/drug-codes
router.use('/drug_codes', drugCodesRoutes);  // /api/drug_codes  (alias)
router.use('/allergies', allergiesRoutes);
router.use('/treatment-plans', require('./treatmentPlans.routes'));
router.use('/treatmentPlans', require('./treatmentPlans.routes'));
router.use('/routines', require('./routines.routes')); 
router.get('/patients/:id/home-needs/latest', homeNeedsController.latestForPatient);
router.patch('/patients/:id/deceased',        deathController.aliasMarkFromPatients);

module.exports = router;
