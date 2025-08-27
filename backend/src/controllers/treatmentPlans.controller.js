// backend/src/controllers/treatmentPlans.controller.js
const db = require('../config/db');

// ... keep parseJSON as-is ...
function parseJSON(input, fallback) {
  if (input == null || input === '') return fallback;
  try {
    return (typeof input === 'string') ? JSON.parse(input) : input;
  } catch {
    return fallback;
  }
}

exports.create = async (req, res) => {
  const {
    patients_id, title, care_model, care_location,
    life_support, decision_makers, wishes,
  } = req.body;

  if (!patients_id) return res.status(400).json({ message: 'patients_id is required' });

  const lifeSupport    = parseJSON(life_support, []);
  const decisionMakers = parseJSON(decision_makers, []);
  const wishesObj      = parseJSON(wishes, {});

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // ตรวจ type คอลัมน์
    const lsJson   = await colIsJsonLike(client, 'treatment_plans', 'life_support');
    const dmJson   = await colIsJsonLike(client, 'treatment_plans', 'decision_makers');
    const wJson    = await colIsJsonLike(client, 'treatment_plans', 'wishes');

    const colLS = lsJson ? '$5::jsonb' : '$5';
    const colDM = dmJson ? '$6::jsonb' : '$6';
    const colW  = wJson  ? '$7::jsonb' : '$7';

    const insertPlanSQL = `
      INSERT INTO treatment_plans
        (patients_id, title, care_model, care_location, life_support, decision_makers, wishes)
      VALUES ($1, $2, $3, $4, ${colLS}, ${colDM}, ${colW})
      RETURNING plan_id
    `;
    const params = [
      patients_id,
      title || null,
      care_model || null,
      care_location || null,
      JSON.stringify(lifeSupport),
      JSON.stringify(decisionMakers),
      JSON.stringify(wishesObj),
    ];

    const plan = await client.query(insertPlanSQL, params);
    const planId = plan.rows[0].plan_id;

    // แนบไฟล์ (optional)
    for (const f of (req.files || [])) {
      await client.query(
        `INSERT INTO treatment_plan_files (plan_id, filename, mimetype, size, data)
         VALUES ($1, $2, $3, $4, $5)`,
        [planId, f.originalname, f.mimetype, f.size, f.buffer]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({ plan_id: planId, message: 'created' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('create treatment plan error:', err);

    // map error เด่นๆ ให้ user อ่านง่าย
    if (err.code === '22P02' || /invalid input syntax.*json/i.test(err.message))
      return res.status(400).json({ message: 'ส่ง JSON ไม่ถูกต้อง (life_support/decision_makers/wishes)' });
    if (err.code === '23503')
      return res.status(400).json({ message: 'patients_id ไม่พบในระบบผู้ป่วย (FK)' });

    return res.status(500).json({ message: 'create failed', error: err.message });
  } finally {
    client.release();
  }
};


exports.list = async (req, res) => {
  try {
    const q = await db.query(
      `SELECT plan_id, patients_id, title, care_model, care_location,
              life_support, decision_makers, wishes,
              created_at, updated_at
       FROM treatment_plans
       ORDER BY created_at DESC`
    );
    res.json({ data: q.rows });
  } catch (err) {
    console.error('list treatment plans error:', err);
    res.status(500).json({ message: 'list failed', error: err.message });
  }
};

exports.getOne = async (req, res) => {
  const { id } = req.params;
  try {
    // ✅ ใช้ชื่อคอลัมน์ให้ตรงสคีมา: plan_id (ไม่ใช่ id) และเอา note ออก
    const { rows } = await db.pool.query(`
      SELECT plan_id, patients_id, title, care_model, care_location,
             life_support, decision_makers, wishes,
             created_at, updated_at
      FROM treatment_plans
      WHERE plan_id = $1
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'not found' });
    }

    const plan = rows[0];

    // ✅ ถ้ามีตารางไฟล์แนบ (คอลัมน์ที่เราใช้ตอน insert คือ mimetype/size/data และ PK ชื่อ file_id)
    try {
      const filesRes = await db.pool.query(
        `SELECT file_id, filename, mimetype, size
           FROM treatment_plan_files
          WHERE plan_id = $1
          ORDER BY file_id`,
        [id]
      );
      plan.files = filesRes.rows;
    } catch {
      // ไม่มีตารางไฟล์ ก็ข้ามได้
      plan.files = [];
    }

    // ส่งกลับ
    return res.json({ data: plan });
  } catch (err) {
    console.error('getOne plan failed:', err);
    return res.status(500).json({ message: 'get failed', error: err.message });
  }
};

exports.update = async (req, res) => {
  const { id } = req.params;

  const {
    title,
    care_model,
    care_location,
    life_support,
    decision_makers,
    wishes,
  } = req.body;

  const lifeSupport    = parseJSON(life_support,    undefined);
  const decisionMakers = parseJSON(decision_makers, undefined);
  const wishesObj      = parseJSON(wishes,          undefined);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const sets = [];
    const values = [];
    let i = 1;
    const push = (sql, v) => { sets.push(sql.replace(/\?/g, `$${i++}`)); values.push(v); };

    if (title !== undefined)          push('title = ?', title || null);
    if (care_model !== undefined)     push('care_model = ?', care_model || null);
    if (care_location !== undefined)  push('care_location = ?', care_location || null);
    if (lifeSupport !== undefined)    push('life_support = ?::jsonb', JSON.stringify(lifeSupport));
    if (decisionMakers !== undefined) push('decision_makers = ?::jsonb', JSON.stringify(decisionMakers));
    if (wishesObj !== undefined)      push('wishes = ?::jsonb', JSON.stringify(wishesObj));

    if (sets.length > 0) {
      const sql = `UPDATE treatment_plans SET ${sets.join(', ')}, updated_at = NOW() WHERE plan_id = $${i}`;
      await client.query(sql, [...values, id]);
    }

    const files = (req.files || []);
    for (const f of files) {
      await client.query(
        `INSERT INTO treatment_plan_files (plan_id, filename, mimetype, size, data)
         VALUES ($1,$2,$3,$4,$5)`,
        [id, f.originalname, f.mimetype, f.size, f.buffer]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('update treatment plan error:', err);
    res.status(500).json({ message: 'update failed', error: err.message });
  } finally {
    client.release();
  }
};

exports.remove = async (req, res) => {
  const { id } = req.params;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM treatment_plan_files WHERE plan_id = $1', [id]);
    const r = await client.query('DELETE FROM treatment_plans WHERE plan_id = $1', [id]);
    await client.query('COMMIT');
    if (r.rowCount === 0) return res.status(404).json({ message: 'not found' });
    res.json({ message: 'deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('delete treatment plan error:', err);
    res.status(500).json({ message: 'delete failed', error: err.message });
  } finally {
    client.release();
  }
};

exports.downloadFile = async (req, res) => {
  const { id, fileId } = req.params;
  try {
    const r = await db.query(
      `SELECT filename, mimetype, size, data
         FROM treatment_plan_files
        WHERE plan_id = $1 AND file_id = $2`,
      [id, fileId]
    );
    if (r.rowCount === 0) return res.status(404).json({ message: 'file not found' });

    const f = r.rows[0];
    res.setHeader('Content-Type', f.mimetype || 'application/octet-stream');
    res.setHeader('Content-Length', f.size);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(f.filename)}"`);
    res.send(f.data);
  } catch (err) {
    console.error('download file error:', err);
    res.status(500).json({ message: 'download failed', error: err.message });
  }
};

exports.removeFile = async (req, res) => {
  const { id, fileId } = req.params;
  try {
    const r = await db.query(
      'DELETE FROM treatment_plan_files WHERE plan_id = $1 AND file_id = $2',
      [id, fileId]
    );
    if (r.rowCount === 0) return res.status(404).json({ message: 'file not found' });
    res.json({ message: 'file deleted' });
  } catch (err) {
    console.error('remove file error:', err);
    res.status(500).json({ message: 'delete file failed', error: err.message });
  }
};

async function colIsJsonLike(client, table, col) {
  const { rows } = await client.query(
    `SELECT data_type
       FROM information_schema.columns
      WHERE table_name = $1 AND column_name = $2`,
    [table, col]
  );
  const t = rows[0]?.data_type || '';
  return t.includes('json'); // 'json' หรือ 'jsonb'
}