// backend/src/controllers/death.controller.js
const Death = require('../models/deaths.model');
const bedStays = require('../models/bed_stays.model');

const normalizeHN = (v = '') => decodeURIComponent(String(v));

/** helper: compose timestamptz ISO from (date, time) */
function composeDeceasedAt(death_date, death_time) {
  // ถ้า time ไม่มี ให้เป็น 00:00
  const t = String(death_time || '00:00').slice(0,5);
  // new Date() จะตีความเป็น local time แล้วแปลงเป็น ISO (UTC) ให้ bedStays ใช้ได้
  const iso = new Date(`${death_date}T${t}:00`).toISOString();
  return iso;
}

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

    // 1) บันทึกสถานะเสียชีวิตใน patients
    const row = await Death.markDeceased(req.params.id, {
      death_date, death_time, death_cause, management
    });

    // 2) ปล่อยเตียงที่ยังครอง ณ เวลาเสียชีวิต
    const deceasedAt = composeDeceasedAt(death_date, death_time);
    try {
      await bedStays.forceEndActiveForPatient(req.params.id, {
        at: deceasedAt, // ISO เช่น 2025-08-25T12:34:00.000Z
        reason: 'deceased'
      });
    } catch (e) {
      console.error('forceEndActiveForPatient failed:', e);
      return res.status(201).json({
        message: 'บันทึกการเสียชีวิตสำเร็จ แต่ปล่อยเตียงไม่สำเร็จ กรุณาตรวจสอบประวัติเตียง',
        patient: row,
        warn: 'bed_release_failed'
      });
    }

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

/** === Aliases เพื่อให้ Frontend เดิมเรียกผ่าน /api/patients/:id/deceased ได้ === */
exports.aliasMarkFromPatients = async (req, res, next) => {
  return exports.createOrMark(req, res, next);
};
exports.aliasGetFromPatients = async (req, res, next) => {
  req.params.id = normalizeHN(req.params.id);
  return exports.getOne(req, res, next);
};
exports.aliasUnsetFromPatients = async (req, res, next) => {
  return exports.unset(req, res, next);
};
