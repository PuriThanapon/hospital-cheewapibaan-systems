// backend/src/controllers/appointment.controller.js

// ✅ แก้ path ให้ตรงชื่อไฟล์ model ของคุณ
// ถ้าไฟล์คุณชื่อ "appointment.model.js" ให้ใช้บรรทัดล่าง:
// const model = require('../models/appointment.model');
// ถ้าไฟล์คุณชื่อ "appointments.model.js" (มี s) ให้ใช้บรรทัดนี้แทน:
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

// ------- ถ้าคุณใช้ endpoint นี้: ต้องมีฟังก์ชัน model.nextAppointmentCode() -------
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
      type: (q.type || q.appointment_type || '').toString().trim(),   // home|hospital
      department: (q.department || '').toString().trim(),             // ✅ filter ตามแผนก
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

      // รองรับ 'type' หรือ 'appointment_type' (model จะ normalize อีกชั้น)
      appointment_type: b.type || b.appointment_type || null,

      // บ้านผู้ป่วย => null; โรงพยาบาล => ต้องกรอก
      hospital_address: b.hospital_address || b.hospital || null,

      place: b.place || null,
      status: b.status || 'pending',
      note: b.note || null,

      // ✅ ใหม่: department (เฉพาะ hospital)
      department: b.department ?? null,
    };

    if (!payload.patients_id) return res.status(400).json({ message: 'ต้องระบุ patients_id' });
    if (!payload.appointment_date) return res.status(400).json({ message: 'ต้องระบุวันที่นัด' });
    if (!payload.start_time || !payload.end_time) {
      return res.status(400).json({ message: 'ต้องระบุเวลาเริ่มและเวลาสิ้นสุด' });
    }
    // ให้ error ชัดเจนตั้งแต่ controller เมื่อเป็น hospital แต่ไม่ส่ง department
    if ((payload.appointment_type === 'hospital' || (!payload.appointment_type && payload.hospital_address))
        && !payload.department) {
      return res.status(400).json({ message: 'กรุณาเลือกแผนก (department) สำหรับนัดโรงพยาบาล' });
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

    // ✅ ใหม่: รองรับแก้ไข department
    if (b.department !== undefined) update.department = b.department || null;

    // เสริม error ชัดเจน: ถ้าจะเปลี่ยนเป็น hospital ต้องมี department
    if ((update.appointment_type === 'hospital' || update.hospital_address) && update.department === null) {
      return res.status(400).json({ message: 'กรุณาเลือกแผนก (department) สำหรับนัดโรงพยาบาล' });
    }

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
