const { pool } = require('../config/db');

async function listBeds({ care_side = null, ward_id = null, activeOnly = true } = {}) {
  const params = [];
  const where = [];
  if (activeOnly) where.push(`b.is_active = TRUE`);
  if (care_side) { params.push(care_side); where.push(`b.care_side = $${params.length}`); }
  if (ward_id)   { params.push(ward_id);   where.push(`b.ward_id = $${params.length}`); }

  const sql = `
    SELECT b.bed_id, b.code, b.care_side, b.is_active, b.note,
           w.ward_id, w.name AS ward_name
    FROM beds b
    LEFT JOIN wards w ON w.ward_id = b.ward_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY w.name NULLS LAST, b.code
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function createBed({ code, care_side, ward_id = null, note = null }) {
  const { rows } = await pool.query(
    `INSERT INTO beds (code, care_side, ward_id, note)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [code, care_side, ward_id, note]
  );
  return rows[0];
}

async function findAvailableBeds({ from, to, care_side = null, ward_id = null }) {
  // คืนเตียงที่ “ไม่มี” stay ทับช่วงเวลานี้ (เฉพาะ reserved/occupied)
  const params = [from, to];
  let idx = params.length;
  const filters = [];
  if (care_side)   { params.push(care_side); filters.push(`b.care_side = $${++idx}`); }
  if (ward_id)     { params.push(ward_id);   filters.push(`b.ward_id = $${++idx}`); }

  const sql = `
    SELECT b.*
    FROM beds b
    WHERE b.is_active = TRUE
      ${filters.length ? 'AND ' + filters.join(' AND ') : ''}
      AND NOT EXISTS (
        SELECT 1 FROM bed_stays s
        WHERE s.bed_id = b.bed_id
          AND s.status IN ('reserved','occupied')
          AND tstzrange(s.start_at, s.end_at, '[)') && tstzrange($1::timestamptz, $2::timestamptz, '[)')
      )
    ORDER BY b.code
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}

module.exports = { listBeds, createBed, findAvailableBeds };
