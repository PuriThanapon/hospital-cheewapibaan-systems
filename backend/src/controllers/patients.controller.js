// controllers/patients.controller.js
const { pool } = require('../config/db');
const multer = require('multer');
const model = require('../models/patients.model'); // ✅ ต้องมี

/* ---------------- helpers ---------------- */
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

// ฟิลด์ไฟล์ที่รองรับ
const FILE_FIELDS = [
  'patient_id_card',
  'house_registration',
  'patient_photo',
  'relative_id_card',
];

// multer (เก็บเป็น Buffer ในหน่วยความจำ)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const ok = /^image\//.test(file.mimetype || '') || file.mimetype === 'application/pdf';
    if (!ok) return cb(new Error('รองรับเฉพาะรูปภาพหรือ PDF เท่านั้น'));
    cb(null, true);
  },
});

/** middleware สำหรับ route สร้าง/แก้ไข */
const uploadPatientFiles = upload.fields(
  FILE_FIELDS.map((name) => ({ name, maxCount: 1 }))
);

/** ดึงไฟล์จาก req.files */
const fileFrom = (files, field) => {
  const f = files?.[field]?.[0];
  if (!f) return null;
  return { buffer: f.buffer, mime: f.mimetype, name: f.originalname };
};

/* ---------------- controllers ---------------- */

// GET /api/patients/next-id
async function getNextPatientId(req, res, next) {
  try {
    const latestId = await getLatestPatientId();
    let nextNo = 1;
    if (latestId) {
      const parts = latestId.split('-');
      const lastNumber = parseInt(parts[1], 10);
      if (!isNaN(lastNumber)) nextNo = lastNumber + 1;
    }
    res.json({ nextId: `HN-${String(nextNo).padStart(8, '0')}` });
  } catch (e) { next(e); }
}

// GET /api/patients
async function listPatients(req, res, next) {
  try {
    const page  = Math.max(parseInt(req.query.page, 10)  || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;

    const patientId    = req.query.patient_id || req.query.patients_id || '';
    const gender       = req.query.gender || '';
    const patientsType = req.query.patients_type || '';
    const status       = req.query.status || '';
    const bloodGroup   = req.query.blood_group || '';
    const bloodgroupRh = req.query.bloodgroup_rh || '';
    const religion     = req.query.religion || '';
    const admitFrom    = req.query.admit_from || '';
    const admitTo      = req.query.admit_to || '';
    const q            = (req.query.q || '').trim();
    const sortName     = (req.query.sort_name || '').toLowerCase();

    const where = [];
    const vals  = [];
    let i = 1;

    const normalizedHN = normalizePatientsIdFromQuery(patientId);
    if (normalizedHN) { where.push(`p.patients_id = $${i++}`); vals.push(normalizedHN); }
    if (gender)       { where.push(`p.gender = $${i++}`); vals.push(gender); }
    if (patientsType) { where.push(`p.patients_type = $${i++}`); vals.push(patientsType); }
    if (status)       { where.push(`p.status = $${i++}`); vals.push(status); }
    if (bloodGroup)   { where.push(`p.blood_group = $${i++}`); vals.push(bloodGroup); }
    if (bloodgroupRh) { where.push(`p.bloodgroup_rh = $${i++}`); vals.push(bloodgroupRh); }
    if (religion)     { where.push(`p.religion = $${i++}`); vals.push(religion); }
    if (admitFrom)    { where.push(`p.admittion_date >= $${i++}`); vals.push(admitFrom); }
    if (admitTo)      { where.push(`p.admittion_date <= $${i++}`); vals.push(admitTo); }

    if (q) {
      where.push(`(
        p.patients_id ILIKE $${i} OR
        (COALESCE(p.pname || ' ', '') || COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) ILIKE $${i} OR
        COALESCE(p.gender,'')         ILIKE $${i} OR
        COALESCE(p.blood_group,'')    ILIKE $${i} OR
        COALESCE(p.bloodgroup_rh,'')  ILIKE $${i} OR
        COALESCE(p.patients_type,'')  ILIKE $${i} OR
        COALESCE(p.disease,'')        ILIKE $${i} OR
        COALESCE(p.religion,'')       ILIKE $${i} OR
        COALESCE(p.phone_number,'')   ILIKE $${i} OR
        COALESCE(p.card_id,'')        ILIKE $${i}
      )`);
      vals.push(`%${q}%`);
      i++;
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderClause =
      (sortName === 'asc' || sortName === 'desc')
        ? `ORDER BY lower(p.first_name) ${sortName === 'desc' ? 'DESC' : 'ASC'},
                   lower(p.last_name)  ${sortName === 'desc' ? 'DESC' : 'ASC'}`
        : `ORDER BY p.admittion_date DESC NULLS LAST, p.patients_id DESC`;

    const sql = `
      SELECT
        p.patients_id, p.pname, p.first_name, p.last_name, p.gender,
        p.birthdate, p.patients_type, p.blood_group, p.bloodgroup_rh,
        p.disease, p.status, p.nationality, p.religion, p.admittion_date,
        p.phone_number AS phone,
        (p.patient_id_card     IS NOT NULL) AS has_patient_id_card,
        (p.house_registration  IS NOT NULL) AS has_house_registration,
        (p.patient_photo       IS NOT NULL) AS has_patient_photo,
        (p.relative_id_card    IS NOT NULL) AS has_relative_id_card,
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
  } catch (err) { next(err); }
}

// GET /api/patients/:id  (ไม่ดึง BYTEA ออกมา)
async function getOnePatient(req, res, next) {
  const patientId = toPatientsId(req.params.id);
  if (!patientId) return res.status(400).json({ message: 'กรุณาระบุเลขท้าย HN' });
  try {
    const r = await pool.query(
      `SELECT
         p.*, phone_number AS phone,
         (p.patient_id_card     IS NOT NULL) AS has_patient_id_card,
         (p.house_registration  IS NOT NULL) AS has_house_registration,
         (p.patient_photo       IS NOT NULL) AS has_patient_photo,
         (p.relative_id_card    IS NOT NULL) AS has_relative_id_card
       FROM patients p
       WHERE p.patients_id = $1
       LIMIT 1`,
      [patientId]
    );
    if (!r.rows.length) return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ป่วย' });
    const row = r.rows[0];
    FILE_FIELDS.forEach(f => { delete row[f]; });
    for (const f of FILE_FIELDS) {
      delete row[`${f}_mime`];
      delete row[`${f}_name`];
    }
    res.json({ ...row, hn: row.patients_id });
  } catch (err) { next(err); }
}

// GET /api/patients/:id/file/:field  (ดาวน์โหลดไฟล์แนบ)
async function downloadPatientFile(req, res, next) {
  try {
    const patientId = toPatientsId(req.params.id);
    const field = String(req.params.field || '');
    if (!patientId) return res.status(400).json({ message: 'รหัสผู้ป่วยไม่ถูกต้อง' });
    if (!FILE_FIELDS.includes(field)) return res.status(400).json({ message: 'ฟิลด์ไฟล์ไม่ถูกต้อง' });

    const r = await pool.query(
      `SELECT ${field} AS file, ${field}_mime AS mime, ${field}_name AS name
       FROM patients WHERE patients_id=$1 LIMIT 1`,
      [patientId]
    );
    const row = r.rows[0];
    if (!row || !row.file) return res.status(404).json({ message: 'ไม่พบไฟล์' });

    res.setHeader('Content-Type', row.mime || 'application/octet-stream');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');
    return res.send(row.file);
  } catch (e) { next(e); }
}

// POST /api/patients  (รองรับ multipart/form-data + ไฟล์)
async function createPatient(req, res, next) {
  try {
    const b = req.body || {};
    const pid = toPatientsId(b.patients_id || b.hn);
    if (!pid) return res.status(400).json({ message: 'ต้องระบุ patients_id หรือ hn' });

    const phone_number = b.phone_number ?? b.phone ?? null;

    const f = {
      patient_id_card:    fileFrom(req.files, 'patient_id_card'),
      house_registration: fileFrom(req.files, 'house_registration'),
      patient_photo:      fileFrom(req.files, 'patient_photo'),
      relative_id_card:   fileFrom(req.files, 'relative_id_card'),
    };

    const sql = `
      INSERT INTO patients (
        patients_id,
        pname, first_name, last_name, card_id, gender, address, birthdate, nationality,
        patients_type, blood_group, bloodgroup_rh, phone_number, height, weight, status,
        admittion_date, disease, religion,
        patient_id_card, patient_id_card_mime, patient_id_card_name,
        house_registration, house_registration_mime, house_registration_name,
        patient_photo, patient_photo_mime, patient_photo_name,
        relative_id_card, relative_id_card_mime, relative_id_card_name
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15,$16,
        COALESCE($17::date, CURRENT_DATE), $18, $19,
        $20,$21,$22,
        $23,$24,$25,
        $26,$27,$28,
        $29,$30,$31
      )
      RETURNING *, phone_number AS phone
    `;
    const params = [
      pid,
      b.pname, b.first_name, b.last_name, b.card_id, b.gender, b.address, b.birthdate, b.nationality,
      b.patients_type, b.blood_group, b.bloodgroup_rh, phone_number, b.height, b.weight, 'มีชีวิต',
      b.admittion_date, b.disease, b.religion,

      f.patient_id_card?.buffer || null,    f.patient_id_card?.mime || null,    f.patient_id_card?.name || null,
      f.house_registration?.buffer || null, f.house_registration?.mime || null, f.house_registration?.name || null,
      f.patient_photo?.buffer || null,      f.patient_photo?.mime || null,      f.patient_photo?.name || null,
      f.relative_id_card?.buffer || null,   f.relative_id_card?.mime || null,   f.relative_id_card?.name || null,
    ];

    const r = await pool.query(sql, params);
    const row = r.rows[0];
    FILE_FIELDS.forEach(ff => { delete row[ff]; });
    res.status(201).json({ ...row, hn: row.patients_id });
  } catch (err) { next(err); }
}

// PUT /api/patients/:id  (รองรับแก้ไข + อัปไฟล์/ลบไฟล์)
async function updatePatient(req, res, next) {
  const patientId = toPatientsId(req.params.id);
  if (!patientId) return res.status(400).json({ message: 'รหัสผู้ป่วยไม่ถูกต้อง' });

  try {
    const b = req.body || {};
    const phone_number = b.phone_number ?? b.phone ?? null;

    const sets = [];
    const vals = [];
    let i = 1;

    const updatable = [
      'pname','first_name','last_name','card_id','birthdate',
      'gender','nationality','weight','height',
      'patients_type','blood_group','bloodgroup_rh',
      'disease','address','admittion_date','religion',
    ];

    for (const key of updatable) {
      if (b[key] !== undefined) {
        sets.push(`${key} = $${i++}`);
        vals.push(b[key]);
      }
    }
    if (b.phone !== undefined || b.phone_number !== undefined) {
      sets.push(`phone_number = $${i++}`);
      vals.push(phone_number);
    }
    sets.push(`updated_at = NOW()`);

    const f = {
      patient_id_card:    fileFrom(req.files, 'patient_id_card'),
      house_registration: fileFrom(req.files, 'house_registration'),
      patient_photo:      fileFrom(req.files, 'patient_photo'),
      relative_id_card:   fileFrom(req.files, 'relative_id_card'),
    };

    for (const field of FILE_FIELDS) {
      if (f[field]) {
        sets.push(`${field} = $${i++}`);      vals.push(f[field].buffer);
        sets.push(`${field}_mime = $${i++}`); vals.push(f[field].mime || null);
        sets.push(`${field}_name = $${i++}`); vals.push(f[field].name || null);
      } else if (String(b[`clear_${field}`] || '') === '1') {
        sets.push(`${field} = NULL`);
        sets.push(`${field}_mime = NULL`);
        sets.push(`${field}_name = NULL`);
      }
    }

    if (!sets.length) return res.json({ message: 'ไม่มีข้อมูลที่ต้องอัปเดต' });

    const sql = `
      UPDATE patients
      SET ${sets.join(', ')}
      WHERE patients_id = $${i}
      RETURNING *, phone_number AS phone
    `;
    vals.push(patientId);

    const r = await pool.query(sql, vals);
    if (!r.rowCount) return res.status(404).json({ message: 'ไม่พบผู้ป่วย' });

    const row = r.rows[0];
    FILE_FIELDS.forEach(ff => { delete row[ff]; });
    res.json({ message: 'อัปเดตข้อมูลสำเร็จ', patient: { ...row, hn: row.patients_id } });
  } catch (e) { next(e); }
}

// PATCH /api/patients/:id/deceased
async function markDeceased(req, res, next) {
  const client = await pool.connect();
  try {
    const patientId = toPatientsId(req.params.id);
    if (!patientId) return res.status(400).json({ message: 'รหัสผู้ป่วยไม่ถูกต้อง' });

    const { death_date, death_time, death_cause, management } = req.body || {};
    if (!death_date || !death_time || !death_cause) {
      return res.status(400).json({ message: 'ต้องระบุ death_date, death_time, death_cause' });
    }

    await client.query('BEGIN');

    const pr = await client.query(
      `SELECT patients_id FROM patients WHERE patients_id=$1 FOR UPDATE`,
      [patientId]
    );
    if (!pr.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'ไม่พบผู้ป่วย' });
    }

    const { rows: updRows } = await client.query(
      `UPDATE patients
         SET status='เสียชีวิต',
             death_date=$2::date,
             death_time=$3::time,
             death_cause=$4,
             management=$5,
             updated_at=NOW()
       WHERE patients_id=$1
       RETURNING *`,
      [patientId, death_date, death_time, death_cause, management || null]
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
    const updated = updRows[0];
    return res.json({ message: 'บันทึกการเสียชีวิตสำเร็จ', patient: { ...updated, hn: updated.patients_id } });
  } catch (e) {
    // ✅ ต้อง rollback บน client ไม่ใช่ pool
    try { await client.query('ROLLBACK'); } catch {}
    next(e);
  } finally {
    client.release();
  }
}

/* ---- โหมดลืม HN: delegate ไป model (ต้องมีใน models/patients.model.js) ---- */
async function search(req, res, next) {
  try {
    const rows = await model.searchPatients(req.query);
    res.json({ data: rows });
  } catch (e) { next(e); }
}
async function recent(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit || 50,10), 200);
    const offset = parseInt(req.query.offset || 0,10);
    const rows = await model.listRecentPatients({ limit, offset });
    res.json({ data: rows });
  } catch (e) { next(e); }
}

/* ---- exports แบบเดียว ให้ router.require ไปได้แน่นอน ---- */
module.exports = {
  // middleware
  uploadPatientFiles,

  // controllers
  getNextPatientId,
  listPatients,
  getOnePatient,
  createPatient,
  updatePatient,
  downloadPatientFile,
  markDeceased,

  // lookup (ลืม HN)
  search,
  recent,
};
