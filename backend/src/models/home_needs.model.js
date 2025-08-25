const { pool } = require('../config/db');

const TBL = 'home_visit_needs';

// คืนรายการล่าสุดของผู้ป่วยคนนี้ (ให้สถานะ open มาก่อน ถ้าไม่มีค่อยตามวันที่)
async function getLatestNeedsByPatient(patients_id) {
  const sql = `
    SELECT id, patients_id, items, status, source_appointment_id, noted_at, created_at, note
    FROM ${TBL}
    WHERE patients_id = $1
    ORDER BY
      (status = 'open') DESC,
      COALESCE(noted_at, created_at) DESC,
      id DESC
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [patients_id]);
  const row = rows[0] || null;

  // เผื่อบาง DB คืน items เป็น string
  if (row && typeof row.items === 'string') {
    try { row.items = JSON.parse(row.items); } catch { row.items = []; }
  }
  if (row && row.items == null) row.items = [];
  return row;
}

// สร้างรายการความต้องการ (ใช้ตอนกด “บันทึกสิ่งที่ต้องการ”)
async function createHomeNeeds(payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const sql = `
    INSERT INTO ${TBL}
      (patients_id, items, status, source_appointment_id, noted_at, note)
    VALUES ($1, $2::jsonb, $3, $4, $5, $6)
    RETURNING *
  `;
  const params = [
    payload.patients_id,                  // ต้องเป็น HN ที่ normalize แล้ว เช่น HN-00000023
    JSON.stringify(items),                // เก็บ items เป็น jsonb
    payload.status || 'open',
    payload.source_appointment_id || null,
    payload.noted_at || null,
    payload.note || null,
  ];
  const { rows } = await pool.query(sql, params);
  return rows[0];
}

// (ออปชัน) เผื่ออยากใช้ upsert ในอนาคต
async function upsertNeeds({ id = null, patients_id, items = [], status = 'open', source_appointment_id = null, noted_at = null, note = null }) {
  if (id) {
    const { rows } = await pool.query(
      `UPDATE ${TBL}
         SET items=$2::jsonb, status=$3, source_appointment_id=$4, noted_at=$5, note=$6
       WHERE id=$1
       RETURNING *`,
      [id, JSON.stringify(items), status, source_appointment_id, noted_at, note]
    );
    return rows[0] || null;
  } else {
    return createHomeNeeds({ patients_id, items, status, source_appointment_id, noted_at, note });
  }
}

module.exports = {
  getLatestNeedsByPatient,  // ← ชื่อที่คอนโทรลเลอร์เรียก
  createHomeNeeds,          // ← ชื่อที่คอนโทรลเลอร์เรียก
  // เผื่อมีที่อื่นเรียกชื่อเก่า:
  getLatestByPatient: getLatestNeedsByPatient,
  upsertNeeds,
};
