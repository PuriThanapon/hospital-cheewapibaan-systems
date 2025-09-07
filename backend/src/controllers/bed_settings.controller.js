// src/controllers/bed_settings.controller.js
const { pool } = require('../config/db');
const beds = require('../models/beds.model');

const STAYS_TABLE    = process.env.STAYS_TABLE    || 'bed_stays';
const SETTINGS_TABLE = process.env.SETTINGS_TABLE || 'settings'; // ปรับเป็น 'public.settings' ถ้าคุณระบุสคีมาไว้ชัด

function normCode(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

/** อ่านเมตาประเภทจากตาราง settings; ถ้าไม่มีแถว -> คืน {types:[]} */
async function readTypesMeta() {
  const { rows } = await pool.query(
    `SELECT value FROM ${SETTINGS_TABLE} WHERE key=$1`,
    ['bed_types_meta']
  );
  const val = rows[0]?.value;
  return val && Array.isArray(val.types) ? val : { types: [], updated_at: null };
}

/** บันทึกเมตาประเภท (upsert) */
async function saveTypesMeta(payload) {
  const value = { ...payload, updated_at: new Date().toISOString() };
  await pool.query(
    `INSERT INTO ${SETTINGS_TABLE}(key,value)
     VALUES ($1,$2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    ['bed_types_meta', JSON.stringify(value)]
  );
}

/** GET /api/bed-settings/summary */
exports.getSummary = async (req, res, next) => {
  try {
    const [counts, busy, meta] = await Promise.all([
      beds.countByCareSide(),                 // [{care_side, active_count, retired_count}]
      beds.busyCountByCareSide(STAYS_TABLE),  // [{care_side, busy_count}]
      readTypesMeta(),                        // {types:[{code,name_th,code_prefix,color,sort_order}]}
    ]);

    const countMap = Object.fromEntries(
      counts.map(r => [r.care_side, { active: r.active_count, retired: r.retired_count }])
    );
    const busyMap  = Object.fromEntries(busy.map(r => [r.care_side, r.busy_count]));

    const configured = new Set((meta.types || []).map(t => t.code));
    const codes = new Set([...Object.keys(countMap), ...configured]);

    const summary = Array.from(codes).map(code => {
      const t = (meta.types || []).find(x => x.code === code);
      const c = countMap[code] || { active: 0, retired: 0 };
      const b = busyMap[code]  || 0;
      const free = Math.max(0, c.active - b);
      return {
        type: {
          code,
          name_th:   t?.name_th    || code,
          prefix:    t?.code_prefix|| code,
          color:     t?.color      || null,
          sort_order: Number.isFinite(t?.sort_order) ? Number(t.sort_order) : 0,
        },
        counts: { active: c.active, busy: b, free, retired: c.retired },
      };
    }).sort((a,b) =>
      (a.type.sort_order ?? 0) - (b.type.sort_order ?? 0) ||
      a.type.code.localeCompare(b.type.code)
    );

    res.json({ ok: true, summary });
  } catch (err) { next(err); }
};

/** POST /api/bed-settings/types  { code, name_th, code_prefix, color?, sort_order? } */
exports.upsertType = async (req, res, next) => {
  try {
    const code        = normCode(req.body?.code);
    const name_th     = String(req.body?.name_th || '').trim();
    const code_prefix = normCode(req.body?.code_prefix || code);
    const color       = req.body?.color ?? null;
    const sort_order  = Number.isFinite(+req.body?.sort_order) ? +req.body.sort_order : 0;

    if (!code || !name_th || !code_prefix) {
      return res.status(400).json({ ok:false, message:'ต้องระบุ code, name_th, code_prefix' });
    }

    const meta  = await readTypesMeta();
    const types = Array.isArray(meta.types) ? [...meta.types] : [];
    const idx   = types.findIndex(t => t.code === code);
    const item  = { code, name_th, code_prefix, color, sort_order };
    if (idx >= 0) types[idx] = item; else types.push(item);

    await saveTypesMeta({ types });
    res.json({ ok:true, type:item });
  } catch (err) { next(err); }
};

/** DELETE /api/bed-settings/types/:code */
exports.removeType = async (req, res, next) => {
  try {
    const code = normCode(req.params.code);
    const meta = await readTypesMeta();
    const types = (meta.types || []).filter(t => t.code !== code);
    await saveTypesMeta({ types });
    res.json({ ok:true });
  } catch (err) { next(err); }
};

/** POST /api/bed-settings/types/:code/reconcile  { target, ward_id? } */
exports.reconcileOne = async (req, res, next) => {
  try {
    const code    = normCode(req.params.code);
    const target  = Number(req.body?.target);
    const ward_id = req.body?.ward_id == null ? null : Number(req.body.ward_id);

    if (!Number.isFinite(target) || target < 0) {
      return res.status(400).json({ ok:false, message:'target ต้องเป็นตัวเลข >= 0' });
    }

    const meta   = await readTypesMeta();
    const t      = (meta.types || []).find(x => x.code === code);
    const prefix = normCode(t?.code_prefix || code);

    const result = await beds.ensureBedCountCareSide(code, prefix, target, STAYS_TABLE, ward_id);
    res.json({ ok:true, result });
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ ok:false, message: err.message });
    next(err);
  }
};

/** POST /api/bed-settings/reconcile  { targets: [{code,target,ward_id?}, ...] } */
exports.reconcileBulk = async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.targets) ? req.body.targets : [];
    if (!items.length) {
      return res.status(400).json({ ok:false, message:'ต้องส่ง targets เป็น array' });
    }

    const meta = await readTypesMeta();
    const out  = [];

    for (const it of items) {
      const code    = normCode(it.code);
      const target  = Math.max(0, Number(it.target) || 0);
      const ward_id = it.ward_id == null ? null : Number(it.ward_id);
      const prefix  = normCode((meta.types || []).find(x => x.code === code)?.code_prefix || code);

      try {
        const r = await beds.ensureBedCountCareSide(code, prefix, target, STAYS_TABLE, ward_id);
        out.push({ code, ok:true, result:r });
      } catch (e) {
        out.push({ code, ok:false, message: e?.message || 'reconcile failed' });
      }
    }

    res.json({ ok:true, results: out });
  } catch (err) { next(err); }
};
