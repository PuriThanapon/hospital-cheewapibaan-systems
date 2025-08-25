// backend/src/models/deaths.model.js
const { pool } = require('../config/db');

/** HN-มาตรฐานจากค่าใด ๆ (รับได้ทั้ง 18 / HN-00000018) */
function toPatientsId(v) {
  const digits = String(v ?? '')
    .toUpperCase()
    .trim()
    .replace(/^HN[-–—]?/i, '')
    .replace(/\D/g, '');
  if (!digits) return null;
  return 'HN-' + digits.padStart(8, '0');
}

/** ดึงรายชื่อที่ "เสียชีวิต" พร้อมค้นหา/ช่วงวันที่/แบ่งหน้า */
async function listDeaths({ q = '', patient_id = '', death_from = '', death_to = '', page = 1, limit = 20 }) {
  const where = [`p.status = 'เสียชีวิต'`];
  const vals = [];
  let i = 1;

  const pid = toPatientsId(patient_id);
  if (pid) { where.push(`p.patients_id = $${i++}`); vals.push(pid); }
  if (death_from) { where.push(`p.death_date >= $${i++}`); vals.push(death_from); }
  if (death_to)   { where.push(`p.death_date <= $${i++}`); vals.push(death_to); }
  if (q) {
    where.push(`(
      p.patients_id ILIKE $${i}
      OR CONCAT(COALESCE(p.pname,''), COALESCE(p.first_name,''), ' ', COALESCE(p.last_name,'')) ILIKE $${i}
      OR COALESCE(p.death_cause,'') ILIKE $${i}
    )`);
    vals.push(`%${q}%`); i++;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const off = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));

  const sql = `
    SELECT
      p.patients_id, p.pname, p.first_name, p.last_name,
      p.death_date, p.death_time, p.death_cause, p.management,
      p.status, p.updated_at,
      COUNT(*) OVER() AS total_count
    FROM patients p
    ${whereSql}
    ORDER BY p.death_date DESC NULLS LAST, p.patients_id DESC
    LIMIT $${i++} OFFSET $${i++}
  `;
  vals.push(Number(limit), Number(off));

  const { rows } = await pool.query(sql, vals);
  const totalCount = rows[0]?.total_count ? Number(rows[0].total_count) : 0;
  const data = rows.map(({ total_count, ...r }) => r);
  return { data, page: Number(page), limit: Number(limit), totalCount };
}

/** ดึงข้อมูลการเสียชีวิตของผู้ป่วยคนเดียว (อ่านจาก patients) */
async function getDeathByPatient(idOrHN) {
  const pid = toPatientsId(idOrHN);
  if (!pid) return null;
  const { rows } = await pool.query(
    `SELECT patients_id, pname, first_name, last_name,
            death_date, death_time, death_cause, management, status, updated_at
     FROM patients
     WHERE patients_id = $1`,
    [pid]
  );
  return rows[0] || null;
}

/** Mark เสียชีวิต: อัปเดตคอลัมน์ใน patients + ลบใบนัดอนาคต */
async function markDeceased(idOrHN, { death_date, death_time, death_cause, management }) {
  const client = await pool.connect();
  try {
    const pid = toPatientsId(idOrHN);
    if (!pid) throw new Error('รหัสผู้ป่วยไม่ถูกต้อง');

    await client.query('BEGIN');

    const pr = await client.query(`SELECT * FROM patients WHERE patients_id=$1`, [pid]);
    if (!pr.rowCount) throw new Error('ไม่พบผู้ป่วย');

    const upd = await client.query(
      `UPDATE patients
         SET status='เสียชีวิต',
             death_date=$1::date,
             death_time=$2::time,
             death_cause=$3,
             management=$4,
             updated_at=NOW()
       WHERE patients_id=$5
       RETURNING patients_id, pname, first_name, last_name,
                 death_date, death_time, death_cause, management, status, updated_at`,
      [death_date, death_time, death_cause, management ?? null, pid]
    );

    // ลบใบนัด "อนาคต"
    await client.query(
      `DELETE FROM appointment
        WHERE patients_id=$1
          AND (
            appointment_date > CURRENT_DATE OR
            (appointment_date = CURRENT_DATE AND appointment_time > CURRENT_TIME)
          )`,
      [pid]
    );

    await client.query('COMMIT');
    return upd.rows[0] || null;
  } catch (e) {
    await client.query('ROLLBACK').catch(()=>{});
    throw e;
  } finally {
    client.release();
  }
}

/** แก้ไขข้อมูลการเสียชีวิต (เฉพาะฟิลด์ death_*) */
async function updateDeath(idOrHN, patch = {}) {
  const pid = toPatientsId(idOrHN);
  if (!pid) return null;
  const fields = [];
  const vals = [];
  let i = 1;

  if (patch.death_date !== undefined)   { fields.push(`death_date=$${i++}::date`); vals.push(patch.death_date); }
  if (patch.death_time !== undefined)   { fields.push(`death_time=$${i++}::time`); vals.push(patch.death_time); }
  if (patch.death_cause !== undefined)  { fields.push(`death_cause=$${i++}`);     vals.push(patch.death_cause); }
  if (patch.management !== undefined)   { fields.push(`management=$${i++}`);      vals.push(patch.management); }

  if (!fields.length) return getDeathByPatient(pid);

  fields.push(`updated_at=NOW()`);

  const { rows } = await pool.query(
    `UPDATE patients SET ${fields.join(', ')}
     WHERE patients_id=$${i} AND status='เสียชีวิต'
     RETURNING patients_id, pname, first_name, last_name,
               death_date, death_time, death_cause, management, status, updated_at`,
    [...vals, pid]
  );
  return rows[0] || null;
}

/** ยกเลิกสถานะเสียชีวิต: เคลียร์ฟิลด์และ set กลับเป็น "มีชีวิต" */
async function unsetDeath(idOrHN) {
  const pid = toPatientsId(idOrHN);
  if (!pid) return null;
  const { rows } = await pool.query(
    `UPDATE patients
       SET status='มีชีวิต',
           death_date=NULL,
           death_time=NULL,
           death_cause=NULL,
           management=NULL,
           updated_at=NOW()
     WHERE patients_id=$1 AND status='เสียชีวิต'
     RETURNING patients_id, pname, first_name, last_name,
               death_date, death_time, death_cause, management, status, updated_at`,
    [pid]
  );
  return rows[0] || null;
}

module.exports = {
  listDeaths,
  getDeathByPatient,
  markDeceased,
  updateDeath,
  unsetDeath,
};
