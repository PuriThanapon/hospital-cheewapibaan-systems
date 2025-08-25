// backend/src/controllers/death.controller.js
const Death = require('../models/deaths.model');

/** GET /api/deaths */
exports.list = async (req, res, next) => {
  try {
    const { q = '', patient_id = '', death_from = '', death_to = '', page = 1, limit = 20 } = req.query;
    const out = await Death.listDeaths({
      q, patient_id,
      death_from, death_to,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
    res.json(out);
  } catch (e) { next(e); }
};

/** GET /api/deaths/:id */
exports.getOne = async (req, res, next) => {
  try {
    const row = await Death.getDeathByPatient(req.params.id);
    if (!row) return res.status(404).json({ message: 'ไม่พบข้อมูล' });
    res.json(row);
  } catch (e) { next(e); }
};

/** POST /api/deaths/:id  (กำหนดเป็นเสียชีวิต) */
exports.createOrMark = async (req, res, next) => {
  try {
    const { death_date, death_time, death_cause, management } = req.body || {};
    if (!death_date || !death_time || !death_cause) {
      return res.status(400).json({ message: 'ต้องระบุ death_date, death_time, death_cause' });
    }
    const row = await Death.markDeceased(req.params.id, { death_date, death_time, death_cause, management });
    res.status(201).json({ message: 'บันทึกการเสียชีวิตสำเร็จ', patient: row });
  } catch (e) { next(e); }
};

/** PATCH /api/deaths/:id  (แก้ไขข้อมูลการเสียชีวิต) */
exports.update = async (req, res, next) => {
  try {
    const row = await Death.updateDeath(req.params.id, req.body || {});
    if (!row) return res.status(404).json({ message: 'ไม่พบผู้ป่วย' });
    res.json({ message: 'อัปเดตข้อมูลการเสียชีวิตสำเร็จ', patient: row });
  } catch (e) { next(e); }
};

/** DELETE /api/deaths/:id  (ยกเลิกสถานะเสียชีวิต) */
exports.unset = async (req, res, next) => {
  try {
    const row = await Death.unsetDeath(req.params.id);
    if (!row) return res.status(404).json({ message: 'ไม่พบผู้ป่วย' });
    res.json({ message: 'ยกเลิกสถานะเสียชีวิตแล้ว', patient: row });
  } catch (e) { next(e); }
};

/** === Alias เพื่อให้ฝั่ง Frontend เดิมทำงานได้ ===
 * PATCH /api/patients/:id/deceased  -> mark deceased
 */
exports.aliasMarkFromPatients = async (req, res, next) => {
  return exports.createOrMark(req, res, next);
};
