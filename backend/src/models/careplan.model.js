const pool = require('../config/db');

/** ===================== Helpers ===================== **/
function buildWhere(filters, params) {
  const conds = ["cp.status <> 'deleted'"]; // ซ่อนที่ลบแบบ soft
  if (filters.status && filters.status !== 'all') {
    params.push(filters.status);
    conds.push(`cp.status = $${params.length}`);
  }
  if (filters.patient_id) {
    params.push(filters.patient_id);
    conds.push(`cp.patients_id = $${params.length}`);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    conds.push(`
      (
        cp.problem ILIKE $${params.length} OR
        cp.goal ILIKE $${params.length} OR
        cp.intervention ILIKE $${params.length} OR
        p.first_name ILIKE $${params.length} OR
        p.last_name ILIKE $${params.length} OR
        p.pname ILIKE $${params.length} OR
        cp.patients_id ILIKE $${params.length}
      )
    `);
  }
  return conds.length ? `WHERE ${conds.join(' AND ')}` : '';
}

/** ===================== Care Plans ===================== **/

// ดึง Care Plans (รองรับแบ่งหน้า + filter)
exports.listCarePlans = async (opts = {}) => {
  const page = Math.max(parseInt(opts.page ?? 1, 10), 1);
  const limit = Math.max(parseInt(opts.limit ?? 20, 10), 1);
  const offset = (page - 1) * limit;

  const params = [];
  const where = buildWhere(
    { status: opts.status, patient_id: opts.patient_id, q: opts.q },
    params
  );

  const orderBy =
    ['start_date', 'end_date', 'status', 'plan_id'].includes(opts.orderBy) ?
      opts.orderBy : 'start_date';
  const order = (String(opts.order || 'desc').toLowerCase() === 'asc') ? 'ASC' : 'DESC';

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM care_plans cp
    JOIN patients p ON cp.patients_id = p.patients_id
    ${where}
  `;
  const dataSql = `
    SELECT cp.*, p.pname, p.first_name, p.last_name, p.diagnosis
    FROM care_plans cp
    JOIN patients p ON cp.patients_id = p.patients_id
    ${where}
    ORDER BY cp.${orderBy} ${order}
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [{ rows: countRows }, { rows }] = await Promise.all([
    pool.query(countSql, params),
    pool.query(dataSql, params),
  ]);

  const total = countRows[0]?.total ?? 0;
  return {
    items: rows,
    meta: { page, limit, total, pages: Math.ceil(total / limit) }
  };
};

// ดึง Care Plan ตาม id
exports.getCarePlanById = async (id) => {
  const sql = `
    SELECT cp.*, p.pname, p.first_name, p.last_name, p.diagnosis
    FROM care_plans cp
    JOIN patients p ON cp.patients_id = p.patients_id
    WHERE cp.plan_id = $1
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
};

// เพิ่ม Care Plan
exports.createCarePlan = async (data) => {
  const { patients_id, problem, goal, intervention, responsible, end_date } = data;
  const sql = `
    INSERT INTO care_plans 
      (patients_id, problem, goal, intervention, responsible, end_date) 
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING *
  `;
  const { rows } = await pool.query(sql, [
    patients_id, problem, goal, intervention, responsible, end_date || null
  ]);
  return rows[0];
};

// อัปเดต Care Plan (partial update)
exports.updateCarePlan = async (id, data) => {
  const allowed = ['problem','goal','intervention','responsible','end_date','status'];
  const set = [];
  const params = [];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      params.push(data[key]);
      set.push(`${key} = $${params.length}`);
    }
  }
  if (!set.length) return await this.getCarePlanById(id); // ไม่มีอะไรอัปเดต

  params.push(id);
  const sql = `
    UPDATE care_plans
    SET ${set.join(', ')}
    WHERE plan_id = $${params.length}
    RETURNING *
  `;
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
};

// ลบ Care Plan (soft หรือ hard)
exports.deleteCarePlan = async (id, { hard = false } = {}) => {
  if (hard) {
    const sql = `DELETE FROM care_plans WHERE plan_id=$1 RETURNING *`;
    const { rows } = await pool.query(sql, [id]);
    return rows[0] || null;
  } else {
    const sql = `
      UPDATE care_plans 
      SET status='deleted'
      WHERE plan_id=$1
      RETURNING *
    `;
    const { rows } = await pool.query(sql, [id]);
    return rows[0] || null;
  }
};

/** ===================== Progress ===================== **/

// ดึง Progress ทั้งหมดของ Care Plan
exports.listProgress = async (planId) => {
  const sql = `
    SELECT pr.*, cp.problem, cp.goal
    FROM care_plan_progress pr
    JOIN care_plans cp ON pr.plan_id = cp.plan_id
    WHERE pr.plan_id=$1
    ORDER BY pr.created_at DESC
  `;
  const { rows } = await pool.query(sql, [planId]);
  return rows;
};

// เพิ่ม Progress
exports.addProgress = async (planId, data) => {
  const { note, progress_percent } = data;
  const sql = `
    INSERT INTO care_plan_progress (plan_id, note, progress_percent)
    VALUES ($1,$2,$3) RETURNING *
  `;
  const { rows } = await pool.query(sql, [planId, note ?? '', progress_percent ?? 0]);
  return rows[0];
};

// อัปเดต Progress
exports.updateProgress = async (planId, progressId, data) => {
  const allowed = ['note','progress_percent'];
  const set = [];
  const params = [];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      params.push(data[key]);
      set.push(`${key} = $${params.length}`);
    }
  }
  if (!set.length) {
    const { rows } = await pool.query(
      `SELECT * FROM care_plan_progress WHERE progress_id=$1 AND plan_id=$2`,
      [progressId, planId]
    );
    return rows[0] || null;
  }
  params.push(progressId, planId);
  const sql = `
    UPDATE care_plan_progress
    SET ${set.join(', ')}
    WHERE progress_id=$${params.length-1} AND plan_id=$${params.length}
    RETURNING *
  `;
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
};

// ลบ Progress
exports.deleteProgress = async (planId, progressId) => {
  const sql = `
    DELETE FROM care_plan_progress 
    WHERE progress_id=$1 AND plan_id=$2
    RETURNING *
  `;
  const { rows } = await pool.query(sql, [progressId, planId]);
  return rows[0] || null;
};
