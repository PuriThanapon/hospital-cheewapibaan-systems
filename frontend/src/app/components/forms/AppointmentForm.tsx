'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import DatePickerField from '@/app/components/DatePicker';
import TimePicker from '@/app/components/TimePicker';
import PatientLookupModal from '../modals/PatientLookupModal';

type Status = 'pending' | 'done' | 'cancelled';

export type AppointmentFormValue = {
  // ฟิลด์ฝั่ง appointments
  patient?: string;
  hn?: string;
  phone?: string;
  date?: string;   // YYYY-MM-DD
  start?: string;  // HH:mm
  end?: string;    // HH:mm
  type?: string;   // 'home' | 'hospital'
  place?: string;
  hospital_address?: string; // << เพิ่ม
  status?: Status;
  note?: string;
};

type Props = {
  value: AppointmentFormValue;
  onChange: (v: AppointmentFormValue) => void;
  errors?: Partial<Record<keyof AppointmentFormValue, string>>;
  TYPE_OPTIONS: string[];   // ควรมีค่าอย่างน้อย ['home','hospital']
  PLACE_OPTIONS: string[];
  className?: string;
};

/* ---------------- HTTP helpers ---------------- */
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

/* ---------------- Utils ---------------- */
function normalizeHN(v: string) {
  const digits = v.replace(/\D/g, '');
  if (!digits) return '';
  return 'HN-' + digits.padStart(8, '0');
}
function toNumericId(v: string) {
  if (!v) return '';
  const t = String(v).trim().toUpperCase();
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

/* --------------- Smart fetch patient --------------- */
async function fetchPatientSmart(raw: string) {
  const hn = normalizeHN(raw);
  const num = toNumericId(raw);
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

/* ------------------------------ Component ------------------------------ */
export default function AppointmentForm({
  value, onChange, errors, TYPE_OPTIONS, PLACE_OPTIONS, className = '',
}: Props) {
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [verifyErr, setVerifyErr] = useState('');
  const [patientInfo, setPatientInfo] = useState<any | null>(null);
  const hnInputRef = useRef<HTMLInputElement | null>(null);
  const hospitalInputRef = useRef<HTMLInputElement | null>(null);

  const handleVerify = async () => {
    const raw = value.hn || '';
    if (!raw.trim()) {
      setVerifyErr('กรุณากรอกรหัสผู้ป่วย (HN) ก่อนตรวจสอบ');
      hnInputRef.current?.focus();
      return;
    }
    setVerifyLoading(true);
    setVerifyErr('');
    setPatientInfo(null);
    
    try {
      const p = await fetchPatientSmart(raw);
      setPatientInfo(p);

      const fullname = `${p.pname ?? ''}${p.first_name ?? ''} ${p.last_name ?? ''}`
        .replace(/\s+/g, ' ')
        .trim();

      const tVal = TYPE_VALUE_FROM_LABEL(value.type);
      const addrRaw = getPatientAddressRaw(p); // ที่อยู่วัตถุแบบ "ดิบ"

      const newVal = {
        ...value,
        hn: p.patients_id || normalizeHN(raw),
        patient: fullname || p.patients_id,
        phone: p.phone_number || value.phone || '',
        place: tVal === 'home'
          ? ((value.place && value.place !== 'บ้านผู้ป่วย') ? value.place : (addrRaw || 'บ้านผู้ป่วย'))
          : value.place,
      };

      onChange(newVal);

      // ถ้าเป็นบ้านผู้ป่วย → โหลดรายการของใช้ครั้งก่อน
      if (tVal === 'home' && newVal.hn) {
        fetchLatestNeeds(newVal.hn);
      }
    } catch (e: any) {
      setVerifyErr(e?.message || 'ตรวจสอบไม่สำเร็จ');
    } finally {
      setVerifyLoading(false);
    }

  };
  const TYPE_VALUE_FROM_LABEL = (label?: string) =>
    label === 'โรงพยาบาล' ? 'hospital'
    : label === 'บ้านผู้ป่วย' ? 'home'
    : (label || '');

  function getPatientAddressRaw(p: any): string {
    const v =
      p?.address ??           // ← คุณบอกว่ามีฟิลด์นี้
      p?.address_full ??
      p?.home_address ??
      p?.address_text ??
      p?.addr ??
      '';
    return typeof v === 'string' ? v : String(v ?? '');
  }

  const [latestNeeds, setLatestNeeds] = useState<any[]>([]);

  const fetchLatestNeeds = React.useCallback(async (patId: string) => {
    if (!patId) return;
    try {
      const url = `/api/patients/${encodeURIComponent(patId)}/home-needs/latest`;
      const res = await http(url);
      const arr = (res?.data && Array.isArray(res.data)) ? res.data : [];
      setLatestNeeds(arr);
    } catch {
      setLatestNeeds([]);
    }
  }, []);

  /* เมื่อสลับประเภท ให้ล้าง/ตั้งค่าอัตโนมัติให้สอดคล้อง back-end */
  useEffect(() => {
    const t = TYPE_VALUE_FROM_LABEL(value.type);
    if (t === 'home') {
      const addrRaw = getPatientAddressRaw(patientInfo); // ดึงที่อยู่ “ดิบ”
      const hasUserTyped = value.place && value.place !== 'บ้านผู้ป่วย';
      onChange({
        ...value,
        place: hasUserTyped ? value.place : (addrRaw || 'บ้านผู้ป่วย'),
        hospital_address: '', // เคลียร์ช่อง รพ. เมื่อสลับเป็นบ้าน
      });
      if (value.hn) fetchLatestNeeds(value.hn); // ← โหลดรายการของใช้ครั้งก่อน
    } else if (t === 'hospital') {
      onChange({ ...value, place: '', hospital_address: value.hospital_address || '' });
      setTimeout(() => hospitalInputRef.current?.focus(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.type, patientInfo]);

  function pickPatientFromLookup(p: {
    patients_id: string;
    pname?: string; first_name?: string; last_name?: string;
    phone_number?: string;
  }) {
    const name = [p.pname, p.first_name, p.last_name]
      .filter(Boolean).join(' ').replace(/\s/g, ' ').trim();
    const hn = normalizeHN(p.patients_id || '');
    const next = {
      ...form,
      patient: name || hn,
      hn,
      phone: p.phone_number || form.phone,
    };
    setForm(next);
    setErrors(validate(next));
    setLookupOpen(false);
    toast.fire({ icon: 'success', title: `เลือกผู้ป่วย: ${name || hn}` });
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${className}`}>
      {/* HN + ตรวจสอบ */}
      <label className="sm:col-span-2">
        <div className="mb-1 text-sm text-gray-700">รหัสผู้ป่วย (HN)</div>
        <div className="flex gap-2">
          <input
            ref={hnInputRef}
            className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${errors?.hn ? 'border-red-300 focus:ring-red-100' : 'border-gray-300 focus:ring-purple-200'}`}
            placeholder="เช่น HN-00000001 หรือ 1"
            value={value.hn || ''}
            onChange={(e) => { setVerifyErr(''); setPatientInfo(null); onChange({ ...value, hn: e.target.value }); }}
            onBlur={(e) => onChange({ ...value, hn: normalizeHN(e.target.value) })}
          />
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifyLoading}
            className="px-4 sm:px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-60"
          >
            {verifyLoading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบ'}
          </button>
        </div>
        <div className="mt-2">
          <button
            type="button"
            className="text-sm text-blue-600 hover:text-blue-700 underline"
            onClick={() => setLookupOpen(true)}
          >
            ลืมรหัส (ค้นหาด้วยข้อมูลอื่น)
          </button>
        </div>
        <PatientLookupModal
          open={lookupOpen}
          onClose={() => setLookupOpen(false)}
          onSelect={(p) => {
            // สร้างชื่อเต็ม
            const name = [p.pname, p.first_name, p.last_name]
              .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

            const hn = normalizeHN(p.patients_id || '');
            const tVal = TYPE_VALUE_FROM_LABEL(value.type);
            const addrRaw = getPatientAddressRaw(p);

            // อัปเดตค่าในฟอร์มผ่าน onChange
            const next = {
              ...value,
              hn,
              patient: name || hn,
              phone: p.phone_number || value.phone || '',
            };

            // ถ้าเป็น "บ้านผู้ป่วย" ให้ช่วยเติมที่อยู่อัตโนมัติ (ถ้ายังว่าง/เป็นค่าดีฟอลต์)
            if (tVal === 'home') {
              const hasUserTyped = value.place && value.place !== 'บ้านผู้ป่วย';
              next.place = hasUserTyped ? value.place : (addrRaw || 'บ้านผู้ป่วย');
            }

            onChange(next);
            setPatientInfo(p);        // เก็บไว้โชว์การ์ดข้อมูลผู้ป่วย
            setLookupOpen(false);

            // โหลด "สิ่งที่ต้องเตรียมจากครั้งก่อน" ถ้าเป็นเยี่ยมบ้าน
            if (tVal === 'home' && hn) {
              fetchLatestNeeds(hn);
            }
          }}
        />
        {errors?.hn && <div className="mt-1 text-xs text-red-600">{errors.hn}</div>}
        {verifyErr && <div className="mt-2 text-sm text-red-600">{verifyErr}</div>}
      </label>

      {/* ชื่อผู้ป่วย */}
      <label className="sm:col-span-2">
        <div className="mb-1 text-sm text-gray-700">ผู้ป่วย</div>
        <input
          className="w-full px-3 py-2 border rounded-lg border-gray-200 bg-gray-50 text-gray-700"
          value={value.patient || ''}
          readOnly
          placeholder="ตรวจสอบ HN เพื่อเติมชื่ออัตโนมัติ"
        />
      </label>

      {/* การ์ดข้อมูลผู้ป่วย */}
      {patientInfo && (
        <div className="sm:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
            {(() => {
              const p = patientInfo;
              const fullname = `${p.pname ?? ''}${p.first_name ?? ''} ${p.last_name ?? ''}`.replace(/\s+/g, ' ').trim() || '-';
              const ageText =
                p.age != null && p.age !== ''
                  ? `${p.age} ปี`
                  : (p.birthdate ? calcAgeFromBirthdate(p.birthdate) : '-');
              const gender = p.gender || '-';
              const blood = [p.blood_group || '-', p.bloodgroup_rh || ''].filter(Boolean).join(' ');
              const disease = p.disease || '-';
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
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
                  <div className="md:col-span-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                    <div className="text-xs text-gray-500">โรคประจำตัว</div>
                    <div className="text-gray-900">{disease}</div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* วันที่ */}
      <label className="sm:col-span-2">
        <div className="mb-1 text-sm text-gray-700">วันที่</div>
        <DatePickerField
          value={value.date || ''}
          onChange={(d: string) => onChange({ ...value, date: d })}
        />
        {errors?.date && <div className="mt-1 text-xs text-red-600">{errors.date}</div>}
      </label>

      {/* เวลาเริ่ม/สิ้นสุด */}
      <label>
        <div className="mb-1 text-sm text-gray-700">เริ่ม</div>
        <TimePicker
          value={value.start || ''}
          onChange={(t: string) => onChange({ ...value, start: t })}
          mode="select"
        />
        {errors?.start && <div className="mt-1 text-xs text-red-600">{errors.start}</div>}
      </label>

      <label>
        <div className="mb-1 text-sm text-gray-700">สิ้นสุด</div>
        <TimePicker
          value={value.end || ''}
          onChange={(t: string) => onChange({ ...value, end: t })}
          mode="select"
        />
        {errors?.end && <div className="mt-1 text-xs text-red-600">{errors.end}</div>}
      </label>

      {/* ประเภท */}
      <label>
        <div className="mb-1 text-sm text-gray-700">ประเภท</div>
        <select
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${errors?.type ? 'border-red-300 focus:ring-red-100' : 'border-gray-300 focus:ring-purple-200'}`}
          value={value.type || ''}
          onChange={(e) => onChange({ ...value, type: e.target.value })}
        >
          <option value="">เลือกประเภท</option>
          {TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        {errors?.type && <div className="mt-1 text-xs text-red-600">{errors.type}</div>}
      </label>

      {/* สถานที่ / ที่อยู่โรงพยาบาล (แสดงตามประเภท) */}
      {TYPE_VALUE_FROM_LABEL(value.type) === 'hospital' ? (
        <label>
          <div className="mb-1 text-sm text-gray-700">ชื่อ/ที่อยู่โรงพยาบาล</div>
          <input
            ref={hospitalInputRef}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${errors?.hospital_address ? 'border-red-300 focus:ring-red-100' : 'border-gray-300 focus:ring-purple-200'}`}
            placeholder="เช่น รพ.ตัวอย่าง ชั้น 3 แผนกอายุรกรรม"
            value={value.hospital_address || ''}
            onChange={(e) => onChange({ ...value, hospital_address: e.target.value })}
          />
          {errors?.hospital_address && <div className="mt-1 text-xs text-red-600">{errors.hospital_address}</div>}
          <div className="mt-1 text-xs text-gray-500">* ไม่จำเป็นต้องเลือก “สถานที่” ด้านล่างเมื่อเป็นโรงพยาบาล</div>
        </label>
      ) : (
         <label className="sm:col-span-2">
          <div className="mb-1 text-sm text-gray-700">ที่อยู่บ้านผู้ป่วย</div>
          <textarea
            rows={2}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 border-gray-300 focus:ring-purple-200"
            placeholder="ระบบจะเติมจากข้อมูลผู้ป่วยอัตโนมัติหลังตรวจสอบ (แก้ไขได้)"
            value={value.place || ''}
            onChange={(e) => onChange({ ...value, place: e.target.value })}
          />
        </label>
      )}

      {TYPE_VALUE_FROM_LABEL(value.type) === 'home' && latestNeeds.length > 0 && (
        <div className="sm:col-span-2 p-3 rounded-xl border border-amber-300 bg-amber-50">
          <div className="text-sm font-medium text-amber-800 mb-2">
            สิ่งที่ต้องเตรียมจากครั้งก่อน
          </div>
          <ul className="list-disc pl-5 text-sm text-amber-900 space-y-1">
            {latestNeeds.map((it: any, idx: number) => (
              <li key={idx}>
                {typeof it === 'string'
                  ? it
                  : [it.item, it.qty ? `x${it.qty}` : '', it.note].filter(Boolean).join(' · ')
                }
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => {
                const bullets = latestNeeds.map((it: any) =>
                  typeof it === 'string'
                    ? `• ${it}`
                    : `• ${[it.item, it.qty ? `x${it.qty}` : '', it.note].filter(Boolean).join(' · ')}`
                ).join('\n');
                onChange({
                  ...value,
                  note: (value.note ? (value.note + '\n\n') : '') + `สิ่งที่ต้องเตรียมจากครั้งก่อน:\n${bullets}`
                });
              }}
            >
              เติมลงหมายเหตุ
            </button>
          </div>
        </div>
      )}

      {/* สถานะ */}
      <label className="sm:col-span-2">
        <div className="mb-1 text-sm text-gray-700">สถานะ</div>
        <select
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 border-gray-300 focus:ring-purple-200"
          value={value.status || 'pending'}
          onChange={(e) => onChange({ ...value, status: e.target.value as Status })}
        >
          <option value="pending">รอดำเนินการ</option>
          <option value="done">เสร็จสิ้น</option>
          <option value="cancelled">ยกเลิก</option>
        </select>
      </label>

      {/* หมายเหตุ */}
      <label className="sm:col-span-2">
        <div className="mb-1 text-sm text-gray-700">หมายเหตุ</div>
        <textarea
          rows={3}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 border-gray-300 focus:ring-purple-200"
          value={value.note || ''}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
        />
      </label>
    </div>
    

    
  );
}
