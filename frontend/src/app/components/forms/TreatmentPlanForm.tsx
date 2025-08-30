'use client';
import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import PatientLookupModal from '@/app/components/modals/PatientLookupModal';

/* ================= Types ================= */
export type LifeSupportPrefs = {
  icu?: boolean;
  cpr?: boolean;
  tracheostomy?: boolean;
  intubation?: boolean;
  ventilator?: boolean;
  advanced_devices?: boolean;
  note?: string;
};

export type DecisionMaker = {
  name: string;
  relation?: string;
  phone?: string;
};

export type TreatmentPlanFormValue = {
  patients_id: string;

  // ความต้องการรูปแบบการดูแลรักษา
  care_model: 'แพทย์ปัจจุบัน' | 'แพทย์ทางเลือก' | 'ผสมผสาน' | 'ไม่บำบัด' | '';

  // สถานที่ดูแล
  care_location: 'home' | 'hospital' | 'mixed' | '';

  // เทคโนโลยียื้อชีวิต
  life_support: LifeSupportPrefs;

  // ผู้ตัดสินใจแทน (หลายคนได้)
  decision_makers: DecisionMaker[];

  // ความปรารถนา 1–5
  wishes1_decision_person?: string;
  wishes2_preferred_care?: string;
  // 3: ใช้/ไม่ใช้/ไม่ระบุ
  wishes3_comfort_care?: 'ใช้' | 'ไม่ใช้' | 'ไม่ระบุ' | '';
  wishes4_home_caregiver?: string;
  wishes5_final_goodbye?: string;

  // ชื่อเรื่อง/คำอธิบายเพิ่มเติม (ถ้าต้องการ)
  title?: string;
  note?: string;

  // ไฟล์ “หนังสือแสดงเจตนา” (จะส่งออกไปเป็น FormData -> backend เก็บ BYTEA)
  directive_files: File[];
};

export type TreatmentPlanFormHandle = {
  validate: () => boolean;
  reset: () => void;
  setPatientInfo?: (p: any) => void;
};

type Props = {
  value: TreatmentPlanFormValue;
  onChange: (v: TreatmentPlanFormValue) => void;
  className?: string;
  saving?: boolean; // ⬅️ เพิ่ม
};


/* ================= HTTP helpers (เหมือนฟอร์มอื่นๆ) ================= */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';
function joinUrl(base: string, path: string) {
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}
async function http(url: string, options: RequestInit = {}) {
  const finalUrl = /^https?:\/\//i.test(url) ? url : joinUrl(API_BASE, url);
  const res = await fetch(finalUrl, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    let msg = 'Request failed';
    try {
      const j = await res.json();
      msg = (j as any).message || (j as any).error || msg;
    } catch {}
    const err: any = new Error(msg);
    (err as any).status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

async function savePlan(v: TreatmentPlanFormValue) {
  const fd = new FormData();
  fd.append('patients_id', v.patients_id);
  fd.append('care_model', v.care_model || '');
  fd.append('care_location', v.care_location || '');
  fd.append('life_support', JSON.stringify(v.life_support || {}));
  fd.append('decision_makers', JSON.stringify(v.decision_makers || []));

  // ⬇️ รวม wishes เป็นอ็อบเจกต์เดียว
  fd.append('wishes', JSON.stringify({
    decision_person: v.wishes1_decision_person || null,
    preferred_care: v.wishes2_preferred_care || null,
    comfort_care:   v.wishes3_comfort_care || null,
    home_caregiver: v.wishes4_home_caregiver || null,
    final_goodbye:  v.wishes5_final_goodbye || null,
  }));

  fd.append('title', v.title || '');
  fd.append('note', v.note || '');

  (v.directive_files || []).forEach(f => fd.append('files', f));

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000'}/api/treatment-plans`, {
    method: 'POST',
    body: fd, // ห้ามตั้ง Content-Type เอง
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ================= Utils ================= */
function normalizePatientsId(id: string) {
  if (!id) return '';
  const t = String(id).trim();
  if (/^\d+$/.test(t)) return 'HN-' + t.padStart(8, '0');
  return t.toUpperCase();
}
function toNumericId(id: string) {
  if (!id) return '';
  const t = String(id).trim().toUpperCase();
  if (/^\d+$/.test(t)) return t;
  const m = t.match(/\d+/g);
  if (!m) return '';
  const n = String(parseInt(m.join(''), 10));
  return n === 'NaN' ? '' : n;
}
function unwrapPatient(p: any) {
  return p?.data ?? p;
}
function calcAgeFromBirthdate(birthdate?: string) {
  if (!birthdate) return '-';
  const birth = new Date(birthdate);
  if (isNaN(birth.getTime())) return '-';
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  if (months < 0 || (months === 0 && today.getDate() < birth.getDate())) {
    years--; months = 12 + months;
  }
  return years > 0 ? `${years} ปี` : `${months} เดือน`;
}

/* smart fetch patient (HN หรือเลขล้วนตกลงมา) */
async function fetchPatientSmart(rawId: string) {
  const hn = normalizePatientsId(rawId);
  const num = toNumericId(rawId);
  const attempts = [
    `/api/patients/${encodeURIComponent(hn)}`,
    num ? `/api/patients/${encodeURIComponent(num)}` : null,
  ].filter(Boolean) as string[];

  let lastErr: any = null;
  for (const url of attempts) {
    try {
      const res = await http(url);
      const patient = unwrapPatient(res);
      if (patient) return patient;
    } catch (e: any) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('ไม่พบข้อมูลผู้ป่วย');
}

/* ================= Component ================= */
const TreatmentPlanForm = forwardRef<TreatmentPlanFormHandle, Props>(
({ value, onChange, className = '', saving = false }, ref) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyErr, setVerifyErr] = useState('');
  const [patientInfo, setPatientInfo] = useState<any | null>(null);

  // modal ค้นหาผู้ป่วย
  const [lookupOpen, setLookupOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    validate: () => {
      const e: Record<string, string> = {};
      if (!value.patients_id?.trim()) e.patients_id = 'กรุณากรอกรหัสผู้ป่วย (HN)';
      if (!value.care_model) e.care_model = 'กรุณาเลือกความต้องการรูปแบบการดูแล';
      if (!value.care_location) e.care_location = 'กรุณาเลือกสถานที่ดูแล';
      setErrors(e);
      return Object.keys(e).length === 0;
    },
    reset: () => {
      setErrors({});
      setVerifyErr('');
      setVerifyLoading(false);
      setPatientInfo(null);
      setLookupOpen(false);
    },
    setPatientInfo: (p: any) => setPatientInfo(p),
  }), [value]);

  const careModelOptions = useMemo(() => ([
    'แพทย์ปัจจุบัน',
    'แพทย์ทางเลือก',
    'ผสมผสาน',
    'ไม่บำบัด',
  ] as const), []);

  const handleVerify = async () => {
    const raw = value.patients_id || '';
    if (!raw.trim()) {
      setErrors(prev => ({ ...prev, patients_id: 'กรุณากรอก HN ก่อนตรวจสอบ' }));
      return;
    }
    setVerifyLoading(true);
    setVerifyErr('');
    setPatientInfo(null);
    try {
      const p = await fetchPatientSmart(raw);
      setPatientInfo(p);
      const hn = p?.patients_id || normalizePatientsId(raw);
      if (hn && hn !== value.patients_id) {
        onChange({ ...value, patients_id: hn });
      }
    } catch (e: any) {
      setVerifyErr(e?.message || 'ตรวจสอบไม่สำเร็จ');
    } finally {
      setVerifyLoading(false);
    }
  };

  const toggleLS = (k: keyof LifeSupportPrefs) =>
    onChange({ ...value, life_support: { ...(value.life_support || {}), [k]: !value.life_support?.[k] } });

  const updateLSNote = (s: string) =>
    onChange({ ...value, life_support: { ...(value.life_support || {}), note: s } });

  const addDecisionMaker = () =>
    onChange({
      ...value,
      decision_makers: [...(value.decision_makers || []), { name: '', relation: '', phone: '' }],
    });

  const updateDecisionMaker = (idx: number, patch: Partial<DecisionMaker>) => {
    const arr = [...(value.decision_makers || [])];
    arr[idx] = { ...arr[idx], ...patch };
    onChange({ ...value, decision_makers: arr });
  };

  const removeDecisionMaker = (idx: number) => {
    const arr = [...(value.decision_makers || [])];
    arr.splice(idx, 1);
    onChange({ ...value, decision_makers: arr });
  };

  const onFilesChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files || []);
    onChange({ ...value, directive_files: files });
  };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {/* ========== HN + ตรวจสอบ + ค้นหา ========== */}
      <div className="md:col-span-2">
        <label className="text-sm text-gray-700 mb-1 block">รหัสผู้ป่วย (HN)</label>
        <div className="flex gap-2">
          <input
            className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${errors.patients_id ? 'border-red-300 focus:ring-red-100' : 'border-gray-300 focus:ring-blue-200'}`}
            placeholder="เช่น HN-00000001 หรือ 1"
            value={value.patients_id}
            onChange={(e) => { setVerifyErr(''); setPatientInfo(null); onChange({ ...value, patients_id: e.target.value }); }}
            onBlur={(e) => onChange({ ...value, patients_id: normalizePatientsId(e.target.value) })}
          />
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifyLoading || !value.patients_id.trim()} // ⬅️ เพิ่มเงื่อนไข
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-60"
            >
            {verifyLoading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบ'}
            </button>
          <button
            type="button"
            onClick={() => setLookupOpen(true)}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
          >
            ลืมรหัส (ค้นหา)
          </button>
        </div>
        {errors.patients_id && <div className="mt-1 text-xs text-red-600">{errors.patients_id}</div>}
        {verifyErr && <div className="mt-2 text-sm text-red-600">{verifyErr}</div>}
      </div>

      {/* การ์ดข้อมูลผู้ป่วย */}
      {patientInfo && (
        <div className="md:col-span-2">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
            {(() => {
              const p = patientInfo;
              const fullname = `${p.pname ?? ''}${p.first_name ?? ''} ${p.last_name ?? ''}`.replace(/\s+/g,' ').trim() || '-';
              const ageText =
                p.age != null && p.age !== ''
                  ? `${p.age} ปี`
                  : (p.birthdate ? calcAgeFromBirthdate(p.birthdate) : '-');
              const gender = p.gender || '-';
              const blood = [p.blood_group || '-', p.bloodgroup_rh || ''].filter(Boolean).join(' ');
              const disease = p.disease || '-';
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="text-xs text-gray-500">ชื่อ-นามสกุล</div>
                    <div className="text-gray-900">{fullname}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="text-xs text-gray-500">อายุ</div>
                    <div className="text-gray-900">{ageText}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="text-xs text-gray-500">เพศ</div>
                    <div className="text-gray-900">{gender}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <div className="text-xs text-gray-500">กรุ๊ปเลือด</div>
                    <div className="text-gray-900 font-medium">{blood}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="text-xs text-gray-500">ประเภทผู้ป่วย</div>
                    <div className="text-gray-900 font-medium">{p.patient_type || '-'}</div>
                  </div>
                  <div className="md:col-span-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                    <div className="text-xs text-gray-500">โรคประจำตัว</div>
                    <div className="text-gray-900">{disease}</div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========== หัวเรื่อง/หมายเหตุ (ถ้าต้องการ) ========== */}
      <label className="md:col-span-2">
        <div className="mb-1 text-sm text-gray-700">หัวเรื่อง (ไม่บังคับ)</div>
        <input
          className="w-full px-3 py-2 border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
          value={value.title || ''}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="เช่น แผนการรักษาระยะท้าย"
        />
      </label>

      {/* ========== ความต้องการรูปแบบการดูแลรักษา ========== */}
      <label>
        <div className="mb-1 text-sm text-gray-700">รูปแบบการดูแลรักษา</div>
        <select
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${errors.care_model ? 'border-red-300 focus:ring-red-100' : 'border-gray-300 focus:ring-blue-200'}`}
          value={value.care_model}
          onChange={(e) => onChange({ ...value, care_model: e.target.value as any })}
        >
          <option value="">— เลือก —</option>
          {careModelOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        {errors.care_model && <div className="mt-1 text-xs text-red-600">{errors.care_model}</div>}
      </label>

      {/* ========== สถานที่ดูแล ========== */}
      <label>
        <div className="mb-1 text-sm text-gray-700">สถานที่ดูแล</div>
        <select
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${errors.care_location ? 'border-red-300 focus:ring-red-100' : 'border-gray-300 focus:ring-blue-200'}`}
          value={value.care_location}
          onChange={(e) => onChange({ ...value, care_location: e.target.value as any })}
        >
          <option value="">— เลือก —</option>
          <option value="home">ที่บ้าน</option>
          <option value="hospital">โรงพยาบาล</option>
          <option value="mixed">ผสมผสาน</option>
        </select>
        {errors.care_location && <div className="mt-1 text-xs text-red-600">{errors.care_location}</div>}
      </label>

      {/* ========== เทคโนโลยียื้อชีวิต ========== */}
      <div className="md:col-span-2 p-4 rounded-xl border border-amber-300 bg-amber-50">
        <div className="text-sm font-medium text-amber-800 mb-2">
          ความต้องการใช้เทคโนโลยียื้อชีวิต เมื่อวาระสุดท้ายมาถึง
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-amber-900">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={!!value.life_support?.icu} onChange={() => toggleLS('icu')} />
            เข้ารักษาในห้อง ICU
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={!!value.life_support?.cpr} onChange={() => toggleLS('cpr')} />
            กระตุ้นหัวใจ (CPR)
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={!!value.life_support?.tracheostomy} onChange={() => toggleLS('tracheostomy')} />
            เจาะคอใส่ท่อหายใจ
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={!!value.life_support?.intubation} onChange={() => toggleLS('intubation')} />
            ใส่ท่อช่วยหายใจ (Intubation)
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={!!value.life_support?.ventilator} onChange={() => toggleLS('ventilator')} />
            เครื่องช่วยหายใจ
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={!!value.life_support?.advanced_devices} onChange={() => toggleLS('advanced_devices')} />
            ใช้เครื่องมือแพทย์ขั้นสูงอื่นๆ
          </label>
        </div>
        <div className="mt-3">
          <textarea
            rows={2}
            className="w-full px-3 py-2 border rounded-lg border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-200 bg-white"
            placeholder="หมายเหตุเพิ่มเติมเกี่ยวกับการใช้/ไม่ใช้เทคโนโลยียื้อชีวิต"
            value={value.life_support?.note || ''}
            onChange={(e) => updateLSNote(e.target.value)}
          />
        </div>
      </div>

      {/* ========== ผู้ตัดสินใจแทน (หลายคน) ========== */}
      <div className="md:col-span-2 p-4 rounded-xl border border-blue-200 bg-blue-50">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-blue-800">ผู้ที่มอบหมายให้ตัดสินใจแทน</div>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
            onClick={addDecisionMaker}
          >
            + เพิ่มญาติ/ผู้แทน
          </button>
        </div>

        {(value.decision_makers || []).map((it, idx) => (
          <div key={idx} className="grid grid-cols-1 sm:grid-cols-7 gap-2 mb-2">
            <input
              className="sm:col-span-3 px-3 py-2 border rounded-lg border-gray-300"
              placeholder="ชื่อ-นามสกุล"
              value={it.name}
              onChange={(e) => updateDecisionMaker(idx, { name: e.target.value })}
            />
            <input
              className="sm:col-span-2 px-3 py-2 border rounded-lg border-gray-300"
              placeholder="ความสัมพันธ์ (เช่น บุตร)"
              value={it.relation || ''}
              onChange={(e) => updateDecisionMaker(idx, { relation: e.target.value })}
            />
            <input
              className="sm:col-span-2 px-3 py-2 border rounded-lg border-gray-300"
              placeholder="เบอร์ติดต่อ"
              value={it.phone || ''}
              onChange={(e) => updateDecisionMaker(idx, { phone: e.target.value })}
            />
            <div className="sm:col-span-7 flex justify-end">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-sm"
                onClick={() => removeDecisionMaker(idx)}
              >
                ลบรายการนี้
              </button>
            </div>
          </div>
        ))}
        {(value.decision_makers || []).length === 0 && (
          <div className="text-sm text-blue-700/80">ยังไม่ได้เพิ่มผู้แทนตัดสินใจ</div>
        )}
      </div>

      {/* ========== ความปรารถนา 1–5 ========== */}
      <label className="md:col-span-2">
        <div className="mb-1 text-sm text-gray-700">1) แต่งตั้ง/มอบอำนาจผู้แทนตัดสินใจด้านการรักษาพยาบาล</div>
        <input
          className="w-full px-3 py-2 border rounded-lg border-gray-300"
          value={value.wishes1_decision_person || ''}
          onChange={(e) => onChange({ ...value, wishes1_decision_person: e.target.value })}
          placeholder="โปรดระบุบุคคลที่ผู้ป่วยมอบอำนาจให้ตัดสินใจด้านการรักษาพยาบาลเมื่อปู้ป่วยไม่สามารถแสดงเจตนาได้"
        />
      </label>

      <label className="md:col-span-2">
        <div className="mb-1 text-sm text-gray-700">2) ความประสงค์ด้านการดูแลรักษา</div>
        <textarea
          rows={2}
          className="w-full px-3 py-2 border rounded-lg border-gray-300"
          value={value.wishes2_preferred_care || ''}
          onChange={(e) => onChange({ ...value, wishes2_preferred_care: e.target.value })}
          placeholder="รายละเอียด (เช่น เน้นบรรเทาอาการ ปลอบโยน ดูแลจิตวิญญาณ ฯลฯ)"
        />
      </label>

      <label>
        <div className="mb-1 text-sm text-gray-700">3) วิธีการดูแลที่ก่อให้เกิดความสบายกาย-ใจ</div>
        <select
          className="w-full px-3 py-2 border rounded-lg border-gray-300"
          value={value.wishes3_comfort_care || ''}
          onChange={(e) => onChange({ ...value, wishes3_comfort_care: e.target.value as any })}
        >
          <option value="">— เลือก —</option>
          <option value="ใช้">ใช้</option>
          <option value="ไม่ใช้">ไม่ใช้</option>
          <option value="ไม่ระบุ">ไม่ระบุ</option>
        </select>
      </label>

      <label>
        <div className="mb-1 text-sm text-gray-700">4) ผู้มาปฏิบัติดูแลเมื่ออยู่ที่บ้าน</div>
        <input
          className="w-full px-3 py-2 border rounded-lg border-gray-300"
          value={value.wishes4_home_caregiver || ''}
          onChange={(e) => onChange({ ...value, wishes4_home_caregiver: e.target.value })}
          placeholder="โปรดระบุบุคคลที่ทำหน้าที่ดูแลผู้ป่วยที่บ้าน รวมถึงความสัมพันธ์ เบอร์โทร"
        />
      </label>

      <label className="md:col-span-2">
        <div className="mb-1 text-sm text-gray-700">5) ผู้ที่อยากพบเพื่อกล่าวลาครั้งสุดท้าย</div>
        <input
          className="w-full px-3 py-2 border rounded-lg border-gray-300"
          value={value.wishes5_final_goodbye || ''}
          onChange={(e) => onChange({ ...value, wishes5_final_goodbye: e.target.value })}
          placeholder="ระบุชื่อหลายคนคั่นด้วยเครื่องหมายจุลภาค ,"
        />
      </label>

      {/* หมายเหตุเพิ่มเติม */}
      <label className="md:col-span-2">
        <div className="mb-1 text-sm text-gray-700">หมายเหตุเพิ่มเติม (ถ้ามี)</div>
        <textarea
          rows={3}
          className="w-full px-3 py-2 border rounded-lg border-gray-300"
          value={value.note || ''}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
        />
      </label>

      {/* ========== แนบไฟล์ (จะส่งออกไปเป็น FormData -> backend เก็บ BYTEA) ========== */}
      <label className="md:col-span-2">
        <div className="mb-1 text-sm text-gray-700">ไฟล์หนังสือแสดงเจตนา (อัปโหลดหลายไฟล์ได้)</div>
        <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"  // ⬅️ เพิ่ม
            className="block w-full text-sm text-gray-700 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
            onChange={onFilesChange}
            disabled={saving}              // ⬅️ disable ตอนกำลังบันทึก
        />
        <div className="mt-2 text-xs text-gray-500">
            {value.directive_files?.length
            ? (
                <ul className="list-disc pl-5 space-y-0.5">
                {value.directive_files.map((f, i) => <li key={i}>{f.name}</li>)}
                </ul>
            )
            : 'ยังไม่ได้เลือกไฟล์'}
        </div>
        </label>

      {/* ========== Modal: ค้นหาผู้ป่วย ========== */}
      <PatientLookupModal
        open={lookupOpen}
        onClose={() => setLookupOpen(false)}
        onSelect={(p) => {
          onChange({ ...value, patients_id: p.patients_id });
          setPatientInfo(p);
          setLookupOpen(false);
        }}
      />
    </div>
  );
});

TreatmentPlanForm.displayName = 'TreatmentPlanForm';
export default TreatmentPlanForm;
