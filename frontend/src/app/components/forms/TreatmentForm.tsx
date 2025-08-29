'use client';
import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import makeAnimated from 'react-select/animated';
import dynamic from 'next/dynamic';
import DatePickerField from '../DatePicker';
import PatientLookupModal from '../modals/PatientLookupModal';

const Select = dynamic(() => import('react-select'), { ssr: false });
const animatedComponents = makeAnimated();
const menuPortalTarget = typeof window !== 'undefined' ? document.body : undefined;

// Blue medical theme for react-select
const rsx = {
  control: (base, state) => ({
    ...base,
    minHeight: 46,
    borderRadius: 12,
    borderColor: state.isFocused ? '#3b82f6' : '#e2e8f0',
    borderWidth: '2px',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none',
    ':hover': { borderColor: '#3b82f6' },
    color: '#1e293b',
    backgroundColor: '#ffffff',
  }),
  menuPortal: (base) => ({ ...base, color: '#1e293b', zIndex: 12050 }),
  menu: (base) => ({ 
    ...base, 
    zIndex: 12050,
    borderRadius: 12,
    border: '2px solid #e2e8f0',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? '#eff6ff' : 'white',
    color: '#1e293b',
    fontWeight: state.isSelected ? '600' : '400',
    ':active': { backgroundColor: '#dbeafe' },
  }),
};

const treatmentTypeOptions = [
  { value: 'ประจำ', label: 'ประจำ' },
  { value: 'ทำครั้งเดียว', label: 'ทำครั้งเดียว' },
];

export type TreatmentDraft = {
  patients_id: string;
  treatment_type: '' | 'ประจำ' | 'ทำครั้งเดียว';
  treatment_date: string; // YYYY-MM-DD
  diagnosis_summary?: string;
  note?: string;
};

export type TreatmentFormHandle = {
  validate: () => boolean;
  reset: () => void;
  setPatientInfo?: (p: any) => void;
};

type Props = {
  value: TreatmentDraft;
  onChange: (v: TreatmentDraft) => void;
  className?: string;
  onOpenLookup?: () => void;
};

/** http helper */
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

/** utils */
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

/** smart fetch */
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

/** form */
const TreatmentForm = forwardRef<TreatmentFormHandle, Props>(
  ({ value, onChange, className = '', onOpenLookup }, ref) => {
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [verifyErr, setVerifyErr] = useState('');
    const [patientInfo, setPatientInfo] = useState<any | null>(null);
    const [lookupOpen, setLookupOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      validate: () => {
        const e: Record<string, string> = {};
        if (!value.patients_id?.trim()) e.patients_id = 'กรุณากรอกรหัสผู้ป่วย';
        if (!value.treatment_type) e.treatment_type = 'กรุณาเลือกประเภทการรักษา';
        if (!value.treatment_date) e.treatment_date = 'กรุณาเลือกวันที่บันทึก';
        setErrors(e);
        return Object.keys(e).length === 0;
      },
      reset: () => {
        setErrors({});
        setVerifyLoading(false);
        setVerifyErr('');
        setPatientInfo(null);
      },
      setPatientInfo: (p: any) => setPatientInfo(p),
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
      <>
        <div className={`space-y-8 bg-slate-50 p-8 ${className}`}>
          {/* Header Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">แบบฟอร์มบันทึกการรักษา</h1>
            <p className="text-slate-600">Treatment Record Form</p>
            <div className="w-32 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 mx-auto mt-4 rounded-full"></div>
          </div>

          {/* ข้อมูลผู้ป่วย */}
          <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-slate-200">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3 pb-4 border-b-2 border-slate-200">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center">
                  <span className="text-blue-600 text-sm font-bold">ID</span>
                </div>
              </div>
              ข้อมูลผู้ป่วย
              <span className="text-sm font-normal text-slate-500 ml-auto">Patient Information</span>
            </h3>

            {/* รหัสผู้ป่วย + ตรวจสอบ */}
            <div className="mb-8">
              <label className="text-sm font-semibold text-slate-700 mb-3 block flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                รหัสผู้ป่วย (HN)
                <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <input
                  className="flex-1 border-2 rounded-xl px-5 py-4 text-sm border-slate-300 bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 font-mono tracking-wide"
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
                  className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:from-blue-700 active:to-blue-800 text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  disabled={verifyLoading || !value.patients_id?.trim()}
                >
                  {verifyLoading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบ'}
                </button>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  className="text-sm text-cyan-600 hover:text-cyan-700 underline decoration-2 underline-offset-4 font-semibold transition-colors duration-200 flex items-center gap-2"
                  onClick={() => (onOpenLookup ? onOpenLookup() : setLookupOpen(true))}
                >
                  <div className="w-4 h-4 bg-cyan-100 rounded-full flex items-center justify-center">
                    <span className="text-cyan-600 text-xs font-bold">?</span>
                  </div>
                  ลืมรหัส (ค้นหาด้วยข้อมูลอื่น)
                </button>
              </div>
              {errors.patients_id && (
                <div className="text-red-600 text-sm mt-3 bg-red-50 border-l-4 border-red-400 pl-4 py-2 rounded-r-lg">
                  {errors.patients_id}
                </div>
              )}
              {verifyErr && (
                <div className="text-red-600 text-sm mt-3 bg-red-50 border-2 border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-red-600 text-xs font-bold">!</span>
                  </div>
                  <span>{verifyErr}</span>
                </div>
              )}
            </div>

            {/* การ์ดข้อมูลผู้ป่วย */}
            {patientInfo && (
              <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50 rounded-2xl border-2 border-blue-200 p-8 shadow-inner">
                <div className="flex items-center gap-4 mb-8 pb-4 border-b-2 border-blue-300">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center">
                      <span className="text-blue-600 text-sm font-bold">P</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-slate-800">ข้อมูลผู้ป่วย</h4>
                    <p className="text-slate-600 text-sm">Patient Details</p>
                  </div>
                  <div className="bg-green-100 text-green-800 text-xs font-bold px-4 py-2 rounded-full border border-green-300">
                    ยืนยันแล้ว
                  </div>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="bg-white p-5 rounded-xl border-2 border-slate-200 shadow-sm">
                        <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                          ชื่อ-นามสกุล
                        </div>
                        <div className="text-slate-900 font-semibold text-lg">{fullname}</div>
                      </div>
                      
                      <div className="bg-white p-5 rounded-xl border-2 border-slate-200 shadow-sm">
                        <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                          อายุ
                        </div>
                        <div className="text-slate-900 font-semibold text-lg">{ageText}</div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border-2 border-slate-200 shadow-sm">
                        <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                          เพศ
                        </div>
                        <div className="text-slate-900 font-semibold text-lg">{gender}</div>
                      </div>

                      <div className="bg-gradient-to-br from-red-50 to-pink-50 p-5 rounded-xl border-2 border-red-300 shadow-sm">
                        <div className="text-xs font-bold text-red-700 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                            <div className="w-1 h-1 bg-white rounded-full"></div>
                          </div>
                          กรุ๊ปเลือด
                        </div>
                        <div className="text-red-900 font-bold text-xl">{blood}</div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border-2 border-slate-200 shadow-sm">
                        <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                          น้ำหนัก
                        </div>
                        <div className="text-slate-900 font-semibold text-lg">{p.weight ? `${p.weight} กก.` : '-'}</div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border-2 border-slate-200 shadow-sm">
                        <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                          ส่วนสูง
                        </div>
                        <div className="text-slate-900 font-semibold text-lg">{p.height ? `${p.height} ซม.` : '-'}</div>
                      </div>

                      <div className="lg:col-span-3 bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-xl border-2 border-amber-300 shadow-sm">
                        <div className="text-xs font-bold text-amber-700 mb-2 uppercase tracking-wider flex items-center gap-2">
                          <div className="w-3 h-3 bg-amber-500 rounded-full flex items-center justify-center">
                            <div className="w-1 h-1 bg-white rounded-full"></div>
                          </div>
                          โรคประจำตัว / ประวัติการแพทย์
                        </div>
                        <div className="text-amber-900 font-medium leading-relaxed">{disease}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ข้อมูลการรักษา */}
          <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-slate-200">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3 pb-4 border-b-2 border-slate-200">
              <div className="p-3 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl shadow-lg">
                <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center">
                  <span className="text-cyan-600 text-sm font-bold">Rx</span>
                </div>
              </div>
              ข้อมูลการรักษา
              <span className="text-sm font-normal text-slate-500 ml-auto">Treatment Information</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* ประเภทการรักษา */}
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-3 block flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-600 rounded-full"></div>
                  ประเภทการรักษา
                  <span className="text-red-500">*</span>
                </label>
                <Select
                  components={animatedComponents}
                  styles={rsx}
                  menuPortalTarget={menuPortalTarget}
                  menuPosition="fixed"
                  menuShouldBlockScroll
                  isSearchable={false}
                  isClearable={false}
                  placeholder="-- เลือกประเภทการรักษา --"
                  options={treatmentTypeOptions}
                  value={treatmentTypeOptions.find(o => o.value === value.treatment_type) ?? null}
                  onChange={(opt) =>
                    onChange({
                      ...value,
                      treatment_type: opt ? (opt as { value: 'ประจำ' | 'ทำครั้งเดียว' }).value : '',
                    })
                  }
                  name="treatment_type"
                />
                {errors.treatment_type && (
                  <div className="text-red-600 text-sm mt-3 bg-red-50 border-l-4 border-red-400 pl-4 py-2 rounded-r-lg">
                    {errors.treatment_type}
                  </div>
                )}
              </div>

              {/* วันที่รักษา */}
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-3 block flex items-center gap-2">
                  <div className="w-2 h-2 bg-sky-600 rounded-full"></div>
                  วันที่รักษา
                  <span className="text-red-500">*</span>
                </label>
                <DatePickerField
                  value={value.treatment_date}
                  onChange={(iso) => onChange({ ...value, treatment_date: iso })}
                  maxDate={new Date()}
                  placeholder="เลือกวันที่รักษา"
                />
                {errors.treatment_date && (
                  <div className="text-red-600 text-sm mt-3 bg-red-50 border-l-4 border-red-400 pl-4 py-2 rounded-r-lg">
                    {errors.treatment_date}
                  </div>
                )}
              </div>

              {/* สรุปการรักษา */}
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-3 block flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                  สรุปการรักษา
                </label>
                <input
                  className="w-full border-2 rounded-xl px-5 py-4 text-sm border-slate-300 bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 placeholder-slate-400"
                  placeholder="สรุป/วินิจฉัยโดยย่อ"
                  value={value.diagnosis_summary || ''}
                  onChange={(e) => onChange({ ...value, diagnosis_summary: e.target.value })}
                />
              </div>

              {/* หมายเหตุ */}
              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-slate-700 mb-3 block flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                  หมายเหตุ / รายละเอียดเพิ่มเติม
                </label>
                <textarea
                  rows={5}
                  className="w-full border-2 rounded-xl px-5 py-4 text-sm border-slate-300 bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-300 placeholder-slate-400 resize-none"
                  placeholder="บันทึกรายละเอียดการรักษา, อาการ, ยาที่ใช้, คำแนะนำ หรือข้อมูลสำคัญอื่นๆ"
                  value={value.note || ''}
                  onChange={(e) => onChange({ ...value, note: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* สรุปข้อมูลการบันทึก */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-6">
            <h4 className="text-sm font-bold text-blue-800 mb-4 flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">✓</span>
              </div>
              สรุปการบันทึก
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-200">
                <div className={`w-3 h-3 rounded-full ${value.patients_id ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span className={value.patients_id ? 'text-green-700 font-medium' : 'text-gray-600'}>
                  รหัสผู้ป่วย {value.patients_id ? '✓' : '✗'}
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-200">
                <div className={`w-3 h-3 rounded-full ${value.treatment_type ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span className={value.treatment_type ? 'text-green-700 font-medium' : 'text-gray-600'}>
                  ประเภทการรักษา {value.treatment_type ? '✓' : '✗'}
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-200">
                <div className={`w-3 h-3 rounded-full ${value.treatment_date ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span className={value.treatment_date ? 'text-green-700 font-medium' : 'text-gray-600'}>
                  วันที่รักษา {value.treatment_date ? '✓' : '✗'}
                </span>
              </div>
            </div>
            
            {/* แสดงข้อมูลที่กรอกแล้ว */}
            {(value.diagnosis_summary || value.note) && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200">
                <div className="text-xs font-bold text-blue-700 mb-2">ข้อมูลเพิ่มเติม:</div>
                {value.diagnosis_summary && (
                  <div className="mb-2">
                    <span className="text-xs text-slate-600 font-medium">สรุปการรักษา:</span>
                    <div className="text-sm text-slate-800">{value.diagnosis_summary}</div>
                  </div>
                )}
                {value.note && (
                  <div>
                    <span className="text-xs text-slate-600 font-medium">หมายเหตุ:</span>
                    <div className="text-sm text-slate-800">{value.note}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal ค้นหาผู้ป่วย */}
        <PatientLookupModal
          open={lookupOpen}
          onClose={() => setLookupOpen(false)}
          onSelect={(p: any) => {
            const hn = normalizePatientsId(p?.patients_id || '');
            onChange({ ...value, patients_id: hn });
            setPatientInfo(p);
            setVerifyErr('');
            setLookupOpen(false);
          }}
        />
      </>
    );
  }
);

TreatmentForm.displayName = 'TreatmentForm';
export default TreatmentForm;