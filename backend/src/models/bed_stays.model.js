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

exports.end = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'invalid stay id' });
    }
    const { at, reason } = req.body || {};
    const data = await stays.endStay(id, { at, reason });
    if (!data) return res.status(404).json({ message: 'not found' });
    res.json({ data });
  } catch (e) { next(e); }
};

exports.endStay = async (stay_id, { at = null, reason = null } = {}) => {
  const sql = `
    UPDATE bed_stays
       SET end_at = GREATEST(
                      COALESCE($2::timestamptz, now()),
                      start_at + interval '1 second'   -- กันเท่ากับ start_at
                    ),
           status = 'completed',
           note   = CASE
                      WHEN COALESCE($3::text,'') = '' THEN note
                      WHEN COALESCE(note,'') = ''     THEN $3::text
                      ELSE note || E'\n' || $3::text
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
// ---------- โอนย้ายเตียง ----------
exports.transfer = async (stay_id, { to_bed_id, at = null, note = null, by = null } = {}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ให้ DB ช่วยตัดสินว่า tAt อยู่ "ก่อนเริ่ม" หรือไม่
    const { rows: oldRows } = await client.query(
      `SELECT s.*,
              ($2::timestamptz <= s.start_at) AS before_start
         FROM bed_stays s
        WHERE s.stay_id = $1
        FOR UPDATE`,
      [stay_id, at || new Date()]  // ถ้าไม่ส่ง at มาก็ใช้ now()
    );
    const s = oldRows[0];
    if (!s) { await client.query('ROLLBACK'); return null; }

    const tAtParam = at || new Date();

    if (s.before_start) {
      // ⏳ โอนก่อนเริ่ม: ยกเลิกรายการเดิม (end_at ต้อง > start_at)
      await client.query(
        `UPDATE bed_stays
            SET status = 'cancelled',
                end_at = start_at + interval '1 second',
                note   = CASE
                           WHEN COALESCE($2::text,'') = '' THEN note
                           WHEN COALESCE(note,'') = ''     THEN $2::text
                           ELSE note || E'\n' || $2::text
                         END
          WHERE stay_id = $1`,
        [
          stay_id,
          `Transfer (before start) — ${tAtParam.toISOString()}${note ? ` — ${note}` : ''}`
        ]
      );

      // เปิด stay ใหม่ที่เตียงปลายทาง ด้วยเวลาเริ่มเดิม → จะเป็น reserved โดยอัตโนมัติถ้าเริ่มในอนาคต
      const { rows: newRows } = await client.query(
        `INSERT INTO bed_stays
           (bed_id, patients_id, start_at, end_at, status, note, source_appointment_id)
         VALUES
           ($1, $2, $3, NULL,
            CASE WHEN $3 <= now() THEN 'occupied'::bed_stay_status ELSE 'reserved'::bed_stay_status END,
            $4, $5)
         RETURNING *`,
        [
          Number(to_bed_id),
          s.patients_id,
          s.start_at,                      // ใช้เวลาเริ่มเดิม
          note,
          s.source_appointment_id || null
        ]
      );

      await client.query('COMMIT');
      return newRows[0];
    }

    // 🔁 โอนระหว่างใช้งาน: ปิดสเตย์เดิม (กันเท่ากับ start_at) แล้วเปิดสเตย์ใหม่ทันที
    await client.query(
      `UPDATE bed_stays
          SET end_at = GREATEST($2::timestamptz, start_at + interval '1 second'),
              status = 'completed',
              note   = CASE
                         WHEN COALESCE($3::text,'') = '' THEN note
                         WHEN COALESCE(note,'') = ''     THEN $3::text
                         ELSE note || E'\n' || $3::text
                       END
        WHERE stay_id = $1`,
      [stay_id, tAtParam, `Transfer at ${new Date(tAtParam).toISOString()}${note ? ` — ${note}` : ''}`]
    );

    const { rows: newRows } = await client.query(
      `INSERT INTO bed_stays
         (bed_id, patients_id, start_at, end_at, status, note, source_appointment_id)
       VALUES
         ($1, $2, $3, NULL,
          CASE WHEN $3 <= now() THEN 'occupied'::bed_stay_status ELSE 'reserved'::bed_stay_status END,
          $4, $5)
       RETURNING *`,
      [
        Number(to_bed_id),
        s.patients_id,
        tAtParam,          // เริ่มทันทีตามเวลาย้าย
        note,
        s.source_appointment_id || null
      ]
    );

    await client.query('COMMIT');
    return newRows[0];
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    if (e?.code === '23P01') {           // EXCLUDE overlap
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
      s.stay_id AS id,                -- << ทำให้ตรงกับฝั่งหน้า
      s.patients_id,
      s.start_at,
      s.end_at,
      s.status,
      s.note,
      b.bed_id   AS bed_id,
      b.code     AS bed_code,
      b.care_side AS service_type
    FROM bed_stays s
    JOIN beds b ON b.bed_id = s.bed_id
    WHERE s.patients_id = $1
    ORDER BY s.start_at DESC, s.stay_id DESC
  `;
  const { rows } = await pool.query(sql, [patients_id]);
  return rows;
};


exports.currentOccupancy = async () => {
  const sql = `
    SELECT
      s.stay_id AS id,
      s.bed_id,
      b.code       AS bed_code,
      b.care_side  AS service_type,   -- 'LTC' | 'PC'
      s.patients_id,
      p.pname, p.first_name, p.last_name,
      s.start_at,
      s.end_at,
      s.note,
      CASE
        WHEN s.status = 'cancelled' THEN 'cancelled'
        WHEN s.end_at IS NULL THEN 'active'
        ELSE 'ended'
      END AS status
    FROM bed_stays s
    JOIN beds b     ON b.bed_id = s.bed_id
    JOIN patients p ON p.patients_id = s.patients_id
    WHERE s.end_at IS NULL
      AND s.start_at <= now()          -- << เพิ่มเงื่อนไขนี้
      AND s.status <> 'cancelled'
    ORDER BY b.care_side, b.code, s.stay_id;
  `;
  const { rows } = await pool.query(sql);
  return rows;
};


