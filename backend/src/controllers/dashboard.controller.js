// controllers/dashboard.controller.js
const { pool } = require('../config/db');

/* ---------------- Dashboard Summary ---------------- */
// GET /api/dashboard/summary
exports.getSummary = async (req, res, next) => {
  try {
    const sql = `
      WITH tz AS (
        SELECT (current_timestamp AT TIME ZONE 'Asia/Bangkok')::date AS today
      ),
      p AS (SELECT * FROM patients),
      a AS (SELECT * FROM appointment)
      SELECT
        (SELECT COUNT(*) FROM p) AS patients_total,
        (SELECT COUNT(*) FROM p WHERE status = 'มีชีวิต') AS patients_alive,
        (SELECT COUNT(*) FROM p WHERE status = 'เสียชีวิต') AS patients_deceased,
        (SELECT COUNT(*) FROM p WHERE status = 'จำหน่าย') AS patients_discharged,
        (SELECT COUNT(*) FROM p WHERE admittion_date >= (SELECT today FROM tz) - INTERVAL '30 days') AS new_patients_30d,
        (SELECT COUNT(*) FROM a WHERE appointment_date::date = (SELECT today FROM tz)) AS appts_today,
        (SELECT COUNT(*) FROM a
           WHERE appointment_date::date BETWEEN (SELECT today FROM tz)
                                           AND ((SELECT today FROM tz) + INTERVAL '7 days')::date) AS appts_next_7d
    `;
    const { rows } = await pool.query(sql);
    res.json(rows[0] || {});
  } catch (e) { next(e); }
};

/* ---------------- Trends (by day) ---------------- */
// GET /api/dashboard/trends?from=YYYY-MM-DD&to=YYYY-MM-DD
exports.getTrends = async (req, res, next) => {
  try {
    // default: ย้อนหลัง 90 วัน
    const to = req.query.to || new Date().toISOString().slice(0,10);
    const from = req.query.from || new Date(Date.now() - 89*24*3600*1000).toISOString().slice(0,10);

    const sql = `
      WITH bounds AS (
        SELECT $1::date AS dfrom, $2::date AS dto
      ),
      series AS (
        SELECT generate_series((SELECT dfrom FROM bounds), (SELECT dto FROM bounds), '1 day'::interval)::date AS d
      ),
      new_pats AS (
        SELECT admittion_date::date AS d, COUNT(*) AS c
        FROM patients, bounds
        WHERE admittion_date::date BETWEEN (SELECT dfrom FROM bounds) AND (SELECT dto FROM bounds)
        GROUP BY 1
      ),
      deaths AS (
        SELECT death_date::date AS d, COUNT(*) AS c
        FROM patients, bounds
        WHERE status='เสียชีวิต' AND death_date IS NOT NULL
          AND death_date::date BETWEEN (SELECT dfrom FROM bounds) AND (SELECT dto FROM bounds)
        GROUP BY 1
      )
      SELECT s.d,
             COALESCE(n.c,0) AS new_patients,
             COALESCE(d.c,0) AS deaths
      FROM series s
      LEFT JOIN new_pats n ON n.d = s.d
      LEFT JOIN deaths d   ON d.d = s.d
      ORDER BY s.d;
    `;
    const { rows } = await pool.query(sql, [from, to]);
    res.json({ from, to, data: rows });
  } catch (e) { next(e); }
};

/* ---------------- Top โรคที่พบบ่อย ---------------- */
// GET /api/dashboard/top-diseases?limit=10
exports.getTopDiseases = async (req, res, next) => {
  try {
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const sql = `
      WITH tokens AS (
        SELECT trim(BOTH FROM regexp_replace(lower(tok), '\\s+', ' ', 'g')) AS label
        FROM patients
        , LATERAL regexp_split_to_table(COALESCE(disease,''), '[,;/•]+') AS tok
      )
      SELECT label, COUNT(*) AS count
      FROM tokens
      WHERE label <> '' AND label <> '-'
      GROUP BY label
      ORDER BY count DESC, label ASC
      LIMIT $1
    `;
    const { rows } = await pool.query(sql, [limit]);
    res.json({ data: rows });
  } catch (e) { next(e); }
};

/* ---------------- จำแนกตามประเภทผู้ป่วย ---------------- */
// GET /api/dashboard/patients-by-type
exports.getPatientsByType = async (req, res, next) => {
  try {
    const sql = `
      SELECT COALESCE(patients_type, 'ไม่ระบุ') AS label, COUNT(*) AS count
      FROM patients
      GROUP BY 1
      ORDER BY count DESC, label
    `;
    const { rows } = await pool.query(sql);
    res.json({ data: rows });
  } catch (e) { next(e); }
};

exports.getPatientsByGender = async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        CASE
          WHEN lower(trim(gender)) IN ('ชาย','male','m','man','men') THEN 'male'
          WHEN lower(trim(gender)) IN ('หญิง','female','f','woman','women') THEN 'female'
          ELSE 'other'
        END AS gender,
        COUNT(*)::int AS count
      FROM patients
      GROUP BY 1
      ORDER BY 1
    `);

    const male   = rows.find(r => r.gender === 'male')?.count ?? 0;
    const female = rows.find(r => r.gender === 'female')?.count ?? 0;

    // ✅ ส่งรูปแบบที่ frontend รองรับทั้งสองแบบ
    res.json({
      total: male + female,   // รวมเฉพาะ male+female (ตัด other ออก)
      male,
      female,
      data: rows              // และแนบ breakdown เป็น [{ gender, count }, ...]
    });
  } catch (e) { next(e); }
};

async function getAppointmentColumns() {
  const { rows } = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appointment'
  `);
  return new Set(rows.map(r => r.column_name));
}

function pick(cols, ...candidates) {
  // รับชื่อคอลัมน์หลายตัว แล้วคืนชื่อแรกที่ "มีอยู่จริง" ในตาราง
  return candidates.find(c => cols.has(c)) || null;
}
/* ---------------- นัดหมาย (widget) ---------------- */
// GET /api/dashboard/appointments?days=7
exports.getAppointmentsWidget = async (req, res, next) => {
  try {
    const cols = await getAppointmentColumns();

    // helper: คืน COALESCE(a.col1, a.col2, ...)
    const coalesceSql = (...names) => {
      const list = names.filter(n => cols.has(n)).map(n => `a.${n}`);
      return list.length ? `COALESCE(${list.join(', ')})` : null;
    };

    // --- ระบุคอลัมน์ที่มีจริง ---
    const idCol     = pick(cols, 'appointment_id', 'id');
    const dateCol   = pick(cols, 'appointment_date', 'date', 'start_at', 'start'); // start_at เผื่อเก็บ timestamp
    // รวมทุกชื่อที่พบบ่อยสำหรับ "เวลาเริ่ม" และ "เวลาจบ"
    const timeExpr0    = coalesceSql('appointment_time','start_time','time','start_at');   // มีได้หลายชื่อ
    const endTimeExpr0 = coalesceSql('appointment_end_time','end_time','time_end','end_at');

    const typeExpr   = coalesceSql('type','appointment_type','department');
    const placeExpr  = coalesceSql('place','hospital_address');
    const statusExpr = coalesceSql('status','appointment_status');

    if (!dateCol) {
      return res.status(500).json({ error: 'appointment table missing date column (appointment_date/date)' });
    }

    // --- สร้าง expression ที่ฟอร์แมตแล้ว ---
    const idExpr      = idCol ? `a.${idCol}::text` : `row_number() over ()::text`;

    // คืนวันเป็นสตริง YYYY-MM-DD (กัน T...Z)
    // ถ้าเป็น timestamptz → แปลงโซนไทยก่อนค่อยตัดเป็นวัน
    const dateExpr = `
      CASE
        WHEN pg_typeof(a.${dateCol}) = 'timestamptz'::regtype
          THEN to_char(a.${dateCol} AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD')
        WHEN pg_typeof(a.${dateCol}) = 'timestamp'::regtype
          THEN to_char(a.${dateCol}::timestamp, 'YYYY-MM-DD')
        ELSE to_char(a.${dateCol}::date, 'YYYY-MM-DD')
      END
    `;

    // เวลา → HH:MM (ลองแคสต์เป็น time แล้ว to_char)
    const timeExpr =
      timeExpr0 ? `to_char((${timeExpr0})::time, 'HH24:MI')` : `NULL::text`;
    const endTimeExpr =
      endTimeExpr0 ? `to_char((${endTimeExpr0})::time, 'HH24:MI')` : `NULL::text`;

    // ใช้ expression เวลาเดียวกันในการเรียง
    const orderBy = [
      `${dateExpr} ASC`,
      timeExpr0 ? `((${timeExpr0})::time) ASC NULLS LAST` : null,
    ].filter(Boolean).join(', ');

    const dateParam = (req.query.date || '').trim(); // YYYY-MM-DD

    // -------- โหมดวันเดียว --------
    if (dateParam) {
      const sql = `
        SELECT
          ${idExpr}        AS id,
          a.patients_id,
          ${dateExpr}      AS date,
          ${timeExpr}      AS time,
          ${endTimeExpr}   AS time_end,
          ${typeExpr    ? `${typeExpr}::text`  : `NULL::text`} AS type,
          ${placeExpr   ? `${placeExpr}::text` : `NULL::text`} AS place,
          ${statusExpr  ? `${statusExpr}::text`: `'pending'`}  AS status,
          p.pname, p.first_name, p.last_name
        FROM appointment a
        LEFT JOIN patients p ON p.patients_id = a.patients_id
        WHERE (${dateExpr}) = $1::text
        ORDER BY ${orderBy}
        LIMIT 200
      `;
      const { rows } = await pool.query(sql, [dateParam]);
      return res.json({ mode: 'by-date', date: dateParam, data: rows });
    }

    // -------- โหมดช่วงหลายวัน (นับจาก "วันนี้(ไทย)" ไปอีก N วัน) --------
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 31);
    const sql = `
      WITH tz AS (
        SELECT (current_timestamp AT TIME ZONE 'Asia/Bangkok')::date AS today
      ),
      bounds AS (
        SELECT
          (SELECT today FROM tz) AS dfrom,
          ((SELECT today FROM tz) + ($1::int) * INTERVAL '1 day')::date AS dto
      )
      SELECT
        ${idExpr}        AS id,
        a.patients_id,
        ${dateExpr}      AS date,
        ${timeExpr}      AS time,
        ${endTimeExpr}   AS time_end,
        ${typeExpr    ? `${typeExpr}::text`  : `NULL::text`} AS type,
        ${placeExpr   ? `${placeExpr}::text` : `NULL::text`} AS place,
        ${statusExpr  ? `${statusExpr}::text`: `'pending'`}  AS status,
        p.pname, p.first_name, p.last_name
      FROM appointment a
      LEFT JOIN patients p ON p.patients_id = a.patients_id
      WHERE (${dateExpr}) BETWEEN (SELECT to_char(dfrom,'YYYY-MM-DD') FROM bounds)
                              AND (SELECT to_char(dto,'YYYY-MM-DD')   FROM bounds)
      ORDER BY ${orderBy}
      LIMIT 200
    `;
    const { rows } = await pool.query(sql, [days]);
    res.json({ mode: 'range', days, data: rows });
  } catch (e) { next(e); }
};
