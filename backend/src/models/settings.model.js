const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'patient-form.settings.json');

// ค่าเริ่มต้น
const DEFAULTS = {
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

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(FILE); }
  catch { await fs.writeFile(FILE, JSON.stringify(DEFAULTS, null, 2)); }
}

function sanitize(payload = {}) {
  const d = payload || {};
  return {
    requiredFields: Array.isArray(d.requiredFields) ? d.requiredFields : DEFAULTS.requiredFields,
    documents: {
      required: Array.isArray(d?.documents?.required) ? d.documents.required : DEFAULTS.documents.required,
      optional: Array.isArray(d?.documents?.optional) ? d.documents.optional : DEFAULTS.documents.optional,
      hidden:   Array.isArray(d?.documents?.hidden)   ? d.documents.hidden   : DEFAULTS.documents.hidden,
    },
    defaults: d.defaults ?? DEFAULTS.defaults,
    selectOptions: d.selectOptions ?? DEFAULTS.selectOptions,
    validation: d.validation ?? DEFAULTS.validation,
    baseline: d.baseline ?? DEFAULTS.baseline,
  };
}

exports.getPatientForm = async () => {
  await ensureFile();
  const buf = await fs.readFile(FILE, 'utf8');
  try {
    const json = JSON.parse(buf || '{}');
    return sanitize(json);
  } catch {
    return { ...DEFAULTS };
  }
};

exports.updatePatientForm = async (patch = {}) => {
  await ensureFile();
  // โหลดปัจจุบันแล้ว merge → sanitize → save
  const current = await exports.getPatientForm();
  const merged = sanitize({ ...current, ...patch });
  await fs.writeFile(FILE, JSON.stringify(merged, null, 2));
  return merged;
};
