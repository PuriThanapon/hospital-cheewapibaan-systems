'use client';
import React, { useEffect, useRef, useState } from 'react';
import DatePickerField from '@/app/components/DatePicker';
// ⬇️ ลบ MedicalThaiTimePicker ออก
// import MedicalThaiTimePicker from '../TimePicker';
import PatientLookupModal from '../modals/PatientLookupModal';

type Status = 'pending' | 'done' | 'cancelled';

export type AppointmentFormValue = {
  patient?: string;
  hn?: string;
  phone?: string;
  date?: string;   // YYYY-MM-DD
  start?: string;  // HH:mm
  end?: string;    // HH:mm
  type?: string;   // label ไทย เช่น "โรงพยาบาล" | "บ้านผู้ป่วย"
  place?: string;
  hospital_address?: string;
  status?: Status;
  note?: string;
  department?: string;
};

type Props = {
  value: AppointmentFormValue;
  onChange: (v: AppointmentFormValue) => void;
  errors?: Partial<Record<keyof AppointmentFormValue, string>>;
  TYPE_OPTIONS: string[];
  PLACE_OPTIONS: string[];
  DEPT_OPTIONS?: string[];
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

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ------------- Time options (24 ชม. ไทย, ทุก 30 นาที) ------------- */
type TimeOpt = { value: string; label: string };
function buildTimeOptions(stepMin = 30): TimeOpt[] {
  const opts: TimeOpt[] = [{ value: '', label: 'เลือกเวลา' }];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const v = `${hh}:${mm}`;
      opts.push({ value: v, label: `${v} น.` });
    }
  }
  return opts;
}
const TH_TIME_OPTIONS = buildTimeOptions(15);

/* ------------------------------ Component ------------------------------ */
export default function AppointmentForm({
  value,
  onChange,
  errors,
  TYPE_OPTIONS = ['โรงพยาบาล', 'บ้านผู้ป่วย'],
  PLACE_OPTIONS,
  DEPT_OPTIONS = [
    'OPD','IPD','ER','ICU','OR',
    'Medicine','Surgery','Orthopedics','ENT','Ophthalmology',
    'Dental','Rehab','Pediatrics','OB-GYN','Psychiatry',
    'Public Health'
  ],
  className = '',
}: Props) {
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [verifyErr, setVerifyErr] = useState('');
  const [patientInfo, setPatientInfo] = useState<any | null>(null);
  const hnInputRef = useRef<HTMLInputElement | null>(null);
  const hospitalInputRef = useRef<HTMLInputElement | null>(null);

  const LABEL_FROM_VALUE = (v?: string) =>
    v === 'hospital' ? 'โรงพยาบาล'
    : v === 'home'   ? 'บ้านผู้ป่วย'
    : (v || '');

  const TYPE_VALUE_FROM_LABEL = (label?: string) =>
    label === 'โรงพยาบาล' ? 'hospital'
    : label === 'บ้านผู้ป่วย' ? 'home'
    : (label || '');

  useEffect(() => {
    if (!value?.date) {
      onChange({ ...value, date: todayISO() });
    }
  }, [value?.date]);

  const handleWheelBlock: React.WheelEventHandler<HTMLDivElement | HTMLSelectElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleKeyBlock: React.KeyboardEventHandler<HTMLDivElement | HTMLSelectElement> = (e) => {
    const k = e.key;
    if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'PageUp' || k === 'PageDown') {
      e.preventDefault();
      e.stopPropagation();
    }
  };

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
      const addrRaw = getPatientAddressRaw(p);

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

      if (tVal === 'home' && newVal.hn) {
        fetchLatestNeeds(newVal.hn);
      }
    } catch (e: any) {
      setVerifyErr(e?.message || 'ตรวจสอบไม่สำเร็จ');
    } finally {
      setVerifyLoading(false);
    }
  };

  function getPatientAddressRaw(p: any): string {
    const v =
      p?.address ??
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

  useEffect(() => {
    const t = TYPE_VALUE_FROM_LABEL(value.type);
    if (t === 'home') {
      const addrRaw = getPatientAddressRaw(patientInfo);
      const hasUserTyped = value.place && value.place !== 'บ้านผู้ป่วย';
      onChange({
        ...value,
        place: hasUserTyped ? value.place : (addrRaw || 'บ้านผู้ป่วย'),
        hospital_address: '',
        department: '',
      });
      if (value.hn) fetchLatestNeeds(value.hn);
    } else if (t === 'hospital') {
      onChange({
        ...value,
        place: '',
        hospital_address: value.hospital_address || '',
        department: value.department || '',
      });
      setTimeout(() => hospitalInputRef.current?.focus(), 0);
    }
  }, [value.type, patientInfo]);

  const isHospital = TYPE_VALUE_FROM_LABEL(value.type) === 'hospital';

  const getStatusStyle = (status: Status) => {
    switch (status) {
      case 'pending':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'done':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-3xl shadow-xl border border-blue-100">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl mb-4 shadow-lg">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
          ระบบนัดหมายผู้ป่วย
        </h1>
        <p className="text-gray-600 text-lg">Patient Appointment System</p>
        <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 mx-auto mt-4 rounded-full"></div>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-6 ${className}`}>
        {/* HN + ตรวจสอบ */}
        <div className="sm:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <label className="block">
            <div className="mb-3 text-sm font-semibold text-gray-700 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              รหัสผู้ป่วย (HN)
              <span className="text-red-500">*</span>
            </div>
            <div className="flex gap-3">
              <input
                ref={hnInputRef}
                className={`flex-1 px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 font-mono ${
                  errors?.hn 
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-100' 
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-100'
                }`}
                placeholder="เช่น HN-00000001 หรือ 1"
                value={value.hn || ''}
                onChange={(e) => { setVerifyErr(''); setPatientInfo(null); onChange({ ...value, hn: e.target.value }); }}
                onBlur={(e) => onChange({ ...value, hn: normalizeHN(e.target.value) })}
              />
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifyLoading}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {verifyLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ตรวจสอบ...
                  </div>
                ) : (
                  'ตรวจสอบ'
                )}
              </button>
            </div>
            <div className="mt-3">
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-700 underline font-medium transition-colors"
                onClick={() => setLookupOpen(true)}
              >
                ลืมรหัส (ค้นหาด้วยข้อมูลอื่น)
              </button>
            </div>
            <PatientLookupModal
              open={lookupOpen}
              onClose={() => setLookupOpen(false)}
              onSelect={(p) => {
                const name = [p.pname, p.first_name, p.last_name]
                  .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

                const hn = normalizeHN(p.patients_id || '');
                const tVal = TYPE_VALUE_FROM_LABEL(value.type);
                const addrRaw = getPatientAddressRaw(p);

                const next: AppointmentFormValue = {
                  ...value,
                  hn,
                  patient: name || hn,
                  phone: p.phone_number || value.phone || '',
                };

                if (tVal === 'home') {
                  const hasUserTyped = value.place && value.place !== 'บ้านผู้ป่วย';
                  next.place = hasUserTyped ? value.place : (addrRaw || 'บ้านผู้ป่วย');
                  next.department = '';
                }

                onChange(next);
                setPatientInfo(p);

                if (tVal === 'home' && hn) {
                  fetchLatestNeeds(hn);
                }
              }}
            />
            {errors?.hn && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-sm text-red-600 font-medium">{errors.hn}</div>
              </div>
            )}
            {verifyErr && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-sm text-red-600 font-medium">{verifyErr}</div>
              </div>
            )}
          </label>
        </div>

        {/* ชื่อผู้ป่วย */}
        <div className="sm:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <label className="block">
            <div className="mb-3 text-sm font-semibold text-gray-700 flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              ชื่อผู้ป่วย
            </div>
            <input
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl bg-gray-50 text-gray-700 font-medium transition-colors"
              value={value.patient || ''}
              readOnly
              placeholder="ตรวจสอบ HN เพื่อเติมชื่ออัตโนมัติ"
            />
          </label>
        </div>

        {/* การ์ดข้อมูลผู้ป่วย */}
        {patientInfo && (
          <div className="sm:col-span-2">
            <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-lg p-6">
              <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                ข้อมูลผู้ป่วย
              </h3>
              {(() => {
                const p = patientInfo;
                const ageText =
                  p.age != null && p.age !== ''
                    ? `${p.age} ปี`
                    : (p.birthdate ? calcAgeFromBirthdate(p.birthdate) : '-');
                const gender = p.gender || '-';
                const blood = [p.blood_group || '-', p.bloodgroup_rh || ''].filter(Boolean).join(' ');
                const disease = p.disease || '-';
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                      <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide">อายุ</div>
                      <div className="text-gray-900 font-medium mt-1">{ageText}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                      <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">เพศ</div>
                      <div className="text-gray-900 font-medium mt-1">{gender}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                      <div className="text-xs font-semibold text-red-600 uppercase tracking-wide">กรุ๊ปเลือด</div>
                      <div className="text-gray-900 font-bold mt-1">{blood}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                      <div className="text-xs font-semibold text-green-600 uppercase tracking-wide">ประเภทผู้ป่วย</div>
                      <div className="text-gray-900 font-medium mt-1">{p.patient_type || '-'}</div>
                    </div>
                    <div className="md:col-span-2 p-4 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="text-xs font-semibold text-amber-600 uppercase tracking-wide">โรคประจำตัว</div>
                      <div className="text-gray-900 mt-1">{disease}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* วันที่และเวลา */}
        <div className="sm:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            วันที่และเวลานัดหมาย
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* วันที่ */}
            <div>
              <label className="block">
                <div className="mb-2 text-sm font-medium text-gray-700">วันที่นัดหมาย</div>
                <div
                  onWheel={handleWheelBlock}
                  onKeyDown={handleKeyBlock}
                  style={{ touchAction: 'manipulation' }}
                >
                  <DatePickerField
                    value={value.date || ''}
                    onChange={(d: string) => onChange({ ...value, date: d })}
                    min={todayISO() as any}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                  />
                </div>
                {errors?.date && (
                  <div className="mt-1 text-xs text-red-600 font-medium">{errors.date}</div>
                )}
              </label>
            </div>

            {/* เวลาเริ่ม */}
            <div>
              <label className="block">
                <div className="mb-2 text-sm font-medium text-gray-700">เวลาเริ่ม</div>
                <select
                  lang="th"
                  className="w-full px-4 py-1.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:border-blue-500 focus:ring-blue-100 transition-all duration-200"
                  value={value.start || ''}
                  onChange={(e) => onChange({ ...value, start: e.target.value })}
                  onWheel={handleWheelBlock}
                  onKeyDown={handleKeyBlock}
                >
                  {TH_TIME_OPTIONS.map(t => (
                    <option key={`s-${t.value || 'blank'}`} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {errors?.start && (
                  <div className="mt-1 text-xs text-red-600 font-medium">{errors.start}</div>
                )}
              </label>
            </div>

            {/* เวลาสิ้นสุด */}
            <div>
              <label className="block">
                <div className="mb-2 text-sm font-medium text-gray-700">เวลาสิ้นสุด</div>
                <select
                  lang="th"
                  className="w-full px-4 py-1.5 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:border-blue-500 focus:ring-blue-100 transition-all duration-200"
                  value={value.end || ''}
                  onChange={(e) => onChange({ ...value, end: e.target.value })}
                  onWheel={handleWheelBlock}
                  onKeyDown={handleKeyBlock}
                >
                  {TH_TIME_OPTIONS.map(t => (
                    <option key={`e-${t.value || 'blank'}`} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {errors?.end && (
                  <div className="mt-1 text-xs text-red-600 font-medium">{errors.end}</div>
                )}
              </label>
            </div>
          </div>
        </div>

        {/* ประเภทการนัดหมายและสถานที่ */}
        <div className="sm:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
            ประเภทและสถานที่
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* ประเภท */}
            <div>
              <label className="block">
                <div className="mb-2 text-sm font-medium text-gray-700">
                  ประเภทการนัดหมาย
                  <span className="text-red-500 ml-1">*</span>
                </div>
                <select
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 ${
                    errors?.type 
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-100' 
                      : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-100'
                  }`}
                  value={LABEL_FROM_VALUE(value.type)}
                  onChange={(e) => onChange({ ...value, type: e.target.value })}
                >
                  <option value="">เลือกประเภทการนัดหมาย</option>
                  {TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                {errors?.type && (
                  <div className="mt-1 text-xs text-red-600 font-medium">{errors.type}</div>
                )}
              </label>
            </div>

            {/* สถานะ */}
            <div>
              <label className="block">
                <div className="mb-2 text-sm font-medium text-gray-700">สถานะ</div>
                <select
                  className={`w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:border-gray-400 focus:ring-gray-100 transition-all duration-200 ${getStatusStyle(value.status || 'pending')}`}
                  value={value.status || 'pending'}
                  onChange={(e) => onChange({ ...value, status: e.target.value as Status })}
                >
                  <option value="pending">รอดำเนินการ</option>
                  <option value="done">เสร็จสิ้น</option>
                  <option value="cancelled">ยกเลิก</option>
                </select>
              </label>
            </div>
          </div>

          {/* สถานที่ / ที่อยู่โรงพยาบาล + แผนก */}
          {isHospital ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block">
                  <div className="mb-2 text-sm font-medium text-gray-700">
                    ชื่อ/ที่อยู่โรงพยาบาล
                    <span className="text-red-500 ml-1">*</span>
                  </div>
                  <input
                    ref={hospitalInputRef}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 ${
                      errors?.hospital_address 
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-100' 
                        : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-100'
                    }`}
                    placeholder="เช่น รพ.ตัวอย่าง ชั้น 3"
                    value={value.hospital_address || ''}
                    onChange={(e) => onChange({ ...value, hospital_address: e.target.value })}
                  />
                  {errors?.hospital_address && (
                    <div className="mt-1 text-xs text-red-600 font-medium">{errors.hospital_address}</div>
                  )}
                </label>
              </div>

              <div>
                <label className="block">
                  <div className="mb-2 text-sm font-medium text-gray-700">แผนกที่นัดหมาย</div>
                  <input
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 ${
                      errors?.department 
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-100' 
                        : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-100'
                    }`}
                    placeholder="เช่น อายุรกรรม / กุมารเวชฯ"
                    value={value.department || ''}
                    onChange={(e) => onChange({ ...value, department: e.target.value })}
                    list="dept-suggestions"
                  />
                  <datalist id="dept-suggestions">
                    {DEPT_OPTIONS.map(dept => (
                      <option key={dept} value={dept} />
                    ))}
                  </datalist>
                  {errors?.department && (
                    <div className="mt-1 text-xs text-red-600 font-medium">{errors.department}</div>
                  )}
                </label>
              </div>
            </div>
          ) : (
            <div>
              <label className="block">
                <div className="mb-2 text-sm font-medium text-gray-700">ที่อยู่บ้านผู้ป่วย</div>
                <textarea
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:border-blue-500 focus:ring-blue-100 transition-all duration-200 resize-none"
                  placeholder="ระบบจะเติมจากข้อมูลผู้ป่วยอัตโนมัติหลังตรวจสอบ (แก้ไขได้)"
                  value={value.place || ''}
                  onChange={(e) => onChange({ ...value, place: e.target.value })}
                />
              </label>
            </div>
          )}
        </div>

        {/* สิ่งที่ต้องเตรียมจากครั้งก่อน */}
        {TYPE_VALUE_FROM_LABEL(value.type) === 'home' && latestNeeds.length > 0 && (
          <div className="sm:col-span-2">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-amber-800">สิ่งที่ต้องเตรียม</h4>
                  <p className="text-sm text-amber-700">จากการเยียมครั้งก่อน</p>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-4 border border-amber-200 mb-4">
                <ul className="space-y-2 text-sm text-gray-700">
                  {latestNeeds.map((it: any, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
                      <span>
                        {typeof it === 'string'
                          ? it
                          : [it.item, it.qty ? `x${it.qty}` : '', it.note].filter(Boolean).join(' · ')
                        }
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-medium hover:from-amber-700 hover:to-orange-700 transition-all duration-200 shadow-md hover:shadow-lg"
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

        {/* หมายเหตุ */}
        <div className="sm:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <label className="block">
            <div className="mb-3 text-sm font-semibold text-gray-700 flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              หมายเหตุการนัดหมาย
            </div>
            <textarea
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:border-purple-500 focus:ring-purple-100 transition-all duration-200 resize-none"
              placeholder="ระบุรายละเอียดเพิ่มเติม เช่น อาการพิเศษ สิ่งที่ต้องเตรียม หรือข้อมูลสำคัญอื่นๆ"
              value={value.note || ''}
              onChange={(e) => onChange({ ...value, note: e.target.value })}
            />
          </label>
        </div>

        {/* สรุปการนัดหมาย */}
        {value.patient && value.date && value.start && (
          <div className="sm:col-span-2">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-green-800">สรุปการนัดหมาย</h4>
                  <p className="text-sm text-green-700">ตรวจสอบข้อมูลก่อนบันทึก</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-white rounded-xl p-4 border border-green-200">
                  <div className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">ผู้ป่วย</div>
                  <div className="font-medium text-gray-900">{value.patient}</div>
                  <div className="text-gray-600 text-xs mt-1">{value.hn}</div>
                </div>
                
                <div className="bg-white rounded-xl p-4 border border-green-200">
                  <div className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">วันที่และเวลา</div>
                  <div className="font-medium text-gray-900">
                    {new Date(value.date).toLocaleDateString('th-TH', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                  <div className="text-gray-600 text-xs mt-1">
                    {value.start}{value.end ? ` - ${value.end}` : ''}
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-4 border border-green-200">
                  <div className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">ประเภท</div>
                  <div className="font-medium text-gray-900">{value.type || '-'}</div>
                  {value.department && (
                    <div className="text-gray-600 text-xs mt-1">แผนก: {value.department}</div>
                  )}
                </div>
                
                <div className="bg-white rounded-xl p-4 border border-green-200">
                  <div className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">สถานะ</div>
                  <div className="font-medium">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(value.status || 'pending')}`}>
                      {value.status === 'pending' && 'รอดำเนินการ'}
                      {value.status === 'done' && 'เสร็จสิ้น'}
                      {value.status === 'cancelled' && 'ยกเลิก'}
                    </span>
                  </div>
                </div>
                
                {(value.hospital_address || value.place) && (
                  <div className="md:col-span-2 bg-white rounded-xl p-4 border border-green-200">
                    <div className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">สถานที่</div>
                    <div className="font-medium text-gray-900">
                      {value.hospital_address || value.place}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
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
