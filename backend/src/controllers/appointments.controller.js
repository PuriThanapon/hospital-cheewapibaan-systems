// backend/src/controllers/appointment.controller.js
// แก้ path ให้ตรงชื่อไฟล์ model ของคุณ (ไม่มี s)
// ถ้าไฟล์คุณชื่อ appointments.model.js จริง ให้เปลี่ยนบรรทัดนี้กลับไปให้ตรง
const model = require('../models/appointments.model');

function normalizePatientsId(id = '') {
  id = String(id || '').trim();
  if (!id) return '';
  if (/^\d+$/.test(id)) return 'HN-' + id.padStart(8, '0');
  return id.toUpperCase();
}

function toISODateLocal(val) {
  if (!val) return null;
  if (typeof val === 'string') return val;
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ------- ถ้าคุณใช้ endpoint นี้: ต้องมีฟังก์ชัน model.nextAppointmentCode() (ดูด้านล่าง) -------
exports.nextId = async (req, res, next) => {
  try {
    const code = await model.nextAppointmentCode();
    res.json({ nextId: code });
  } catch (e) { next(e); }
};

exports.list = async (req, res, next) => {
  try {
    const q = { ...req.query };
    const result = await model.listAppointments({
      q: (q.q || '').toString().trim(),
      status: (q.status || 'all').toString().trim(),
      type: (q.type || q.appointment_type || '').toString().trim(),   // << รองรับ filter home|hospital
      from: q.from || '',
      to: q.to || '',
      sort: (q.sort || 'datetime').toString().trim(),
      dir: (q.dir || 'desc').toString().trim(),
      page: Number(q.page || 1),
      limit: Number(q.limit || 20),
    });
    res.json(result);
  } catch (e) { next(e); }
};

exports.getById = async (req, res, next) => {
  try {
    const id = req.params.id;
    const row = await model.getAppointmentById(id);
    if (!row) return res.status(404).json({ message: 'ไม่พบนัดหมาย' });
    res.json(row);
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const b = req.body || {};
    const payload = {
      patients_id: normalizePatientsId(b.patients_id || b.hn || ''),
      appointment_date: toISODateLocal(b.date || b.appointment_date),
      start_time: b.start || b.start_time || null,
      end_time: b.end || b.end_time || null,

      // รองรับ 'type' หรือ 'appointment_type', map clinic -> hospital ในชั้น model อีกรอบ
      appointment_type: b.type || b.appointment_type || null,

      // บ้านผู้ป่วย => ปล่อยให้เป็น null; โรงพยาบาล => กรอกชื่อ/ที่อยู่
      hospital_address: b.hospital_address || b.hospital || null,

      place: b.place || null,          // ใช้แสดงผลฝั่ง UI ได้เหมือนเดิม
      status: b.status || 'pending',
      note: b.note || null,
    };

    if (!payload.patients_id) return res.status(400).json({ message: 'ต้องระบุ patients_id' });
    if (!payload.appointment_date) return res.status(400).json({ message: 'ต้องระบุวันที่นัด' });
    if (!payload.start_time || !payload.end_time) {
      return res.status(400).json({ message: 'ต้องระบุเวลาเริ่มและเวลาสิ้นสุด' });
    }

    const row = await model.createAppointment(payload);
    res.status(201).json(row);
  } catch (e) {
    const status = e.status || 500;
    res.status(status).json({ message: e.message || 'สร้างนัดหมายไม่สำเร็จ' });
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = req.params.id;
    const b = req.body || {};
    const update = {};

    if (b.patients_id || b.hn) update.patients_id = normalizePatientsId(b.patients_id || b.hn);
    if (b.date || b.appointment_date) update.appointment_date = toISODateLocal(b.date || b.appointment_date);
    if (b.start || b.start_time) update.start_time = b.start || b.start_time;
    if (b.end || b.end_time) update.end_time = b.end || b.end_time;

    if (b.type || b.appointment_type) update.appointment_type = b.type || b.appointment_type;
    if (b.hospital_address !== undefined || b.hospital !== undefined) {
      update.hospital_address = (b.hospital_address ?? b.hospital) || null;
    }

    if (b.place !== undefined) update.place = b.place;
    if (b.status !== undefined) update.status = b.status;
    if (b.note !== undefined) update.note = b.note;

    const row = await model.updateAppointment(id, update);
    if (!row) return res.status(404).json({ message: 'ไม่พบนัดหมายหรือไม่มีการเปลี่ยนแปลง' });
    res.json(row);
  } catch (e) {
    const status = e.status || 500;
    res.status(status).json({ message: e.message || 'อัปเดตนัดหมายไม่สำเร็จ' });
  }
};

exports.remove = async (req, res, next) => {
  try {
    const ok = await model.deleteAppointment(req.params.id);
    if (!ok) return res.status(404).json({ message: 'ไม่พบนัดหมาย' });
    res.status(204).end();
  } catch (e) { next(e); }
};
