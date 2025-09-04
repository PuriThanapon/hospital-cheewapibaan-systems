'use client';

import React, { forwardRef, useImperativeHandle } from 'react';
import InputField from '@/app/components/ui/InputField';
import { Calendar, Droplets, FileText, Heart, MapPin, Phone, User, FileUp } from 'lucide-react';
import DatePickerField from '@/app/components/DatePicker';
import BirthDatePicker from '@/app/components/BirthDatePicker';
import dynamic from 'next/dynamic';
import makeAnimated from 'react-select/animated';
import Swal from 'sweetalert2';
import { ClipboardList } from 'lucide-react';
import Link from 'next/link';
import BaselineForm from '@/app/components/forms/BaselineForm';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

/* ---------------- Utils ---------------- */
function calculateAge(birthdateStr) {
  if (!birthdateStr) return '-';
  const birthDate = new Date(birthdateStr);
  if (isNaN(birthDate.getTime())) return '-';
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
    years--;
    months = 12 + months;
  }
  if (today.getDate() < birthDate.getDate() && months > 0) months--;
  if (years > 0) return `${years} ปี`;
  if (months > 0) return `${months} เดือน`;
  return `0 เดือน`;
}

const animatedComponents = makeAnimated();
const Select = dynamic(() => import('react-select'), { ssr: false });
const menuPortalTarget = typeof window !== 'undefined' ? document.body : undefined;

// Updated Select styles with medical theme
const rsx = {
  control: (base, state) => ({
    ...base,
    minHeight: 32,
    borderRadius: 8,
    borderColor: state.isFocused ? '#005A50' : '#d1d5db',
    borderWidth: 2,
    boxShadow: state.isFocused ? '0 0 0 3px rgba(0,90,80,0.1)' : 'none',
    ':hover': { borderColor: '#005A50' },
    color: '#374151',
    backgroundColor: '#ffffff',
  }),
  menuPortal: (base) => ({ ...base, color: '#374151', zIndex: 9999 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#005A50' : state.isFocused ? '#f0fdf4' : 'white',
    color: state.isSelected ? 'white' : '#374151',
    ':hover': {
      backgroundColor: state.isSelected ? '#005A50' : '#ecfdf5',
    },
  }),
};

const ortherrsx = {
  control: (base, state) => ({
    ...base,
    minHeight: 46,
    borderRadius: 8,
    borderColor: state.isFocused ? '#005A50' : '#d1d5db',
    borderWidth: 2,
    boxShadow: state.isFocused ? '0 0 0 3px rgba(0,90,80,0.1)' : 'none',
    ':hover': { borderColor: '#005A50' },
    color: '#374151',
    backgroundColor: '#ffffff',
  }),
  menuPortal: (base) => ({ ...base, color: '#374151', zIndex: 9999 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#005A50' : state.isFocused ? '#f0fdf4' : 'white',
    color: state.isSelected ? 'white' : '#374151',
    ':hover': {
      backgroundColor: state.isSelected ? '#005A50' : '#ecfdf5',
    },
  }),
};

/* ---------------- Select options ---------------- */
const patientTypeOptions = [
  { value: 'ติดสังคม', label: 'ติดสังคม' },
  { value: 'ติดบ้าน', label: 'ติดบ้าน' },
  { value: 'ติดเตียง', label: 'ติดเตียง' },
];
const pnameOptions = [
  { value: 'นาย', label: 'นาย' },
  { value: 'นาง', label: 'นาง' },
  { value: 'น.ส.', label: 'น.ส.' },
  { value: 'เด็กชาย', label: 'เด็กชาย' },
  { value: 'เด็กหญิง', label: 'เด็กหญิง' },
];
const genderOptions = [
  { value: 'ชาย', label: 'ชาย' },
  { value: 'หญิง', label: 'หญิง' },
  { value: 'ไม่ระบุ', label: 'ไม่ระบุ' },
];
const bloodGroupOptions = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'AB', label: 'AB' },
  { value: 'O', label: 'O' },
];
const rhOptions = [
  { value: 'Rh+', label: 'Rh+' },
  { value: 'Rh-', label: 'Rh-' },
];
const treatatOptions = [
  { value: 'โรงพยาบาล', label: 'โรงพยาบาล' },
  { value: 'บ้าน', label: 'บ้าน' },
];

/* ---------------- Validation (เฉพาะ 7 ช่อง + เงื่อนไขผู้เสียชีวิต) ---------------- */
const FIELD_META = {
  card_id: { label: 'เลขบัตรประชาชน', type: 'thaiId', focusName: 'card_id' },
  first_name: { label: 'ชื่อ', focusName: 'first_name' },
  last_name: { label: 'นามสกุล', focusName: 'last_name' },
  gender: { label: 'เพศ', focusName: 'gender' },
  blood_group: { label: 'กรุ๊ปเลือด', focusName: 'blood_group' },
  bloodgroup_rh: { label: 'ประเภท Rh', focusName: 'bloodgroup_rh' },
  treat_at: { label: 'รักษาที่', focusName: 'treat_at' },
};
const DEFAULT_REQUIRED = Object.keys(FIELD_META);

// รายการเอกสารมาตรฐาน
const DOC_OPTIONS = [
  { key: 'patient_id_card', label: 'สำเนาบัตรประชาชนผู้ป่วย', accept: 'image/*,.pdf' },
  { key: 'house_registration', label: 'สำเนาทะเบียนบ้านผู้ป่วย/ญาติ', accept: 'image/*,.pdf' },
  { key: 'patient_photo', label: 'รูปถ่ายผู้ป่วย (สภาพปัจจุบัน)', accept: 'image/*' },
  { key: 'relative_id_card', label: 'สำเนาบัตรประชาชนญาติ/ผู้ขอความอนุเคราะห์', accept: 'image/*,.pdf' },
  { key: 'assistance_letter', label: 'หนังสือขอความอนุเคราะห์', accept: 'image/*,.pdf' },
  { key: 'power_of_attorney', label: 'หนังสือมอบอำนาจ / หนังสือรับรองบุคคลไร้ญาติ', accept: 'image/*,.pdf' },
  { key: 'homeless_certificate', label: 'หนังสือรับรองบุคคลไร้ที่พึ่ง', accept: 'image/*,.pdf' },
  { key: 'adl_assessment', label: 'แบบประเมิน ADL', accept: 'image/*,.pdf' },
  { key: 'clinical_summary', label: 'ประวัติการรักษา (Clinical Summary)', accept: 'image/*,.pdf' },
];

// ช่วยอ่านชื่อไฟล์สั้น ๆ
const fileName = (f?: File | null) => (f ? f.name : '');

function validatePatientForm(values) {
  const v = values || {};
  const digits = (s) => (s || '').toString().replace(/\D/g, '');
  const issues = [];
  let firstFocusName = null;

  const need = (key, meta = {}) => {
    const { label = key, type, focusName } = meta;
    const raw = v[key];
    const val = (raw ?? '').toString().trim();

    if (!val) {
      issues.push(`• ${label} - กรุณากรอก`);
      if (!firstFocusName) firstFocusName = focusName || key;
      return;
    }
    if (type === 'thaiId' && digits(val).length !== 13) {
      issues.push(`• ${label} ต้องมี 13 หลัก`);
      if (!firstFocusName) firstFocusName = focusName || key;
    }
  };

  DEFAULT_REQUIRED.forEach((key) => need(key, FIELD_META[key]));

  // ถ้าสถานะเสียชีวิต บังคับกรอก "วันที่เสียชีวิต"
  if (String(v.status) === 'เสียชีวิต') {
    if (!v.death_date) {
      issues.push('• วันที่เสียชีวิต - กรุณากรอก');
      if (!firstFocusName) firstFocusName = 'death_date';
    }
  }

  return { ok: issues.length === 0, issues, firstFocusName };
}

// ---- Thai time helpers & field ----
const pad2 = (n: number) => n.toString().padStart(2, '0');

function splitHHmm(val?: string): [number | null, number | null] {
  if (!val || typeof val !== 'string') return [null, null];
  const m = val.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return [null, null];
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return [h, mm];
}

type ThaiTimeFieldProps = {
  value?: string;                 // รูปแบบ HH:mm
  onChange: (val: string) => void;
  name?: string;                  // ใส่ไว้เพื่อให้ querySelector[name=...] โฟกัสได้
  minuteStep?: number;            // ค่าเริ่มต้น 5 นาที
};

const ThaiTimeField: React.FC<ThaiTimeFieldProps> = ({ value, onChange, name, minuteStep = 5 }) => {
  const [h, m] = splitHHmm(value);

  const hours = React.useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = React.useMemo(() => {
    const base = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);
    if (m != null && !base.includes(m)) base.push(m); // เผื่อค่าที่ไม่ตรง step
    return base.sort((a, b) => a - b);
  }, [m, minuteStep]);

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nh = e.target.value === '' ? null : parseInt(e.target.value, 10);
    const mm = m ?? 0;
    if (nh == null) return onChange('');
    onChange(`${pad2(nh)}:${pad2(mm)}`);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nm = e.target.value === '' ? null : parseInt(e.target.value, 10);
    const hh = h ?? 0;
    if (nm == null) return onChange('');
    onChange(`${pad2(hh)}:${pad2(nm)}`);
  };

  return (
    <div className="flex items-center gap-2">
      {/* เก็บค่าไว้ในฟิลด์ซ่อน เพื่อรองรับระบบโฟกัสด้วย name เดิม */}
      <input type="hidden" name={name} value={value || ''} />
      <select
        className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-red-600 focus:ring-4 focus:ring-red-600/10 transition-all"
        value={h ?? ''}
        onChange={handleHourChange}
        aria-label="ชั่วโมง"
      >
        <option value="" disabled>เลือกชั่วโมง</option>
        {hours.map((x) => (
          <option key={x} value={x}>{pad2(x)}</option>
        ))}
      </select>
      <span className="text-gray-500">:</span>
      <select
        className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-red-600 focus:ring-4 focus:ring-red-600/10 transition-all"
        value={m ?? ''}
        onChange={handleMinuteChange}
        aria-label="นาที"
      >
        <option value="" disabled>เลือกนาที</option>
        {minutes.map((x) => (
          <option key={x} value={x}>{pad2(x)} นาที</option>
        ))}
      </select>
      <span className="text-gray-600">น.</span>
    </div>
  );
};


/* ---------------- Component ---------------- */
const PatientForm = forwardRef(function PatientForm({ value, onChange, errors = {} }, ref) {
  const v = value || {};
  const set = (k) => (e) => onChange({ ...v, [k]: e.target.value });


  // ฟอร์แมตเลขบัตรประชาชน: X-XXXX-XXXXX-XX-X
  const handleCardIdChange = (e) => {
    let value = e.target.value.replace(/-/g, '').replace(/\D/g, '').slice(0, 13);
    let formatted = '';
    if (value.length > 0) formatted += value.slice(0, 1);
    if (value.length > 1) formatted += '-' + value.slice(1, 5);
    if (value.length > 5) formatted += '-' + value.slice(5, 10);
    if (value.length > 10) formatted += '-' + value.slice(10, 12);
    if (value.length > 12) formatted += '-' + value.slice(12, 13);
    onChange({ ...v, card_id: formatted });
  };

  // ฟอร์แมตเบอร์โทร: XXX-XXX-XXXX (ไม่ใช่ฟิลด์บังคับใน validate)
  const handlePhoneNumberChange = (e) => {
    let value = e.target.value.replace(/\D/g, '').slice(0, 10);
    let formatted = '';
    if (value.length > 0) formatted = value.slice(0, 3);
    if (value.length > 3) formatted += '-' + value.slice(3, 6);
    if (value.length > 6) formatted += '-' + value.slice(6, 10);
    onChange({ ...v, phone: formatted, phone_number: formatted });
  };

  // ----- เอกสารแนบ -----
  const flags = v.docFlags || {}; // { [key: string]: boolean }

  const toggleDoc = (key: string, checked: boolean) => {
    const nextFlags = { ...flags, [key]: checked };
    const next: any = { ...v, docFlags: nextFlags };
    // ถ้ายกเลิกเช็ค -> เคลียร์ไฟล์ทิ้งด้วย
    if (!checked) next[key] = null;
    onChange(next);
  };

  const setFileFor = (key: string, file?: File | null) => {
    onChange({ ...v, [key]: file ?? null });
  };

  // "เอกสารอื่นๆ" : [{ label, file }]
  const otherDocs: Array<{ label?: string; file?: File | null }> = v.other_docs || [];
  const setOtherDocs = (list: any[]) => onChange({ ...v, other_docs: list });

  const addOtherDoc = () => setOtherDocs([...(otherDocs || []), { label: '', file: null }]);
  const updateOtherDoc = (idx: number, patch: Partial<{ label: string; file: File | null }>) => {
    const next = (otherDocs || []).slice();
    next[idx] = { ...next[idx], ...patch };
    setOtherDocs(next);
  };
  const removeOtherDoc = (idx: number) => {
    const next = (otherDocs || []).slice();
    next.splice(idx, 1);
    setOtherDocs(next);
  };

  // ออโต้เช็คให้ถ้ามีไฟล์อยู่แล้ว
  React.useEffect(() => {
    const filled: any = {};
    DOC_OPTIONS.forEach(({ key }) => {
      if (v[key]) filled[key] = true;
    });
    if (Object.keys(filled).length > 0) {
      onChange({ ...v, docFlags: { ...(v.docFlags || {}), ...filled } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose ให้ parent ใช้งาน
  useImperativeHandle(ref, () => ({
    validate: () => {
      const res = validatePatientForm(v);
      if (!res.ok) {
        Swal.fire({
          icon: 'error',
          title: 'กรอกข้อมูลไม่ครบ',
          html: `<div style="text-align:left">${res.issues.map(i => `<div>${i}</div>`).join('')}</div>`,
          confirmButtonText: 'ตกลง',
          confirmButtonColor: '#005A50',
        }).then(() => {
          if (res.firstFocusName) {
            const el = document.querySelector(`[name="${res.firstFocusName}"]`);
            if (el) el.focus();
          }
        });
        return false;
      }
      return true;
    },
    getValues: () => ({ ...v }),
  }));

  // มีประวัติเบื้องต้นอยู่แล้วหรือไม่ (รองรับทั้ง flag และตรวจจากฟิลด์)
  const localHasBaseline =
  v?.baseline_exists === true ||
  Boolean(
    (v.reason_in_dept || '').trim() ||
    (v.reason_admit || '').trim() ||
    (v.bedbound_cause || '').trim() ||
    (v.other_history || '').trim() ||
    (v.referral_hospital || '').trim() ||
    (v.referral_phone || '').trim()
  );

  // ==== NEW: ตรวจว่ามีประวัติเบื้องต้นในระบบไหม (จาก API) ====
  const [remoteHasBaseline, setRemoteHasBaseline] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const hn = v?.patients_id;
    if (!API_BASE || !hn) { setRemoteHasBaseline(null); return; }

    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/patients/${encodeURIComponent(hn)}/encounters/baseline`,
          { cache: 'no-store' }
        );
        if (!alive) return;

        if (res.ok) {
          const js = await res.json();
          const bl = js?.data?.baseline ?? js?.data ?? null;
          const exist = Boolean(
            bl &&
            (
              (bl.reason_in_dept || '').trim() ||
              (bl.reason_admit || '').trim() ||
              (bl.bedbound_cause || '').trim() ||
              (bl.other_history || '').trim() ||
              (bl.referral_hospital || '').trim() ||
              (bl.referral_phone || '').trim()
            )
          );
          setRemoteHasBaseline(exist);
        } else if (res.status === 404) {
          setRemoteHasBaseline(false);
        } else {
          setRemoteHasBaseline(null);
        }
      } catch {
        setRemoteHasBaseline(null);
      }
    })();

    return () => { alive = false; };
  }, [v?.patients_id]);

  const hasBaseline = (remoteHasBaseline ?? localHasBaseline);

  return (
    <div className="space-y-8 bg-gray-50 p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-[#005A50] mb-2">แบบฟอร์มข้อมูลผู้ป่วย</h1>
        <p className="text-gray-600">Patient Information Form</p>
        <div className="w-24 h-1 bg-[#005A50] mx-auto mt-4 rounded"></div>
      </div>

      {/* ข้อมูลพื้นฐาน */}
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
        <h3 className="text-xl font-bold text-[#005A50] mb-6 flex items-center gap-3 pb-3 border-b border-gray-200">
          <div className="p-2 bg-[#005A50] rounded-lg">
            <FileText size={20} className="text-white" />
          </div>
          ข้อมูลพื้นฐาน
          <span className="text-sm font-normal text-gray-500 ml-auto">Basic Information</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <InputField label="HN (รหัสผู้ป่วย)" required icon={<User size={16} />}>
            <input
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 bg-gray-50 text-gray-600 font-mono text-sm focus:outline-none cursor-not-allowed transition-colors"
              value={v.patients_id || ''}
              readOnly
              placeholder="Auto-generated"
            />
          </InputField>

          <InputField label="วันที่รับเข้า" icon={<Calendar size={16} />}>
            <DatePickerField
              value={v.admittion_date}
              onChange={(val) => onChange({ ...v, admittion_date: val })}
              name="admittion_date"
            />
          </InputField>

          <InputField label="ประเภทผู้ป่วย" error={errors.patients_type} icon={<Heart size={16} />}>
            <Select
              components={animatedComponents}
              styles={{
                ...rsx,
                menuPortal: (base) => ({ ...base, zIndex: 12050 }),
                menu: (base) => ({ ...base, zIndex: 12050 }),
              }}
              menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
              menuPosition="fixed"
              menuShouldBlockScroll
              isSearchable={false}
              isClearable={false}
              placeholder="-- เลือกประเภทผู้ป่วย --"
              options={patientTypeOptions}
              value={patientTypeOptions.find((o) => o.value === v.patients_type) ?? null}
              onChange={(opt) => onChange({ ...v, patients_type: opt?.value ?? '' })}
              name="patients_type"
              onKeyDown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
            />
          </InputField>

          {/* สถานะผู้ป่วย (อ่านอย่างเดียว) */}
          <InputField label="สถานะผู้ป่วย">
            <input
              className={`w-full px-4 py-3 rounded-lg border-2 bg-gray-50 text-sm font-medium
                ${v.status === 'เสียชีวิต'
                  ? 'border-red-300 text-red-700'
                  : 'border-gray-300 text-gray-700'}`}
              value={v.status || 'มีชีวิต'}
              readOnly
              name="status"
            />
          </InputField>
        </div>
      </div>

      {/* ประวัติเบื้องต้น */}
      {/* {!hasBaseline ? (
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
          <h3 className="text-xl font-bold text-[#005A50] mb-6 flex items-center gap-3 pb-3 border-b border-gray-200">
            <div className="p-2 bg-[#005A50] rounded-lg">
              <ClipboardList size={20} className="text-white" />
            </div>
            ประวัติเบื้องต้น
            <span className="text-sm font-normal text-gray-500 ml-auto">Baseline (optional)</span>
          </h3>

          <BaselineForm
            value={{
              patients_id: v.patients_id || '',
              reason_in_dept: v.reason_in_dept ?? '',
              reason_admit: v.reason_admit ?? '',
              bedbound_cause: v.bedbound_cause ?? '',
              other_history: v.other_history ?? '',
              referral_hospital: v.referral_hospital ?? '',
              referral_phone: v.referral_phone ?? '',
            }}
            onChange={(b) => onChange({ ...v, ...b })}
          />

          <p className="mt-3 text-xs text-gray-500">
            * ไม่บังคับ กรอกเท่าที่ทราบในเบื้องต้น ระบบจะบันทึกไปเป็นประวัติเบื้องต้นของผู้ป่วย
          </p>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
          <h3 className="text-xl font-bold text-[#005A50] mb-3 flex items-center gap-3">
            <div className="p-2 bg-[#005A50] rounded-lg">
              <ClipboardList size={20} className="text-white" />
            </div>
            ประวัติเบื้องต้น
          </h3>
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-sm">
            พบว่ามีประวัติเบื้องต้นแล้ว กรุณาแก้ไขในหน้า{' '}
            <Link
              href={`/patient/${encodeURIComponent(v.patients_id || '')}/encounters`}
              className="font-semibold underline"
            >
              ประวัติเบื้องต้น
            </Link>{' '}
            โดยตรง
          </div>
        </div>
      )} */}

      {/* ข้อมูลส่วนตัว */}
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
        <h3 className="text-xl font-bold text-[#005A50] mb-6 flex items-center gap-3 pb-3 border-b border-gray-200">
          <div className="p-2 bg-[#005A50] rounded-lg">
            <User size={20} className="text-white" />
          </div>
          ข้อมูลส่วนตัว
          <span className="text-sm font-normal text-gray-500 ml-auto">Personal Information</span>
        </h3>

        {/* เลขบัตรประชาชน */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <InputField label="เลขบัตรประชาชน" required error={errors.card_id}>
              <input
                name="card_id"
                className="w-full px-4 py-3 rounded-lg bg-white border-2 border-gray-300 focus:border-[#005A50] focus:ring-4 focus:ring-[#005A50]/10 transition-all duration-200 font-mono tracking-wide"
                value={v.card_id || ''}
                onChange={handleCardIdChange}
                placeholder="1-1234-12345-12-1"
                maxLength={17}
                inputMode="numeric"
                autoComplete="off"
              />
            </InputField>
          </div>
        </div>

        {/* คำนำหน้า + ชื่อ + นามสกุล */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <InputField label="คำนำหน้า" error={errors.pname}>
            <Select
              components={animatedComponents}
              styles={{
                ...rsx,
                menuPortal: (base) => ({ ...base, zIndex: 12050 }),
                menu: (base) => ({ ...base, zIndex: 12050 }),
              }}
              menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
              menuPosition="fixed"
              menuShouldBlockScroll
              isSearchable={false}
              isClearable={false}
              placeholder="เลือกคำนำหน้า"
              options={pnameOptions}
              value={pnameOptions.find((o) => o.value === v.pname) ?? null}
              onChange={(opt) => onChange({ ...v, pname: opt?.value ?? '' })}
              name="pname"
              onKeyDown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
            />
          </InputField>

          <InputField label="ชื่อ" required error={errors.first_name}>
            <input
              name="first_name"
              className="w-full px-4 py-3 rounded-lg bg-white border-2 border-gray-300 focus:border-[#005A50] focus:ring-4 focus:ring-[#005A50]/10 transition-all duration-200"
              value={v.first_name || ''}
              onChange={set('first_name')}
              placeholder="ชื่อจริง"
              autoComplete="given-name"
            />
          </InputField>

          <InputField label="นามสกุล" required error={errors.last_name}>
            <input
              name="last_name"
              className="w-full px-4 py-3 rounded-lg bg-white border-2 border-gray-300 focus:border-[#005A50] focus:ring-4 focus:ring-[#005A50]/10 transition-all duration-200"
              value={v.last_name || ''}
              onChange={set('last_name')}
              placeholder="นามสกุล"
              autoComplete="family-name"
            />
          </InputField>
        </div>

        {/* เพศ + วันเกิด + อายุ + โทรศัพท์ */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
          <InputField label="เพศ" required error={errors.gender}>
            <Select
              components={animatedComponents}
              styles={{
                ...ortherrsx,
                menuPortal: (base) => ({ ...base, zIndex: 12050 }),
                menu: (base) => ({ ...base, zIndex: 12050 }),
              }}
              menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
              menuPosition="fixed"
              menuShouldBlockScroll
              isSearchable={false}
              isClearable={false}
              placeholder="-- เลือกเพศ --"
              options={genderOptions}
              value={genderOptions.find((o) => o.value === v.gender) ?? null}
              onChange={(opt) => onChange({ ...v, gender: opt?.value ?? '' })}
              name="gender"
              onKeyDown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
            />
          </InputField>

          <InputField label="วันเกิด" error={errors.birthdate} icon={<Calendar size={16} />}>
            <BirthDatePicker value={v.birthdate} onChange={(val) => onChange({ ...v, birthdate: val })} />
          </InputField>

          <InputField label="อายุ">
            <input
              className="w-full px-4 py-3 rounded-lg bg-gray-50 border-2 border-gray-300 text-gray-600 cursor-not-allowed font-medium"
              value={calculateAge(v.birthdate)}
              readOnly
              placeholder="คำนวณจากวันเกิด"
            />
          </InputField>

          <InputField label="โทรศัพท์" error={errors.phone} icon={<Phone size={16} />}>
            <input
              name="phone"
              className="w-full px-4 py-3 rounded-lg bg-white border-2 border-gray-300 focus:border-[#005A50] focus:ring-4 focus:ring-[#005A50]/10 transition-all duration-200 font-mono"
              value={v.phone || ''}
              onChange={handlePhoneNumberChange}
              placeholder="0XX-XXX-XXXX"
              maxLength={12}
              inputMode="numeric"
              autoComplete="tel"
            />
          </InputField>
        </div>

        {/* น้ำหนัก + ส่วนสูง */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
          <InputField label="น้ำหนัก (กิโลกรัม)" error={errors.weight}>
            <input
              name="weight"
              className="w-full px-4 py-3 rounded-lg bg-white border-2 border-gray-300 focus:border-[#005A50] focus:ring-4 focus:ring-[#005A50]/10 transition-all duration-200"
              value={v.weight || ''}
              onChange={set('weight')}
              placeholder="XX"
              maxLength={4}
              inputMode="numeric"
            />
          </InputField>

          <InputField label="ส่วนสูง (เซนติเมตร)" error={errors.height}>
            <input
              name="height"
              className="w-full px-4 py-3 rounded-lg bg-white border-2 border-gray-300 focus:border-[#005A50] focus:ring-4 focus:ring-[#005A50]/10 transition-all duration-200"
              value={v.height || ''}
              onChange={set('height')}
              placeholder="XXX"
              maxLength={4}
              inputMode="numeric"
            />
          </InputField>
        </div>

        {/* เชื้อชาติ + ศาสนา */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <InputField label="เชื้อชาติ" error={errors.nationality}>
            <input
              name="nationality"
              className="w-full px-4 py-3 rounded-lg bg-white border-2 border-gray-300 focus:border-[#005A50] focus:ring-4 focus:ring-[#005A50]/10 transition-all duration-200"
              value={v.nationality || ''}
              onChange={set('nationality')}
              placeholder="เช่น ไทย ลาว พม่า"
              maxLength={20}
              autoComplete="country-name"
            />
          </InputField>

          <InputField label="ศาสนา" error={errors.religion}>
            <input
              name="religion"
              className="w-full px-4 py-3 rounded-lg bg-white border-2 border-gray-300 focus:border-[#005A50] focus:ring-4 focus:ring-[#005A50]/10 transition-all duration-200"
              value={v.religion || ''}
              onChange={set('religion')}
              placeholder="เช่น พุทธ คริส อิสลาม"
              maxLength={20}
              autoComplete="off"
            />
          </InputField>
        </div>

        <div className="mt-6">
          <InputField label="ที่อยู่" error={errors.address} icon={<MapPin size={16} />}>
            <textarea
              name="address"
              className="w-full px-4 py-4 rounded-lg bg-white border-2 border-gray-300 focus:border-[#005A50] focus:ring-4 focus:ring-[#005A50]/10 transition-all duration-200 resize-none"
              value={v.address || ''}
              onChange={(e) => onChange({ ...v, address: e.target.value })}
              placeholder="บ้านเลขที่, ถนน, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์"
              rows={3}
              autoComplete="street-address"
            />
          </InputField>
        </div>
      </div>

      {/* ข้อมูลทางการแพทย์ */}
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
        <h3 className="text-xl font-bold text-[#005A50] mb-6 flex items-center gap-3 pb-3 border-b border-gray-200">
          <div className="p-2 bg-[#005A50] rounded-lg">
            <Droplets size={20} className="text-white" />
          </div>
          ข้อมูลทางการแพทย์
          <span className="text-sm font-normal text-gray-500 ml-auto">Medical Information</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InputField label="กรุ๊ปเลือด" required error={errors.blood_group} icon={<Droplets size={16} />}>
            <Select
              components={animatedComponents}
              styles={{
                ...ortherrsx,
                menuPortal: (base) => ({ ...base, zIndex: 12050 }),
                menu: (base) => ({ ...base, zIndex: 12050 }),
              }}
              menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
              menuPosition="fixed"
              menuShouldBlockScroll
              isSearchable={false}
              isClearable={false}
              placeholder="-- เลือกกรุ๊ปเลือด --"
              options={bloodGroupOptions}
              value={bloodGroupOptions.find((o) => o.value === v.blood_group) ?? null}
              onChange={(opt) => onChange({ ...v, blood_group: opt?.value ?? '' })}
              name="blood_group"
              onKeyDown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
            />
          </InputField>

          <InputField label="Rh Factor" required error={errors.bloodgroup_rh}>
            <Select
              components={animatedComponents}
              styles={{
                ...ortherrsx,
                menuPortal: (base) => ({ ...base, zIndex: 12050 }),
                menu: (base) => ({ ...base, zIndex: 12050 }),
              }}
              menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
              menuPosition="fixed"
              menuShouldBlockScroll
              isSearchable={false}
              isClearable={false}
              placeholder="-- เลือกประเภท Rh --"
              options={rhOptions}
              value={rhOptions.find((o) => o.value === v.bloodgroup_rh) ?? null}
              onChange={(opt) => onChange({ ...v, bloodgroup_rh: opt?.value ?? '' })}
              name="bloodgroup_rh"
              onKeyDown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
            />
          </InputField>

          <InputField label="กรุ๊ปเลือดเต็ม">
            <input
              className="w-full px-4 py-3 rounded-lg bg-gray-50 border-2 border-gray-300 text-gray-700 font-bold cursor-not-allowed text-center text-lg"
              value={v.blood_group && v.bloodgroup_rh ? `${v.blood_group}${v.bloodgroup_rh}` : ''}
              readOnly
              placeholder="เช่น A Rh+"
            />
          </InputField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <InputField label="รักษาที่" required error={errors.treat_at}>
            <Select
              components={animatedComponents}
              styles={{
                ...ortherrsx,
                menuPortal: (base) => ({ ...base, zIndex: 12050 }),
                menu: (base) => ({ ...base, zIndex: 12050 }),
              }}
              menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
              menuPosition="fixed"
              menuShouldBlockScroll
              isSearchable={false}
              isClearable={false}
              placeholder="-- เลือกสถานที่รักษา --"
              options={treatatOptions}
              value={treatatOptions.find((o) => o.value === v.treat_at) ?? null}
              onChange={(opt) => onChange({ ...v, treat_at: opt?.value ?? '' })}
              name="treat_at"
              onKeyDown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
            />
          </InputField>
        </div>
      </div>

      {/* ===== ข้อมูลการเสียชีวิต (แสดงเมื่อสถานะ = เสียชีวิต) ===== */}
      {v.status === 'เสียชีวิต' && (
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
          <h3 className="text-xl font-bold text-red-700 mb-6 flex items-center gap-3 pb-3 border-b border-gray-200">
            <div className="p-2 bg-red-600 rounded-lg">
              <Heart size={20} className="text-white" />
            </div>
            ข้อมูลการเสียชีวิต
            <span className="text-sm font-normal text-gray-500 ml-auto">Death Information</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="วันที่เสียชีวิต" icon={<Calendar size={16} />}>
              <DatePickerField
                value={v.death_date}
                onChange={(val) => onChange({ ...v, death_date: val })}
                name="death_date"
              />
            </InputField>

            <InputField label="เวลาเสียชีวิต">
              <ThaiTimeField
                value={v.death_time}
                onChange={(val) => onChange({ ...v, death_time: val })}
                name="death_time"
                minuteStep={5} // ปรับเป็น 1 ถ้าต้องการเลือกทีละนาที
              />
            </InputField>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <InputField label="สาเหตุการเสียชีวิต">
              <input
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-red-600 focus:ring-4 focus:ring-red-600/10 transition-all"
                value={v.death_cause || ''}
                onChange={(e) => onChange({ ...v, death_cause: e.target.value })}
                placeholder="เช่น หัวใจล้มเหลวเฉียบพลัน"
                name="death_cause"
              />
            </InputField>

            <InputField label="การจัดการศพ">
              <input
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-red-600 focus:ring-4 focus:ring-red-600/10 transition-all"
                value={v.management || ''}
                onChange={(e) => onChange({ ...v, management: e.target.value })}
                placeholder="เช่น ส่งชันสูตร / ประกอบพิธีทางศาสนา"
                name="management"
              />
            </InputField>
          </div>
        </div>
      )}

      {/* เอกสารแนบที่จำเป็น */}
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
        <h3 className="text-xl font-bold text-[#005A50] mb-6 flex items-center gap-3 pb-3 border-b border-gray-200">
          <div className="p-2 bg-[#005A50] rounded-lg">
            <FileUp size={20} className="text-white" />
          </div>
          เอกสารประกอบการยื่นเรื่อง
          <span className="text-sm font-normal text-gray-500 ml-auto">Required Documents</span>
        </h3>

        {/* คำแนะนำ */}
        <div className="bg-[#005A50]/5 border border-[#005A50]/20 rounded-lg p-4 mb-6">
          <p className="text-sm text-[#005A50] font-medium">
            📋 คำแนะนำ: เลือกเช็คเอกสารที่ต้องการแนบ จากนั้นทำการอัปโหลดไฟล์ในช่องที่ปรากฏขึ้น
          </p>
        </div>

        {/* กล่องเช็คเลือกเอกสาร */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {DOC_OPTIONS.map(({ key, label }) => (
            <label key={key} className="flex items-start gap-3 p-4 rounded-lg bg-gray-50 border-2 border-gray-200 hover:border-[#005A50]/30 hover:bg-[#005A50]/5 transition-all duration-200 cursor-pointer">
              <input
                type="checkbox"
                className="w-5 h-5 mt-0.5 text-[#005A50] border-2 border-gray-300 rounded focus:ring-[#005A50] focus:ring-2"
                checked={!!flags[key]}
                onChange={(e) => toggleDoc(key, e.target.checked)}
              />
              <span className="text-sm leading-relaxed text-gray-700">{label}</span>
            </label>
          ))}

          {/* เอกสารอื่นๆ */}
          <label className="flex items-start gap-3 p-4 rounded-lg bg-gray-50 border-2 border-gray-200 hover:border-[#005A50]/30 hover:bg-[#005A50]/5 transition-all duration-200 cursor-pointer">
            <input
              type="checkbox"
              className="w-5 h-5 mt-0.5 text-[#005A50] border-2 border-gray-300 rounded focus:ring-[#005A50] focus:ring-2"
              checked={!!flags.other}
              onChange={(e) => {
                const checked = e.target.checked;
                toggleDoc('other', checked);
                if (checked && (!otherDocs || otherDocs.length === 0)) addOtherDoc();
              }}
            />
            <span className="text-sm leading-relaxed text-gray-700">
              <strong>เอกสารอื่นๆ</strong><br />
              <span className="text-gray-500">(ระบุชื่อเอกสารเอง)</span>
            </span>
          </label>
        </div>

        {/* ช่องอัปโหลดของรายการที่เช็คไว้ */}
        {DOC_OPTIONS.filter(d => flags[d.key]).length > 0 && (
          <div className="space-y-6 mb-8">
            <h4 className="text-lg font-semibold text-[#005A50] border-l-4 border-[#005A50] pl-4">
              อัปโหลดเอกสารที่เลือก
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {DOC_OPTIONS.filter(d => flags[d.key]).map(({ key, label, accept }) => (
                <div key={key} className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <div className="text-sm font-semibold text-[#005A50] mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#005A50] rounded-full"></div>
                    {label}
                  </div>
                  <input
                    type="file"
                    accept={accept}
                    className="w-full px-4 py-3 border-2 border-dashed border-[#005A50]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005A50] focus:border-[#005A50] bg-white transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-[#005A50] file:text-white hover:file:bg-[#004A43]"
                    onChange={(e) => setFileFor(key, e.target.files?.[0] || null)}
                  />
                  {v[key] && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-xs text-green-700 flex items-center justify-between">
                        <span>✅ เลือกแล้ว: <span className="font-mono font-medium">{fileName(v[key])}</span></span>
                        <button
                          type="button"
                          className="ml-3 text-red-600 hover:text-red-800 hover:underline font-medium"
                          onClick={() => setFileFor(key, null)}
                        >
                          ลบไฟล์
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* เอกสารอื่นๆ (หลายแถว) */}
        {flags.other && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-[#005A50] border-l-4 border-[#005A50] pl-4">
              เอกสารอื่นๆ
            </h4>
            {(otherDocs || []).map((row, idx) => (
              <div key={idx} className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">ชื่อเอกสาร</label>
                    <input
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#005A50] focus:ring-2 focus:ring-[#005A50]/10 transition-all"
                      placeholder="เช่น หนังสือรับรองรายได้น้อย"
                      value={row.label || ''}
                      onChange={(e) => updateOtherDoc(idx, { label: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">แนบไฟล์</label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="w-full px-4 py-3 border-2 border-dashed border-[#005A50]/30 rounded-lg bg-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-[#005A50] file:text-white hover:file:bg-[#004A43]"
                      onChange={(e) => updateOtherDoc(idx, { file: e.target.files?.[0] || null })}
                    />
                    {row.file && (
                      <div className="mt-2 text-xs text-green-700 bg-green-50 p-2 rounded">
                        ✅ เลือกแล้ว: <span className="font-mono">{fileName(row.file)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="w-full px-4 py-3 border-2 border-red-300 rounded-lg text-red-600 hover:bg-red-50 hover:border-red-400 font-medium transition-colors"
                      onClick={() => removeOtherDoc(idx)}
                    >
                      ลบแถว
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div>
              <button
                type="button"
                className="px-6 py-3 border-2 border-[#005A50] rounded-lg text-[#005A50] hover:bg-[#005A50] hover:text-white font-medium transition-colors flex items-center gap-2"
                onClick={addOtherDoc}
              >
                <span className="text-lg">+</span> เพิ่มเอกสารอื่น
              </button>
            </div>
          </div>
        )}

        {/* สรุปเอกสาร */}
        {(DOC_OPTIONS.filter(d => flags[d.key]).length > 0 || flags.other) && (
          <div className="mt-8 p-6 bg-[#005A50]/5 border border-[#005A50]/20 rounded-xl">
            <h4 className="text-sm font-semibold text-[#005A50] mb-3">📋 เอกสารที่เลือก:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {DOC_OPTIONS.filter(d => flags[d.key]).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full ${v[key] ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                  <span className={v[key] ? 'text-green-700 font-medium' : 'text-gray-600'}>{label}</span>
                  {v[key] && <span className="text-green-600 text-xs">✓</span>}
                </div>
              ))}
              {flags.other && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span className="text-blue-700 font-medium">เอกสารอื่นๆ ({(otherDocs || []).length} รายการ)</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default PatientForm;
