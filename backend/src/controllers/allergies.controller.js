// src/controllers/allergies.controller.js
const model = require('../models/allergies.model');
const asyncHandler = require('../middlewares/asyncHandler');

// --- ใส่ exports.* ให้ครบทุกตัว และอย่าเผลอ module.exports ทับ exports ---
exports.list = asyncHandler(async (req, res) => {
  const hn = req.query.hn || req.params.hn || req.params.id || req.body.patients_id;
  if (!hn) return res.status(400).json({ message: 'hn is required' });
  const rows = await model.listByHN(String(hn).toUpperCase());
  res.json({ data: rows });
});

exports.getOne = asyncHandler(async (req, res) => {
  const row = await model.getById(req.params.id);
  if (!row) return res.status(404).json({ message: 'Not found' });
  res.json(row);
});

exports.create = asyncHandler(async (req, res) => {
  const hn = (req.body.patients_id || req.params.id || req.query.hn || '').toUpperCase();
  if (!hn) return res.status(400).json({ message: 'patients_id/hn is required' });

  const payload = {
    ...req.body,
    patients_id: hn,
    onset_date: req.body.onset_date || null,
    reaction: req.body.reaction || null,
    thai24_code: req.body.thai24_code || null,
    note: req.body.note || null,
    patient_type: req.body.patient_type || 'OPD',
  };
  const row = await model.create(payload);
  res.status(201).json(row);
});

exports.update = asyncHandler(async (req, res) => {
  const { patients_id, ...rest } = req.body || {}; // กันเปลี่ยน patients_id
  const row = await model.update(req.params.id, rest);
  if (!row) return res.status(404).json({ message: 'Not found' });
  res.json(row);
});

exports.remove = asyncHandler(async (req, res) => {
  const has = await model.getById(req.params.id);
  if (!has) return res.status(404).json({ message: 'Not found' });
  await model.remove(req.params.id);
  res.status(204).end();
});
