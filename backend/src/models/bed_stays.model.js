const { pool } = require('../config/db');

// Postgres SQLSTATE ของ Exclusion/constraint conflict
const EXCLUSION_CONFLICT = '23P01';

exports.occupy = async ({
  bed_id,
  patients_id,
  start_at = null,
  note = null,
  source_appointment_id = null,
}) => {
  // กำหนดสถานะอัตโนมัติ: ถ้าเริ่ม <= now() ให้เป็น occupied, ถ้าเป็นอนาคต ให้ reserved
  const sql = `
    INSERT INTO bed_stays
      (bed_id, patients_id, start_at, end_at, status, note, source_appointment_id)
    VALUES
      ($1, $2, COALESCE($3, now()), NULL,
       CASE WHEN COALESCE($3, now()) <= now()
            THEN 'occupied'::bed_stay_status
            ELSE 'reserved'::bed_stay_status END,
       $4, $5)
    RETURNING *
  `;
  try {
    const { rows } = await pool.query(sql, [
      bed_id,
      patients_id,
      start_at,
      note,
      source_appointment_id,
    ]);
    return rows[0];
  } catch (e) {
    // ทับซ้อนช่วงเวลาจาก EXCLUDE constraint
    if (e && e.code === EXCLUSION_CONFLICT) {
      e.status = 409;
      e.message = 'ช่วงเวลาทับซ้อนกับการจอง/ครอบครองเตียงเดิม';
    }
    throw e;
  }
};

exports.endStay = async (stay_id, { at = null, reason = null } = {}) => {
  const sql = `
    UPDATE bed_stays
       SET end_at = COALESCE($2, now()),
           status = 'completed',
           note   = CASE
                      WHEN $3 IS NULL OR $3 = '' THEN note
                      WHEN note IS NULL OR note = '' THEN $3
                      ELSE note || E'\n' || $3
                    END
     WHERE stay_id = $1
     RETURNING *
  `;
  const { rows } = await pool.query(sql, [stay_id, at, reason]);
  return rows[0] || null;
};

exports.cancel = async (stay_id) => {
  const sql = `
    UPDATE bed_stays
       SET status = 'cancelled',
           end_at = COALESCE(end_at, now())
     WHERE stay_id = $1
     RETURNING *
  `;
  const { rows } = await pool.query(sql, [stay_id]);
  return rows[0] || null;
};

// โอนย้ายเตียง: ปิด stay เดิม แล้วเปิด stay ใหม่เตียงปลายทาง
exports.transfer = async (stay_id, { to_bed_id, at = null, note = null, by = null } = {}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ดึง stay เดิม
    const { rows: oldRows } = await client.query(
      `SELECT * FROM bed_stays WHERE stay_id = $1 FOR UPDATE`,
      [stay_id]
    );
    const oldStay = oldRows[0];
    if (!oldStay) {
      await client.query('ROLLBACK');
      return null;
    }

    const tAt = at || new Date();

    // ปิด stay เดิม
    await client.query(
      `UPDATE bed_stays
          SET end_at = $2,
              status = 'completed',
              note = CASE
                       WHEN $3 IS NULL OR $3 = '' THEN note
                       WHEN note IS NULL OR note = '' THEN $3
                       ELSE note || E'\n' || $3
                     END
        WHERE stay_id = $1`,
      [stay_id, tAt, note ? `Transfer at ${tAt.toISOString()} — ${note}` : `Transfer at ${tAt.toISOString()}`]
    );

    // เปิด stay ใหม่
    const insertSql = `
      INSERT INTO bed_stays
        (bed_id, patients_id, start_at, end_at, status, note, source_appointment_id)
      VALUES
        ($1, $2, $3, NULL, 'occupied', $4, $5)
      RETURNING *
    `;
    const { rows: newRows } = await client.query(insertSql, [
      to_bed_id,
      oldStay.patients_id,
      tAt,
      note,
      oldStay.source_appointment_id || null,
    ]);

    await client.query('COMMIT');
    return newRows[0];
  } catch (e) {
    await pool.query('ROLLBACK');
    if (e && e.code === EXCLUSION_CONFLICT) {
      e.status = 409;
      e.message = 'ช่วงเวลาทับซ้อนกับการจอง/ครอบครองเตียงปลายทาง';
    }
    throw e;
  } finally {
    client.release();
  }
};

exports.historyByPatient = async (patients_id) => {
  const sql = `
    SELECT
      s.stay_id,
      s.bed_id,
      s.patients_id,
      s.start_at,
      s.end_at,
      s.status,
      s.note,
      s.source_appointment_id,
      b.code         AS bed_code,
      b.care_side    AS care_side,
      w.name         AS ward_name
    FROM bed_stays s
    LEFT JOIN beds  b ON b.bed_id  = s.bed_id
    LEFT JOIN wards w ON w.ward_id = b.ward_id
    WHERE s.patients_id = $1
    ORDER BY COALESCE(s.end_at, s.start_at) DESC, s.start_at DESC, s.stay_id DESC
  `;
  const { rows } = await pool.query(sql, [patients_id]);
  return rows;
};

exports.currentOccupancy = async () => {
  // โชว์ทั้ง reserved (อนาคต/รอเข้าเตียง) และ occupied (กำลังอยู่เตียง) ที่ยังไม่จบ
  const sql = `
    SELECT
      s.stay_id,
      s.bed_id,
      s.patients_id,
      s.start_at,
      s.end_at,
      s.status,
      s.note,
      b.code         AS bed_code,
      b.care_side    AS care_side,
      w.name         AS ward_name,
      p.pname, p.first_name, p.last_name
    FROM bed_stays s
    LEFT JOIN beds     b ON b.bed_id  = s.bed_id
    LEFT JOIN wards    w ON w.ward_id = b.ward_id
    LEFT JOIN patients p ON p.patients_id = s.patients_id
    WHERE s.status IN ('reserved','occupied') AND s.end_at IS NULL
    ORDER BY w.name NULLS LAST, b.care_side, b.code
  `;
  const { rows } = await pool.query(sql);
  return rows;
};
