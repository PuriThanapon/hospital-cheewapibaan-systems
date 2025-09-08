// controllers/templates.controller.js
const { pool } = require('../config/db');
const multer = require('multer');
const { signUrl, uploadFile } = require('../integrations/supabase');
// ถ้าจะใช้ Google Drive ด้วย ให้ uncomment บรรทัดล่างและเตรียมไฟล์ integration:
// const { getMeta, streamPreview, streamDownload } = require('../integrations/googleDrive');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
exports.uploadTemplateFile = upload.single('file');

/** GET /api/templates?query=&category= */
exports.listTemplates = async (req, res, next) => {
  try {
    const q = (req.query.query || '').toString().trim();
    const cat = (req.query.category || '').toString().trim();

    const where = [];
    const vals = [];
    let i = 1;

    if (q)   { where.push(`(title ILIKE $${i} OR COALESCE(description,'') ILIKE $${i})`); vals.push(`%${q}%`); i++; }
    if (cat) { where.push(`category = $${i++}`); vals.push(cat); }

    const sql = `
      SELECT id, title, category, description, mime, filename,
             storage, sb_bucket, sb_path, drive_file_id,
             created_at, updated_at
      FROM template_docs
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
    `;
    const { rows } = await pool.query(sql, vals);
    res.json({ data: rows });
  } catch (e) { next(e); }
};

/** GET /api/templates/:id */
exports.getOneTemplate = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `SELECT id, title, category, description, mime, filename,
              storage, sb_bucket, sb_path, drive_file_id,
              created_at, updated_at
       FROM template_docs WHERE id = $1 LIMIT 1`, [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'ไม่พบเอกสารแม่แบบ' });
    res.json(rows[0]);
  } catch (e) { next(e); }
};

/** ---------- Helpers ---------- */
function extFrom(row) {
  if (row.filename && /\./.test(row.filename)) {
    const ext = row.filename.split('.').pop();
    if (ext) return `.${ext.toLowerCase()}`;
  }
  const map = {
    'application/pdf': '.pdf',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
  };
  return map[row.mime] || '';
}
function safeBaseName(name) {
  return String(name || 'template').replace(/[\/\\:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 150);
}
function asciiFallback(s) { return String(s).replace(/[^\x20-\x7E]/g, '_'); }

// Normalize + validation สำหรับ Supabase
function normalizeSbPath(p) {
  const s = String(p || '').trim().replace(/^\/+/, '');
  if (!s) throw new Error('invalid sb_path');
  return s;
}
function normalizeBucket(b) {
  const s = String(b || '').trim();
  if (!s) throw new Error('invalid sb_bucket');
  return s;
}
function storageIs(v, name) {
  return String(v || '').toLowerCase() === name;
}
function assertStorage(v) {
  const s = String(v || '').toLowerCase();
  if (!s) return null;
  if (!['db', 'supabase', 'drive'].includes(s)) throw new Error('invalid storage');
  return s;
}

/** GET /api/templates/:id/file?download=1  */
exports.downloadTemplateFile = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'invalid id' });

    const { rows } = await pool.query(
      `SELECT title, file, mime, filename, storage, sb_bucket, sb_path, drive_file_id
       FROM template_docs WHERE id=$1 LIMIT 1`, [id]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: 'ไม่พบไฟล์' });

    const isDownload = String(req.query.download || '') === '1';
    const base = safeBaseName(row.title || 'template');
    const ext  = extFrom(row) || '';
    const finalName = base + ext;

    // 1) Supabase Storage
    if (row.storage === 'supabase') {
      if (!row.sb_bucket || !row.sb_path) return res.status(500).json({ message: 'invalid supabase mapping' });
      try {
        const url = await signUrl(row.sb_bucket, row.sb_path, {
          expiresSec: 300,
          downloadName: isDownload ? finalName : undefined, // preview = inline, download = แนบชื่อ
        });
        return res.redirect(302, url);
      } catch (err) {
        console.error('Supabase signUrl error:', err);
        return res.status(502).json({ message: 'supabase_error' });
      }
    }

    // 2) Google Drive (ถ้าเปิดใช้)
    // if (row.storage === 'drive') {
    //   try {
    //     const meta = await getMeta(row.drive_file_id);
    //     return isDownload ? streamDownload(res, meta) : streamPreview(res, meta);
    //   } catch (err) {
    //     console.error('Drive error:', err);
    //     return res.status(502).json({ message: 'drive_error' });
    //   }
    // }

    // 3) เก็บใน DB ตามเดิม
    if (!row.file) return res.status(404).json({ message: 'ไม่พบไฟล์' });
    const mime = row.mime || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename="${asciiFallback(finalName)}"; filename*=UTF-8''${encodeURIComponent(finalName)}`
    );
    return res.send(row.file);
  } catch (e) { next(e); }
};

/** POST /api/templates
 * โหมดที่รองรับ:
 *  - DB (เดิม): multipart (title, category?, description?, file)
 *  - Supabase (ประกาศ mapping): JSON { title, storage:'supabase', sb_bucket, sb_path, mime? }
 *  - Supabase (อัปโหลดขึ้น storage ผ่าน API): multipart + storage='supabase' [+ sb_bucket?, sb_path?]
 *  - (ออปชัน) Drive: JSON { title, storage:'drive', drive_file_id }
 */
exports.createTemplate = async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.title) return res.status(400).json({ message: 'ต้องระบุชื่อเอกสาร (title)' });

    // validate storage (ถ้ามีส่งมา)
    try { assertStorage(b.storage); } catch (err) { return res.status(400).json({ message: err.message }); }

    // Supabase (ประกาศ mapping โดยไม่อัปโหลด)
    if ((assertStorage(b.storage) === 'supabase' || (b.sb_bucket && b.sb_path)) && !req.file) {
      try {
        const bucket = normalizeBucket(b.sb_bucket || process.env.SUPABASE_BUCKET_TEMPLATES);
        const path   = normalizeSbPath(b.sb_path);
        const sql = `
          INSERT INTO template_docs (title, category, description, storage, sb_bucket, sb_path, mime)
          VALUES ($1,$2,$3,'supabase',$4,$5,$6)
          RETURNING id, title, category, description, mime, filename, storage, sb_bucket, sb_path, created_at, updated_at
        `;
        const params = [b.title, b.category || null, b.description || null, bucket, path, b.mime || 'application/pdf'];
        const { rows } = await pool.query(sql, params);
        return res.status(201).json(rows[0]);
      } catch (err) {
        return next(err);
      }
    }

    // Supabase (อัปโหลด)
    if (req.file && storageIs(b.storage, 'supabase')) {
      try {
        const bucket = normalizeBucket(b.sb_bucket || process.env.SUPABASE_BUCKET_TEMPLATES || 'templates');
        const rawGen = b.sb_path && b.sb_path.trim()
          ? b.sb_path
          : `core/${Date.now()}-${(req.file.originalname || 'file').replace(/\s+/g,'_')}`;
        const path = normalizeSbPath(rawGen);

        await uploadFile(bucket, path, req.file.buffer, req.file.mimetype, { upsert: true });

        const { rows } = await pool.query(
          `INSERT INTO template_docs (title, category, description, storage, sb_bucket, sb_path, mime, filename)
           VALUES ($1,$2,$3,'supabase',$4,$5,$6,$7)
           RETURNING id, title, category, description, mime, filename, storage, sb_bucket, sb_path, created_at, updated_at`,
          [b.title, b.category || null, b.description || null, bucket, path, req.file.mimetype, req.file.originalname]
        );
        return res.status(201).json(rows[0]);
      } catch (err) {
        return next(err);
      }
    }

    // (ออปชัน) Drive mapping
    // if ((assertStorage(b.storage) === 'drive' || b.drive_file_id) && !req.file) {
    //   if (!b.drive_file_id) return res.status(400).json({ message: 'ต้องระบุ drive_file_id' });
    //   const sql = `
    //     INSERT INTO template_docs (title, category, description, storage, drive_file_id, mime)
    //     VALUES ($1,$2,$3,'drive',$4,'application/pdf')
    //     RETURNING id, title, category, description, mime, filename, storage, drive_file_id, created_at, updated_at
    //   `;
    //   const params = [b.title, b.category || null, b.description || null, b.drive_file_id.trim()];
    //   const { rows } = await pool.query(sql, params);
    //   return res.status(201).json(rows[0]);
    // }

    // DB (เดิม)
    const f = req.file;
    if (!f) return res.status(400).json({ message: 'ต้องแนบไฟล์ (file)' });
    const { rows } = await pool.query(
      `INSERT INTO template_docs (title, category, description, file, mime, filename, storage)
       VALUES ($1,$2,$3,$4,$5,$6,'db')
       RETURNING id, title, category, description, mime, filename, storage, created_at, updated_at`,
      [b.title, b.category || null, b.description || null, f.buffer, f.mimetype, f.originalname]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
};

/** PUT /api/templates/:id
 * - แก้ metadata
 * - อัปไฟล์ใหม่ (DB) หรืออัป Supabase แล้วชี้ path ใหม่
 * - สลับ storage ระหว่าง db/supabase/(drive)
 */
exports.updateTemplate = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    const f = req.file;

    const sets = [];
    const vals = [];
    let i = 1;

    if (b.title !== undefined)       { sets.push(`title=$${i++}`);       vals.push(b.title); }
    if (b.category !== undefined)    { sets.push(`category=$${i++}`);    vals.push(b.category || null); }
    if (b.description !== undefined) { sets.push(`description=$${i++}`); vals.push(b.description || null); }

    // อัปไฟล์ใหม่ → เก็บใน DB
    if (f && (!b.storage || storageIs(b.storage, 'db'))) {
      sets.push(`storage='db'`);
      sets.push(`sb_bucket=NULL, sb_path=NULL, drive_file_id=NULL`);
      sets.push(`file=$${i++}`);     vals.push(f.buffer);
      sets.push(`mime=$${i++}`);     vals.push(f.mimetype || null);
      sets.push(`filename=$${i++}`); vals.push(f.originalname || null);
    }

    // สลับเป็น Supabase (mapping หรืออัปโหลดแล้ว)
    if (storageIs(b.storage, 'supabase') || b.sb_bucket || b.sb_path) {
      const bucketEnv = process.env.SUPABASE_BUCKET_TEMPLATES || null;

      if (f) {
        // มีไฟล์แนบมาด้วย → อัปโหลดขึ้น Supabase แล้วจด path ใหม่
        const bucket = normalizeBucket(b.sb_bucket || bucketEnv || 'templates');
        const rawGen = b.sb_path && b.sb_path.trim()
          ? b.sb_path
          : `core/${Date.now()}-${(f.originalname || 'file').replace(/\s+/g,'_')}`;
        const genPath = normalizeSbPath(rawGen);

        await uploadFile(bucket, genPath, f.buffer, f.mimetype, { upsert: true });
        sets.push(`storage='supabase'`);
        sets.push(`sb_bucket=$${i++}`); vals.push(bucket);
        sets.push(`sb_path=$${i++}`);   vals.push(genPath);
        sets.push(`file=NULL, mime=$${i++}, filename=$${i++}`); vals.push(f.mimetype || null, f.originalname || null);
        sets.push(`drive_file_id=NULL`);
      } else {
        // mapping อย่างเดียว
        const bucket = normalizeBucket(b.sb_bucket || bucketEnv);
        const path   = normalizeSbPath(b.sb_path);
        sets.push(`storage='supabase'`);
        sets.push(`sb_bucket=$${i++}`); vals.push(bucket);
        sets.push(`sb_path=$${i++}`);   vals.push(path);
        if (b.mime !== undefined)     { sets.push(`mime=$${i++}`);     vals.push(b.mime || null); }
        if (b.filename !== undefined) { sets.push(`filename=$${i++}`); vals.push(b.filename || null); }
        sets.push(`file=NULL, drive_file_id=NULL`);
      }
    }

    // (ออปชัน) สลับเป็น Drive
    // if (storageIs(b.storage, 'drive') || b.drive_file_id) {
    //   if (!b.drive_file_id) return res.status(400).json({ message: 'ต้องระบุ drive_file_id เมื่อ storage=drive' });
    //   sets.push(`storage='drive'`);
    //   sets.push(`drive_file_id=$${i++}`); vals.push(b.drive_file_id.trim());
    //   sets.push(`file=NULL, mime='application/pdf', filename=NULL, sb_bucket=NULL, sb_path=NULL`);
    // }

    sets.push(`updated_at=NOW()`);
    if (!sets.length) return res.json({ message: 'ไม่มีข้อมูลที่ต้องอัปเดต' });

    const sql = `UPDATE template_docs SET ${sets.join(', ')} WHERE id=$${i} RETURNING id`;
    vals.push(id);

    const r = await pool.query(sql, vals);
    if (!r.rowCount) return res.status(404).json({ message: 'ไม่พบเอกสารแม่แบบ' });
    res.json({ message: 'อัปเดตแล้ว', id });
  } catch (e) { next(e); }
};

/** DELETE /api/templates/:id */
exports.deleteTemplate = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const r = await pool.query(`DELETE FROM template_docs WHERE id=$1`, [id]);
    if (!r.rowCount) return res.status(404).json({ message: 'ไม่พบเอกสารแม่แบบ' });
    res.status(204).end();
  } catch (e) { next(e); }
};
