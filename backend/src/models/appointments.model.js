// backend/src/models/appointment.model.js
const { pool } = require('../config/db');

const ATBL = 'appointment';
const PTBL = 'patients';

const CODE_PREFIX = 'AP-';
const CODE_PAD = 6;

const codeFromId = (id) => `${CODE_PREFIX}${String(id).padStart(CODE_PAD, '0')}`;
exports.nextAppointmentCode = async () => {
  const { rows } = await pool.query(`SELECT COALESCE(MAX(appointment_id),0)+1 AS next_id FROM appointment`);
  const nextId = rows?.[0]?.next_id || 1;
  return `AP-${String(nextId).padStart(6, '0')}`;
};
const idFromCode = (code) => {
  const n = parseInt(String(code).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

/** ──────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────── */
function buildOrder(sort = 'status', dir = 'asc') {
  const d = String(dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  switch (sort) {
    case 'status':
      return `ORDER BY
        CASE a.status
          WHEN 'pending'   THEN 1
          WHEN 'done'      THEN 2
          WHEN 'cancelled' THEN 3
          ELSE 4
        END ${d},
        a.appointment_date ASC, a.start_time ASC, a.appointment_id ASC`;

    case 'created':
      return `ORDER BY a.created_at ${d}, a.appointment_id ${d}`;
    case 'patient':
      return `ORDER BY p.first_name ${d}, p.last_name ${d}, a.appointment_id ${d}`;
    case 'hn':
      return `ORDER BY a.patients_id ${d}, a.appointment_id ${d}`;
    case 'type':
      return `ORDER BY a.appointment_type ${d}, a.appointment_id ${d}`;
    case 'place':
      // ใช้ hospital_address เป็นหลัก ถ้าเป็น home ให้ fallback เป็น a.place (หรือค่าว่าง)
      return `ORDER BY COALESCE(a.hospital_address, a.place, '') ${d}, a.appointment_id ${d}`;
    case 'datetime':
    default:
      return `ORDER BY a.appointment_date ${d}, a.start_time ${d}, a.appointment_id ${d}`;
  }
}

async function hasOverlap({ patients_id, date, start, end, excludeId = null }) {
  const params = [patients_id, date, start, end];
  let sql = `
    SELECT 1
    FROM ${ATBL} a
    WHERE a.patients_id = $1
      AND a.appointment_date = $2
      AND NOT ($4 <= a.start_time OR $3 >= a.end_time)
  `;
  if (excludeId) {
    sql += ` AND a.appointment_id <> $5`;
    params.push(excludeId);
  }
  const { rows } = await pool.query(sql, params);
  return rows.length > 0;
}

/** map/validate home|hospital กับ hospital_address (กันเพี้ยนตั้งแต่ชั้น model) */
function normalizeTypeAndAddress(input) {
  const out = { ...input };

  // รับ backward compat: 'clinic' => 'hospital'
  if (out.appointment_type === 'clinic') out.appointment_type = 'hospital';

  // เดา type จาก hospital_address ถ้าไม่ส่งมา
  if (!out.appointment_type) {
    out.appointment_type = out.hospital_address ? 'hospital' : 'home';
  }

  if (out.appointment_type === 'home') {
    out.hospital_address = null;
  } else if (out.appointment_type === 'hospital') {
    if (!out.hospital_address || !String(out.hospital_address).trim()) {
      const e = new Error('กรอกชื่อ/ที่อยู่โรงพยาบาล');
      e.status = 400;
      throw e;
    }
    out.hospital_address = String(out.hospital_address).trim();
  } else {
    const e = new Error('appointment_type ต้องเป็น home หรือ hospital');
    e.status = 400;
    throw e;
  }

  // legacy: ถ้าไม่มี appointment_time ให้ใส่เท่ากับ start_time
  if (!out.appointment_time && out.start_time) {
    out.appointment_time = out.start_time;
  }

  // ตรวจช่วงเวลา (ถ้าส่งมา)
  if (out.start_time && out.end_time && out.start_time > out.end_time) {
    const e = new Error('เวลาเริ่มต้องไม่เกินเวลาสิ้นสุด');
    e.status = 400;
    throw e;
  }

  return out;
}

/** ──────────────────────────────────────────────────────────────────
 * List + filter + pagination
 * query:
 *  - q (ค้นหาใน ชื่อ/สกุล/HN/ประเภท/สถานที่/ที่อยู่โรงพยาบาล/รหัส AP-xxxxxx)
 *  - status: 'pending'|'done'|'cancelled'|'all'
 *  - from, to (YYYY-MM-DD)
 *  - type: 'home'|'hospital' (optional)
 *  - sort: 'datetime'|'created'|'patient'|'hn'|'status'|'type'|'place'
 *  - dir: 'asc'|'desc'
 *  - page, limit
 * ────────────────────────────────────────────────────────────────── */
async function listAppointments({
  q = '',
  status = 'all',
  from = '',
  to = '',
  type = '',
  sort = 'status',
  dir = 'asc',
  page = 1,
  limit = 20,
}) {
  const where = [];
  const params = [];
  let i = 1;

  if (q) {
    where.push(`(
      ('${CODE_PREFIX}' || lpad(a.appointment_id::text, ${CODE_PAD}, '0')) ILIKE $${i}
      OR a.patients_id ILIKE $${i}
      OR COALESCE(a.appointment_type,'') ILIKE $${i}
      OR COALESCE(a.place,'') ILIKE $${i}
      OR COALESCE(a.hospital_address,'') ILIKE $${i}
      OR (COALESCE(p.pname,'') || COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) ILIKE $${i}
    )`);
    params.push(`%${q}%`); i++;
  }
  if (status && status !== 'all') { where.push(`a.status = $${i++}`); params.push(status); }
  if (type) { where.push(`a.appointment_type = $${i++}`); params.push(type); }
  if (from) { where.push(`a.appointment_date >= $${i++}`); params.push(from); }
  if (to)   { where.push(`a.appointment_date <= $${i++}`); params.push(to); }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = buildOrder(sort, dir);
  const off = (Number(page) - 1) * Number(limit);

  // นับรวม
  const countSql = `
    SELECT COUNT(*)::int AS cnt
    FROM ${ATBL} a
    LEFT JOIN ${PTBL} p ON p.patients_id = a.patients_id
    ${whereSql}
  `;
  const { rows: totalRows } = await pool.query(countSql, params);
  const totalCount = totalRows?.[0]?.cnt || 0;

  // data
  const dataSql = `
    SELECT
      a.appointment_id,
      ('${CODE_PREFIX}' || lpad(a.appointment_id::text, ${CODE_PAD}, '0')) AS appointment_code,
      a.patients_id,
      a.appointment_date,
      a.start_time,
      a.end_time,
      a.appointment_type,
      a.place,
      a.hospital_address,
      -- ชื่อคอลัมน์เพื่อแสดงผลใน UI: ถ้า hospital ให้ใช้ hospital_address, ถ้า home แสดง 'บ้านผู้ป่วย' หรือ a.place
      CASE WHEN a.appointment_type = 'hospital'
           THEN COALESCE(a.hospital_address, a.place, '')
           ELSE COALESCE(a.place, 'บ้านผู้ป่วย')
      END AS display_place,
      a.status,
      a.note,
      a.created_at,
      a.updated_at,
      p.pname, p.first_name, p.last_name, p.phone_number, p.gender, p.birthdate
    FROM ${ATBL} a
    LEFT JOIN ${PTBL} p ON p.patients_id = a.patients_id
    ${whereSql}
    ${orderSql}
    LIMIT $${i++} OFFSET $${i++}
  `;
  const { rows } = await pool.query(dataSql, [...params, Number(limit), Number(off)]);
  return { data: rows, page: Number(page), limit: Number(limit), totalCount };
}

async function getAppointmentById(idOrCode) {
  let idParam = idOrCode;
  if (typeof idOrCode === 'string' && /^AP-\d+$/i.test(idOrCode)) {
    const parsed = idFromCode(idOrCode);
    if (!parsed) return null;
    idParam = parsed;
  }

  const sql = `
    SELECT
      a.*,
      ('${CODE_PREFIX}' || lpad(a.appointment_id::text, ${CODE_PAD}, '0')) AS appointment_code,
      CASE WHEN a.appointment_type = 'hospital'
           THEN COALESCE(a.hospital_address, a.place, '')
           ELSE COALESCE(a.place, 'บ้านผู้ป่วย')
      END AS display_place,
      p.pname, p.first_name, p.last_name, p.phone_number, p.gender, p.birthdate,
      row_to_json(p) AS patient
    FROM ${ATBL} a
    LEFT JOIN ${PTBL} p ON p.patients_id = a.patients_id
    WHERE a.appointment_id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [idParam]);
  return rows[0] || null;
}

async function createAppointment(payload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const data = normalizeTypeAndAddress(payload);

    // กันซ้อนเวลา (optional)
    if (data.patients_id && data.appointment_date && data.start_time && data.end_time) {
      const overlapped = await hasOverlap({
        patients_id: data.patients_id,
        date: data.appointment_date,
        start: data.start_time,
        end: data.end_time,
      });
      if (overlapped) {
        const e = new Error('ช่วงเวลานี้ชนกับนัดอื่นของผู้ป่วยคนเดียวกัน');
        e.status = 409;
        throw e;
      }
    }

    const sql = `
      INSERT INTO ${ATBL}
        (patients_id, appointment_date, start_time, end_time,
         appointment_time, appointment_type, place, hospital_address,
         status, note)
      VALUES ($1,$2,$3,$4,
              $5,$6,$7,$8,
              COALESCE($9,'pending'),$10)
      RETURNING
        appointment_id,
        ('${CODE_PREFIX}' || lpad(appointment_id::text, ${CODE_PAD}, '0')) AS appointment_code,
        patients_id, appointment_date, start_time, end_time,
        appointment_type, place, hospital_address, status, note, created_at, updated_at
    `;
    const { rows } = await client.query(sql, [
      data.patients_id || null,
      data.appointment_date || null,
      data.start_time || null,
      data.end_time || null,
      data.appointment_time || data.start_time || null, // legacy support
      data.appointment_type || null,
      data.place || null,
      data.hospital_address || null,
      data.status || null,
      data.note || null,
    ]);

    await client.query('COMMIT');
    return rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function updateAppointment(idOrCode, update) {
  let idParam = idOrCode;
  if (typeof idOrCode === 'string' && /^AP-\d+$/i.test(idOrCode)) {
    const parsed = idFromCode(idOrCode);
    if (!parsed) {
      const e = new Error('รูปแบบรหัสนัดไม่ถูกต้อง');
      e.status = 400;
      throw e;
    }
    idParam = parsed;
  }

  // นำ business rule มาจัดก่อน ให้ a) type/home/hospital ถูกต้อง b) กันเวลาซ้อน
  const current = await getAppointmentById(idParam);
  if (!current) return null;

  // รวมค่าเดิมกับค่าที่อัปเดต (เพื่อ normalize และตรวจเวลา)
  const merged = {
    patients_id: update.patients_id ?? current.patients_id,
    appointment_date: update.appointment_date ?? current.appointment_date,
    start_time: update.start_time ?? current.start_time,
    end_time: update.end_time ?? current.end_time,
    appointment_time: update.appointment_time ?? current.appointment_time,
    appointment_type: update.appointment_type ?? current.appointment_type,
    place: update.place ?? current.place,
    hospital_address: update.hospital_address ?? current.hospital_address,
    status: update.status ?? current.status,
    note: update.note ?? current.note,
  };

  const normalized = normalizeTypeAndAddress(merged);

  // กันซ้อนเวลา (ถ้ามีส่งหรือค่าปัจจุบันครบ)
  if (normalized.patients_id && normalized.appointment_date && normalized.start_time && normalized.end_time) {
    const overlapped = await hasOverlap({
      patients_id: normalized.patients_id,
      date: normalized.appointment_date,
      start: normalized.start_time,
      end: normalized.end_time,
      excludeId: current.appointment_id,
    });
    if (overlapped) {
      const e = new Error('ช่วงเวลานี้ชนกับนัดอื่นของผู้ป่วยคนเดียวกัน');
      e.status = 409;
      throw e;
    }
  }

  // สร้าง SET เฉพาะฟิลด์ที่เปลี่ยนจริง ๆ จาก normalized เมื่อเทียบกับ current
  const patch = {};
  [
    'patients_id','appointment_date','start_time','end_time','appointment_time',
    'appointment_type','place','hospital_address','status','note'
  ].forEach((k) => {
    if (normalized[k] !== current[k]) patch[k] = normalized[k];
  });

  const fields = [];
  const params = [];
  let i = 1;

  Object.keys(patch).forEach((k) => {
    fields.push(`${k} = $${i++}`);
    params.push(patch[k]);
  });

  // อัปเดต timestamp เสมอ
  fields.push(`updated_at = NOW()`);

  if (fields.length === 1) {
    // ไม่มีอะไรเปลี่ยน (มีแค่ updated_at) ก็คืนค่าปัจจุบัน
    return current;
  }

  const sql = `UPDATE ${ATBL} SET ${fields.join(', ')} WHERE appointment_id = $${i} RETURNING *`;
  params.push(idParam);

  const { rows } = await pool.query(sql, params);
  if (!rows[0]) return null;

  return {
    ...rows[0],
    appointment_code: codeFromId(rows[0].appointment_id),
  };
}

async function deleteAppointment(idOrCode) {
  let idParam = idOrCode;
  if (typeof idOrCode === 'string' && /^AP-\d+$/i.test(idOrCode)) {
    const parsed = idFromCode(idOrCode);
    if (!parsed) return false;
    idParam = parsed;
  }
  const sql = `DELETE FROM ${ATBL} WHERE appointment_id = $1`;
  const res = await pool.query(sql, [idParam]);
  return res.rowCount > 0;
}

module.exports = {
  listAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
};
