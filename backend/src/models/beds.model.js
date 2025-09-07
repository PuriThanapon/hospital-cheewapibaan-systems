// models/beds.model.js
const { pool } = require('../config/db');

/* ===================== เดิมของคุณ (ปรับเล็กน้อยเฉพาะความทนทาน) ===================== */
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

async function findAvailableBeds({ from, to, care_side = null, ward_id = null }) {
  // คืนเตียงที่ “ไม่มี” stay ซ้อนในช่วงเวลา (นับเฉพาะรายการที่ยัง active คือ end_at IS NULL)
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
        SELECT 1
        FROM bed_stays s
        WHERE s.bed_id = b.bed_id
          AND s.end_at IS NULL                           -- ยังไม่สิ้นสุด (ถือว่ากำลังครองอยู่)
          AND s.status IN ('reserved','occupied')        -- สถานะที่ถือว่าใช้เตียง
          AND tstzrange(s.start_at, s.end_at, '[)') && tstzrange($1::timestamptz, $2::timestamptz, '[)')
      )
    ORDER BY b.code
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}

/* ===================== เพิ่มสำหรับ “ตั้งค่าเตียง” / reconcile ===================== */

function pad2(n) { return String(n).padStart(2, '0'); }

/** นับจำนวนเตียงแยกตาม care_side (active / retired โดยอิง is_active) */
async function countByCareSide() {
  const sql = `
    SELECT care_side,
      COUNT(*) FILTER (WHERE is_active = TRUE )::int AS active_count,
      COUNT(*) FILTER (WHERE is_active = FALSE)::int AS retired_count
    FROM beds
    GROUP BY care_side
    ORDER BY care_side
  `;
  const { rows } = await pool.query(sql);
  return rows; // [{ care_side, active_count, retired_count }]
}

/** นับ busy ต่อ care_side = เตียง active ที่มี stay end_at IS NULL */
async function busyCountByCareSide(staysTable = process.env.STAYS_TABLE || 'bed_stays') {
  const sql = `
    SELECT b.care_side, COUNT(*)::int AS busy_count
    FROM beds b
    WHERE b.is_active = TRUE
      AND EXISTS (
        SELECT 1 FROM ${staysTable} s
        WHERE s.bed_id = b.bed_id AND s.end_at IS NULL
      )
    GROUP BY b.care_side
    ORDER BY b.care_side
  `;
  const { rows } = await pool.query(sql);
  return rows; // [{ care_side, busy_count }]
}

/** หาเลขรันสูงสุดของรหัสที่ขึ้นต้นด้วย prefix- NN (ปลอดภัยด้วยพารามิเตอร์) */
async function getMaxNoForPrefix(care_side, prefix) {
  const sql = `
    SELECT MAX(CAST(regexp_replace(code, ('^' || $2 || '-'), '') AS int))::int AS max_no
    FROM beds
    WHERE care_side = $1
      AND code ~ ('^' || $2 || '-[0-9]+$')
  `;
  const { rows } = await pool.query(sql, [care_side, prefix]);
  return rows[0]?.max_no || 0;
}

/** สร้างเตียงใหม่ชุดหนึ่ง ตาม care_side/prefix จำนวน count (ผูกกับ ward ได้ถ้าจำเป็น) */
async function createBedsWithPrefix(care_side, prefix, count, ward_id = null) {
  if (count <= 0) return [];
  const maxNo = await getMaxNoForPrefix(care_side, prefix);

  const values = [];
  const params = [care_side, ward_id];
  for (let i = 1; i <= count; i++) {
    const code = `${prefix}-${pad2(maxNo + i)}`;
    params.push(code);
    // (care_side, ward_id, code, is_active)
    values.push(`($1, $2, $${params.length}, TRUE)`);
  }
  const sql = `
    INSERT INTO beds (care_side, ward_id, code, is_active)
    VALUES ${values.join(',')}
    RETURNING bed_id, code, care_side, is_active, ward_id
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}

/** เลือกเตียง “ว่าง” (ไม่มี stay ค้าง) แล้วเซ็ต is_active = FALSE จำนวนที่ต้องการ */
async function retireFreeBeds(care_side, howMany, staysTable = process.env.STAYS_TABLE || 'bed_stays') {
  if (howMany <= 0) return [];
  const findSql = `
    SELECT b.bed_id
    FROM beds b
    WHERE b.care_side = $1
      AND b.is_active = TRUE
      AND NOT EXISTS (SELECT 1 FROM ${staysTable} s WHERE s.bed_id = b.bed_id AND s.end_at IS NULL)
    ORDER BY b.code DESC
    LIMIT $2
  `;
  const { rows } = await pool.query(findSql, [care_side, howMany]);
  if (rows.length < howMany) {
    const e = new Error(`มีเตียงว่างให้ลดได้เพียง ${rows.length} เตียง น้อยกว่าที่ต้องการ ${howMany}`);
    e.status = 400;
    throw e;
  }
  const ids = rows.map(r => r.bed_id);
  const upSql = `
    UPDATE beds SET is_active = FALSE, updated_at = now()
    WHERE bed_id = ANY($1::int[])
    RETURNING bed_id, code, care_side, is_active
  `;
  const ret = await pool.query(upSql, [ids]);
  return ret.rows;
}

async function getActiveCount(care_side) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM beds WHERE care_side = $1 AND is_active = TRUE`,
    [care_side]
  );
  return rows[0]?.c || 0;
}

/**
 * ปรับ "จำนวนเตียงที่ active" ของ care_side ให้ตรงกับ target
 * - ถ้าขาด: สร้างเตียงใหม่ (prefix-01, 02, ...)
 * - ถ้าเกิน: retire เฉพาะเตียงที่ “ว่าง” (ไม่มี stay ค้าง)
 * ward_id: ใส่ได้ถ้าต้องการผูกเตียงใหม่เข้าตึก/วอร์ดหนึ่ง ๆ (ไม่บังคับ)
 */
async function ensureBedCountCareSide(care_side, prefix, target, staysTable = process.env.STAYS_TABLE || 'bed_stays', ward_id = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await getActiveCount(care_side);
    if (current < target) {
      const need = target - current;
      const created = await createBedsWithPrefix(care_side, prefix, need, ward_id);
      await client.query('COMMIT');
      return { changed: true, created, retired: [] };
    } else if (current > target) {
      const need = current - target;
      const retired = await retireFreeBeds(care_side, need, staysTable);
      await client.query('COMMIT');
      return { changed: true, created: [], retired };
    } else {
      await client.query('COMMIT');
      return { changed: false, created: [], retired: [] };
    }
  } catch (err) {
    await client.query('ROLLBACK');
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

  // สำหรับ summary / ตั้งค่า / reconcile
  countByCareSide,
  busyCountByCareSide,
  ensureBedCountCareSide,
};
