'use client';

import React, { forwardRef, useImperativeHandle } from 'react';
import InputField from '@/app/components/ui/InputField';
import { Calendar, Droplets, FileText, Heart, MapPin, Phone, User, FileUp } from 'lucide-react';
import DatePickerField from '@/app/components/DatePicker';
import BirthDatePicker from '@/app/components/BirthDatePicker';
import dynamic from 'next/dynamic';
import makeAnimated from 'react-select/animated';
import Swal from 'sweetalert2';

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
  menuPortal: (base) => ({ ...base, color: '#000000', zIndex: 9999 }),
};
const ortherrsx = {
  control: (base, state) => ({
    ...base,
    minHeight: 46,
    borderRadius: 10,
    borderColor: state.isFocused ? '#60a5fa' : '#e5e7eb',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(59,130,246,.25)' : 'none',
    ':hover': { borderColor: '#60a5fa' },
    color: '#000000',
  }),
  menuPortal: (base) => ({ ...base, color: '#000000', zIndex: 9999 }),
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

/* ---------------- Validation (เฉพาะ 7 ช่อง) ---------------- */
const FIELD_META = {
  card_id:       { label: 'เลขบัตรประชาชน', type: 'thaiId', focusName: 'card_id' },
  first_name:    { label: 'ชื่อ',             focusName: 'first_name' },
  last_name:     { label: 'นามสกุล',         focusName: 'last_name' },
  gender:        { label: 'เพศ',             focusName: 'gender' },
  blood_group:   { label: 'กรุ๊ปเลือด',      focusName: 'blood_group' },
  bloodgroup_rh: { label: 'ประเภท Rh',       focusName: 'bloodgroup_rh' },
  disease:       { label: 'โรคประจำตัว',     focusName: 'disease' },
};
const DEFAULT_REQUIRED = Object.keys(FIELD_META);

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
  return { ok: issues.length === 0, issues, firstFocusName };
}

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

  return (
    <div className="space-y-8">
      {/* ข้อมูลพื้นฐาน */}
      <div className="bg-blue-100 p-6 rounded-xl border border-blue-200">
        <h3 className="text-lg font-bold text-blue-800 mb-6 flex items-center gap-2">
          <FileText size={20} />
          ข้อมูลพื้นฐาน
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <InputField label="HN (รหัสผู้ป่วย)" required icon={<User size={16} />}>
            <input
              className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 bg-gray-100 text-gray-600 font-mono text-sm focus:outline-none cursor-not-allowed"
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
                menu:       (base) => ({ ...base, zIndex: 12050 }),
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
        </div>
      </div>

      {/* ข้อมูลส่วนตัว */}
      <div className="bg-green-100 p-6 rounded-xl border border-green-200">
        <h3 className="text-lg font-bold text-green-800 mb-6 flex items-center gap-2">
          <User size={20} />
          ข้อมูลส่วนตัว
        </h3>

        {/* เลขบัตรประชาชน */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <InputField label="เลขบัตรประชาชน" required error={errors.card_id}>
              <input
                name="card_id"
                className="w-full px-4 py-2 rounded-lg bg-[#ffffff] border-1 border-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
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
                menu:       (base) => ({ ...base, zIndex: 12050 }),
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
              className="w-full px-4 py-2 rounded-lg bg-[#ffffff] border-1 border-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
              value={v.first_name || ''}
              onChange={set('first_name')}
              placeholder="ชื่อจริง"
              autoComplete="given-name"
            />
          </InputField>

          <InputField label="นามสกุล" required error={errors.last_name}>
            <input
              name="last_name"
              className="w-full px-4 py-2 rounded-lg bg-[#ffffff] border-1 border-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
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
                menu:       (base) => ({ ...base, zIndex: 12050 }),
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
              className="w-full px-4 py-2 rounded-lg bg-[#ffffff] border-1 border-gray-400 bg-gray-100 text-gray-600 cursor-not-allowed"
              value={calculateAge(v.birthdate)}
              readOnly
              placeholder="คำนวณจากวันเกิด"
            />
          </InputField>

          <InputField label="โทรศัพท์" error={errors.phone} icon={<Phone size={16} />}>
            <input
              name="phone"
              className="w-full px-4 py-2 rounded-lg bg-[#ffffff] border-1 border-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
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
          <InputField label="น้ำหนัก" error={errors.weight}>
            <input
              name="weight"
              className="w-full px-4 py-2 rounded-lg bg-[#ffffff] border-1 border-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
              value={v.weight || ''}
              onChange={set('weight')}
              placeholder="XX"
              maxLength={4}
              inputMode="numeric"
            />
          </InputField>

          <InputField label="ส่วนสูง" error={errors.height}>
            <input
              name="height"
              className="w-full px-4 py-2 rounded-lg bg-[#ffffff] border-1 border-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
              value={v.height || ''}
              onChange={set('height')}
              placeholder="XXX"
              maxLength={4}
              inputMode="numeric"
            />
          </InputField>
        </div>

        {/* เชื้อชาติ + ศาสนา + ที่อยู่ */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
          <div className="md:col-span-2">
            <InputField label="เชื้อชาติ" error={errors.nationality}>
              <input
                name="nationality"
                className="w-full px-4 py-2 rounded-lg bg-[#ffffff] border-1 border-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
                value={v.nationality || ''}
                onChange={set('nationality')}
                placeholder="เช่น ไทย ลาว พม่า"
                maxLength={20}
                autoComplete="country-name"
              />
            </InputField>
          </div>
          <div className="md:col-span-2">
            <InputField label="ศาสนา" error={errors.religion}>
              <input
                name="religion"
                className="w-full px-4 py-2 rounded-lg bg-[#ffffff] border-1 border-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
                value={v.religion || ''}
                onChange={set('religion')}
                placeholder="เช่น พุทธ คริส อิสลาม "
                maxLength={20}
                autoComplete="off"
              />
            </InputField>
          </div>
        </div>

        <div className="mt-6">
          <InputField label="ที่อยู่" error={errors.address} icon={<MapPin size={16} />}>
            <textarea
              name="address"
              className="w-full px-4 py-4 rounded-lg bg-[#ffffff] border-1 border-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200 resize-none"
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
      <div className="bg-red-100 p-6 rounded-xl border border-red-200">
        <h3 className="text-lg font-bold text-red-800 mb-6 flex items-center gap-2">
          <Droplets size={20} />
          ข้อมูลทางการแพทย์
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InputField label="กรุ๊ปเลือด" required error={errors.blood_group} icon={<Droplets size={16} />}>
            <Select
              components={animatedComponents}
              styles={{
                ...ortherrsx,
                menuPortal: (base) => ({ ...base, zIndex: 12050 }),
                menu:       (base) => ({ ...base, zIndex: 12050 }),
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
                menu:       (base) => ({ ...base, zIndex: 12050 }),
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
              className="w-full px-4 py-2 rounded-lg bg-[#ffffff] border-1 border-gray-400 bg-gray-100 text-gray-600 font-bold cursor-not-allowed"
              value={v.blood_group && v.bloodgroup_rh ? `${v.blood_group}${v.bloodgroup_rh}` : ''}
              readOnly
              placeholder="เช่น A Rh+"
            />
          </InputField>
        </div>

        <div className="mt-6">
          <InputField label="โรคประจำตัว / ประวัติการแพทย์" required error={errors.disease} icon={<FileText size={16} />}>
            <textarea
              name="disease"
              className="w-full px-4 py-4 rounded-lg bg-[#ffffff] border-1 border-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all duration-200 resize-none"
              value={v.disease || ''}
              onChange={set('disease')}
              placeholder="ระบุโรคประจำตัว, ประวัติการแพทย์, ยาที่แพ้ หรือข้อมูลสำคัญทางการแพทย์ (ถ้าไม่มี ใส่ -)"
              rows={3}
            />
          </InputField>
        </div>
      </div>

      {/* เก็บสำหรับเอกสารจำเป็น */}
      <div className="bg-gray-100 p-6 rounded-xl border border-blue-200">
        <h3 className="text-lg font-bold text-blue-800 mb-6 flex items-center gap-2">
          <FileUp size={20} />
          เอกสารแนบที่จำเป็น
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InputField label="• สำเนาบัตรประชาชนผู้ป่วย">
            <input
              type="file"
              accept="image/*,.pdf"
              className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              onChange={(e) => {
                const file = e.target.files?.[0];
                onChange({ ...v, patient_id_card: file });
              }}
            />
          </InputField>

          <InputField label="• สำเนาทะเบียนบ้านผู้ป่วย/ญาติ">
            <input
              type="file"
              accept="image/*,.pdf"
              className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              onChange={(e) => {
                const file = e.target.files?.[0];
                onChange({ ...v, house_registration: file });
              }}
            />
          </InputField>

          <InputField label="• รูปถ่ายผู้ป่วย สภาพปัจจุบัน">
            <input
              type="file"
              accept="image/*"
              className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              onChange={(e) => {
                const file = e.target.files?.[0];
                onChange({ ...v, patient_photo: file });
              }}
            />
          </InputField>

          <InputField label="• สำเนาบัตรประชาชนญาติ/ผู้ขอความอนุเคราะห์">
            <input
              type="file"
              accept="image/*,.pdf"
              className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              onChange={(e) => {
                const file = e.target.files?.[0];
                onChange({ ...v, relative_id_card: file });
              }}
            />
          </InputField>
        </div>
      </div>
    </div>
  );
});

export default PatientForm;
