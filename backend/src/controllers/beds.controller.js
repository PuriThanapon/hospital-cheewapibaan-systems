// controllers/beds.controller.js
const beds = require('../models/beds.model');

/**
 * GET /api/beds
 * ?care_side=LTC|PC&ward_id=123&activeOnly=true|false
 */
exports.list = async (req, res, next) => {
  try {
    const care_side = req.query.care_side
      ? String(req.query.care_side).toUpperCase()
      : null;
    const ward_id = req.query.ward_id ? Number(req.query.ward_id) : null;

    // ถ้าไม่ส่งมา ให้ค่าเริ่มต้นเป็น true (ตามพฤติกรรมเดิม)
    const activeOnly =
      typeof req.query.activeOnly === 'undefined'
        ? true
        : String(req.query.activeOnly).toLowerCase() !== 'false';

    const rows = await beds.listBeds({ care_side, ward_id, activeOnly });

    // ช่วยให้ฝั่งหน้าใช้ง่าย: เติม id และ service_type (คงฟิลด์เดิมไว้ครบ)
    const data = rows.map((r) => ({
      ...r,
      id: r.bed_id,
      service_type: r.care_side,
    }));

    res.json({ data });
  } catch (e) {
    next(e);
  }
};

/**
 * POST /api/beds
 * body: { code, care_side, ward_id?, note? }
 */
exports.create = async (req, res, next) => {
  try {
    const { code, care_side, ward_id, note } = req.body || {};
    if (!code || !care_side) {
      return res.status(400).json({ message: 'code, care_side จำเป็น' });
    }

    const payload = {
      code: String(code).trim().toUpperCase(),
      care_side: String(care_side).trim().toUpperCase(),
      ward_id: ward_id == null || ward_id === '' ? null : Number(ward_id),
      note: note ?? null,
    };

    const data = await beds.createBed(payload);
    // เติมฟิลด์ช่วยเหมือนใน list
    res.status(201).json({
      data: {
        ...data,
        id: data.bed_id,
        service_type: data.care_side,
      },
    });
  } catch (e) {
    // จัดการ error ที่พบบ่อยให้เป็น 4xx อ่านง่าย
    if (e?.code === '23505') {
      // unique_violation (เช่น code ซ้ำ)
      return res.status(409).json({ message: 'รหัสเตียงซ้ำ (duplicate code)' });
    }
    if (e?.code === '23503') {
      // foreign_key_violation (เช่น ward_id ไม่ถูกต้อง)
      return res
        .status(422)
        .json({ message: 'อ้างอิง ward_id ไม่ถูกต้อง (FK violation)' });
    }
    next(e);
  }
};

/**
 * GET /api/beds/available
 * ?from=ISO&to=ISO&care_side=LTC|PC&ward_id=123
 */
exports.available = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res
        .status(400)
        .json({ message: 'from, to จำเป็น (ISO timestamp)' });
    }

    const care_side = req.query.care_side
      ? String(req.query.care_side).toUpperCase()
      : null;
    const ward_id = req.query.ward_id ? Number(req.query.ward_id) : null;

    // ตรวจรูปแบบเวลาเบื้องต้น
    const fromD = new Date(String(from));
    const toD = new Date(String(to));
    if (isNaN(+fromD) || isNaN(+toD)) {
      return res
        .status(400)
        .json({ message: 'รูปแบบ from/to ไม่ถูกต้อง (ต้องเป็น ISO)' });
    }
    if (+toD <= +fromD) {
      return res
        .status(400)
        .json({ message: 'ช่วงเวลาไม่ถูกต้อง: to ต้องมากกว่า from' });
    }

    const rows = await beds.findAvailableBeds({
      from,
      to,
      care_side,
      ward_id,
    });

    // เติมฟิลด์ช่วยให้สอดคล้องกับ list
    const data = rows.map((r) => ({
      ...r,
      id: r.bed_id,
      service_type: r.care_side,
    }));

    res.json({ data });
  } catch (e) {
    next(e);
  }
};
