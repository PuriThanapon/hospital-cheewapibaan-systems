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

/* ---------- ประกอบ SQL expr โดย "ยึด start_time/end_time เป็นหลัก" ---------- */
function buildExprs(cols) {
  // id
  const idCol  = pick(cols, 'appointment_id', 'id');
  const idExpr = idCol ? `a.${idCol}::text` : `row_number() over ()::text`;

  // date -> YYYY-MM-DD
  const dateCol = pick(cols, 'appointment_date', 'date', 'start_at', 'start');
  if (!dateCol) throw new Error('appointment table missing date column (appointment_date/date/start_at)');
  const dateExpr = `
    CASE
      WHEN pg_typeof(a.${dateCol}) = 'timestamptz'::regtype
        THEN to_char(a.${dateCol} AT TIME ZONE 'Asia/Bangkok','YYYY-MM-DD')
      WHEN pg_typeof(a.${dateCol}) = 'timestamp'::regtype
        THEN to_char(a.${dateCol}, 'YYYY-MM-DD')
      ELSE to_char(a.${dateCol}::date, 'YYYY-MM-DD')
    END
  `;

  // time (ยึด start_time / end_time เป็นหลัก)
  const hasStart = cols.has('start_time');
  const hasEnd   = cols.has('end_time');
  const timeExpr     = hasStart ? `to_char(a.start_time::time,'HH24:MI')` : `NULL::text`;
  const endTimeExpr  = hasEnd   ? `to_char(a.end_time::time,'HH24:MI')`   : `NULL::text`;
  const timeSortExpr = hasStart ? `(a.start_time::time)` : null;

  // ฟิลด์อื่น ๆ จาก appointment (ใส่ a. ให้แน่ + แคสต์เป็น text)
  const typeExpr   = cols.has('type')               ? `a.type::text`
                   : cols.has('appointment_type')   ? `a.appointment_type::text`
                   : cols.has('department')         ? `a.department::text`
                   : null;

  const placeExpr  = cols.has('place')              ? `a.place::text`
                   : cols.has('hospital_address')   ? `a.hospital_address::text`
                   : cols.has('location')           ? `a.location::text`
                   : null;

  const statusExpr = cols.has('status')             ? `a.status::text`
                   : cols.has('appointment_status') ? `a.appointment_status::text`
                   : null;

  const orderBy = [
    `${dateExpr} ASC`,
    timeSortExpr ? `${timeSortExpr} ASC NULLS LAST` : null
  ].filter(Boolean).join(', ');

  return { idExpr, dateExpr, timeExpr, endTimeExpr, typeExpr, placeExpr, statusExpr, orderBy };
}

/* ---------- นัดหมาย "วันนี้" ---------- */
// GET /api/notification/today
exports.getTodayAppointments = async (req, res, next) => {
  try {
    const cols = await getAppointmentColumns();
    const { idExpr, dateExpr, timeExpr, endTimeExpr, typeExpr, placeExpr, statusExpr, orderBy } = buildExprs(cols);

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
        ${placeExpr  ? placeExpr  : `NULL::text`}                           AS place,
        ${statusExpr ? `COALESCE(${statusExpr}, 'pending'::text)` : `'pending'::text`} AS status,
        ${typeExpr   ? typeExpr   : `NULL::text`}                           AS type
      FROM appointment a
      LEFT JOIN patients p ON p.patients_id = a.patients_id
      WHERE ${dateExpr} = (SELECT to_char(today,'YYYY-MM-DD') FROM tz)
      ORDER BY ${orderBy}
    `;
    const { rows } = await pool.query(sql);
    res.json({ date: new Date().toLocaleDateString('th-TH'), data: rows });
  } catch (err) { next(err); }
};

/* ---------- นัดหมายแบบ Timeline (ช่วงวัน) ---------- */
// GET /api/notification/timeline?from=YYYY-MM-DD&to=YYYY-MM-DD
exports.getTimelineAppointments = async (req, res, next) => {
  try {
    const cols = await getAppointmentColumns();
    const { idExpr, dateExpr, timeExpr, endTimeExpr, typeExpr, placeExpr, statusExpr, orderBy } = buildExprs(cols);

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
        ${placeExpr  ? placeExpr  : `NULL::text`}                           AS place,
        ${statusExpr ? `COALESCE(${statusExpr}, 'pending'::text)` : `'pending'::text`} AS status,
        ${typeExpr   ? typeExpr   : `NULL::text`}                           AS type
      FROM appointment a
      LEFT JOIN patients p ON p.patients_id = a.patients_id
      WHERE ${dateExpr} BETWEEN $1 AND $2
      ORDER BY ${orderBy}
    `;
    const { rows } = await pool.query(sql, [fromYmd, toYmd]);
    res.json({ from: fromYmd, to: toYmd, data: rows });
  } catch (err) { next(err); }
};

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
        -- ✅ ให้ทั้งสองฝั่งของ COALESCE เป็นชนิด date
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
        -- เปรียบเทียบโดยใช้รูปแบบ YYYY-MM-DD เหมือนกันทั้งสองฝั่ง
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
