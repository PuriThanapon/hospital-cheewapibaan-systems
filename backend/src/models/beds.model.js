// src/models/beds.model.js
const { pool } = require('../config/db');

/* ===================== ฟังก์ชันเดิม (คงพฤติกรรม) ===================== */
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
    `INSERT INTO beds (code, care_side, ward_id, note, is_active)
     VALUES ($1,$2,$3,$4, TRUE)
     RETURNING *`,
    [code, care_side, ward_id, note]
  );
  return rows[0];
}

/** หาเตียงที่ว่างในช่วงเวลา: ไม่มี stay (reserved/occupied) ที่ทับช่วง [from,to) */
async function findAvailableBeds({ from, to, care_side = null, ward_id = null }) {
  const params = [from, to];
  let idx = params.length;
  const filters = [];
  if (care_side) { params.push(care_side); filters.push(`b.care_side = $${++idx}`); }
  if (ward_id)   { params.push(ward_id);   filters.push(`b.ward_id = $${++idx}`); }

  const sql = `
    SELECT b.*
    FROM beds b
    WHERE b.is_active = TRUE
      ${filters.length ? 'AND ' + filters.join(' AND ') : ''}
      AND NOT EXISTS (
        SELECT 1
        FROM bed_stays s
        WHERE s.bed_id = b.bed_id
          AND s.status IN ('reserved','occupied')
          AND s.end_at IS NULL
          AND tstzrange(s.start_at, s.end_at, '[)') && tstzrange($1::timestamptz, $2::timestamptz, '[)')
      )
    ORDER BY b.code
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}

/* ===================== ส่วนสำหรับ summary / reconcile ===================== */
function pad2(n) { return String(n).padStart(2, '0'); }

/** นับ active/retired ต่อ care_side */
async function countByCareSide() {
  const { rows } = await pool.query(`
    SELECT care_side,
      COUNT(*) FILTER (WHERE is_active = TRUE )::int AS active_count,
      COUNT(*) FILTER (WHERE is_active = FALSE)::int AS retired_count
    FROM beds
    GROUP BY care_side
    ORDER BY care_side
  `);
  return rows;
}

/** นับ busy ต่อ care_side = เตียง active ที่มี stay ค้าง (reserved/occupied + end_at IS NULL) */
async function busyCountByCareSide(staysTable = process.env.STAYS_TABLE || 'bed_stays') {
  const { rows } = await pool.query(`
    SELECT b.care_side, COUNT(*)::int AS busy_count
    FROM beds b
    WHERE b.is_active = TRUE
      AND EXISTS (
        SELECT 1 FROM ${staysTable} s
        WHERE s.bed_id = b.bed_id
          AND s.end_at IS NULL
          AND s.status IN ('reserved','occupied')
      )
    GROUP BY b.care_side
    ORDER BY b.care_side
  `);
  return rows;
}

/* ------ helper แบบใช้ client ภายใต้ทรานแซกชันเดียว ------ */
async function getActiveCountTx(client, care_side) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS c FROM beds WHERE care_side = $1 AND is_active = TRUE`,
    [care_side]
  );
  return rows[0]?.c || 0;
}

async function getMaxNoForPrefixTx(client, care_side, prefix) {
  const { rows } = await client.query(
    `
    SELECT MAX(CAST(regexp_replace(code, ('^' || $2 || '-'), '') AS int))::int AS max_no
    FROM beds
    WHERE care_side = $1
      AND code ~ ('^' || $2 || '-[0-9]+$')
    `,
    [care_side, prefix]
  );
  return rows[0]?.max_no || 0;
}

async function createBedsWithPrefixTx(client, care_side, prefix, count, ward_id = null) {
  if (count <= 0) return [];
  const maxNo = await getMaxNoForPrefixTx(client, care_side, prefix);

  const params = [care_side, ward_id];
  const values = [];
  for (let i = 1; i <= count; i++) {
    const code = `${prefix}-${pad2(maxNo + i)}`;
    params.push(code);
    values.push(`($1, $2, $${params.length}, TRUE)`); // (care_side, ward_id, code, is_active)
  }
  const { rows } = await client.query(
    `INSERT INTO beds (care_side, ward_id, code, is_active)
     VALUES ${values.join(',')}
     RETURNING bed_id, code, care_side, is_active, ward_id`,
    params
  );
  return rows;
}

/** retire เฉพาะเตียง “ว่างจริง” และล็อกแถวกัน race */
async function retireFreeBedsTx(client, care_side, howMany, staysTable = process.env.STAYS_TABLE || 'bed_stays') {
  if (howMany <= 0) return [];

  const sel = await client.query(
    `
    SELECT b.bed_id
    FROM beds b
    WHERE b.care_side = $1
      AND b.is_active = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM ${staysTable} s
        WHERE s.bed_id = b.bed_id
          AND s.end_at IS NULL
          AND s.status IN ('reserved','occupied')
      )
    ORDER BY b.code DESC
    LIMIT $2
    FOR UPDATE SKIP LOCKED
    `,
    [care_side, howMany]
  );

  if (sel.rowCount < howMany) {
    const e = new Error(`มีเตียงว่างให้ลดได้เพียง ${sel.rowCount} เตียง (ต้องการลด ${howMany}). โปรดสิ้นสุดการครองเตียงก่อน หรือปรับเป้าหมายให้ ≥ จำนวน Busy`);
    e.status = 400;
    throw e;
  }

  const ids = sel.rows.map(r => r.bed_id);
  // ❌ ตัด updated_at = now() ออก เพื่อไม่พังถ้าไม่มีคอลัมน์นี้
  const upd = await client.query(
    `
    UPDATE beds
    SET is_active = FALSE
    WHERE bed_id = ANY($1::int[])
    RETURNING bed_id, code, care_side, is_active
    `,
    [ids]
  );
  return upd.rows;
}


/** ปรับจำนวนเตียง active ของ care_side ให้ตรง target ภายใต้ทรานแซกชันเดียว */
async function ensureBedCountCareSide(care_side, prefix, target, staysTable = process.env.STAYS_TABLE || 'bed_stays', ward_id = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await getActiveCountTx(client, care_side);

    if (current < target) {
      const need = target - current;
      const created = await createBedsWithPrefixTx(client, care_side, prefix, need, ward_id);
      await client.query('COMMIT');
      return { changed: true, created, retired: [] };
    }

    if (current > target) {
      const need = current - target;
      const retired = await retireFreeBedsTx(client, care_side, need, staysTable);
      await client.query('COMMIT');
      return { changed: true, created: [], retired };
    }

    await client.query('COMMIT');
    return { changed: false, created: [], retired: [] };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

/* ===================== exports ===================== */
module.exports = {
  listBeds,
  createBed,
  findAvailableBeds,

  countByCareSide,
  busyCountByCareSide,
  ensureBedCountCareSide,
};
