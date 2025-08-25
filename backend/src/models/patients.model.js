// models/patients.model.js
const { pool } = require('../config/db');
const { normalizePatientsIdFromQuery } = require('../utils/helpers');

/** ฟิลด์ไฟล์ที่รองรับอัปโหลดในตาราง patients (BYTEA + mime + name) */
const FILE_FIELDS = [
  'patient_id_card',
  'house_registration',
  'patient_photo',
  'relative_id_card',
];

/** ตัวช่วยเล็ก ๆ */
const pick = (v) => (v === undefined ? undefined : v);

/* ==========================
 * Basic queries
 * ========================== */
exports.getLatestPatientId = async () => {
  const r = await pool.query(`
    SELECT patients_id
    FROM patients
    ORDER BY patients_id DESC
    LIMIT 1
  `);
  return r.rows[0]?.patients_id || null;
};

/* ==========================
 * List / Search
 * ========================== */
exports.listPatients = async (query) => {
  const page  = Math.max(parseInt(query.page, 10)  || 1, 1);
  const limit = Math.max(parseInt(query.limit, 10) || 20, 1);
  const offset = (page - 1) * limit;

  const patientId    = query.patient_id || query.patients_id || '';
  const gender       = query.gender || '';
  const patientsType = query.patients_type || '';
  const status       = query.status || '';
  const bloodGroup   = query.blood_group || '';
  const bloodgroupRh = query.bloodgroup_rh || '';
  const religion     = query.religion || '';
  const admitFrom    = query.admit_from || '';
  const admitTo      = query.admit_to || '';
  const q            = (query.q || '').trim();
  const sortName     = (query.sort_name || '').toLowerCase(); // asc | desc

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
      CONCAT(COALESCE(p.pname,''), COALESCE(p.first_name,''), ' ', COALESCE(p.last_name,'')) ILIKE $${i} OR
      COALESCE(p.gender,'')         ILIKE $${i} OR
      COALESCE(p.blood_group,'')    ILIKE $${i} OR
      COALESCE(p.bloodgroup_rh,'')  ILIKE $${i} OR
      COALESCE(p.patients_type,'')  ILIKE $${i} OR
      COALESCE(p.disease,'')        ILIKE $${i} OR
      COALESCE(p.religion,'')       ILIKE $${i}
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

  const valsForData  = [...vals, limit, offset];
  const valsForCount = [...vals];

  const dataSql = `
    SELECT
      p.patients_id, p.pname, p.first_name, p.last_name, p.gender,
      p.birthdate, p.phone_number, p.patients_type, p.blood_group, p.bloodgroup_rh,
      p.address, p.nationality, p.religion, p.disease,
      p.status, p.admittion_date,
      -- เฉพาะ flag ว่ามีไฟล์ไหม (ไม่ดึง BYTEA ออกมาเพื่อลด payload)
      (p.patient_id_card   IS NOT NULL) AS has_patient_id_card,
      (p.house_registration IS NOT NULL) AS has_house_registration,
      (p.patient_photo      IS NOT NULL) AS has_patient_photo,
      (p.relative_id_card   IS NOT NULL) AS has_relative_id_card
    FROM patients p
    ${whereClause}
    ${orderClause}
    LIMIT $${i++} OFFSET $${i++}
  `;

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM patients p
    ${whereClause}
  `;

  const [dataRes, countRes] = await Promise.all([
    pool.query(dataSql, valsForData),
    pool.query(countSql, valsForCount),
  ]);

  return {
    data: dataRes.rows,
    totalCount: countRes.rows[0].total,
    page,
    limit,
  };
};

/* ==========================
 * Get one (ไม่ดึงไฟล์ BYTEA)
 * ========================== */
exports.getPatientById = async (patients_id) => {
  const r = await pool.query(`
    SELECT
      p.patients_id, p.pname, p.first_name, p.last_name, p.gender,
      p.birthdate, p.phone_number, p.patients_type, p.blood_group, p.bloodgroup_rh,
      p.address, p.nationality, p.religion, p.disease,
      p.status, p.admittion_date, p.card_id, p.weight, p.height,
      p.death_date, p.death_time, p.death_cause, p.management,
      (p.patient_id_card   IS NOT NULL) AS has_patient_id_card,
      (p.house_registration IS NOT NULL) AS has_house_registration,
      (p.patient_photo      IS NOT NULL) AS has_patient_photo,
      (p.relative_id_card   IS NOT NULL) AS has_relative_id_card
    FROM patients p
    WHERE p.patients_id = $1
    LIMIT 1
  `, [patients_id]);
  return r.rows[0] || null;
};

/* ==========================
 * Create (รองรับไฟล์)
 * ========================== */
exports.createPatient = async (body, fileObjs = {}) => {
  const params = [
    pick(body.patients_id),
    pick(body.pname),
    pick(body.first_name),
    pick(body.last_name),
    pick(body.gender),
    pick(body.birthdate),
    pick(body.phone_number),
    pick(body.patients_type),
    pick(body.blood_group),
    pick(body.bloodgroup_rh),
    pick(body.address),
    pick(body.nationality),
    pick(body.religion),
    pick(body.disease),
    pick(body.status || 'มีชีวิต'),
    pick(body.admittion_date),
    pick(body.card_id),
    pick(body.weight),
    pick(body.height),

    // files + meta
    fileObjs.patient_id_card?.buffer || null,
    fileObjs.patient_id_card?.mime   || null,
    fileObjs.patient_id_card?.name   || null,

    fileObjs.house_registration?.buffer || null,
    fileObjs.house_registration?.mime   || null,
    fileObjs.house_registration?.name   || null,

    fileObjs.patient_photo?.buffer || null,
    fileObjs.patient_photo?.mime   || null,
    fileObjs.patient_photo?.name   || null,

    fileObjs.relative_id_card?.buffer || null,
    fileObjs.relative_id_card?.mime   || null,
    fileObjs.relative_id_card?.name   || null,
  ];

  const sql = `
    INSERT INTO patients (
      patients_id, pname, first_name, last_name, gender,
      birthdate, phone_number, patients_type, blood_group, bloodgroup_rh,
      address, nationality, religion, disease, status, admittion_date,
      card_id, weight, height,
      patient_id_card, patient_id_card_mime, patient_id_card_name,
      house_registration, house_registration_mime, house_registration_name,
      patient_photo, patient_photo_mime, patient_photo_name,
      relative_id_card, relative_id_card_mime, relative_id_card_name
    )
    VALUES (
      $1,$2,$3,$4,$5,
      $6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,
      $17,$18,$19,
      $20,$21,$22,
      $23,$24,$25,
      $26,$27,$28,
      $29,$30,$31
    )
    RETURNING patients_id
  `;
  const r = await pool.query(sql, params);
  return r.rows[0];
};

/* ==========================
 * Update (ฟิลด์ปกติ + ไฟล์/ลบไฟล์)
 * ========================== */
exports.updatePatient = async (patients_id, body = {}, fileObjs = {}) => {
  const sets = [];
  const vals = [];
  let i = 1;

  const updatable = [
    'pname','first_name','last_name','gender','birthdate',
    'phone_number','patients_type','blood_group','bloodgroup_rh',
    'address','nationality','religion','disease','status',
    'admittion_date','card_id','weight','height',
  ];

  for (const key of updatable) {
    if (body[key] !== undefined) {
      sets.push(`${key} = $${i++}`);
      vals.push(body[key]);
    }
  }

  // จัดการไฟล์: ส่งไฟล์ใหม่ => อัปเดต, ส่ง clear_FIELD="1" => ลบไฟล์
  for (const f of FILE_FIELDS) {
    if (fileObjs[f]) {
      sets.push(`${f} = $${i++}`);      vals.push(fileObjs[f].buffer);
      sets.push(`${f}_mime = $${i++}`); vals.push(fileObjs[f].mime || null);
      sets.push(`${f}_name = $${i++}`); vals.push(fileObjs[f].name || null);
    } else if (String(body[`clear_${f}`] || '') === '1') {
      sets.push(`${f} = NULL`);
      sets.push(`${f}_mime = NULL`);
      sets.push(`${f}_name = NULL`);
    }
  }

  if (!sets.length) return { patients_id }; // ไม่มีอะไรเปลี่ยน

  const sql = `
    UPDATE patients
    SET ${sets.join(', ')}
    WHERE patients_id = $${i}
    RETURNING patients_id
  `;
  vals.push(patients_id);

  const r = await pool.query(sql, vals);
  return r.rows[0] || { patients_id };
};

/* ==========================
 * Get file (สำหรับดาวน์โหลด/แสดงผล)
 * ========================== */
exports.getPatientFile = async (patients_id, field) => {
  if (!FILE_FIELDS.includes(field)) throw new Error('Invalid file field');
  const r = await pool.query(
    `
    SELECT ${field} AS file, ${field}_mime AS mime, ${field}_name AS name
    FROM patients
    WHERE patients_id = $1
    LIMIT 1
    `,
    [patients_id]
  );
  return r.rows[0] || null;
};

/* ==========================
 * Mark deceased (ใช้กับ PATCH /patients/:id/deceased)
 * ========================== */
exports.markDeceased = async (patients_id, { death_date, death_time, death_cause, management }) => {
  const r = await pool.query(
    `
    UPDATE patients
    SET status = 'เสียชีวิต',
        death_date = $1,
        death_time = $2,
        death_cause = $3,
        management = $4
    WHERE patients_id = $5
    RETURNING patients_id
    `,
    [death_date || null, death_time || null, death_cause || null, management || null, patients_id]
  );
  return r.rows[0] || { patients_id };
};
