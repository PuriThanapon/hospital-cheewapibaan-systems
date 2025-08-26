const { pool } = require('../config/db');

// แปลง error จาก Postgres -> HTTP ที่อ่านง่าย
function handlePgError(res, err) {
  const code = err?.code;
  if (code === '23505') {
    return res.status(409).json({ error: 'ตั้ง Primary ซ้ำ: ผู้ป่วยนี้มี Primary ที่ active อยู่แล้ว' });
  }
  if (code === '23514') {
    return res.status(400).json({ error: err.detail || err.message });
  }
  return res.status(500).json({ error: err.message || 'Internal error' });
}

// ---------------------- CRUD แบบเดิม ----------------------
exports.createDiagnosis = async (req, res) => {
  try {
    const { patients_id, code, term, is_primary, onset_date, status } = req.body;

    // 1) สร้าง encounter ใหม่
    const encRes = await pool.query(
      `INSERT INTO encounters (patients_id, encounter_type, note)
       VALUES ($1, 'diagnosis', 'สร้างจากการเพิ่มการวินิจฉัย')
       RETURNING encounter_id`,
      [patients_id]
    );

    const encounter_id = encRes.rows[0].encounter_id;

    // 2) สร้าง diagnosis โดยผูก encounter_id ด้วย
    const dxRes = await pool.query(
      `INSERT INTO patient_diagnosis
        (patients_id, encounter_id, code, term, is_primary, onset_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [patients_id, encounter_id, code ?? null, term, !!is_primary, onset_date ?? null, status ?? 'active']
    );

    res.json(dxRes.rows[0]);
  } catch (err) {
    handlePgError(res, err);
  }
};

exports.listDiagnosis = async (req, res) => {
  const { patients_id } = req.query;
  if (!patients_id) return res.status(400).json({ error: 'ต้องส่ง patients_id' });
  const r = await pool.query(
    `SELECT * FROM patient_diagnosis
     WHERE patients_id = $1
     ORDER BY is_primary DESC, created_at DESC`,
    [patients_id]
  );
  res.json(r.rows);
};

exports.getDiagnosisByPatient = async (req, res) => {
  const { patients_id } = req.params;
  const r = await pool.query(
    `SELECT * FROM patient_diagnosis
     WHERE patients_id = $1
     ORDER BY is_primary DESC, created_at DESC`,
    [patients_id]
  );
  res.json(r.rows);
};

exports.updateDiagnosis = async (req, res) => {
  try {
    const { diag_id } = req.params;
    const { code, term, is_primary, onset_date, status } = req.body;

    const sets = [];
    const vals = [];
    let i = 1;

    if (code !== undefined)       { sets.push(`code=$${i++}`);       vals.push(code ?? null); }
    if (term !== undefined)       { sets.push(`term=$${i++}`);       vals.push(term); }
    if (is_primary !== undefined) { sets.push(`is_primary=$${i++}`); vals.push(!!is_primary); }
    if (onset_date !== undefined) { sets.push(`onset_date=$${i++}`); vals.push(onset_date ?? null); }
    if (status !== undefined)     { sets.push(`status=$${i++}`);     vals.push(status); }

    sets.push(`updated_at=now()`);

    const q = `UPDATE patient_diagnosis SET ${sets.join(', ')} WHERE diag_id=$${i} RETURNING *`;
    vals.push(diag_id);

    const r = await pool.query(q, vals);
    if (!r.rows[0]) return res.status(404).json({ error: 'ไม่พบรายการ' });
    res.json(r.rows[0]);
  } catch (err) {
    handlePgError(res, err);
  }
};

exports.deleteDiagnosis = async (req, res) => {
  const { diag_id } = req.params;
  const r = await pool.query('DELETE FROM patient_diagnosis WHERE diag_id=$1', [diag_id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'ไม่พบรายการ' });
  res.status(204).end();
};

// ---------------------- ผูกกับ Encounter ----------------------
exports.listByEncounter = async (req, res) => {
  const { encounter_id } = req.params;
  const r = await pool.query(
    `SELECT * FROM patient_diagnosis WHERE encounter_id=$1 ORDER BY is_primary DESC, created_at DESC`,
    [encounter_id]
  );
  res.json(r.rows);
};

exports.createForEncounter = async (req, res) => {
  const { encounter_id } = req.params;
  const { code, term, is_primary, onset_date, status } = req.body;

  try {
    // หา patients_id จาก encounters
    const enc = await pool.query(`SELECT patients_id FROM encounters WHERE encounter_id=$1`, [encounter_id]);
    if (!enc.rows[0]) return res.status(404).json({ error: 'ไม่พบ encounter' });

    const patients_id = enc.rows[0].patients_id;
    const r = await pool.query(
      `INSERT INTO patient_diagnosis
        (patients_id, encounter_id, code, term, is_primary, onset_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [patients_id, encounter_id, code ?? null, term, !!is_primary, onset_date ?? null, status ?? 'active']
    );

    res.json(r.rows[0]);
  } catch (err) {
    handlePgError(res, err);
  }
};
