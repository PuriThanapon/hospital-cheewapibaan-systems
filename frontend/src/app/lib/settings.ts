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
