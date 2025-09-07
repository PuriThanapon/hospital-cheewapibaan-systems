// src/routes/index.js
const express = require('express');
const router = express.Router();

const drugCodesRoutes   = require('./drug_codes.routes');
const deathController   = require('../controllers/deaths.controller');
const homeNeedsController = require('../controllers/home_needs.controller');
const bedSettingsRoutes = require('./bed_setting.routes');

// แพ้ยา
const allergiesRoutes = require('./allergies.routes');
const allergiesCtrl   = require('../controllers/allergies.controller');

// ✅ ตั้งค่าแบบฟอร์มผู้ป่วย
const settingsCtrl = require('../controllers/settings.controller');

// ---- helpers ----
// ไม่ normalize ใน router แล้ว ให้ controller จัดการเอง
const injectPatientId = (req, res, next) => {
  const id = req.params?.id;
  if (!id) return res.status(400).json({ message: 'Invalid HN' });

  if (req.method === 'GET') {
    req.query = { ...req.query, hn: id };
  } else if (req.method === 'POST') {
    req.body  = { ...(req.body || {}), patients_id: id };
  }
  next();
};

// ---------------- Aliases / Inline routes ----------------

// /api/patients/:id/allergies → GET list, POST create
router
  .route('/patients/:id/allergies')
  .get(injectPatientId,  allergiesCtrl.list)
  .post(injectPatientId, allergiesCtrl.create);

// ✅ Settings endpoints
// อ่านค่าตั้งค่าแบบฟอร์มผู้ป่วย
router.get('/settings/patient-form', settingsCtrl.getPatientForm);
// บันทึก/อัปเดตค่าตั้งค่าแบบฟอร์มผู้ป่วย
router.put('/settings/patient-form', settingsCtrl.updatePatientForm);

// ---------------- Sub-routers ----------------
router.use('/patients',         require('./patients.routes'));
router.use('/patient-files',    require('./patient_files.routes'));
router.use('/treatment',        require('./treatment.routes'));
router.use('/appointments',     require('./appointments.routes'));
router.use('/deaths',           require('./deaths.routes'));
router.use('/templates',        require('./templates.routes'));
router.use('/dashboard',        require('./dashboard.routes'));
router.use('/stats',            require('./stats.routes'));
router.use('/notification',     require('./notification.routes'));
router.use('/home_needs',       require('./home_needs.routes'));
router.use('/patient_diagnosis',require('./diagnosis.routes'));
router.use('/encounters',       require('./encounters.routes'));
router.use('/bed-settings',     bedSettingsRoutes);   // /api/bed-settings/*
router.use('/bed_settings',     bedSettingsRoutes);
router.use('/beds',             require('./beds.routes'));
router.use('/bed_stays',        require('./bed_stays.routes'));
router.use('/careplans',        require('./careplan.routes'));
router.use('/drug-codes',       drugCodesRoutes);   // /api/drug-codes
router.use('/drug_codes',       drugCodesRoutes);   // /api/drug_codes (alias)
router.use('/allergies',        allergiesRoutes);
router.use('/treatment-plans',  require('./treatmentPlans.routes'));
router.use('/treatmentPlans',   require('./treatmentPlans.routes'));
router.use('/routines',         require('./routines.routes'));

router.get('/patients/:id/home-needs/latest', homeNeedsController.latestForPatient);
router.patch('/patients/:id/deceased',        deathController.aliasMarkFromPatients);

module.exports = router;
