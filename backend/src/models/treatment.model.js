// models/treatment.model.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

/* ---------------- Helpers ---------------- */
function normalizePatientsId(id = '') {
  id = String(id || '').trim();
  if (!id) return '';
  if (/^\d+$/.test(id)) return 'HN-' + id.padStart(8, '0');
  const m = id.match(/^HN[-\s]?(\d{1,8})$/i);
  if (m) return 'HN-' + m[1].padStart(8, '0');
  return id.toUpperCase();
}

function pickUpdatableFields(body = {}) {
  const allow = ['patients_id', 'treatment_type', 'treatment_date', 'diagnosis_summary', 'note'];
  const data = {};
  for (const k of allow) {
    if (Object.prototype.hasOwnProperty.call(body, k)) data[k] = body[k];
  }
  if (data.patients_id) data.patients_id = normalizePatientsId(data.patients_id);
  return data;
}

/* ================ Query: List with filters ================ */
/**
 * q = {
 *   patient_id?, q?, treatment_type?, from?, to?,
 *   active_only? ('1'|'0'), page?, limit?, sort? ('importance'|'recent'|'date_desc')
 * }
 */
async function listTreatment(q = {}) {
  const params = [];
  const where = [];

  // patient filter
  if (q.patient_id) {
    params.push(String(q.patient_id).toUpperCase());
    where.push(`t.patients_id = $${params.length}`);
  }

  // name search (AND tokens)
  if (q.q) {
    const tokens = String(q.q).trim().replace(/\s+/g, ' ').split(' ');
    for (const token of tokens) {
      if (!token) continue;
      params.push(`%${token}%`);
      where.push(`(concat_ws(' ', p.pname, p.first_name, p.last_name) ILIKE $${params.length})`);
    }
  }

  // type filter
  if (q.treatment_type) {
    params.push(q.treatment_type);
    where.push(`t.treatment_type = $${params.length}`);
  }

  // date range
  if (q.from) { params.push(q.from); where.push(`t.treatment_date >= $${params.length}`); }
  if (q.to)   { params.push(q.to);   where.push(`t.treatment_date <= $${params.length}`); }

  // active_only: hide completed one-time rows
  if (String(q.active_only ?? '1') === '1') {
    where.push(`(t.treatment_type != 'ทำครั้งเดียว' OR t.completed_at IS NULL)`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // sorting
  let orderBy = `t.treatment_date DESC, t.treatment_id DESC`;
  switch ((q.sort || 'importance')) {
    case 'recent':
      orderBy = `COALESCE(t.updated_at, t.created_at) DESC, t.treatment_id DESC`;
      break;
    case 'date_desc':
      orderBy = `t.treatment_date DESC, t.treatment_id DESC`;
      break;
    case 'importance':
    default:
      orderBy = `
        CASE WHEN t.treatment_type = 'ทำครั้งเดียว' AND t.completed_at IS NULL THEN 1 ELSE 0 END DESC,
        CASE WHEN t.updated_at IS NOT NULL AND t.updated_at >= NOW() - INTERVAL '10 minutes' THEN 1 ELSE 0 END DESC,
        t.treatment_date DESC,
        t.treatment_id DESC
      `;
      break;
  }

  const page = Math.max(1, parseInt(q.page || 1, 10));
  const limit = Math.max(1, Math.min(200, parseInt(q.limit || 20, 10)));
  const offset = (page - 1) * limit;

  const baseFrom = `
    FROM treatment t
    JOIN patients p ON p.patients_id = t.patients_id
  `;

  const sqlData = `
    SELECT
      t.*,
      p.pname, p.first_name, p.last_name, p.gender, p.birthdate,
      p.blood_group, p.bloodgroup_rh, p.patients_type, p.disease
    ${baseFrom}
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ${limit} OFFSET ${offset}
  `;
  const sqlCount = `SELECT COUNT(*)::int AS count ${baseFrom} ${whereSql}`;

  const client = await pool.connect();
  try {
    const [countRes, dataRes] = await Promise.all([
      client.query(sqlCount, params),
      client.query(sqlData, params),
    ]);
    const total = countRes.rows?.[0]?.count ?? 0;
    return { total, page, limit, data: dataRes.rows || [] };
  } finally {
    client.release();
  }
}

/* ================ Get one by id ================ */
async function getTreatmentById(id) {
  const sql = `
    SELECT
      t.*,
      p.pname, p.first_name, p.last_name, p.gender, p.birthdate,
      p.blood_group, p.bloodgroup_rh, p.patients_type, p.disease
    FROM treatment t
    JOIN patients p ON p.patients_id = t.patients_id
    WHERE t.treatment_id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}

/* ================ Create ================ */
async function createTreatment(body = {}) {
  const data = pickUpdatableFields(body);
  if (!data.patients_id) throw new Error('กรุณาระบุ patients_id');
  if (!data.treatment_type) throw new Error('กรุณาระบุ treatment_type');
  if (!data.treatment_date) throw new Error('กรุณาระบุ treatment_date');

  const sql = `
    INSERT INTO treatment (
      patients_id, treatment_type, treatment_date, diagnosis_summary, note,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    RETURNING treatment_id
  `;
  const params = [
    normalizePatientsId(data.patients_id),
    data.treatment_type,
    data.treatment_date,
    data.diagnosis_summary ?? null,
    data.note ?? null,
  ];

  const { rows } = await pool.query(sql, params);
  return rows[0]?.treatment_id;
}

/* ================ Update ================ */
async function updateTreatment(id, body = {}) {
  const data = pickUpdatableFields(body);
  if (!id) throw new Error('missing id');

  const sets = [];
  const params = [];
  let idx = 1;

  for (const [k, v] of Object.entries(data)) {
    sets.push(`${k} = $${idx++}`);
    params.push(k === 'patients_id' ? normalizePatientsId(v) : v);
  }

  // nothing to update
  if (sets.length === 0) {
    const row = await getTreatmentById(id);
    return row; // no-op
  }

  // updated_at
  sets.push(`updated_at = NOW()`);

  const sql = `
    UPDATE treatment
    SET ${sets.join(', ')}
    WHERE treatment_id = $${idx}
    RETURNING *
  `;
  params.push(id);

  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

/* ================ Delete ================ */
async function deleteTreatment(id) {
  const { rowCount } = await pool.query(
    `DELETE FROM treatment WHERE treatment_id = $1`,
    [id]
  );
  return rowCount > 0;
}

/* ================ Complete one-time ================ */
async function completeTreatment(id) {
  // อนุญาตเฉพาะประเภท "ทำครั้งเดียว" ที่ยังไม่เสร็จ
  const sql = `
    UPDATE treatment
    SET completed_at = NOW(), updated_at = NOW()
    WHERE treatment_id = $1
      AND treatment_type = 'ทำครั้งเดียว'
      AND completed_at IS NULL
    RETURNING *
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}

module.exports = {
  listTreatment,
  getTreatmentById,
  createTreatment,
  updateTreatment,
  deleteTreatment,
  completeTreatment,
};
