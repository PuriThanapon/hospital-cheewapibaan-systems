const { pool } = require('../config/db');

/* ---------- one-time init (create tables if missing) ---------- */
async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patient_encounter_baseline (
      patients_id        TEXT PRIMARY KEY,
      reason_in_dept     TEXT,
      reason_admit       TEXT,
      bedbound_cause     TEXT,
      other_history      TEXT,
      referral_hospital  TEXT,
      referral_phone     TEXT,
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE patient_encounter_baseline
      ADD COLUMN IF NOT EXISTS referral_hospital TEXT,
      ADD COLUMN IF NOT EXISTS referral_phone    TEXT;

    CREATE TABLE IF NOT EXISTS patient_symptom_treatments (
      treatment_id  BIGSERIAL PRIMARY KEY,
      patients_id   TEXT NOT NULL,
      symptom       TEXT NOT NULL,
      severity      TEXT NOT NULL CHECK (severity IN ('mild','moderate','severe')),
      symptom_date  DATE NOT NULL,
      medication    TEXT,
      note          TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_treatments_patient ON patient_symptom_treatments(patients_id);
    CREATE INDEX IF NOT EXISTS idx_treatments_date ON patient_symptom_treatments(symptom_date DESC, created_at DESC);
  `);
}

const normalizeHN = (v='') => decodeURIComponent(String(v));

/* ---------- NEW: GET /api/patients/:hn/encounters/baseline ---------- */
async function getBaseline(req, res, next) {
  try {
    await initTables();
    const hn = normalizeHN(req.params.hn || req.params.id);
    const bl = await pool.query(
      `SELECT patients_id,
              reason_in_dept, reason_admit, bedbound_cause, other_history,
              referral_hospital, referral_phone,
              updated_at
         FROM patient_encounter_baseline
        WHERE patients_id = $1`,
      [hn]
    );
    res.json({ data: { baseline: bl.rows[0] || null } });
  } catch (e) { next(e); }
}

/* ---------- (เดิม) GET /api/patients/:hn/encounters/summary ---------- */
async function getSummary(req, res, next) {
  try {
    await initTables();
    const hn = normalizeHN(req.params.hn || req.params.id);

    const bl = await pool.query(
      `SELECT patients_id,
              reason_in_dept, reason_admit, bedbound_cause, other_history,
              referral_hospital, referral_phone,
              updated_at
         FROM patient_encounter_baseline
        WHERE patients_id = $1`,
      [hn]
    );

    const tr = await pool.query(
      `SELECT treatment_id, patients_id, symptom, severity, 
              to_char(symptom_date,'YYYY-MM-DD') AS symptom_date,
              medication, note, created_at
         FROM patient_symptom_treatments
        WHERE patients_id = $1
        ORDER BY symptom_date DESC, created_at DESC`,
      [hn]
    );

    res.json({
      data: {
        baseline: bl.rows[0] || null,
        treatments: tr.rows || [],
      }
    });
  } catch (e) { next(e); }
}

/* ---------- (เดิม) POST /api/patients/:hn/encounters/baseline ---------- */
async function upsertBaseline(req, res, next) {
  try {
    await initTables();
    const hn = normalizeHN(req.params.hn || req.params.id);
    const {
      reason_in_dept = null,
      reason_admit = null,
      bedbound_cause = null,
      other_history = null,
      referral_hospital = null,
      referral_phone = null,
    } = req.body || {};

    await pool.query(
      `INSERT INTO patient_encounter_baseline
         (patients_id, reason_in_dept, reason_admit, bedbound_cause, other_history, referral_hospital, referral_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (patients_id) DO UPDATE SET
         reason_in_dept    = EXCLUDED.reason_in_dept,
         reason_admit      = EXCLUDED.reason_admit,
         bedbound_cause    = EXCLUDED.bedbound_cause,
         other_history     = EXCLUDED.other_history,
         referral_hospital = EXCLUDED.referral_hospital,
         referral_phone    = EXCLUDED.referral_phone,
         updated_at        = now()`,
      [hn, reason_in_dept, reason_admit, bedbound_cause, other_history, referral_hospital, referral_phone]
    );

    res.json({ ok: true });
  } catch (e) { next(e); }
}

/* ---------- (เดิม) POST /api/patients/:hn/encounters/treatments ---------- */
async function addTreatment(req, res, next) {
  try {
    await initTables();
    const hn = normalizeHN(req.params.hn || req.params.id);
    let {
      symptom = '',
      severity = 'mild',
      symptom_date = null,
      medication = null,
      note = null,
    } = req.body || {};

    symptom = String(symptom || '').trim();
    severity = String(severity || 'mild').toLowerCase();
    if (!['mild','moderate','severe'].includes(severity)) severity = 'mild';
    if (!symptom) return res.status(400).json({ error: 'symptom is required' });
    if (!symptom_date) return res.status(400).json({ error: 'symptom_date is required (YYYY-MM-DD)' });

    const { rows } = await pool.query(
      `INSERT INTO patient_symptom_treatments
         (patients_id, symptom, severity, symptom_date, medication, note)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING treatment_id`,
      [hn, symptom, severity, symptom_date, medication, note]
    );

    res.json({ ok: true, treatment_id: rows[0].treatment_id });
  } catch (e) { next(e); }
}

module.exports = {
  getBaseline,   // ✅ ใหม่
  getSummary,
  upsertBaseline,
  addTreatment,
};
