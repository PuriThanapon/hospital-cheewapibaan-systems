const beds = require('../models/beds.model');

exports.list = async (req, res, next) => {
  try {
    const { care_side, ward_id } = req.query;
    const data = await beds.listBeds({
      care_side: care_side || null,
      ward_id: ward_id ? Number(ward_id) : null,
      activeOnly: true,
    });
    res.json({ data });
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const { code, care_side, ward_id, note } = req.body || {};
    if (!code || !care_side) return res.status(400).json({ message: 'code, care_side จำเป็น' });
    const data = await beds.createBed({ code, care_side, ward_id: ward_id ?? null, note: note ?? null });
    res.status(201).json({ data });
  } catch (e) { next(e); }
};

exports.available = async (req, res, next) => {
  try {
    const { from, to, care_side, ward_id } = req.query;
    if (!from || !to) return res.status(400).json({ message: 'from, to จำเป็น (ISO timestamp)' });
    const data = await beds.findAvailableBeds({
      from, to,
      care_side: care_side || null,
      ward_id: ward_id ? Number(ward_id) : null,
    });
    res.json({ data });
  } catch (e) { next(e); }
};
