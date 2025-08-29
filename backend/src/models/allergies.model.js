// src/models/allergies.model.js
const { pool } = require('../config/db');

// เฉพาะคอลัมน์ที่อนุญาตให้เขียน
const FIELDS = [
  'patients_id','report_date','onset_date','substance','reaction',
  'severity','system_affected','causality','outcome',
  'patient_type','thai24_code','note'
];

const pick = (obj = {}) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => FIELDS.includes(k)));

const normalizeHN = (hn) => (hn || '').toString().trim().toUpperCase();

/* --------------------------------- Query --------------------------------- */

async function listByHN(hn) {
  const HN = normalizeHN(hn);
  const { rows } = await pool.query(
    `SELECT * FROM allergies
     WHERE patients_id = $1
     ORDER BY report_date DESC, allergy_id DESC`,
    [HN]
  );
  return rows;
}

async function getById(id) {
  // กันกรณี route จับ path แปลก ๆ มาเป็น id
  const nid = Number(id);
  if (!Number.isInteger(nid)) return null;

  const { rows } = await pool.query(
    `SELECT * FROM allergies WHERE allergy_id = $1`,
    [nid]
  );
  return rows[0] || null;
}

async function create(payload) {
  const d = pick(payload);
  if (!d.patients_id) d.patients_id = normalizeHN(payload.patients_id);

  const cols = Object.keys(d);
  if (cols.length === 0) throw new Error('empty payload');

  const vals = Object.values(d);
  const params = cols.map((_, i) => `$${i + 1}`).join(', ');

  const { rows } = await pool.query(
    `INSERT INTO allergies (${cols.join(', ')})
     VALUES (${params})
     RETURNING *`,
    vals
  );
  return rows[0];
}

async function update(id, payload) {
  const nid = Number(id);
  if (!Number.isInteger(nid)) return null;

  const d = pick(payload);
  if (Object.keys(d).length === 0) return getById(nid);

  const sets = Object.keys(d).map((k, i) => `${k} = $${i + 1}`).join(', ');
  const vals = [...Object.values(d), nid];

  const { rows } = await pool.query(
    `UPDATE allergies SET ${sets}, updated_at = now()
     WHERE allergy_id = $${vals.length}
     RETURNING *`,
    vals
  );
  return rows[0] || null;
}

async function remove(id) {
  const nid = Number(id);
  if (!Number.isInteger(nid)) return true;
  await pool.query(`DELETE FROM allergies WHERE allergy_id = $1`, [nid]);
  return true;
}

/* ------------------------------ Aggregations ------------------------------ */

// นับจำนวนรายการแพ้ยา “ต่อ HN เดียว”
async function countByHN(hn) {
  const HN = normalizeHN(hn);
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM allergies WHERE patients_id = $1`,
    [HN]
  );
  return rows[0]?.total || 0;
}

// นับจำนวนรายการแพ้ยา “หลาย HN ทีเดียว”
// ใช้กับ endpoint: GET /api/allergies/count-by-patients?ids=HN-1,HN-2,...
async function countByPatients(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const list = ids.map(normalizeHN).filter(Boolean);
  if (!list.length) return [];
  const { rows } = await pool.query(
    `SELECT patients_id, COUNT(*)::int AS total
     FROM allergies
     WHERE patients_id = ANY($1::text[])
     GROUP BY patients_id`,
    [list]
  );
  return rows; // [{ patients_id, total }, ...]
}

module.exports = {
  listByHN,
  getById,
  create,
  update,
  remove,
  countByHN,
  countByPatients,
};
