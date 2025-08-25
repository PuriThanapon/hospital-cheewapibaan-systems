const stays = require('../models/bed_stays.model');

exports.occupy = async (req, res, next) => {
  try {
    const { bed_id, patients_id, start_at, note, source_appointment_id } = req.body || {};
    if (!bed_id || !patients_id) {
      return res.status(400).json({ message: 'bed_id, patients_id จำเป็น' });
    }
    const data = await stays.occupy({
      bed_id: Number(bed_id),
      patients_id,
      start_at,
      note,
      source_appointment_id: source_appointment_id ?? null,
    });
    res.status(201).json({ data });
  } catch (e) {
    if (e.code === '23P01') return res.status(409).json({ message: e.message });
    next(e);
  }
};

exports.end = async (req, res, next) => {
  try {
    const stay_id = Number(req.params.id);
    const { at, reason } = req.body || {};
    const data = await stays.endStay(stay_id, { at, reason });
    if (!data) return res.status(404).json({ message: 'not found' });
    res.json({ data });
  } catch (e) { next(e); }
};

exports.cancel = async (req, res, next) => {
  try {
    const stay_id = Number(req.params.id);
    const data = await stays.cancel(stay_id);
    if (!data) return res.status(404).json({ message: 'not found' });
    res.json({ data });
  } catch (e) { next(e); }
};

exports.transfer = async (req, res, next) => {
  try {
    const stay_id = Number(req.params.id);
    const { to_bed_id, at, note } = req.body || {};
    if (!to_bed_id) return res.status(400).json({ message: 'to_bed_id จำเป็น' });
    const data = await stays.transfer(stay_id, {
      to_bed_id: Number(to_bed_id),
      at, note, by: req.user?.id || null
    });
    if (!data) return res.status(404).json({ message: 'not found' });
    res.json({ data });
  } catch (e) {
    if (e.code === '23P01') return res.status(409).json({ message: e.message });
    next(e);
  }
};

exports.historyByPatient = async (req, res, next) => {
  try {
    const patients_id = req.params.id;
    const data = await stays.historyByPatient(patients_id);
    res.json({ data });
  } catch (e) { next(e); }
};

exports.current = async (req, res, next) => {
  try {
    const data = await stays.currentOccupancy();
    res.json({ data });
  } catch (e) { next(e); }
};
