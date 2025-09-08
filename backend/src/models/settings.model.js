// src/models/settings.model.js
const fs = require('fs/promises');
const path = require('path');

const DATA_DIR   = path.join(__dirname, '..', '..', 'data');
const FILE_FORM  = path.join(DATA_DIR, 'patient-form.settings.json');
const FILE_TABLE = path.join(DATA_DIR, 'patient-table.settings.json');

// ===== defaults: patient-form =====
const FORM_DEFAULTS = {
  requiredFields: ["card_id","first_name","last_name","gender","blood_group","bloodgroup_rh","treat_at"],
  documents: {
    required: ["patient_id_card","house_registration"],
    optional:  ["patient_photo","relative_id_card","adl_assessment","clinical_summary","assistance_letter","power_of_attorney","homeless_certificate"],
    hidden:    []
  },
  defaults: { patients_type: "ติดบ้าน", treat_at: "บ้าน" },
  selectOptions: { treat_at: ["โรงพยาบาล","บ้าน"] },
  validation: { thaiId: { enabled: true }, phone: { pattern: "^0\\d{2}-\\d{3}-\\d{4}$" } },
  baseline: { enabled: true }
};

// ===== defaults: patient-table =====
const ALL_COLUMNS = [
  "hn","name","gender","age","blood","type","treat_at","status",
  "verify","edit","add_appt","history","allergies","diagnosis","deceased","delete"
];
const TABLE_DEFAULTS = {
  columns: {
    order: [...ALL_COLUMNS],
    visible: Object.fromEntries(ALL_COLUMNS.map(k => [k, true])),
  },
  pageSize: 20,
};

// ----- helpers -----
async function ensureFile(file, defaults) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(file); }
  catch { await fs.writeFile(file, JSON.stringify(defaults, null, 2)); }
}

// ----- sanitize -----
function sanitizeForm(payload = {}) {
  const d = payload || {};
  return {
    requiredFields: Array.isArray(d.requiredFields) ? d.requiredFields : FORM_DEFAULTS.requiredFields,
    documents: {
      required: Array.isArray(d?.documents?.required) ? d.documents.required : FORM_DEFAULTS.documents.required,
      optional: Array.isArray(d?.documents?.optional) ? d.documents.optional : FORM_DEFAULTS.documents.optional,
      hidden:   Array.isArray(d?.documents?.hidden)   ? d.documents.hidden   : FORM_DEFAULTS.documents.hidden,
    },
    defaults: d.defaults ?? FORM_DEFAULTS.defaults,
    selectOptions: d.selectOptions ?? FORM_DEFAULTS.selectOptions,
    validation: d.validation ?? FORM_DEFAULTS.validation,
    baseline: d.baseline ?? FORM_DEFAULTS.baseline,
  };
}

function sanitizeTable(payload = {}) {
  const p = payload || {};
  const sz = Number(p.pageSize);
  const pageSize = Number.isFinite(sz) ? Math.max(5, Math.min(200, sz)) : TABLE_DEFAULTS.pageSize;

  const incomingOrder = Array.isArray(p?.columns?.order)
    ? p.columns.order.filter(k => ALL_COLUMNS.includes(k))
    : [];
  const order = [...incomingOrder, ...ALL_COLUMNS.filter(k => !incomingOrder.includes(k))];

  const incomingVisible = (p?.columns?.visible && typeof p.columns.visible === 'object') ? p.columns.visible : {};
  const visible = Object.fromEntries(ALL_COLUMNS.map(k => [k, Boolean(incomingVisible[k] ?? true)]));

  return { columns: { order, visible }, pageSize };
}

// ----- exports: patient-form -----
exports.getPatientForm = async () => {
  await ensureFile(FILE_FORM, FORM_DEFAULTS);
  const buf = await fs.readFile(FILE_FORM, 'utf8');
  try { return sanitizeForm(JSON.parse(buf || '{}')); }
  catch { return { ...FORM_DEFAULTS }; }
};
exports.updatePatientForm = async (patch = {}) => {
  await ensureFile(FILE_FORM, FORM_DEFAULTS);
  const current = await exports.getPatientForm();
  const merged  = sanitizeForm({ ...current, ...patch });
  await fs.writeFile(FILE_FORM, JSON.stringify(merged, null, 2));
  return merged;
};

// ----- exports: patient-table -----
exports.getPatientTable = async () => {
  await ensureFile(FILE_TABLE, TABLE_DEFAULTS);
  const buf = await fs.readFile(FILE_TABLE, 'utf8');
  try { return sanitizeTable(JSON.parse(buf || '{}')); }
  catch { return { ...TABLE_DEFAULTS }; }
};
exports.updatePatientTable = async (patch = {}) => {
  await ensureFile(FILE_TABLE, TABLE_DEFAULTS);
  const current = await exports.getPatientTable();
  const merged  = sanitizeTable({ ...current, ...patch });
  await fs.writeFile(FILE_TABLE, JSON.stringify(merged, null, 2));
  return merged;
};

// เผื่อ front ต้องรู้รายการคอลัมน์ทั้งหมด
exports.ALL_PATIENT_COLUMNS = ALL_COLUMNS;
