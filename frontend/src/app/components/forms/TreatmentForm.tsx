'use client';
import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import makeAnimated from 'react-select/animated';
import dynamic from 'next/dynamic';
import DatePickerField from '../DatePicker';

const Select = dynamic(() => import('react-select'), { ssr: false });
const animatedComponents = makeAnimated();
const menuPortalTarget = typeof window !== 'undefined' ? document.body : undefined;
const rsx = {
  control: (base, state) => ({
    ...base,
    minHeight: 32,
    borderRadius: 10,
    borderColor: state.isFocused ? '#60a5fa' : '#e5e7eb',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(59,130,246,.25)' : 'none',
    ':hover': { borderColor: '#60a5fa' },
    color: '#000000',
  }),
  /* ⬇️ ให้สูงกว่า overlay ของ Modal (ที่คุณตั้ง ~10000) */
  menuPortal: (base) => ({ ...base, color: '#000000', zIndex: 12050 }),
  menu: (base) => ({ ...base, zIndex: 12050 }),
};

const treatmentTypeOptions = [
  { value: 'ประจำ', label: 'ประจำ' },
  { value: 'ทำครั้งเดียว', label: 'ทำครั้งเดียว' },
];

export type TreatmentDraft = {
  patients_id: string;
  treatment_type: '' | 'ประจำ' | 'ทำครั้งเดียว';
  treatment_date: string; // ISO: YYYY-MM-DD
  diagnosis_summary?: string;
  note?: string;
};

export type TreatmentFormHandle = {
  validate: () => boolean;
  reset: () => void;
};

type Props = {
  value: TreatmentDraft;
  onChange: (v: TreatmentDraft) => void;
  className?: string;
};

/** ---------- http helper (เหมือนหน้า list) ---------- */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';
function joinUrl(base: string, path: string) {
  if (!base) return path;
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}
async function http(url: string, options: RequestInit = {}) {
  const finalUrl = /^https?:\/\//i.test(url) ? url : joinUrl(API_BASE, url);
  const res = await fetch(finalUrl, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
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

/** ---------- utils ---------- */
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
  if (!p) return null;
  return p?.data ?? p; // รองรับทั้ง {data:{...}} หรือ {...}
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

/** ---------- smart fetch: HN -> numeric fallback ---------- */
async function fetchPatientSmart(rawId: string) {
  const hn = normalizePatientsId(rawId); // e.g. HN-00000018
  const num = toNumericId(rawId);        // e.g. 18
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

/** ---------- Form ---------- */
const TreatmentForm = forwardRef<TreatmentFormHandle, Props>(({ value, onChange, className = '' }, ref) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyErr, setVerifyErr] = useState('');
  const [patientInfo, setPatientInfo] = useState<any | null>(null);

  useImperativeHandle(ref, () => ({
    validate: () => {
      const e: Record<string, string> = {};
      if (!value.patients_id?.trim()) e.patients_id = 'กรุณากรอกรหัสผู้ป่วย';
      if (!value.treatment_type) e.treatment_type = 'กรุณาเลือกประเภทการรักษา';
      if (!value.treatment_date) e.treatment_date = 'กรุณาเลือกวันที่บันทึก';
      setErrors(e);
      return Object.keys(e).length === 0;
    },
    reset: () => {                // ✅ ล้างสถานะภายในฟอร์ม
      setErrors({});
      setVerifyLoading(false);
      setVerifyErr('');
      setPatientInfo(null);
    },
    setPatientInfo: (p: any) => {
      setPatientInfo(p); // อัปเดตข้อมูลผู้ป่วยใน UI
    },
  }), [value]);

  const todayISO = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }, []);
  

  const handleVerifyPatient = async () => {
    const raw = value.patients_id;
    if (!raw?.trim()) {
      setErrors(prev => ({ ...prev, patients_id: 'กรุณากรอกรหัสผู้ป่วย (HN)' }));
      return;
    }
    setVerifyLoading(true);
    setVerifyErr('');
    setPatientInfo(null);
    try {
      const p = await fetchPatientSmart(raw);
      setPatientInfo(p);
      // sync รูปแบบในช่องกรอกตามที่ normalize + ตามที่ API ตอบกลับ (ถ้ามี)
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

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {/* patients_id + ตรวจสอบ */}
      <div className="md:col-span-2">
        <label className="text-sm text-gray-600 mb-1 block">รหัสผู้ป่วย (HN)</label>
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded-lg px-3 py-2 text-[14px] border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="เช่น HN-00000001 หรือ 1"
            value={value.patients_id}
            onChange={(e) => {
              setPatientInfo(null);
              setVerifyErr('');
              onChange({ ...value, patients_id: e.target.value });
            }}
            onBlur={(e) => onChange({ ...value, patients_id: normalizePatientsId(e.target.value) })}
          />
          <button
            type="button"
            onClick={handleVerifyPatient}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-60"
            disabled={verifyLoading || !value.patients_id?.trim()}
          >
            {verifyLoading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบ'}
          </button>
        </div>
        {errors.patients_id && <div className="text-red-600 text-sm mt-1">{errors.patients_id}</div>}
        {verifyErr && <div className="text-red-600 text-sm mt-2">{verifyErr}</div>}
      </div>

      {/* แสดงข้อมูลผู้ป่วย (ตามที่ต้องการ) */}
      {patientInfo && (
        <div className="md:col-span-2">
          <div className="bg-white rounded-2xl shadow p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-emerald-100">
              <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
                {/* ใช้ emoji/ไอคอนพื้นฐาน แสดงชื่อส่วน */}
                <span className="text-emerald-700 text-xs">i</span>
              </div>
              <h3 className="text-base font-semibold text-gray-800">ข้อมูลผู้ป่วย</h3>
            </div>

            {(() => {
              const p = patientInfo || {};
              const fullname = `${p.pname || ''} ${p.first_name || ''} ${p.last_name || ''}`.trim() || '-';
              const ageText =
                p.age != null && p.age !== ''
                  ? `${p.age} ปี`
                  : (p.birthdate ? calcAgeFromBirthdate(p.birthdate) : '-');
              const gender = p.gender || '-';
              const blood = [p.blood_group || '-', p.bloodgroup_rh || ''].filter(Boolean).join(' ');
              const disease = p.disease || '-';

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">ชื่อ-นามสกุล</div>
                    <div className="text-gray-900">{fullname}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">อายุ</div>
                    <div className="text-gray-900">{ageText}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">เพศ</div>
                    <div className="text-gray-900">{gender}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <div className="text-xs text-gray-500 mb-1">กรุ๊ปเลือด</div>
                    <div className="text-gray-900 font-medium">{blood}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">น้ำหนัก</div>
                    <div className="text-gray-900">{p.weight || '-'}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">ส่วนสูง</div>
                    <div className="text-gray-900">{p.height || '-'}</div>
                  </div>
                  <div className="md:col-span-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                    <div className="text-xs text-gray-500 mb-1">โรคประจำตัว</div>
                    <div className="text-gray-900">{disease}</div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* treatment_type */}
      <div>
        <label className="text-sm text-gray-600 mb-1 block">ประเภทการรักษา</label>
        <Select
          components={animatedComponents}
          styles={rsx}
          menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
          menuPosition="fixed"
          menuShouldBlockScroll
          isSearchable={false}
          isClearable={false}
          placeholder="-- เลือกประเภทการรักษา --"
          options={treatmentTypeOptions}
          // map สตริงใน state -> option object
          value={treatmentTypeOptions.find(o => o.value === value.treatment_type) ?? null}
          // รับค่าที่เลือก (หรือ null ถ้าล้าง) แล้ว map กลับเป็นสตริงเก็บใน state
          onChange={(opt) => onChange({
            ...value,
            treatment_type: opt ? (opt as { value: 'ประจำ' | 'ทำครั้งเดียว' }).value : '',
          })}

          name="treatment_type"
        />
        {errors.treatment_type && <div className="text-red-600 text-sm mt-1">{errors.treatment_type}</div>}
      </div>

      {/* treatment_date */}
      <div>
        <label className="text-sm text-gray-600 mb-1 block">วันที่รักษา</label>
        <DatePickerField
          value={value.treatment_date}                 // string: 'YYYY-MM-DD'
          onChange={(iso) => onChange({               // iso คือ string 'YYYY-MM-DD'
            ...value,
            treatment_date: iso,
          })}
          maxDate={new Date()}                         // ไม่ให้เลือกวันที่อนาคต
          placeholder="เลือกวันที่รักษา"
        />
        {errors.treatment_date && (
          <div className="text-red-600 text-sm mt-1">{errors.treatment_date}</div>
        )}
      </div>

      {/* diagnosis_summary */}
      <div>
        <label className="text-sm text-gray-600 mb-1 block">สรุปการรักษา</label>
        <input
          className="w-full border rounded-lg px-3 py-2 text-[14px] border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="สรุป/วินิจฉัยโดยย่อ"
          value={value.diagnosis_summary || ''}
          onChange={(e) => onChange({ ...value, diagnosis_summary: e.target.value })}
        />
      </div>

      {/* note */}
      <div className="md:col-span-2">
        <label className="text-sm text-gray-600 mb-1 block">หมายเหตุ</label>
        <textarea
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-[14px] border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="บันทึกเพิ่มเติม (ถ้ามี)"
          value={value.note || ''}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
        />
      </div>
    </div>
  );
});

TreatmentForm.displayName = 'TreatmentForm';
export default TreatmentForm;
