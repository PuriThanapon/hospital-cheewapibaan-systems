// src/models/patient_files.model.js
const { pool } = require('../config/db');

const ALLOWED_TYPES = new Set([
  'patient_id_card',
  'house_registration',
  'patient_photo',
  'relative_id_card',
  'assistance_letter',
  'power_of_attorney',
  'adl_assessment',
  'clinical_summary',       // ✅ ใหม่
  'homeless_certificate',   // ✅ ใหม่
  'other',
]);

function assertDocType(t) {
  if (!ALLOWED_TYPES.has(String(t || ''))) {
    const e = new Error('doc_type ไม่ถูกต้อง');
    e.status = 400;
    throw e;
  }
}

async function list({ patients_id, doc_types = [], appointment_id = null }) {
  const params = [patients_id];
  let where = `patients_id = $1`;
  if (appointment_id != null) {
    params.push(Number(appointment_id));
    where += ` AND appointment_id = $${params.length}`;
  }
  if (Array.isArray(doc_types) && doc_types.length > 0) {
    const valid = doc_types.filter((t) => ALLOWED_TYPES.has(t));
    if (valid.length > 0) {
      const placeholders = valid.map((_, i) => `$${params.length + i + 1}`).join(',');
      where += ` AND doc_type IN (${placeholders})`;
      params.push(...valid);
    }
  }

  const { rows } = await pool.query(
    `SELECT id, patients_id, appointment_id, doc_type, label,
            filename, mime_type, size_bytes, created_at
     FROM patient_files
     WHERE ${where}
     ORDER BY created_at DESC`,
    params
  );
  return rows;
}

async function create({ patients_id, appointment_id, doc_type, label, file }) {
  assertDocType(doc_type);
  if (!file || !file.buffer) {
    const e = new Error('ไม่มีไฟล์');
    e.status = 400;
    throw e;
  }
  const params = [
    patients_id,
    appointment_id || null,
    doc_type,
    label || null,
    file.originalname || null,
    file.mimetype || null,
    file.size || null,
    file.buffer,
  ];
  const { rows } = await pool.query(
    `INSERT INTO patient_files
       (patients_id, appointment_id, doc_type, label,
        filename, mime_type, size_bytes, content)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    params
  );
  return rows[0];
}

async function getContent(file_id) {
  const { rows } = await pool.query(
    `SELECT id, filename, mime_type, content FROM patient_files WHERE id = $1 LIMIT 1`,
    [file_id]
  );
  return rows[0] || null;
}

async function getMeta(file_id) {
  const { rows } = await pool.query(
    `SELECT id, patients_id, appointment_id, doc_type, label,
            filename, mime_type, size_bytes, created_at
     FROM patient_files WHERE id = $1 LIMIT 1`,
    [file_id]
  );
  return rows[0] || null;
}

async function updateLabel(file_id, label) {
  const { rows } = await pool.query(
    `UPDATE patient_files SET label = $1 WHERE id = $2 RETURNING id`,
    [label || null, file_id]
  );
  return !!rows[0];
}

async function remove(file_id) {
  const res = await pool.query(`DELETE FROM patient_files WHERE id = $1`, [file_id]);
  return res.rowCount > 0;
}

module.exports = {
  ALLOWED_TYPES,
  list,
  create,
  getContent,
  getMeta,
  updateLabel,
  remove,
};
