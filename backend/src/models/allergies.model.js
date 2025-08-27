// src/models/allergies.model.js
const { pool } = require('../config/db');

// เฉพาะคอลัมน์ที่อนุญาตให้เขียน
const FIELDS = [
  'patients_id','report_date','onset_date','substance','reaction',
  'severity','system_affected','causality','outcome',
  'patient_type','thai24_code','note'
];

function pick(obj = {}) {
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => FIELDS.includes(k))
  );
}

async function listByHN(hn) {
  const { rows } = await pool.query(
    `SELECT * FROM allergies
     WHERE patients_id = $1
     ORDER BY report_date DESC, allergy_id DESC`,
    [hn]
  );
  return rows;
}

async function getById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM allergies WHERE allergy_id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function create(payload) {
  const d = pick(payload);
  const cols = Object.keys(d);
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
  const d = pick(payload);
  if (Object.keys(d).length === 0) return getById(id);

  const sets = Object.keys(d).map((k, i) => `${k} = $${i + 1}`).join(', ');
  const vals = [...Object.values(d), id];

  const { rows } = await pool.query(
    `UPDATE allergies SET ${sets}, updated_at = now()
     WHERE allergy_id = $${vals.length}
     RETURNING *`,
    vals
  );
  return rows[0] || null;
}

async function remove(id) {
  await pool.query(`DELETE FROM allergies WHERE allergy_id = $1`, [id]);
  return true;
}

module.exports = { listByHN, getById, create, update, remove };
