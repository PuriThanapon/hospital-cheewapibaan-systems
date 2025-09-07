// app/api/settings/patient-form/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COOKIE = 'patient_form_settings_v1';

// ----- defaults ให้ตรงกับฟอร์ม -----
type DocType = { key: string; label: string; accept?: string; protected?: boolean };
type DocsCfg  = { types: DocType[]; required: string[]; optional: string[]; hidden: string[] };

const DEFAULT_DOC_TYPES: DocType[] = [
  { key: 'patient_id_card',   label: 'สำเนาบัตรประชาชนผู้ป่วย',                 accept: 'image/*,.pdf', protected: true },
  { key: 'house_registration', label: 'สำเนาทะเบียนบ้านผู้ป่วย/ญาติ',             accept: 'image/*,.pdf', protected: true },
  { key: 'patient_photo',     label: 'รูปถ่ายผู้ป่วย (สภาพปัจจุบัน)',             accept: 'image/*' },
  { key: 'relative_id_card',  label: 'สำเนาบัตรประชาชนญาติ/ผู้ขอความอนุเคราะห์', accept: 'image/*,.pdf' },
  { key: 'assistance_letter', label: 'หนังสือขอความอนุเคราะห์',                  accept: 'image/*,.pdf' },
  { key: 'power_of_attorney', label: 'หนังสือมอบอำนาจ / หนังสือรับรองบุคคลไร้ญาติ', accept: 'image/*,.pdf' },
  { key: 'homeless_certificate', label: 'หนังสือรับรองบุคคลไร้ที่พึ่ง',           accept: 'image/*,.pdf' },
  { key: 'adl_assessment',    label: 'แบบประเมิน ADL',                             accept: 'image/*,.pdf' },
  { key: 'clinical_summary',  label: 'ประวัติการรักษา (Clinical Summary)',         accept: 'image/*,.pdf' },
];

const DEFAULT_SETTINGS = {
  requiredFields: ['card_id','first_name','last_name','gender','blood_group','bloodgroup_rh','treat_at'],
  documents: {
    types: DEFAULT_DOC_TYPES,
    required: ['patient_id_card', 'house_registration'],
    optional: [
      'patient_photo', 'relative_id_card', 'assistance_letter',
      'power_of_attorney', 'homeless_certificate', 'adl_assessment', 'clinical_summary'
    ],
    hidden: [] as string[],
  },
  defaults: { patients_type: 'ติดบ้าน', treat_at: 'บ้าน' },
  selectOptions: {
    pname: ['นาย', 'นาง', 'น.ส.', 'เด็กชาย', 'เด็กหญิง'],
    gender: ['ชาย', 'หญิง', 'ไม่ระบุ'],
    blood_group: ['A', 'B', 'AB', 'O'],
    bloodgroup_rh: ['Rh+', 'Rh-'],
    patients_type: ['ติดสังคม', 'ติดบ้าน', 'ติดเตียง'],
    treat_at: ['โรงพยาบาล', 'บ้าน'],
  },
  validation: { thaiId: { enabled: true }, phone: { pattern: '^0\\d{2}-\\d{3}-\\d{4}$' } },
  baseline: { enabled: true },
};

// ----- helpers -----
const uniq = (arr: string[]) => Array.from(new Set((arr || []).filter(Boolean)));
const byKey = (types: DocType[]) => Object.fromEntries((types||[]).map(t => [t.key, t]));
function disjoint(required: string[], optional: string[], hidden: string[]) {
  const R = new Set(uniq(required)), O = new Set(uniq(optional)), H = new Set(uniq(hidden));
  for (const k of Array.from(O)) if (R.has(k) || H.has(k)) O.delete(k);
  for (const k of Array.from(H)) if (R.has(k) || O.has(k)) H.delete(k);
  return { required: Array.from(R), optional: Array.from(O), hidden: Array.from(H) };
}

// merge types ตาม key (เติม default ที่หาย, เก็บ label/accept จากของเดิมถ้ามี)
function mergeTypes(incoming: DocType[] | undefined) {
  const inc = Array.isArray(incoming) ? incoming : [];
  const map = new Map<string, DocType>();
  DEFAULT_DOC_TYPES.forEach(t => map.set(t.key, t));
  inc.forEach(t => { if (t?.key) map.set(t.key, { ...map.get(t.key), ...t } as DocType); });
  return Array.from(map.values());
}

function sanitizeIncoming(body: any) {
  const inDocs = body?.documents || {};
  const types = mergeTypes(inDocs.types);

  const lists = disjoint(
    Array.isArray(inDocs.required) ? inDocs.required : DEFAULT_SETTINGS.documents.required,
    Array.isArray(inDocs.optional) ? inDocs.optional : DEFAULT_SETTINGS.documents.optional,
    Array.isArray(inDocs.hidden)   ? inDocs.hidden   : []
  );

  const outDocs: DocsCfg = { types, ...lists };

  return {
    requiredFields: Array.isArray(body?.requiredFields) && body.requiredFields.length
      ? uniq(body.requiredFields)
      : DEFAULT_SETTINGS.requiredFields,
    documents: outDocs,
    defaults: { ...DEFAULT_SETTINGS.defaults, ...(body?.defaults || {}) },
    selectOptions: { ...DEFAULT_SETTINGS.selectOptions, ...(body?.selectOptions || {}) },
    validation: { ...DEFAULT_SETTINGS.validation, ...(body?.validation || {}) },
    baseline: { ...DEFAULT_SETTINGS.baseline, ...(body?.baseline || {}) },
  };
}

// ----- routes -----
export async function GET(req: NextRequest) {
  const raw = req.cookies.get(COOKIE)?.value;
  let payload: any = DEFAULT_SETTINGS;
  try { if (raw) payload = JSON.parse(raw); } catch { payload = DEFAULT_SETTINGS; }
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: NextRequest) {
  const incoming = await req.json().catch(() => ({}));
  const merged = sanitizeIncoming(incoming);

  const res = NextResponse.json(merged, { headers: { 'Cache-Control': 'no-store' } });
  // เก็บไว้ใน cookie ให้รีเฟรชแล้วยังคงอยู่
  res.cookies.set(COOKIE, JSON.stringify(merged), {
    path: '/',
    httpOnly: false, // ให้ฝั่ง client อ่านได้ใน dev
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 ปี
  });
  return res;
}
// DELETE ลบการตั้งค่า (คืนค่าเป็น default)                                                         