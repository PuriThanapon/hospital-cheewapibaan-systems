// src/controllers/patient_files.controller.js
const model = require('../models/patient_files.model');

function normalizePatientsId(id = '') {
  id = String(id || '').trim();
  if (!id) return '';
  if (/^\d+$/.test(id)) return 'HN-' + id.padStart(8, '0');
  return id.toUpperCase();
}

// อนุญาตเฉพาะชุดเดิม + other (ถ้า DB เป็น ENUM จะไม่พัง)
const ALLOWED_DOC_TYPES = [
  'patient_id_card','house_registration','patient_photo','relative_id_card',
  'assistance_letter','power_of_attorney','adl_assessment','clinical_summary',
  'homeless_certificate','other',
];

// รับอะไรมาก็ได้ ถ้าไม่อยู่ใน ALLOWED → บันทึกเป็น other และเอาค่าเดิมไปเป็น label
function normalizeDocType(raw = '', currLabel = '') {
  const t = String(raw || '').trim();
  if (ALLOWED_DOC_TYPES.includes(t)) return { doc_type: t, label: currLabel || null };
  // ไม่รู้จัก → บันทึกเป็น other และเก็บชื่อเดิมไว้ที่ label
  return { doc_type: 'other', label: currLabel?.trim() || t || null };
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
    console.error('[patient-files:list]', e);
    res.status(e.status || 500).json({ message: e.message || 'ดึงรายการไฟล์ไม่สำเร็จ' });
  }
};

/** POST /api/patient-files/:patients_id  (multipart: file, doc_type, label?, appointment_id?) */
exports.upload = async (req, res) => {
  try {
    const patients_id = normalizePatientsId(req.params.patients_id);
    if (!patients_id) return res.status(400).json({ message: 'patients_id ไม่ถูกต้อง' });
    if (!req.file) return res.status(400).json({ message: 'ต้องส่งไฟล์ (field: file)' });

    const rawType  = (req.body.doc_type || '').toString();
    const rawLabel = (req.body.label || '').toString();
    const { doc_type, label } = normalizeDocType(rawType, rawLabel);

    const appointment_id = req.body.appointment_id ? Number(req.body.appointment_id) : null;

    const row = await model.create({ patients_id, appointment_id, doc_type, label, file: req.file });
    res.status(201).json({ ok: true, id: row.id });
  } catch (e) {
    console.error('[patient-files:upload]', e);
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
    console.error('[patient-files:download]', e);
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
    console.error('[patient-files:update]', e);
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
    console.error('[patient-files:remove]', e);
    res.status(500).json({ message: 'ลบไม่สำเร็จ' });
  }
};
