const model = require('../models/careplan.model');

/** Normalize patients_id -> HN-XXXXXXXX */
function normalizePatientsId(id = '') {
  id = String(id || '').trim().toUpperCase();
  if (!id) return '';
  // remove HN- prefix, non-digits; then pad
  const digits = id.replace(/^HN[-–—]?/i, '').replace(/\D/g, '');
  if (!digits) return '';
  return 'HN-' + digits.padStart(8, '0');
}

/** =============== Care Plans =============== */

exports.listCarePlans = async (req, res, next) => {
  try {
    const q = { ...req.query };
    if (q.patient_id) q.patient_id = normalizePatientsId(q.patient_id);
    const result = await model.listCarePlans(q);
    res.json(result);
  } catch (err) { next(err); }
};

exports.getCarePlan = async (req, res, next) => {
  try {
    const data = await model.getCarePlanById(req.params.id);
    if (!data) return res.status(404).json({ message: 'Care Plan not found' });
    res.json(data);
  } catch (err) { next(err); }
};

exports.createCarePlan = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    payload.patients_id = normalizePatientsId(payload.patients_id);
    if (!payload.patients_id) {
      return res.status(400).json({ message: 'patients_id is required' });
    }
    if (!payload.problem || !payload.goal || !payload.intervention) {
      return res.status(400).json({ message: 'problem, goal, intervention are required' });
    }
    const data = await model.createCarePlan(payload);
    res.status(201).json(data);
  } catch (err) {
    // foreign key fail -> patients_id ไม่อยู่ในฐาน
    if (err?.code === '23503') {
      return res.status(400).json({ message: 'Invalid patients_id (not found in patients)' });
    }
    next(err);
  }
};

exports.updateCarePlan = async (req, res, next) => {
  try {
    const data = await model.updateCarePlan(req.params.id, req.body || {});
    if (!data) return res.status(404).json({ message: 'Care Plan not found' });
    res.json(data);
  } catch (err) { next(err); }
};

exports.deleteCarePlan = async (req, res, next) => {
  try {
    const hard = String(req.query.hard || '').toLowerCase() === 'true';
    const data = await model.deleteCarePlan(req.params.id, { hard });
    if (!data) return res.status(404).json({ message: 'Care Plan not found' });
    res.json({ message: hard ? 'Hard deleted' : 'Soft deleted', data });
  } catch (err) { next(err); }
};

/** =============== Progress =============== */

exports.listProgress = async (req, res, next) => {
  try {
    const data = await model.listProgress(req.params.id);
    res.json(data);
  } catch (err) { next(err); }
};

exports.addProgress = async (req, res, next) => {
  try {
    const { note = '', progress_percent = 0 } = req.body || {};
    if (progress_percent < 0 || progress_percent > 100) {
      return res.status(400).json({ message: 'progress_percent must be 0..100' });
    }
    const data = await model.addProgress(req.params.id, { note, progress_percent });
    res.status(201).json(data);
  } catch (err) { next(err); }
};

exports.updateProgress = async (req, res, next) => {
  try {
    const { progress_percent } = req.body || {};
    if (progress_percent != null && (progress_percent < 0 || progress_percent > 100)) {
      return res.status(400).json({ message: 'progress_percent must be 0..100' });
    }
    const data = await model.updateProgress(req.params.id, req.params.progressId, req.body || {});
    if (!data) return res.status(404).json({ message: 'Progress not found' });
    res.json(data);
  } catch (err) { next(err); }
};

exports.deleteProgress = async (req, res, next) => {
  try {
    const data = await model.deleteProgress(req.params.id, req.params.progressId);
    if (!data) return res.status(404).json({ message: 'Progress not found' });
    res.json({ message: 'Deleted', data });
  } catch (err) { next(err); }
};
