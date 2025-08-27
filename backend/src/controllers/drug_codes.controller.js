// src/controllers/drug_codes.controller.js
const model = require('../models/drug_codes.model');
const asyncHandler = require('../middlewares/asyncHandler');

const toArrayOfString = (v) => {
  if (Array.isArray(v)) return v.map(x => String(x || '').trim()).filter(Boolean);
  if (v == null || v === '') return [];
  // รองรับส่งมาเป็นสตริงคั่นด้วยจุลภาค
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
};

const search = asyncHandler(async (req, res) => {
  let q = req.query.q ?? '';
  let code_24 = req.query.code_24 ?? '';
  let limit = Number(req.query.limit ?? 20);

  q = String(q).trim();
  code_24 = String(code_24).trim();
  if (!Number.isFinite(limit) || limit <= 0 || limit > 100) limit = 20;

  // ถ้า q เป็นตัวเลข 24 หลัก และยังไม่ได้ส่ง code_24 มา → ใช้ q เป็น code_24
  if (!code_24 && /^\d{24}$/.test(q)) code_24 = q;

  const items = await model.search({ q, code_24, limit });
  res.json({ data: items });
});

const getOne = asyncHandler(async (req, res) => {
  const row = await model.getById(req.params.id);
  if (!row) return res.status(404).json({ message: 'Not found' });
  res.json(row);
});

const create = asyncHandler(async (req, res) => {
  const {
    code_24 = null,
    generic_name,
    synonyms = [],
    atc_code = null,
    note = null,
  } = req.body || {};

  if (!generic_name || !String(generic_name).trim()) {
    return res.status(400).json({ message: 'generic_name is required' });
  }
  if (code_24 && !/^\d{24}$/.test(String(code_24))) {
    return res.status(400).json({ message: 'code_24 must be 24 digits' });
  }

  const row = await model.create({
    code_24: code_24 ? String(code_24) : null,
    generic_name: String(generic_name).trim(),
    synonyms: toArrayOfString(synonyms),
    atc_code: atc_code ? String(atc_code).trim() : null,
    note: note ? String(note).trim() : null,
  });

  res.status(201).json(row);
});

module.exports = { search, getOne, create };
