// src/app/lib/setting.ts  (อัปเดตให้เรียก API ภายในโปรเจกต์เดียวกันเป็นค่าเริ่มต้น)
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/,'');
const join = (p: string) => API_BASE ? `${API_BASE}${p.startsWith('/')?p:`/${p}`}` : (p.startsWith('/')?p:`/${p}`);

export type PatientFormSettings = {
  requiredFields?: string[];
  documents?: { types?: any[]; required?: string[]; optional?: string[]; hidden?: string[] };
  defaults?: Record<string, any>;
  selectOptions?: Record<string, string[]>;
  validation?: any;
  baseline?: { enabled: boolean };
};

export async function getPatientFormSettings(): Promise<PatientFormSettings> {
  const r = await fetch(join('/api/settings/patient-form'), { cache: 'no-store', next: { revalidate: 0 } });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function savePatientFormSettings(s: PatientFormSettings) {
  const r = await fetch(join('/api/settings/patient-form'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(s),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// --- เพิ่มต่อท้ายไฟล์เดิม (ไม่ต้องลบของเก่า) ---

export type PatientListFilterDef = {
  key: string;
  label: string;
  type: 'select'|'text'|'boolean'|'daterange'|'numberrange';
  // สำหรับ select: ดึงตัวเลือกจาก selectOptions หรือระบุเอง
  source?: 'pname'|'gender'|'blood_group'|'bloodgroup_rh'|'patients_type'|'treat_at';
  options?: string[];       // ถ้าอยาก fix ค่าเอง
  multi?: boolean;          // select หลายตัว
};

export type PatientListFilterSettings = {
  defs: PatientListFilterDef[];      // เมทาดาต้า
  enabled: string[];                 // ลำดับในการแสดงผล (คีย์ตาม defs)
  hidden: string[];                  // ซ่อน
  defaults: Record<string, any>;     // ค่าตั้งต้นของแต่ละตัวกรอง
};

const DEFAULT_LIST_FILTERS: PatientListFilterSettings = {
  defs: [
    { key: 'status',        label: 'สถานะ',           type: 'select', options: ['มีชีวิต','เสียชีวิต'], multi: true },
    { key: 'gender',        label: 'เพศ',             type: 'select', source: 'gender', multi: true },
    { key: 'patients_type', label: 'ประเภทผู้ป่วย',   type: 'select', source: 'patients_type', multi: true },
    { key: 'treat_at',      label: 'รักษาที่',        type: 'select', source: 'treat_at', multi: true },
    { key: 'admit_range',   label: 'ช่วงวันที่รับเข้า', type: 'daterange' },
    { key: 'has_baseline',  label: 'มีประวัติเบื้องต้น', type: 'boolean' },
    { key: 'q',             label: 'ค้นหา (ชื่อ/HN/โทร)', type: 'text' },
  ],
  enabled: ['status','gender','patients_type','treat_at','admit_range','has_baseline','q'],
  hidden: [],
  defaults: {
    status: [], gender: [], patients_type: [], treat_at: [],
    admit_range: { from: '', to: '' }, has_baseline: null, q: ''
  },
};

export async function getPatientListFilterSettings(): Promise<PatientListFilterSettings> {
  const API = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const r = await fetch(`${API}/api/settings/patient-form?__ts=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) return DEFAULT_LIST_FILTERS;
  const js = await r.json();
  const merged: PatientListFilterSettings = {
    defs: js?.listFilters?.defs?.length ? js.listFilters.defs : DEFAULT_LIST_FILTERS.defs,
    enabled: Array.isArray(js?.listFilters?.enabled) ? js.listFilters.enabled : DEFAULT_LIST_FILTERS.enabled,
    hidden: Array.isArray(js?.listFilters?.hidden) ? js.listFilters.hidden : DEFAULT_LIST_FILTERS.hidden,
    defaults: typeof js?.listFilters?.defaults === 'object' ? js.listFilters.defaults : DEFAULT_LIST_FILTERS.defaults,
  };
  return merged;
}

export async function savePatientListFilterSettings(s: PatientListFilterSettings) {
  const API = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const r = await fetch(`${API}/api/settings/patient-form`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    // สไตล์เดียวกับหน้าตั้งค่าก่อนหน้า: PUT เฉพาะฟิลด์ที่แก้
    body: JSON.stringify({ listFilters: s }),
  });
  if (!r.ok) throw new Error('save listFilters failed');
  return r.json();
}

