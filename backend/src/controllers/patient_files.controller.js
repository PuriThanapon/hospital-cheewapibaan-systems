// src/controllers/patient_files.controller.js
const model = require('../models/patient_files.model');

function normalizePatientsId(id = '') {
  id = String(id || '').trim();
  if (!id) return '';
  if (/^\d+$/.test(id)) return 'HN-' + id.padStart(8, '0');
  return id.toUpperCase();
}

/** GET /api/patient-files/:patients_id?doc_type=a,b&appointment_id=123 */
exports.list = async (req, res) => {
  try {
    const patients_id = normalizePatientsId(req.params.patients_id);
    if (!patients_id) return res.status(400).json({ message: 'patients_id ไม่ถูกต้อง' });

    const docTypeRaw = (req.query.doc_type || '').toString().trim();
    const doc_types = docTypeRaw ? docTypeRaw.split(',').map(s => s.trim()) : [];
    const appointment_id = req.query.appointment_id != null ? Number(req.query.appointment_id) : null;

    const rows = await model.list({ patients_id, doc_types, appointment_id });
    res.json({ data: rows });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message || 'ดึงรายการไฟล์ไม่สำเร็จ' });
  }
};

/** POST /api/patient-files/:patients_id  (multipart: file, doc_type, label?, appointment_id?) */
exports.upload = async (req, res) => {
  try {
    const patients_id = normalizePatientsId(req.params.patients_id);
    if (!patients_id) return res.status(400).json({ message: 'patients_id ไม่ถูกต้อง' });

    const doc_type = (req.body.doc_type || '').toString().trim();
    const label = (req.body.label || '').toString().trim() || null;
    const appointment_id = req.body.appointment_id ? Number(req.body.appointment_id) : null;
    const file = req.file;

    const row = await model.create({ patients_id, appointment_id, doc_type, label, file });
    res.status(201).json({ ok: true, id: row.id });
  } catch (e) {
    res.status(e.status || 500).json({ message: e.message || 'อัปโหลดไฟล์ไม่สำเร็จ' });
  }
};

/** GET /api/patient-files/download/:id?dl=1 */
exports.download = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const row = await model.getContent(id);
    if (!row) return res.status(404).json({ message: 'ไม่พบไฟล์' });

    const filename = row.filename || 'file';
    const mime = row.mime_type || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    const asAttachment = String(req.query.dl || '') === '1';
    const dispo = asAttachment ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${dispo}; filename="${encodeURIComponent(filename)}"`);
    res.send(row.content);
  } catch (e) {
    res.status(500).json({ message: 'ดาวน์โหลดไม่สำเร็จ' });
  }
};

/** PATCH /api/patient-files/:id  { label } */
exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ok = await model.updateLabel(id, req.body?.label ?? null);
    if (!ok) return res.status(404).json({ message: 'ไม่พบไฟล์' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: 'อัปเดตไม่สำเร็จ' });
  }
};

/** DELETE /api/patient-files/:id */
exports.remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ok = await model.remove(id);
    if (!ok) return res.status(404).json({ message: 'ไม่พบไฟล์' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ message: 'ลบไม่สำเร็จ' });
  }
};
