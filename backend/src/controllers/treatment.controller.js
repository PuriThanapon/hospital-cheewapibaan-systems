const model = require('../models/treatment.model');

// helper ให้ตรงกับฝั่งหน้าเว็บ
function normalizePatientsId(id = '') {
  id = String(id || '').trim();
  if (!id) return '';
  if (/^\d+$/.test(id)) return 'HN-' + id.padStart(8, '0');
  // รองรับรูปแบบ HN-00000001 / HN00000001
  const m = id.match(/^HN[-\s]?(\d{1,8})$/i);
  if (m) return 'HN-' + m[1].padStart(8, '0');
  return id.toUpperCase();
}

// ช่วยแปลงชนิด + เดาโหมดค้นหา
function shapeQuery(qraw = {}) {
  const q = { ...qraw };

  // จัดการ page/limit/sort/active_only
  q.page = Math.max(1, parseInt(q.page ?? 1, 10) || 1);
  q.limit = Math.max(1, Math.min(200, parseInt(q.limit ?? 20, 10) || 20));
  q.sort = (q.sort || 'importance');
  q.active_only = (q.active_only === '0' || q.active_only === 0) ? '0' : '1';

  // from/to/treatment_type ปล่อยผ่าน (ตรวจใน model อีกชั้น)
  if (q.patient_id) {
    q.patient_id = normalizePatientsId(q.patient_id);
  }

  // เดาโหมดค้นหาจาก q:
  // - ถ้า q เป็นตัวเลขล้วน หรือเป็น HN ให้ย้ายไปเป็น patient_id
  // - ถ้ามีตัวอักษร ให้คงไว้เป็น q (ค้นหาชื่อ)
  if (!q.patient_id && q.q) {
    const s = String(q.q).trim();
    if (/^\d+$/.test(s) || /^HN[-\s]?\d+$/i.test(s)) {
      q.patient_id = normalizePatientsId(s);
      delete q.q;
    }
  }

  return q;
}

exports.listTreatment = async (req, res, next) => {
  try {
    const shaped = shapeQuery(req.query);
    const result = await model.listTreatment(shaped);
    res.json(result);
  } catch (err) { next(err); }
};

exports.getTreatment = async (req, res, next) => {
  try {
    const data = await model.getTreatmentById(req.params.id); // ✅ ใช้ :id
    if (!data) return res.status(404).json({ message: 'ไม่พบข้อมูลการรักษา' });
    res.json(data);
  } catch (err) { next(err); }
};

// (ออปชัน) ค้นด้วย patients_id โดยดึงจาก listTreatment
exports.searchTreatment = async (req, res, next) => {
  try {
    const shaped = shapeQuery({
      patient_id: req.query.patients_id,
      active_only: req.query.active_only ?? '0',
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 50),
      sort: req.query.sort || 'recent'
    });
    const result = await model.listTreatment(shaped);
    res.json(result);
  } catch (err) { next(err); }
};

exports.createTreatment = async (req, res, next) => {
  try {
    const treatment_id = await model.createTreatment(req.body);
    res.status(201).json({ message: 'บันทึกการรักษาสำเร็จ', treatment_id });
  } catch (err) { next(err); }
};

exports.updateTreatment = async (req, res, next) => {
  try {
    const data = await model.updateTreatment(req.params.id, req.body);
    if (!data) return res.status(404).json({ message: 'ไม่พบข้อมูลการรักษาที่ต้องการแก้ไข' });
    res.json({ message: 'แก้ไขข้อมูลการรักษาสำเร็จ', data });
  } catch (err) { next(err); }
};

exports.deleteTreatment = async (req, res, next) => {
  try {
    const ok = await model.deleteTreatment(req.params.id);
    if (!ok) return res.status(404).json({ message: 'ไม่พบข้อมูลการรักษานี้' });
    res.json({ message: 'ลบข้อมูลการรักษาเรียบร้อยแล้ว' });
  } catch (err) { next(err); }
};

exports.completeTreatment = async (req, res, next) => {
  try {
    const data = await model.completeTreatment(req.params.id);
    if (!data) return res.status(404).json({ message: 'ไม่พบรายการ หรือประเภทไม่ใช่ "ทำครั้งเดียว"' });
    res.json({ message: 'ทำเครื่องหมายเสร็จสิ้นแล้ว', data });
  } catch (err) { next(err); }
};
