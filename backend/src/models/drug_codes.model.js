// src/models/drug_codes.model.js
const { pool } = require('../config/db');

async function search({ q, code_24, limit = 20 }) {
  if (code_24 && /^\d{24}$/.test(String(code_24))) {
    const { rows } = await pool.query(
      `SELECT * FROM drug_codes WHERE code_24 = $1 LIMIT 1`,
      [code_24]
    );
    return rows;
  }
  if (q && String(q).trim()) {
    const term = String(q).trim();
    const { rows } = await pool.query(
      `
      SELECT *, GREATEST(similarity(generic_name, $1), similarity(synonyms_join, $1)) AS score
      FROM drug_codes
      WHERE generic_name ILIKE '%'||$1||'%' OR synonyms_join ILIKE '%'||$1||'%'
      ORDER BY score DESC NULLS LAST, generic_name ASC
      LIMIT $2
      `,
      [term, limit]
    );
    return rows;
  }
  const { rows } = await pool.query(
    `SELECT * FROM drug_codes ORDER BY generic_name ASC LIMIT $1`,
    [limit]
  );
  return rows;
}

async function getById(id) {
  const { rows } = await pool.query(`SELECT * FROM drug_codes WHERE drug_id = $1`, [id]);
  return rows[0] || null;
}

async function create({ code_24 = null, generic_name, synonyms = [], atc_code = null, note = null }) {
  const { rows } = await pool.query(
    `
    INSERT INTO drug_codes (code_24, generic_name, synonyms, atc_code, note)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [code_24, generic_name, synonyms, atc_code, note]
  );
  return rows[0];
}

module.exports = { search, getById, create };
