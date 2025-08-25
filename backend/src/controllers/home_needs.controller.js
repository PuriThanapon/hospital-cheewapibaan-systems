const model = require('../models/home_needs.model');

// รองรับ HN-00000001 หรือเลขดิบ
function normalizePatientsId(id = '') {
  id = String(id || '').trim();
  if (!id) return '';
  if (/^\d+$/.test(id)) return 'HN-' + id.padStart(8, '0');
  return id.toUpperCase();
}

exports.latestByPatient = async (req, res, next) => {
  try {
    const pid = normalizePatientsId(req.params.id);
    if (!pid) return res.status(400).json({ message: 'ต้องระบุ patients_id' });
    const row = await model.getLatestByPatient(pid);
    res.json({ patients_id: pid, data: row ? row.items : [] , meta: row || null });
  } catch (e) { next(e); }
};

// (ทางเลือก) สร้าง/แก้รายการ ต้องเรียกตอนปิดเยี่ยมบ้าน
exports.upsert = async (req, res, next) => {
  try {
    const b = req.body || {};
    const payload = {
      id: b.id || null,
      patients_id: normalizePatientsId(b.patients_id),
      items: Array.isArray(b.items) ? b.items : [],
      status: b.status || 'open',
      source_appointment_id: b.source_appointment_id || null,
      noted_at: b.noted_at || null,
      note: b.note || null
    };
    if (!payload.patients_id) return res.status(400).json({ message: 'ต้องระบุ patients_id' });
    const row = await model.upsertNeeds(payload);
    res.status(payload.id ? 200 : 201).json(row);
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const b = req.body || {};
    const patients_id = normalizePatientsId(b.patients_id || b.hn || '');
    const items = Array.isArray(b.items) ? b.items : [];
    const payload = {
      patients_id,
      items, // ให้ model เป็นคน JSON.stringify
      status: b.status || 'open',
      source_appointment_id: b.source_appointment_id || null,
      noted_at: b.noted_at || null,
    };
    if (!patients_id) return res.status(400).json({ message: 'ต้องระบุ patients_id' });
    if (items.length === 0) return res.status(400).json({ message: 'ต้องมี items อย่างน้อย 1 รายการ' });

    const row = await model.createHomeNeeds(payload);
    return res.status(201).json(row);
  } catch (e) { next(e); }
};

exports.latestForPatient = async (req, res, next) => {
  try {
    const pid = normalizePatientsId(req.params.id);
    if (!pid) return res.status(400).json({ message: 'ต้องระบุ patients_id' });

    const row = await model.getLatestNeedsByPatient(pid); // อธิบายด้านล่าง
    // คาดว่า row = { id, patients_id, items(JSON|string), status, noted_at, ... } หรือ null
    const items = row?.items
      ? (typeof row.items === 'string' ? JSON.parse(row.items) : row.items)
      : [];

    return res.json({ data: Array.isArray(items) ? items : [] });
  } catch (e) {
    // กัน JSON.parse พัง/SQL พัง
    e.status = e.status || 500;
    return next(e);
  }
};