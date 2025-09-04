const { pool } = require('../config/db');

const FIELDS = ['title', 'time', 'days_of_week', 'note'];
const TIME_RX = /^([01]?\d|2[0-3]):([0-5]\d)$/; // HH:MM

function pick(obj = {}) {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => FIELDS.includes(k)));
}

function normalizePayload(payload = {}) {
  const data = pick(payload);

  // time: HH:MM -> HH:MM:00 (เพื่อให้ตรงกับ type TIME ของ Postgres)
  if (typeof data.time === 'string') {
    if (!TIME_RX.test(data.time)) throw new Error('INVALID_TIME');
    data.time = data.time.length === 5 ? `${data.time}:00` : data.time;
  }

  // days_of_week: [] -> NULL (ทุกวัน) / validate 1..7 / unique + sort
  if (Array.isArray(data.days_of_week)) {
    if (data.days_of_week.length === 0) {
      data.days_of_week = null;
    } else {
      const ok = data.days_of_week.every((n) => Number.isInteger(n) && n >= 1 && n <= 7);
      if (!ok) throw new Error('INVALID_DAYS');
      data.days_of_week = Array.from(new Set(data.days_of_week)).sort((a, b) => a - b);
    }
  } else if (data.days_of_week === undefined) {
    // ไม่ส่ง = ไม่แตะค่า (ตอน update)
  } else if (data.days_of_week === null) {
    // ตั้งใจให้ทุกวัน
  } else {
    throw new Error('INVALID_DAYS');
  }

  if (typeof data.title === 'string') data.title = data.title.trim();
  if (typeof data.note === 'string') {
    data.note = data.note.trim();
    if (data.note === '') data.note = null;
  }

  return data;
}

const SELECT_BASE = `
  SELECT routine_id,
         title,
         to_char(time,'HH24:MI') AS time,
         days_of_week,
         note,
         created_at,
         updated_at
  FROM routines
`;

async function listAll() {
  const { rows } = await pool.query(
    `${SELECT_BASE}
     ORDER BY time ASC, routine_id ASC`
  );
  return rows;
}

async function listByDay(day) {
  // ใช้ ANY อ่านง่ายและเข้ากันได้ดี
  const { rows } = await pool.query(
    `${SELECT_BASE}
     WHERE days_of_week IS NULL OR $1 = ANY(days_of_week)
     ORDER BY time ASC, routine_id ASC`,
    [day]
  );
  return rows;
}

async function getById(id) {
  const { rows } = await pool.query(`${SELECT_BASE} WHERE routine_id = $1`, [id]);
  return rows[0] || null;
}

async function create(payload) {
  const d = normalizePayload(payload);
  const { rows } = await pool.query(
    `INSERT INTO routines (title, time, days_of_week, note)
     VALUES ($1, $2, $3, $4)
     RETURNING routine_id, title, to_char(time,'HH24:MI') AS time, days_of_week, note, created_at, updated_at`,
    [d.title, d.time, d.days_of_week, d.note]
  );
  return rows[0];
}

async function update(id, payload) {
  const d = normalizePayload(payload);
  const sets = [];
  const vals = [];
  let i = 1;

  for (const key of Object.keys(d)) {
    sets.push(`${key} = $${i++}`);
    vals.push(d[key]);
  }
  if (sets.length === 0) return getById(id);

  sets.push(`updated_at = now()`);
  vals.push(id);

  const { rows } = await pool.query(
    `UPDATE routines SET ${sets.join(', ')}
     WHERE routine_id = $${i}
     RETURNING routine_id, title, to_char(time,'HH24:MI') AS time, days_of_week, note, created_at, updated_at`,
    vals
  );
  return rows[0] || null;
}

async function remove(id) {
  const { rowCount } = await pool.query(`DELETE FROM routines WHERE routine_id = $1`, [id]);
  return rowCount > 0;
}

module.exports = { listAll, listByDay, getById, create, update, remove };
