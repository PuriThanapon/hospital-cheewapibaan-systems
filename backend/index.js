require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// ---------------- Helpers ----------------
const toPatientsId = (v) => {
  const digits = String(v ?? '')
    .toUpperCase()
    .trim()
    .replace(/^HN[-–—]?/i, '')
    .replace(/\D/g, '');
  if (!digits) return null;
  return 'HN-' + digits.padStart(8, '0');
};

function normalizePatientsIdFromQuery(q) {
  if (!q) return '';
  const digits = String(q)
    .toUpperCase()
    .replace(/^HN[-–—]?/, '')
    .replace(/\D/g, '');
  if (!digits) return '';
  return `HN-${digits.padStart(8, '0')}`;
}

async function getLatestPatientId() {
  const r = await pool.query(
    `SELECT patients_id FROM patients ORDER BY patients_id DESC LIMIT 1`
  );
  return r.rows[0]?.patients_id || null;
}

// ---------------- Patients ----------------
// Next HN
app.get('/api/patients/next-id', async (req, res, next) => {
  try {
    const latestId = await getLatestPatientId();
    let next = 1;
    if (latestId) {
      const parts = latestId.split('-');
      const lastNumber = parseInt(parts[1], 10);
      if (!isNaN(lastNumber)) next = lastNumber + 1;
    }
    return res.json({ nextId: `HN-${String(next).padStart(8, '0')}` });
  } catch (e) {
    next(e);
  }
});

// List with filters
app.get('/api/patients', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;

    const patientId = req.query.patient_id || req.query.patients_id || '';
    const gender = req.query.gender || '';
    const patientsType = req.query.patients_type || '';
    const status = req.query.status || '';
    const bloodGroup = req.query.blood_group || '';
    const bloodgroupRh = req.query.bloodgroup_rh || '';
    const admitFrom = req.query.admit_from || '';
    const admitTo = req.query.admit_to || '';
    const q = (req.query.q || '').trim();
    const sortName = (req.query.sort_name || '').toLowerCase(); // asc | desc

    const where = [];
    const vals = [];
    let i = 1;

    const normalizedHN = normalizePatientsIdFromQuery(patientId);
    if (normalizedHN) {
      where.push(`p.patients_id = $${i++}`);
      vals.push(normalizedHN);
    }

    if (gender) {
      where.push(`p.gender = $${i++}`);
      vals.push(gender);
    }
    if (patientsType) {
      where.push(`p.patients_type = $${i++}`);
      vals.push(patientsType);
    }
    if (status) {
      where.push(`p.status = $${i++}`);
      vals.push(status);
    }
    if (bloodGroup) {
      where.push(`p.blood_group = $${i++}`);
      vals.push(bloodGroup);
    }
    if (bloodgroupRh) {
      where.push(`p.bloodgroup_rh = $${i++}`);
      vals.push(bloodgroupRh);
    }
    if (admitFrom) {
      where.push(`p.admittion_date >= $${i++}`);
      vals.push(admitFrom);
    }
    if (admitTo) {
      where.push(`p.admittion_date <= $${i++}`);
      vals.push(admitTo);
    }

    if (q) {
      where.push(`(
        p.patients_id ILIKE $${i} OR
        CONCAT(COALESCE(p.pname,''), COALESCE(p.first_name,''), ' ', COALESCE(p.last_name,'')) ILIKE $${i} OR
        COALESCE(p.gender,'') ILIKE $${i} OR
        COALESCE(p.blood_group,'') ILIKE $${i} OR
        COALESCE(p.bloodgroup_rh,'') ILIKE $${i} OR
        COALESCE(p.patients_type,'') ILIKE $${i} OR
        COALESCE(p.disease,'') ILIKE $${i} OR
        COALESCE(p.phone_number::text,'') ILIKE $${i}
      )`);
      vals.push(`%${q}%`);
      i++;
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const orderClause =
      sortName === 'asc' || sortName === 'desc'
        ? `ORDER BY lower(p.first_name) ${sortName === 'desc' ? 'DESC' : 'ASC'},
                     lower(p.last_name)  ${sortName === 'desc' ? 'DESC' : 'ASC'}`
        : `ORDER BY p.admittion_date DESC NULLS LAST, p.patients_id DESC`;

    const sql = `
      SELECT
        p.patients_id,
        p.pname,
        p.first_name,
        p.last_name,
        p.gender,
        p.birthdate,
        p.patients_type,
        p.blood_group,
        p.bloodgroup_rh,
        p.disease,
        p.status,
        p.admittion_date,
        p.phone_number AS phone,
        COUNT(*) OVER() AS total_count
      FROM patients p
      ${whereClause}
      ${orderClause}
      LIMIT $${i++} OFFSET $${i++}
    `;
    vals.push(limit, offset);

    const { rows } = await pool.query(sql, vals);
    const totalCount = rows[0]?.total_count ? parseInt(rows[0].total_count, 10) : 0;
    const data = rows.map(({ total_count, ...r }) => ({ ...r, hn: r.patients_id }));
    res.json({ data, totalCount, page, limit });
  } catch (err) {
    next(err);
  }
});

// Get one
app.get('/api/patients/:id', async (req, res, next) => {
  const patientId = toPatientsId(req.params.id);
  if (!patientId) return res.status(400).json({ message: 'กรุณาระบุเลขท้าย HN' });
  try {
    const r = await pool.query(
      `SELECT *, phone_number AS phone FROM patients WHERE patients_id = $1`,
      [patientId]
    );
    if (r.rows.length === 0) return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ป่วย' });
    res.json({ ...r.rows[0], hn: r.rows[0].patients_id });
  } catch (err) {
    next(err);
  }
});

// Create
app.post('/api/patients', async (req, res, next) => {
  try {
    const b = req.body || {};
    const pid = toPatientsId(b.patients_id || b.hn);
    if (!pid) return res.status(400).json({ message: 'ต้องระบุ patients_id หรือ hn' });

    const phone_number = b.phone_number ?? b.phone ?? null;

    const sql = `
      INSERT INTO patients (
        patients_id,
        pname, first_name, last_name, card_id, gender, address, birthdate, nationality,
        patients_type, blood_group, bloodgroup_rh, phone_number, height, weight, status,
        admittion_date, disease
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15,$16,
        COALESCE($17::date, CURRENT_DATE), $18
      )
      RETURNING *, phone_number AS phone
    `;

    const params = [
      pid,
      b.pname, b.first_name, b.last_name, b.card_id, b.gender, b.address, b.birthdate, b.nationality,
      b.patients_type, b.blood_group, b.bloodgroup_rh, phone_number, b.height, b.weight, 'มีชีวิต',
      b.admittion_date, b.disease,
    ];

    const r = await pool.query(sql, params);
    res.status(201).json({ ...r.rows[0], hn: r.rows[0].patients_id });
  } catch (err) {
    next(err);
  }
});

// Update
app.put('/api/patients/:id', async (req, res, next) => {
  const patientId = toPatientsId(req.params.id);
  if (!patientId) return res.status(400).json({ message: 'รหัสผู้ป่วยไม่ถูกต้อง' });

  try {
    const b = req.body || {};
    const phone_number = b.phone_number ?? b.phone ?? null;

    const r = await pool.query(
      `UPDATE patients
         SET pname=$1, first_name=$2, last_name=$3, card_id=$4, birthdate=$5,
             gender=$6, nationality=$7, phone_number=$8,
             weight=$9, height=$10,
             patients_type=$11, blood_group=$12, bloodgroup_rh=$13,
             disease=$14, address=$15, admittion_date=$16,
             updated_at=NOW()
       WHERE patients_id=$17
       RETURNING *, phone_number AS phone`,
      [
        b.pname, b.first_name, b.last_name, b.card_id, b.birthdate,
        b.gender, b.nationality, phone_number,
        b.weight, b.height,
        b.patients_type, b.blood_group, b.bloodgroup_rh,
        b.disease, b.address, b.admittion_date,
        patientId,
      ]
    );
    if (!r.rowCount) return res.status(404).json({ message: 'ไม่พบผู้ป่วย' });
    res.json({ message: 'อัปเดตข้อมูลสำเร็จ', patient: { ...r.rows[0], hn: r.rows[0].patients_id } });
  } catch (e) {
    next(e);
  }
});

// Mark deceased
app.patch('/api/patients/:id/deceased', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const patientId = toPatientsId(req.params.id);
    if (!patientId) return res.status(400).json({ message: 'รหัสผู้ป่วยไม่ถูกต้อง' });

    const { death_date, death_time, death_cause, management } = req.body || {};
    if (!death_date || !death_time || !death_cause)
      return res.status(400).json({ message: 'ต้องระบุ death_date, death_time, death_cause' });

    await client.query('BEGIN');

    const pr = await client.query(`SELECT * FROM patients WHERE patients_id=$1`, [patientId]);
    if (!pr.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'ไม่พบผู้ป่วย' });
    }
    const p = pr.rows[0];

    await client.query(
      `UPDATE patients SET status='เสียชีวิต', updated_at=NOW() WHERE patients_id=$1`,
      [patientId]
    );

    await client.query(
      `INSERT INTO death_information (
         death_date, death_time, death_cause, status, management, patients_id,
         first_name, last_name, card_id, gender, address, birthdate, nationality,
         patients_type, blood_group, phone_number, height, weight, admittion_date, disease
       ) VALUES (
         $1::date, $2::time, $3, 'เสียชีวิต', $4, $5,
         $6, $7, $8, $9, $10, $11, $12,
         $13, $14, $15, $16, $17, $18, $19
       )`,
      [
        death_date, death_time, death_cause, management || null, patientId,
        p.first_name, p.last_name, p.card_id, p.gender, p.address, p.birthdate, p.nationality,
        p.patients_type, p.blood_group, p.phone_number, p.height, p.weight, p.admittion_date, p.disease,
      ]
    );

    await client.query(
      `DELETE FROM appointment
        WHERE patients_id=$1
          AND (
            appointment_date > CURRENT_DATE OR
            (appointment_date = CURRENT_DATE AND appointment_time > CURRENT_TIME)
          )`,
      [patientId]
    );

    await client.query('COMMIT');
    res.json({ message: 'บันทึกการเสียชีวิตสำเร็จ' });
  } catch (e) {
    await pool.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

// ---------------- Treatment ----------------
app.get('/api/treatment', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const offset = (page - 1) * limit;

    const patientIdRaw = req.query.patient_id || req.query.patients_id || '';
    const patientsId = normalizePatientsIdFromQuery(patientIdRaw);
    const treatmentType = req.query.treatment_type || '';
    const sortName = (req.query.sort_name || '').toLowerCase();

    const where = [];
    const values = [];
    let i = 1;

    if (patientsId) {
      where.push(`t.patients_id = $${i++}`);
      values.push(patientsId);
    }
    if (treatmentType) {
      where.push(`t.treatment_type = $${i++}`);
      values.push(treatmentType);
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const orderClause =
      sortName === 'asc' || sortName === 'desc'
        ? `ORDER BY lower(p.pname), lower(p.first_name), lower(p.last_name) ${
            sortName === 'desc' ? 'DESC' : 'ASC'
          }`
        : `ORDER BY t.treatment_date DESC, t.treatment_id DESC`;

    const sql = `
      SELECT
        t.treatment_id,
        t.patients_id,
        t.treatment_date,
        t.treatment_type,
        t.description,
        p.pname,
        p.first_name,
        p.last_name,
        COUNT(*) OVER() AS total_count
      FROM treatment t
      JOIN patients p ON t.patients_id = p.patients_id
      ${whereClause}
      ${orderClause}
      LIMIT $${i++} OFFSET $${i++}
    `;

    values.push(limit, offset);

    const { rows } = await pool.query(sql, values);
    const totalCount = rows[0]?.total_count ? parseInt(rows[0].total_count, 10) : 0;
    const data = rows.map(({ total_count, ...rest }) => rest);

    res.json({ data, totalCount, page, limit });
  } catch (err) {
    next(err);
  }
});

app.get('/api/treatment/:id', async (req, res, next) => {
  const treatmentId = req.params.id; // string (e.g., TRT-001)
  try {
    const result = await pool.query(
      `SELECT t.*, 
              p.pname, p.first_name, p.last_name, p.gender, p.birthdate, 
              p.patients_type, p.blood_group, p.bloodgroup_rh,
              p.height, p.weight, p.status,
              p.disease
       FROM treatment t
       JOIN patients p ON t.patients_id = p.patients_id
       WHERE t.treatment_id = $1`,
      [treatmentId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลการรักษา' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post('/api/treatment', async (req, res, next) => {
  const { patients_id, description, treatment_date, treatment_type } = req.body || {};

  if (!patients_id || !description || !treatment_date || !treatment_type) {
    return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertTreatmentQuery = `
      INSERT INTO treatment (patients_id, description, treatment_date, treatment_type)
      VALUES ($1, $2, $3, $4)
      RETURNING treatment_id;
    `;

    const insertResult = await client.query(insertTreatmentQuery, [patients_id, description, treatment_date, treatment_type]);
    const newTreatmentId = insertResult.rows[0].treatment_id;

    await client.query(
      `UPDATE patients SET treatment_id = $1 WHERE patients_id = $2`,
      [newTreatmentId, patients_id]
    );

    await client.query('COMMIT');

    res.status(201).json({ message: 'บันทึกการรักษาสำเร็จ', treatment_id: newTreatmentId });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// NOTE: use /api prefix for consistency
app.put('/api/treatment/:treatment_id', async (req, res, next) => {
  const { treatment_id } = req.params;
  const { treatment_type, description, treatment_date } = req.body || {};
  try {
    const sql = `
      UPDATE treatment
      SET treatment_type=$1, description=$2, treatment_date=$3
      WHERE treatment_id=$4
      RETURNING *
    `;
    const values = [treatment_type, description, treatment_date, treatment_id];
    const result = await pool.query(sql, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลการรักษาที่ต้องการแก้ไข' });
    }
    res.json({ message: 'แก้ไขข้อมูลการรักษาสำเร็จ', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/treatment/:id', async (req, res, next) => {
  const treatmentId = req.params.id;
  try {
    const result = await pool.query('DELETE FROM treatment WHERE treatment_id = $1', [treatmentId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'ไม่พบข้อมูลการรักษานี้' });
    }
    res.json({ message: 'ลบข้อมูลการรักษาเรียบร้อยแล้ว' });
  } catch (error) {
    next(error);
  }
});

// ---------------- Appointments ----------------
app.get('/api/appointments', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT a.*, p.first_name, p.last_name
      FROM appointment a
      JOIN patients p ON a.patients_id = p.patients_id
      ORDER BY a.appointment_date, a.appointment_time
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET by patients_id (kept for backward-compatibility)
app.get('/api/appointments/:id', async (req, res, next) => {
  const id = toPatientsId(req.params.id) || req.params.id; // accept HN-* or raw
  try {
    const result = await pool.query(
      `SELECT a.*, p.first_name, p.last_name
       FROM appointment a
       JOIN patients p ON a.patients_id = p.patients_id
       WHERE a.patients_id = $1
       ORDER BY a.appointment_date, a.appointment_time`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'ไม่พบนัดหมายของผู้ป่วยนี้' });
    }
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.post('/api/appointments', async (req, res, next) => {
  const {
    appointment_date,
    appointment_time,
    hospital_address,
    department,
    description,
    patients_id,
  } = req.body || {};

  try {
    const result = await pool.query(
      `INSERT INTO appointment (
        appointment_date, appointment_time, hospital_address, department, description, patients_id
      ) VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *`,
      [
        appointment_date,
        appointment_time,
        hospital_address || null,
        department || null,
        description || null,
        patients_id,
      ]
    );
    res.status(201).json({ message: 'Appointment created successfully', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

app.put('/api/appointments/:id', async (req, res, next) => {
  const { id } = req.params; // appointment_id
  const { patients_id, appointment_date, appointment_time, hospital_address, department, description } = req.body || {};
  try {
    const result = await pool.query(
      `UPDATE appointment
       SET patients_id=$1, appointment_date=$2, appointment_time=$3,
           hospital_address=$4, department=$5, description=$6
       WHERE appointment_id=$7`,
      [patients_id, appointment_date, appointment_time, hospital_address || null, department || null, description || null, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'ไม่พบนัดหมายที่ต้องการแก้ไข' });
    res.json({ message: 'Appointment updated successfully' });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/appointments/:id', async (req, res, next) => {
  const { id } = req.params; // appointment_id
  try {
    const result = await pool.query('DELETE FROM appointment WHERE appointment_id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'ไม่พบการนัดหมายที่ต้องการลบ' });
    res.json({ message: 'ลบการนัดหมายเรียบร้อยแล้ว' });
  } catch (err) {
    next(err);
  }
});

// ---------------- Death Information ----------------
app.get('/api/deaths', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT death_id, death_date, death_time, death_cause, status, management,
             patients_id, first_name, last_name
      FROM death_information
      ORDER BY death_id DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.get('/api/deaths/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT death_id, death_date, death_time, death_cause, status, management,
              patients_id, first_name, last_name, card_id, gender, birthdate, nationality,
              address, patients_type, blood_group, phone_number, height, weight,
              admittion_date, disease
       FROM death_information
       WHERE death_id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'ไม่พบข้อมูลการเสียชีวิตนี้' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Create death snapshot (does NOT delete patient)
app.post('/api/deaths', async (req, res, next) => {
  const { death_date, death_time, death_cause, management, patients_id } = req.body || {};
  if (!patients_id || !death_date || !death_time || !death_cause) {
    return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pRes = await client.query(
      `SELECT patients_id, first_name, last_name, card_id, gender, address, birthdate,
              nationality, patients_type, blood_group, phone_number, height, weight,
              admittion_date, disease
       FROM patients WHERE patients_id=$1`,
      [toPatientsId(patients_id) || patients_id]
    );
    if (!pRes.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'ไม่พบผู้ป่วยในระบบ' });
    }
    const p = pRes.rows[0];

    await client.query(
      `INSERT INTO death_information (
         death_date, death_time, death_cause, status, management,
         patients_id, first_name, last_name, card_id, gender, address,
         birthdate, nationality, patients_type, blood_group, phone_number,
         height, weight, admittion_date, disease
       ) VALUES (
         $1,$2,$3,'เสียชีวิต',$4,
         $5,$6,$7,$8,$9,$10,
         $11,$12,$13,$14,$15,
         $16,$17,$18,$19
       )`,
      [
        death_date, death_time, death_cause, management || null,
        p.patients_id, p.first_name, p.last_name, p.card_id, p.gender, p.address,
        p.birthdate, p.nationality, p.patients_type, p.blood_group, p.phone_number,
        p.height, p.weight, p.admittion_date, p.disease,
      ]
    );

    // update patient status as well
    await client.query(
      `UPDATE patients SET status='เสียชีวิต', updated_at=NOW() WHERE patients_id=$1`,
      [p.patients_id]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'บันทึกข้อมูลการเสียชีวิตสำเร็จ' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

app.put('/api/deaths/:id', async (req, res, next) => {
  const { id } = req.params;
  const { death_date, death_time, death_cause, status, management, patients_id } = req.body || {};
  try {
    await pool.query(
      `UPDATE death_information
       SET death_date=$1, death_time=$2, death_cause=$3, status=$4, management=$5, patients_id=$6
       WHERE death_id=$7`,
      [death_date, death_time, death_cause, status, management, patients_id, id]
    );
    res.json({ message: 'อัปเดตข้อมูลการเสียชีวิตสำเร็จ' });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/deaths/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const r = await pool.query('DELETE FROM death_information WHERE death_id=$1', [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'ไม่พบข้อมูลการเสียชีวิตนี้' });
    res.json({ message: 'ลบข้อมูลการเสียชีวิตสำเร็จ' });
  } catch (err) {
    next(err);
  }
});

// ---------------- 404 & Error handlers ----------------
app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: err?.message || 'Internal Server Error' });
});

// ---------------- Start ----------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
