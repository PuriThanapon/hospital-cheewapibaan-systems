// src/controllers/notification.controller.js
const { pool } = require('../config/db');

/* ---------- helpers: ตรวจคอลัมน์ที่มีจริง ---------- */
async function getAppointmentColumns() {
  const { rows } = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appointment'
  `);
  return new Set(rows.map(r => r.column_name));
}
const pick = (cols, ...names) => names.find(n => cols.has(n)) || null;

/* ---------- สร้าง expression ให้ทุกคอลัมน์ที่ต้องใช้ ---------- */
function buildExprs(cols) {
  // id
  const idCol  = pick(cols, 'appointment_id', 'id');
  const idExpr = idCol ? `a.${idCol}::text` : `row_number() over ()::text`;

  // date -> YYYY-MM-DD (รองรับ timestamp/timestamptz/date)
  const dateCol = pick(cols, 'appointment_date', 'date', 'start_at', 'start');
  if (!dateCol) throw new Error('appointment table missing date column (appointment_date/date/start_at/start)');
  const dateExpr = `
    CASE
      WHEN pg_typeof(a.${dateCol}) = 'timestamptz'::regtype
        THEN to_char(a.${dateCol} AT TIME ZONE 'Asia/Bangkok','YYYY-MM-DD')
      WHEN pg_typeof(a.${dateCol}) = 'timestamp'::regtype
        THEN to_char(a.${dateCol}, 'YYYY-MM-DD')
      ELSE to_char(a.${dateCol}::date, 'YYYY-MM-DD')
    END
  `;

  // time
  const hasStart = cols.has('start_time');
  const hasEnd   = cols.has('end_time');
  const timeExpr     = hasStart ? `to_char(a.start_time::time,'HH24:MI')` : `NULL::text`;
  const endTimeExpr  = hasEnd   ? `to_char(a.end_time::time,'HH24:MI')`   : `NULL::text`;
  const timeSortExpr = hasStart ? `(a.start_time::time)` : null;

  // สถานที่บ้าน (place) เท่านั้น — ไม่ fallback เป็น hospital
  const placeCol = pick(cols, 'place', 'home_address', 'address', 'location');
  const placeExpr = placeCol ? `a.${placeCol}::text` : null;

  // โรงพยาบาล/แผนก
  const hospitalCol = pick(cols, 'hospital_address', 'hospital', 'hospital_name');
  const hospitalExpr = hospitalCol ? `a.${hospitalCol}::text` : null;

  const deptCol = pick(cols, 'department', 'dept', 'department_name');
  const departmentExpr = deptCol ? `a.${deptCol}::text` : null;

  // status
  const statusCol  = pick(cols, 'status', 'appointment_status');
  const statusExpr = statusCol ? `a.${statusCol}::text` : null;

  // type — ใช้ของจริงก่อน, ไม่งั้นเดาจากข้อมูลที่มี
  let typeExpr = null;
  if (cols.has('type')) typeExpr = `a.type::text`;
  else if (cols.has('appointment_type')) typeExpr = `a.appointment_type::text`;
  else {
    const hasHospCond =
      [hospitalExpr, departmentExpr]
        .filter(Boolean)
        .map(e => `NULLIF(TRIM(${e}), '') IS NOT NULL`)
        .join(' OR ') || 'FALSE';

    const homeCond = placeExpr
      ? `COALESCE(${placeExpr}, '') ILIKE '%บ้าน%'`
      : 'FALSE';

    typeExpr = `
      CASE
        WHEN ${hasHospCond} THEN 'hospital'::text
        WHEN ${homeCond}    THEN 'home'::text
        ELSE NULL::text
      END
    `;
  }

  const orderBy = [
    `${dateExpr} ASC`,
    timeSortExpr ? `${timeSortExpr} ASC NULLS LAST` : null
  ].filter(Boolean).join(', ');

  return {
    idExpr, dateExpr, timeExpr, endTimeExpr,
    placeExpr, hospitalExpr, departmentExpr,
    statusExpr, typeExpr, orderBy
  };
}

function buildDateOnlyExpr(cols) {
  const dateCol = pick(cols, 'appointment_date', 'date', 'start_at', 'start');
  if (!dateCol) throw new Error('appointment table missing date column (appointment_date/date/start_at/start)');
  return `
    CASE
      WHEN pg_typeof(a.${dateCol}) = 'timestamptz'::regtype THEN (a.${dateCol} AT TIME ZONE 'Asia/Bangkok')::date
      WHEN pg_typeof(a.${dateCol}) = 'timestamp'::regtype  THEN (a.${dateCol})::date
      ELSE a.${dateCol}::date
    END
  `;
}

/* ---------- นัดหมาย "วันนี้" ---------- */
// GET /api/notification/today
exports.getTodayAppointments = async (req, res, next) => {
  try {
    const cols = await getAppointmentColumns();
    const {
      idExpr, dateExpr, timeExpr, endTimeExpr,
      placeExpr, hospitalExpr, departmentExpr,
      statusExpr, typeExpr, orderBy
    } = buildExprs(cols);

    const sql = `
      WITH tz AS (
        SELECT (current_timestamp AT TIME ZONE 'Asia/Bangkok')::date AS today
      )
      SELECT
        ${idExpr} AS appointment_id,
        p.pname, p.first_name, p.last_name,
        ${dateExpr}    AS date,
        ${timeExpr}    AS start,
        ${endTimeExpr} AS "end",
        ${placeExpr      ? placeExpr      : `NULL::text`}                           AS place,
        ${hospitalExpr   ? hospitalExpr   : `NULL::text`}                           AS hospital_address,
        ${departmentExpr ? departmentExpr : `NULL::text`}                           AS department,
        ${statusExpr ? `COALESCE(${statusExpr}, 'pending'::text)` : `'pending'::text`} AS status,
        ${typeExpr   ? typeExpr   : `NULL::text`}                                    AS appointment_type
      FROM appointment a
      LEFT JOIN patients p ON p.patients_id = a.patients_id
      WHERE ${dateExpr} = (SELECT to_char(today,'YYYY-MM-DD') FROM tz)
      ORDER BY ${orderBy}
    `;
    const { rows } = await pool.query(sql);
    res.json({ date: new Date().toLocaleDateString('th-TH'), data: rows });
  } catch (err) { next(err); }
};

/* ---------- นัดที่เลยวัน (ยัง pending) ---------- */
// GET /api/notification/overdue
exports.getOverdueAppointments = async (req, res, next) => {
  try {
    const cols = await getAppointmentColumns();
    const {
      idExpr, timeExpr, endTimeExpr,
      placeExpr, hospitalExpr, departmentExpr,
      statusExpr, typeExpr, orderBy
    } = buildExprs(cols);

    const dateOnlyExpr = buildDateOnlyExpr(cols);

    // เงื่อนไขสถานะ pending (รองรับทั้งอังกฤษ/ไทย)
    const pendingCond = statusExpr
      ? `(lower(${statusExpr}) LIKE '%pending%' OR ${statusExpr} LIKE '%รอ%')`
      : `TRUE`; // ถ้าไม่มีคอลัมน์สถานะ ถือว่า pending

    // ไม่เอาที่ "เสร็จ/ยกเลิก"
    const notDoneOrCancelled = statusExpr
      ? `NOT (lower(${statusExpr}) LIKE '%done%' OR lower(${statusExpr}) LIKE '%complete%' OR lower(${statusExpr}) LIKE '%cancel%') 
         AND ${pendingCond}`
      : `TRUE`;

    const sql = `
      WITH tz AS (
        SELECT (current_timestamp AT TIME ZONE 'Asia/Bangkok')::date AS today
      )
      SELECT
        ${idExpr} AS appointment_id,
        p.pname, p.first_name, p.last_name,
        to_char(${dateOnlyExpr}, 'YYYY-MM-DD') AS date,
        ${timeExpr}    AS start,
        ${endTimeExpr} AS "end",
        ${placeExpr      ? placeExpr      : `NULL::text`} AS place,
        ${hospitalExpr   ? hospitalExpr   : `NULL::text`} AS hospital_address,
        ${departmentExpr ? departmentExpr : `NULL::text`} AS department,
        ${statusExpr ? `COALESCE(${statusExpr}, 'pending'::text)` : `'pending'::text`} AS status,
        ${typeExpr   ? typeExpr   : `NULL::text`}  AS appointment_type,
        ((SELECT today FROM tz) - ${dateOnlyExpr})::int AS days_overdue
      FROM appointment a
      LEFT JOIN patients p ON p.patients_id = a.patients_id
      WHERE ${dateOnlyExpr} < (SELECT today FROM tz)
        AND ${notDoneOrCancelled}
      ORDER BY ${orderBy}
    `;
    const { rows } = await pool.query(sql);
    res.json({ data: rows });
  } catch (err) { next(err); }
};

/* ---------- งานยกเลิกนัดอัตโนมัติเมื่อเกิน 7 วัน (ยัง pending) ---------- */
// เรียกใช้ได้ทั้งจาก cron และ route
exports.autoCancelOverdueTask = async () => {
  const cols = await getAppointmentColumns();
  const statusCol = pick(cols, 'status', 'appointment_status');
  if (!statusCol) throw new Error('appointment table missing status column');

  const dateOnlyExpr = buildDateOnlyExpr(cols);

  // เงื่อนไข pending (รองรับอังกฤษ/ไทย)
  const pendingCond = `(lower(a.${statusCol}::text) LIKE '%pending%' OR a.${statusCol}::text LIKE '%รอ%')`;

  const sql = `
    WITH tz AS (
      SELECT (current_timestamp AT TIME ZONE 'Asia/Bangkok')::date AS today
    )
    UPDATE appointment a
    SET ${statusCol} = 'cancelled'
    WHERE ${dateOnlyExpr} < ((SELECT today FROM tz) - INTERVAL '7 days')
      AND ${pendingCond}
    RETURNING 1
  `;
  const { rowCount } = await pool.query(sql);
  return { updated: rowCount || 0 };
};

// POST /api/notification/auto-cancel-overdue?dry=1  (dry run = นับเฉย ๆ)
exports.autoCancelOverdue = async (req, res, next) => {
  try {
    const dry = String(req.query.dry || '').trim() === '1';
    const cols = await getAppointmentColumns();
    const statusCol = pick(cols, 'status', 'appointment_status');
    if (!statusCol) return res.status(500).json({ error: 'appointment table missing status column' });

    const dateOnlyExpr = buildDateOnlyExpr(cols);
    const pendingCond = `(lower(a.${statusCol}::text) LIKE '%pending%' OR a.${statusCol}::text LIKE '%รอ%')`;

    if (dry) {
      const sql = `
        WITH tz AS (
          SELECT (current_timestamp AT TIME ZONE 'Asia/Bangkok')::date AS today
        )
        SELECT COUNT(*)::int AS would_update
        FROM appointment a
        WHERE ${dateOnlyExpr} < ((SELECT today FROM tz) - INTERVAL '7 days')
          AND ${pendingCond}
      `;
      const { rows } = await pool.query(sql);
      return res.json({ dry: true, would_update: rows[0]?.would_update ?? 0 });
    }

    const { updated } = await exports.autoCancelOverdueTask();
    res.json({ updated });
  } catch (err) { next(err); }
};


/* ---------- นัดหมายแบบ Timeline (ช่วงวัน) ---------- */
// GET /api/notification/timeline?from=YYYY-MM-DD&to=YYYY-MM-DD
exports.getTimelineAppointments = async (req, res, next) => {
  try {
    const cols = await getAppointmentColumns();
    const {
      idExpr, dateExpr, timeExpr, endTimeExpr,
      placeExpr, hospitalExpr, departmentExpr,
      statusExpr, typeExpr, orderBy
    } = buildExprs(cols);

    const today = new Date();
    const pad = (n) => String(n).padStart(2,'0');
    const defYmd = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;

    const fromYmd = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : defYmd;
    const toYmd   = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to   || '') ? req.query.to   : defYmd;

    const sql = `
      SELECT
        ${idExpr} AS appointment_id,
        p.pname, p.first_name, p.last_name,
        ${dateExpr}    AS date,
        ${timeExpr}    AS start,
        ${endTimeExpr} AS "end",
        ${placeExpr      ? placeExpr      : `NULL::text`}                           AS place,
        ${hospitalExpr   ? hospitalExpr   : `NULL::text`}                           AS hospital_address,
        ${departmentExpr ? departmentExpr : `NULL::text`}                           AS department,
        ${statusExpr ? `COALESCE(${statusExpr}, 'pending'::text)` : `'pending'::text`} AS status,
        ${typeExpr   ? typeExpr   : `NULL::text`}                                    AS appointment_type
      FROM appointment a
      LEFT JOIN patients p ON p.patients_id = a.patients_id
      WHERE ${dateExpr} BETWEEN $1 AND $2
      ORDER BY ${orderBy}
    `;
    const { rows } = await pool.query(sql, [fromYmd, toYmd]);
    res.json({ from: fromYmd, to: toYmd, data: rows });
  } catch (err) { next(err); }
};

/* ---------- Today badge (เดิม) ---------- */
exports.getTodayBadge = async (req, res, next) => {
  try {
    const cols = await getAppointmentColumns();

    const dateCol = pick(cols, 'appointment_date', 'date', 'start_at', 'start');
    if (!dateCol) {
      return res.status(500).json({ error: 'appointment table missing date column' });
    }

    const dateExpr = `
      CASE
        WHEN pg_typeof(a.${dateCol}) = 'timestamptz'::regtype
          THEN to_char(a.${dateCol} AT TIME ZONE 'Asia/Bangkok','YYYY-MM-DD')
        WHEN pg_typeof(a.${dateCol}) = 'timestamp'::regtype
          THEN to_char(a.${dateCol}, 'YYYY-MM-DD')
        ELSE to_char(a.${dateCol}::date, 'YYYY-MM-DD')
      END
    `;

    const statusCol  = pick(cols, 'status', 'appointment_status');
    const statusExpr = statusCol ? `a.${statusCol}::text` : `NULL::text`;

    const rawDate = (req.query.date || '').slice(0, 10);

    const sql = `
      WITH tz AS (
        SELECT (current_timestamp AT TIME ZONE 'Asia/Bangkok')::date AS today
      ),
      day AS (
        SELECT COALESCE(NULLIF($1,'')::date, (SELECT today FROM tz)) AS ymd
      )
      SELECT
        COUNT(*)::int AS total,
        SUM((lower(s) LIKE '%cancel%' OR s LIKE '%ยกเลิก%')::int)::int AS cancelled,
        SUM((lower(s) LIKE '%done%' OR lower(s) LIKE '%complete%' OR lower(s) LIKE '%completed%' OR s LIKE '%เสร็จ%' OR s LIKE '%สำเร็จ%')::int)::int AS done,
        SUM((lower(s) LIKE '%pending%' OR s LIKE '%รอ%')::int)::int AS pending
      FROM (
        SELECT COALESCE(${statusExpr}, '') AS s
        FROM appointment a
        WHERE ${dateExpr} = to_char((SELECT ymd FROM day), 'YYYY-MM-DD')
      ) x;
    `;

    const { rows } = await pool.query(sql, [rawDate]);
    res.json({
      date: rawDate || null,
      total: rows[0]?.total ?? 0,
      pending: rows[0]?.pending ?? 0,
      done: rows[0]?.done ?? 0,
      cancelled: rows[0]?.cancelled ?? 0,
    });
  } catch (e) { next(e); }
};
