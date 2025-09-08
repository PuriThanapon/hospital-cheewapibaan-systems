// controllers/templates.controller.js
const { pool } = require('../config/db');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });
exports.uploadTemplateFile = upload.single('file');

/** GET /api/templates?query=&category= */
exports.listTemplates = async (req, res, next) => {
  try {
    const q = (req.query.query || '').trim();
    const cat = (req.query.category || '').trim();

    const where = [];
    const vals = [];
    let i = 1;

    if (q)   { where.push(`(title ILIKE $${i} OR COALESCE(description,'') ILIKE $${i})`); vals.push(`%${q}%`); i++; }
    if (cat) { where.push(`category = $${i++}`); vals.push(cat); }

    const sql = `
      SELECT id, title, category, description, mime, filename, created_at, updated_at
      FROM template_docs
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY updated_at DESC, id DESC
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
      `SELECT id, title, category, description, mime, filename, created_at, updated_at
       FROM template_docs WHERE id = $1 LIMIT 1`, [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'ไม่พบเอกสารแม่แบบ' });
    res.json(rows[0]);
  } catch (e) { next(e); }
};

/** GET /api/templates/:id/file  (พรีวิว/ดาวน์โหลด)  */
function extFrom(row) {
  // จากชื่อไฟล์เดิม
  if (row.filename && /\./.test(row.filename)) {
    const ext = row.filename.split('.').pop();
    if (ext) return `.${ext.toLowerCase()}`;
  }
  // จาก MIME
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

// helper: ทำให้ชื่อไฟล์ปลอดภัย (Windows-safe)
function safeBaseName(name) {
  return String(name || 'template')
    .replace(/[\/\\:*?"<>|]+/g, '_')   // อักขระต้องห้ามในไฟล์เนม
    .replace(/\s+/g, ' ')              // ช่องว่างซ้ำ
    .trim()
    .slice(0, 150);                    // กันยาวเกิน
}

// GET /api/templates/:id/file?download=1
exports.downloadTemplateFile = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'invalid id' });

    const { rows } = await pool.query(
      `SELECT title, file, mime, filename FROM template_docs WHERE id=$1 LIMIT 1`, [id]
    );
    const row = rows[0];
    if (!row || !row.file) return res.status(404).json({ message: 'ไม่พบไฟล์' });

    // base name ใช้ filename เดิม (ตัดนามสกุล) ถ้าไม่มีค่อยใช้ title
    const base =
      (row.filename ? row.filename.replace(/\.[^/.]+$/, '') : null) ||
      safeBaseName(row.title || 'template');

    const ext = extFrom(row) || '';
    const finalName = safeBaseName(base) + ext;

    const mime = row.mime || 'application/octet-stream';
    const isDownload = String(req.query.download || '') === '1';

    // ✅ ใส่ทั้ง filename (ASCII fallback) และ filename* (UTF-8)
    const ascii = asciiFallback(finalName);
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(finalName)}`
    );

    return res.send(row.file);
  } catch (e) { next(e); }
};

/** POST /api/templates  (multipart/form-data: fields=title,category,description,file) */
exports.createTemplate = async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.title) return res.status(400).json({ message: 'ต้องระบุชื่อเอกสาร (title)' });

    const f = req.file;
    if (!f) return res.status(400).json({ message: 'ต้องแนบไฟล์ (file)' });

    const { rows } = await pool.query(
      `INSERT INTO template_docs (title, category, description, file, mime, filename)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, title, category, description, mime, filename, created_at, updated_at`,
      [b.title, b.category || null, b.description || null, f.buffer, f.mimetype, f.originalname]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
};

/** PUT /api/templates/:id  (แก้ไข metadata + อัปไฟล์ใหม่ได้) */
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

    if (f) {
      sets.push(`file=$${i++}`);     vals.push(f.buffer);
      sets.push(`mime=$${i++}`);     vals.push(f.mimetype || null);
      sets.push(`filename=$${i++}`); vals.push(f.originalname || null);
    }
    sets.push(`updated_at=NOW()`);

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

function asciiFallback(s) {
  return String(s).replace(/[^\x20-\x7E]/g, '_');
}

// GET /api/templates/:id/file?download=1
exports.downloadTemplateFile = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'invalid id' });

    const { rows } = await pool.query(
      `SELECT title, file, mime, filename FROM template_docs WHERE id=$1 LIMIT 1`, [id]
    );
    const row = rows[0];
    if (!row || !row.file) return res.status(404).json({ message: 'ไม่พบไฟล์' });

    // ✅ ใช้ title เป็นชื่อไฟล์เสมอ
    const base = safeBaseName(row.title || 'template');

    // นามสกุลไฟล์เดาได้จาก filename เดิม หรือ mime
    const ext = extFrom(row) || '';
    const finalName = base + ext;

    const mime = row.mime || 'application/octet-stream';
    const isDownload = String(req.query.download || '') === '1';

    // ใส่ทั้ง ASCII fallback และ UTF-8
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename="${asciiFallback(finalName)}"; filename*=UTF-8''${encodeURIComponent(finalName)}`
    );
    // (ถ้าทดสอบแล้วเบราว์เซอร์ยังแคชชื่อเดิม ให้เสริม)
    // res.setHeader('Cache-Control', 'no-store');

    return res.send(row.file);
  } catch (e) { next(e); }
};
