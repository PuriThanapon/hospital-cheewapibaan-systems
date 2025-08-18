'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './patient.module.css';
import { Search, X, Plus, Pencil, Eye, CalendarPlus, Skull, RefreshCw, ChevronLeft, ChevronRight, User, Phone, MapPin, Droplets, Calendar, FileText, Clock, Building, AlertCircle, CheckCircle, Heart } from 'lucide-react';
import makeAnimated from 'react-select/animated';

import dynamic from "next/dynamic";
const Select = dynamic(() => import("react-select"), { ssr: false });

const cx = (...c) => c.filter(Boolean).join(' ');
const animatedComponents = makeAnimated();

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

const menuPortalTarget = typeof window !== 'undefined' ? document.body : undefined;
const rsx = {
  control: (base, state) => ({
    ...base,
    minHeight: 32,
    borderRadius: 10,
    borderColor: state.isFocused ? '#60a5fa' : '#e5e7eb',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(59,130,246,.25)' : 'none',
    ':hover': { borderColor: '#60a5fa' },
    color: '#000000'
  }),
  menuPortal: (base) => ({ ...base, 
    color: '#000000',
    zIndex: 9999 }),
};

const pnameOptions = [
  { value: 'นาย', label: 'นาย' },
  { value: 'นาง', label: 'นาง' },
  { value: 'นางสาว', label: 'นางสาว' },
  { value: 'เด็กชาย', label: 'เด็กชาย' },
  { value: 'เด็กหญิง', label: 'เด็กหญิง' },
];

const genderOptions = [
  { value: 'ชาย', label: 'ชาย' },
  { value: 'หญิง', label: 'หญิง' },
];

const patientTypeOptions = [
  { value: 'ช่วยเหลือตัวเองได้', label: 'ช่วยเหลือตัวเองได้' },
  { value: 'ต้องมีผู้ดูแล', label: 'ต้องมีผู้ดูแล' },
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

const statusOptions = [
  { value: 'มีชีวิต', label: 'มีชีวิต' },
  { value: 'เสียชีวิต', label: 'เสียชีวิต' },
  { value: 'จำหน่าย', label: 'จำหน่าย' },
];

const managementOptions = [
  { value: 'ส่งกลับบ้าน', label: 'ส่งกลับบ้าน' },
  { value: 'ฌาปนกิจ', label: 'ฌาปนกิจ' },
  { value: 'บริจาคร่างกาย', label: 'บริจาคร่างกาย' },
  { value: 'อื่น ๆ', label: 'อื่น ๆ' },
];

function joinUrl(base, path) {
  if (!base) return path;
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

async function http(url, options = {}) {
  const finalUrl = /^https?:\/\//i.test(url) ? url : joinUrl(API_BASE, url);
  const res = await fetch(finalUrl, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) {
    let msg = 'Request failed';
    try {
      const j = await res.json();
      msg = j.message || j.error || msg;
    } catch {}
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}


/* ---------------- Enhanced Modal with modern styling ---------------- */
function Modal({open, title, onClose, onConfirm, children, footer, size='md', bodyClassName, initialFocusSelector}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const root = ref.current; if (!root) return;
    const qf = () => Array.from(root.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'))
      .filter(el => !el.hasAttribute('disabled'));
    const prev = document.activeElement;
    const first = initialFocusSelector ? root.querySelector(initialFocusSelector) : qf()[0];
    if (first) first.focus();
    const onKey = (e) => {
      if (e.key === 'Tab') {
        const f = qf(); if (f.length === 0) return;
        const [a, z] = [f[0], f[f.length - 1]];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
      if (e.key === 'Enter' && onConfirm) {
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag !== 'textarea') { e.preventDefault(); onConfirm(); }
      }
    };
    root.addEventListener('keydown', onKey);
    return () => { root.removeEventListener('keydown', onKey); if (prev?.focus) prev.focus(); };
  }, [open, onConfirm, initialFocusSelector]);

  if (!open) return null;
  const sizeCls = size==='sm'?'max-w-md': size==='lg'?'max-w-4xl': size==='xl'?'max-w-6xl': 'max-w-2xl';
  
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      ref={ref}
      onMouseDown={(e)=>{ if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className={`bg-white rounded-2xl shadow-2xl ${sizeCls} w-full max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200`} onMouseDown={(e)=>e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            {title}
          </h2>
          <button 
            className="p-2 hover:bg-white/80 rounded-full transition-colors duration-200 group" 
            onClick={onClose} 
            aria-label="ปิด"
          >
            <X size={20} className="text-gray-600 group-hover:text-gray-800"/>
          </button>
        </div>
        
        {/* Body */}
        <div className={`flex-1 overflow-auto p-6 ${bodyClassName || ''}`}>
          {children}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex items-center justify-between gap-4">
          {footer}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Enhanced UI Components ---------------- */
const Pill = ({alive}) => (
  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
    alive 
      ? 'bg-green-100 text-green-800 border border-green-200' 
      : 'bg-red-100 text-red-800 border border-red-200'
  }`}>
    {alive ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
    {alive ? 'มีชีวิต' : 'เสียชีวิต'}
  </span>
);

const InputField = ({ label, children, error, required = false, icon, description }) => (
  <div className="space-y-2">
    <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
      {icon && <span className="text-blue-500">{icon}</span>}
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    {description && <p className="text-xs text-gray-500 -mt-1">{description}</p>}
    {children}
    {error && (
      <p className="text-sm text-red-600 flex items-center gap-1">
        <AlertCircle size={14}/>
        {error}
      </p>
    )}
  </div>
);

/* ---------------- Enhanced Forms ---------------- */
function PatientForm({ value, onChange, errors = {} }) {
  const v = value;
  const set = (k) => (e) => onChange({ ...v, [k]: e.target.value });
  
  return (
    <div className="space-y-8">
      {/* ข้อมูลพื้นฐาน */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
        <h3 className="text-lg font-bold text-blue-800 mb-6 flex items-center gap-2">
          <FileText size={20}/>
          ข้อมูลพื้นฐาน
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <InputField label="HN (รหัสผู้ป่วย)" required icon={<User size={16}/>}>
            <input
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 bg-gray-100 text-gray-600 font-mono text-sm focus:outline-none cursor-not-allowed"
              value={v.patients_id || ''}
              readOnly
              placeholder="Auto-generated"
            />
          </InputField>

          <InputField label="วันที่รับเข้า" required error={errors.admittion_date} icon={<Calendar size={16}/>}>
            <input
              type="date"
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
              value={v.admittion_date || ''}
              onChange={set('admittion_date')}
              max={new Date().toISOString().split('T')[0]}
            />
          </InputField>

          <InputField label="ประเภทผู้ป่วย" required error={errors.patients_type} icon={<Heart size={16}/>}>
            <select
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
              value={v.patients_type || ''}
              onChange={set('patients_type')}
            >
              <option value="">-- เลือกประเภท --</option>
              <option value="ช่วยเหลือตัวเองได้">ช่วยเหลือตัวเองได้</option>
              <option value="ต้องมีผู้ดูแล">ต้องมีผู้ดูแล</option>
            </select>
          </InputField>
        </div>
      </div>

      {/* ข้อมูลส่วนตัว */}
      <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
        <h3 className="text-lg font-bold text-green-800 mb-6 flex items-center gap-2">
          <User size={20}/>
          ข้อมูลส่วนตัว
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <InputField label="คำนำหน้า" required error={errors.pname}>
            <select
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
              value={v.pname || ''}
              onChange={set('pname')}
            >
              <option value="">-- เลือกคำนำหน้า --</option>
              <option value="นาย">นาย</option>
              <option value="นาง">นาง</option>
              <option value="นางสาว">นางสาว</option>
              <option value="เด็กชาย">เด็กชาย</option>
              <option value="เด็กหญิง">เด็กหญิง</option>
            </select>
          </InputField>

          <InputField label="ชื่อ" required error={errors.first_name}>
            <input
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
              value={v.first_name || ''}
              onChange={set('first_name')}
              placeholder="ชื่อจริง"
            />
          </InputField>

          <InputField label="นามสกุล" required error={errors.last_name}>
            <input
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
              value={v.last_name || ''}
              onChange={set('last_name')}
              placeholder="นามสกุล"
            />
          </InputField>

          <InputField label="เพศ" required error={errors.gender}>
            <select
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
              value={v.gender || ''}
              onChange={set('gender')}
            >
              <option value="">-- เลือกเพศ --</option>
              <option value="ชาย">ชาย</option>
              <option value="หญิง">หญิง</option>
            </select>
          </InputField>

          <InputField label="วันเกิด" required error={errors.birthdate} icon={<Calendar size={16}/>}>
            <input
              type="date"
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
              value={v.birthdate || ''}
              onChange={set('birthdate')}
              max={new Date().toISOString().split('T')[0]}
            />
          </InputField>

          <InputField label="อายุ" description="คำนวณอัตโนมัติจากวันเกิด">
            <input
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 bg-gray-100 text-gray-600 cursor-not-allowed"
              value={calculateAge(v.birthdate) ? `${calculateAge(v.birthdate)} ปี` : ''}
              readOnly
              placeholder="คำนวณจากวันเกิด"
            />
          </InputField>

          <InputField label="โทรศัพท์" required error={errors.phone} icon={<Phone size={16}/>}>
            <input
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200"
              value={v.phone || ''}
              onChange={set('phone')}
              placeholder="0XX-XXX-XXXX"
              maxLength="12"
            />
          </InputField>
        </div>

        <div className="mt-6">
          <InputField label="ที่อยู่" required error={errors.address} icon={<MapPin size={16}/>}>
            <textarea
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200 resize-none"
              value={v.address || ''}
              onChange={set('address')}
              placeholder="บ้านเลขที่, ถนน, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์"
              rows="3"
            />
          </InputField>
        </div>
      </div>

      {/* ข้อมูลทางการแพทย์ */}
      <div className="bg-gradient-to-r from-red-50 to-red-100 p-6 rounded-xl border border-red-200">
        <h3 className="text-lg font-bold text-red-800 mb-6 flex items-center gap-2">
          <Droplets size={20}/>
          ข้อมูลทางการแพทย์
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InputField label="กรุ๊ปเลือด" error={errors.blood_group} icon={<Droplets size={16}/>}>
            <select
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all duration-200"
              value={v.blood_group || ''}
              onChange={set('blood_group')}
            >
              <option value="">-- เลือกกรุ๊ปเลือด --</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="AB">AB</option>
              <option value="O">O</option>
            </select>
          </InputField>

          <InputField label="Rh Factor" error={errors.bloodgroup_rh}>
            <select
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all duration-200"
              value={v.bloodgroup_rh || ''}
              onChange={set('bloodgroup_rh')}
            >
              <option value="">-- เลือก Rh --</option>
              <option value="Rh+">Rh+ (บวก)</option>
              <option value="Rh-">Rh- (ลบ)</option>
            </select>
          </InputField>

          <InputField label="กรุ๊ปเลือดเต็ม" description="รวมกรุ๊ปเลือดและ Rh Factor">
            <input
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 bg-gray-100 text-gray-600 font-bold cursor-not-allowed"
              value={v.blood_group && v.bloodgroup_rh ? `${v.blood_group}${v.bloodgroup_rh}` : ''}
              readOnly
              placeholder="เช่น A Rh+"
            />
          </InputField>
        </div>

        <div className="mt-6">
          <InputField label="โรคประจำตัว / ประวัติการแพทย์" error={errors.disease} icon={<FileText size={16}/>}>
            <textarea
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all duration-200 resize-none"
              value={v.disease || ''}
              onChange={set('disease')}
              placeholder="ระบุโรคประจำตัว, ประวัติการแพทย์, ยาที่แพ้ หรือข้อมูลสำคัญทางการแพทย์"
              rows="3"
            />
          </InputField>
        </div>
      </div>

      {/* สรุปข้อมูล */}
      {(v.first_name && v.last_name) && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-100 p-6 rounded-xl border-2 border-blue-300 shadow-lg">
          <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
            <CheckCircle size={18}/>
            สรุปข้อมูล
          </h4>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-blue-700 leading-relaxed">
              <strong>ชื่อ-นามสกุล:</strong> {v.pname} {v.first_name} {v.last_name}
              {v.gender && <span> ({v.gender})</span>}
              {v.birthdate && <span>, อายุ {calculateAge(v.birthdate)} ปี</span>}
              {v.blood_group && v.bloodgroup_rh && (
                <span>, กรุ๊ปเลือด <strong>{v.blood_group}{v.bloodgroup_rh}</strong></span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function AppointmentForm({value, onChange}){
  const v=value; const set=(k)=>(e)=>onChange({...v, [k]: e.target.value});
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
        <h3 className="text-lg font-bold text-purple-800 mb-4 flex items-center gap-2">
          <CalendarPlus size={20}/>
          รายละเอียดการนัดหมาย
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField label="วันที่นัด" required icon={<Calendar size={16}/>}>
            <input 
              type="date" 
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200" 
              value={v.appointment_date||''} 
              onChange={set('appointment_date')} 
              min={new Date().toISOString().split('T')[0]}
            />
          </InputField>
          
          <InputField label="เวลานัด" required icon={<Clock size={16}/>}>
            <input 
              type="time" 
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200" 
              value={v.appointment_time||''} 
              onChange={set('appointment_time')} 
            />
          </InputField>
        </div>
        
        <div className="mt-6">
          <InputField label="แผนก" icon={<Building size={16}/>}>
            <input 
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200" 
              value={v.department||''} 
              onChange={set('department')} 
              placeholder="เช่น อายุรกรรม, ศัลยกรรม, กุมารเวชกรรม" 
            />
          </InputField>
        </div>
        
        <div className="mt-6">
          <InputField label="รายละเอียด" icon={<FileText size={16}/>} description="เหตุผลในการนัดหมาย หรือคำแนะนำพิเศษ">
            <textarea 
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 resize-none" 
              value={v.description||''} 
              onChange={set('description')} 
              placeholder="เช่น ตรวจติดตามอาการ, เปลี่ยนยา, ตรวจผลเลือด" 
              rows="3"
            />
          </InputField>
        </div>
      </div>
    </div>
  );
}

function DeceasedForm({value, onChange, errors={}}){
  const v=value; const set=(k)=>(e)=>onChange({...v, [k]: e.target.value});
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-xl border-2 border-gray-300">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <Skull size={20} className="text-red-600"/>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">ข้อมูลการเสียชีวิต</h3>
            <p className="text-sm text-gray-600">โปรดกรอกข้อมูลให้ครบถ้วนและถูกต้อง</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField label="วันที่เสียชีวิต" required error={errors.death_date} icon={<Calendar size={16}/>}>
            <input 
              type="date" 
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all duration-200" 
              value={v.death_date||''} 
              onChange={set('death_date')} 
              max={new Date().toISOString().split('T')[0]}
            />
          </InputField>
          
          <InputField label="เวลาเสียชีวิต" icon={<Clock size={16}/>} description="ประมาณเวลา (ไม่บังคับ)">
            <input 
              type="time" 
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all duration-200" 
              value={v.death_time||''} 
              onChange={set('death_time')} 
            />
          </InputField>
        </div>
        
        <div className="mt-6">
          <InputField label="สาเหตุการเสียชีวิต" required error={errors.death_cause} icon={<FileText size={16}/>}>
            <input 
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all duration-200" 
              value={v.death_cause||''} 
              onChange={set('death_cause')} 
              placeholder="เช่น ภาวะหัวใจหยุดเต้น, ภาวะหายใจล้มเหลว" 
            />
          </InputField>
        </div>
        
        <div className="mt-6">
          <InputField label="การจัดการศพ" icon={<Building size={16}/>} description="วิธีการจัดการหลังเสียชีวิต">
            <select 
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all duration-200" 
              value={v.management||''} 
              onChange={set('management')}
            >
              <option value="">-- เลือกการจัดการ --</option>
              <option value="ส่งกลับบ้าน">ส่งกลับบ้าน</option>
              <option value="ฌาปนกิจ">ฌาปนกิจ</option>
              <option value="บริจาคร่างกาย">บริจาคร่างกาย</option>
              <option value="อื่น ๆ">อื่น ๆ</option>
            </select>
          </InputField>
        </div>
      </div>
      
      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5"/>
          <div>
            <h4 className="font-semibold text-red-800">ข้อสำคัญ</h4>
            <p className="text-sm text-red-700 mt-1">
              การเปลี่ยนสถานะเป็น "เสียชีวิต" ไม่สามารถย้อนกลับได้ โปรดตรวจสอบข้อมูลให้ถูกต้องก่อนยืนยัน
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main Component ---------------- */
export default function PatientsPage(){
  /* state: query + filters + pagination */
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ gender:'', status:'', blood_group:'', bloodgroup_rh:'', patients_type:'', admit_from:'', admit_to:'' });
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [tick, setTick] = useState(0); // force refetch trigger

  /* data */
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  /* modals */
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(null);       // patients_id
  const [openAppt, setOpenAppt] = useState(null);       // patients_id
  const [openDeceased, setOpenDeceased] = useState(null); // patients_id
  const [openVerify, setOpenVerify] = useState(false);
  const [verifyData, setVerifyData] = useState(null);

  /* drafts */
  const [addDraft, setAddDraft] = useState({ status:'มีชีวิต' });
  const [editDraft, setEditDraft] = useState({});
  const [apptDraft, setApptDraft] = useState({});
  const [deadDraft, setDeadDraft] = useState({});
  const [deadErrors, setDeadErrors] = useState({});

  /* build query string */
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (query.trim()) p.set('q', query.trim());
    Object.entries(filters).forEach(([k,v]) => { if (v) p.set(k, v); });
    p.set('page', String(page));
    p.set('limit', String(limit));
    p.set('_t', String(tick)); // ensure re-fetch when tick changes
    return p.toString();
  }, [query, filters, page, limit, tick]);

  const calculateAgeFromBirthdate = (birthdate) => {
        if (!birthdate) return '-';
        const birth = new Date(birthdate);
        if (isNaN(birth.getTime())) return '-';

        const today = new Date();
        let years = today.getFullYear() - birth.getFullYear();
        let months = today.getMonth() - birth.getMonth();

        if (months < 0 || (months === 0 && today.getDate() < birth.getDate())) {
            years--;
            months = 12 + months;
        }

        if (years > 0) {
            return `${years} ปี`;
        } else {
            return `${months} เดือน`;
        }
    };

  /* load list with debounce + abort */
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true); setErrMsg('');
      try {
        const data = await http(`/api/patients?${qs}`, { signal: controller.signal });
        if (!alive) return;
        setRows(data.data || []);
        setTotal(data.totalCount || 0);
      } catch (e) {
        if (!alive) return;
        if (e.name === 'AbortError') return; // ignore
        setErrMsg(e.message || 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        if (alive) setLoading(false);
      }
    }, 350);
    return () => { alive = false; clearTimeout(t); controller.abort(); };
  }, [qs]);

  const clearFilters = () => { setFilters({ gender:'', status:'', blood_group:'', bloodgroup_rh:'', patients_type:'', admit_from:'', admit_to:'' }); setPage(1); setTick(t=>t+1); };

  const activeFilterEntries = useMemo(()=> Object.entries(filters).filter(([,v])=>!!v), [filters]);
  const filterLabels = { status: 'สถานะผู้ป่วย', gender: 'เพศ', blood_group: 'กรุ๊ปเลือด', bloodgroup_rh: 'Rh', patients_type: 'ประเภทผู้ป่วย', admit_from: 'รับเข้าตั้งแต่', admit_to: 'รับเข้าถึง' };

  /* open add: ขอ next HN */
  const handleOpenAdd = async () => {
    setErrMsg('');
    try {
      const { nextId } = await http('/api/patients/next-id');
      setAddDraft({ patients_id: nextId, status:'มีชีวิต' });
      setOpenAdd(true);
    } catch (e) {
      setErrMsg(e.message || 'ดึง HN ถัดไปไม่สำเร็จ');
    }
  };

  /* CRUD handlers */
  const refresh = () => setTick(t => t + 1);

  const handleCreate = async () => {
    try {
      const body = { ...addDraft, phone_number: addDraft.phone };
      await http('/api/patients', { method:'POST', body: JSON.stringify(body) });
      setOpenAdd(false);
      refresh();
    } catch (e) {
      alert(e.message || 'บันทึกข้อมูลไม่สำเร็จ');
    }
  };

  const handleOpenEdit = async (patients_id) => {
    setOpenEdit(patients_id);
    try {
      const d = await http(`/api/patients/${encodeURIComponent(patients_id)}`);
      // normalize phone field to UI key
      setEditDraft({ ...d, phone: d.phone ?? d.phone_number ?? '' });
    } catch (e) {
      alert('ดึงข้อมูลผู้ป่วยไม่สำเร็จ'); setOpenEdit(null);
    }
  };

  const handleUpdate = async () => {
    try {
      const id = openEdit;
      const body = { ...editDraft, phone_number: editDraft.phone };
      await http(`/api/patients/${encodeURIComponent(id)}`, { method:'PUT', body: JSON.stringify(body) });
      setOpenEdit(null);
      refresh();
    } catch (e) {
      alert(e.message || 'อัปเดตข้อมูลไม่สำเร็จ');
    }
  };

  const handleOpenAppt = (patients_id) => { setOpenAppt(patients_id); setApptDraft({}); };

  const handleCreateAppt = async () => {
    try {
      if (!apptDraft.appointment_date) return alert('กรุณาระบุวันที่นัด');
      if (!apptDraft.appointment_time) return alert('กรุณาระบุเวลานัด');
      await http('/api/appointments', {
        method:'POST',
        body: JSON.stringify({ patients_id: openAppt, ...apptDraft })
      });
      setOpenAppt(null); setApptDraft({});
      refresh();
    } catch (e) {
      alert(e.message || 'บันทึกนัดหมายไม่สำเร็จ');
    }
  };

  const handleOpenDeceased = (patients_id) => { setOpenDeceased(patients_id); setDeadDraft({}); setDeadErrors({}); };

  const handleMarkDeceased = async () => {
    const e = {};
    if (!deadDraft.death_date) e.death_date = 'กรุณาระบุวันที่เสียชีวิต';
    if (!deadDraft.death_cause) e.death_cause = 'กรุณาระบุสาเหตุการเสียชีวิต';
    setDeadErrors(e);
    if (Object.keys(e).length) return;

    try {
      await http(`/api/patients/${encodeURIComponent(openDeceased)}/deceased`, {
        method:'PATCH',
        body: JSON.stringify({
          death_date: deadDraft.death_date,
          death_time: deadDraft.death_time || '00:00',
          death_cause: deadDraft.death_cause,
          management: deadDraft.management || null
        })
      });
      setOpenDeceased(null); setDeadDraft({});
      refresh();
    } catch (err) {
      alert(err.message || 'บันทึกการเสียชีวิตไม่สำเร็จ');
    }
  };

  const handleVerify = async (patients_id) => {
    try {
      const d = await http(`/api/patients/${encodeURIComponent(patients_id)}`);
      setVerifyData(d);
      setOpenVerify(true);
    } catch (e) {
      alert('ดึงข้อมูลไม่สำเร็จ');
    }
  };

  /* derived */
  const totalPages = Math.max(1, Math.ceil(total / limit));

  function formatCardId (id) {
    if (!id) return "-";
    const parts = id.split("-");
    if (parts.length > 1) {
      return `HN ${parts[1]}`;
    }
    return id;
  };

  function formatThaiDateBE(dateStr) {
    if (!dateStr) return "-";
    let dt;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split("-").map(Number);
      dt = new Date(y, m - 1, d);
    } else {
      dt = new Date(dateStr);
    }
    if (Number.isNaN(dt.getTime())) return "-";
    return new Intl.DateTimeFormat("th-TH-u-nu-latn-ca-buddhist", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(dt);
  }

  function calculateAge(birthdateStr) {
    if (!birthdateStr) return "-";
    const birthDate = new Date(birthdateStr);
    if (isNaN(birthDate.getTime())) return "-";
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };


  return (
    <div className={styles.wrapper}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.title}>จัดการข้อมูลผู้ป่วย</div>
          <div className={styles.subtitle}>เพิ่ม • ตรวจสอบ • แก้ไข • นัดหมาย • เปลี่ยนสถานะเป็นเสียชีวิต</div>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className={styles.btn} onClick={()=>{ setQuery(''); clearFilters(); }}><RefreshCw size={16}/> เคลียร์</button>
          <button className={cx(styles.btn, styles.btnPrimary)} onClick={handleOpenAdd}><Plus size={16}/> เพิ่มผู้ป่วย</button>
        </div>
      </div>

      {/* top: single search */}
      <div className={styles.bar}>
        <div>
          <div className={styles.label}>ค้นหา (ชื่อ, HN, เพศ, กรุ๊ปเลือด, โรค, โทร)</div>
          <div style={{display:'flex', gap:8}}>
            <input className={styles.input} placeholder="เช่น HN-00000001 / สมชาย / เบาหวาน" value={query} onChange={e=>{ setQuery(e.target.value); setPage(1); }} />
            <button className={styles.btn} onClick={()=>{ setPage(1); refresh(); }}><Search size={16}/> ค้นหา</button>
          </div>
        </div>
      </div>

      {/* filters */}
      <div className={styles.sectionTitle}>ตัวกรอง</div>
      <div className={styles.filtersBar}>
        <div>
          <div className={styles.label}>สถานะผู้ป่วย</div>
          <Select
            components={animatedComponents}
            styles={rsx}
            menuPortalTarget={menuPortalTarget}
            isClearable
            placeholder="ทั้งหมด"
            options={statusOptions}
            value={statusOptions.find(o => o.value === filters.status) ?? null}
            onChange={(opt) => { setFilters(f => ({ ...f, status: opt?.value || '' })); setPage(1); }}
          />
        </div>
        <div>
          <div className={styles.label}>เพศ</div>
          <Select
            components={animatedComponents}
            styles={rsx}
            menuPortalTarget={menuPortalTarget}
            isClearable
            placeholder="ทั้งหมด"
            options={genderOptions}
            value={genderOptions.find(o => o.value === filters.gender) ?? null}
            onChange={(opt) => { setFilters(f => ({ ...f, gender: opt?.value || '' })); setPage(1); }}
          />
        </div>
        <div>
          <div className={styles.label}>กรุ๊ปเลือด</div>
          <Select
            components={animatedComponents}
            styles={rsx}
            menuPortalTarget={menuPortalTarget}
            isClearable
            placeholder="ทั้งหมด"
            options={bloodGroupOptions}
            value={bloodGroupOptions.find(o => o.value === filters.blood_group) ?? null}
            onChange={(opt) => { setFilters(f => ({ ...f, blood_group: opt?.value || '' })); setPage(1); }}
          />
        </div>
        <div>
          <div className={styles.label}>Rh</div>
          <Select
            components={animatedComponents}
            styles={rsx}
            menuPortalTarget={menuPortalTarget}
            isClearable
            placeholder="ทั้งหมด"
            options={rhOptions}
            value={rhOptions.find(o => o.value === filters.bloodgroup_rh) ?? null}
            onChange={(opt) => { setFilters(f => ({ ...f, bloodgroup_rh: opt?.value || '' })); setPage(1); }}
          />
        </div>
        <div>
          <div className={styles.label}>ประเภทผู้ป่วย</div>
          <Select
            components={animatedComponents}
            styles={rsx}
            menuPortalTarget={menuPortalTarget}
            isClearable
            placeholder="ทั้งหมด"
            options={patientTypeOptions}
            value={patientTypeOptions.find(o => o.value === filters.patients_type) ?? null}
            onChange={(opt) => { setFilters(f => ({ ...f, patients_type: opt?.value || '' })); setPage(1); }}
          />
        </div>
        <div><div className={styles.label}>รับเข้าตั้งแต่</div><input type="date" className={styles.input} value={filters.admit_from} onChange={e=>{ setFilters(f=>({...f,admit_from:e.target.value})); setPage(1); }} /></div>
        <div><div className={styles.label}>รับเข้าถึง</div><input type="date" className={styles.input} value={filters.admit_to} onChange={e=>{ setFilters(f=>({...f,admit_to:e.target.value})); setPage(1); }} /></div>
        <div style={{display:'flex', alignItems:'end'}}><button className={styles.btn} onClick={clearFilters}><X size={16}/> ล้างตัวกรองทั้งหมด</button></div>
      </div>

      {activeFilterEntries.length > 0 && (
        <div className={styles.chipsRow}>
          {activeFilterEntries.map(([k,v])=> (
            <span key={k} className={styles.chip}>
              <span>{(filterLabels[k]||k)}: {v}</span>
              <button onClick={()=>{ setFilters(f=>({...f, [k]: '' })); setPage(1); setTick(t=>t+1); }}>×</button>
            </span>
          ))}
          <button className={cx(styles.btn, styles.btnSm)} onClick={clearFilters}>ล้างทั้งหมด</button>
        </div>
      )}

      {/* banners */}
      {errMsg && <div className={cx(styles.banner, styles.bannerError)}>{errMsg}</div>}
      {!errMsg && loading && <div className={cx(styles.banner, styles.bannerInfo)}><span className={styles.spinner}></span> กำลังโหลดข้อมูล...</div>}

      {/* table */}
      <div className={styles.sectionTitle}>รายการผู้ป่วย</div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th className={styles.th}>HN</th>
              <th className={styles.th}>ชื่อ-นามสกุล</th>
              <th className={styles.th}>เพศ</th>
              <th className={styles.th}>อายุ</th>
              <th className={styles.th}>กรุ๊ปเลือด</th>
              <th className={styles.th}>ประเภท</th>
              <th className={styles.th}>โรคประจำตัว</th>
              <th className={styles.th}>รับเข้า</th>
              <th className={styles.th}>สถานะ</th>
              <th className={styles.th}>การทำงาน</th>
            </tr>
          </thead>
          <tbody>
            {(rows||[]).map(r=> (
              <tr key={r.patients_id}>
                <td className={styles.td}><span className={styles.mono}>{r.patients_id}</span></td>
                <td className={styles.td}>{r.pname||''}{r.first_name} {r.last_name}</td>
                <td className={styles.td}>{r.gender||'-'}</td>
                <td className={styles.td}>{calculateAgeFromBirthdate(r.birthdate||'-')}</td>
                <td className={styles.td}>{r.blood_group||'-'} {r.bloodgroup_rh||''}</td>
                <td className={styles.td}>{r.patients_type||'-'}</td>
                <td className={styles.td}>{r.disease||'-'}</td>
                <td className={styles.td}>{formatThaiDateBE(r.admittion_date||'-')}</td>
                <td className={styles.td}><Pill alive={r.status!=='เสียชีวิต'} /></td>
                <td className={styles.td}>
                  <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                    <button className={cx(styles.btn, styles.btnSm)} onClick={()=>handleVerify(r.patients_id)}><Eye size={14}/> ตรวจสอบ</button>
                    <button className={cx(styles.btn, styles.btnSm)} onClick={()=>handleOpenEdit(r.patients_id)}><Pencil size={14}/> แก้ไข</button>
                    <button className={cx(styles.btn, styles.btnSm)} onClick={()=>handleOpenAppt(r.patients_id)}><CalendarPlus size={14}/> เพิ่มนัด</button>
                    {r.status!=='เสียชีวิต' && (
                      <button className={cx(styles.btn, styles.btnSm)} onClick={()=>handleOpenDeceased(r.patients_id)}><Skull size={14}/> เสียชีวิต</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && rows.length===0 && (
              <tr><td className={styles.td} colSpan={10}>ไม่พบข้อมูลตามเงื่อนไข</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className={styles.pagination}>
        <span className={styles.pageInfo}>ทั้งหมด {total} รายการ</span>
        <button className={styles.pageBtn} disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>ก่อนหน้า</button>
        <span className={styles.pageInfo}>หน้า {page}/{totalPages}</span>
        <button className={styles.pageBtn} disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>ถัดไป</button>
      </div>

      {/* Enhanced Add Patient Modal */}
      <Modal
        open={openAdd}
        title={<div className="flex items-center gap-2"><Plus size={20} className="text-blue-600"/> เพิ่มผู้ป่วยใหม่</div>}
        size="xl"
        bodyClassName="max-h-[70vh] overflow-y-auto"
        initialFocusSelector="input,select,textarea"
        onConfirm={handleCreate}
        onClose={()=>setOpenAdd(false)}
        footer={<>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Enter</kbd>
              <span>บันทึก</span>
              <span className="mx-2">•</span>
              <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Esc</kbd>
              <span>ปิด</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2" 
              onClick={()=>setOpenAdd(false)}
            >
              <X size={16}/> ยกเลิก
            </button>
            <button 
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg flex items-center gap-2" 
              onClick={handleCreate}
            >
              <CheckCircle size={16}/> บันทึกข้อมูล
            </button>
          </div>
        </>}
      >
        <PatientForm value={addDraft} onChange={setAddDraft} />
      </Modal>

      {/* Enhanced Edit Patient Modal */}
      <Modal
        open={!!openEdit}
        title={<div className="flex items-center gap-2"><Pencil size={20} className="text-orange-600"/> แก้ไขข้อมูลผู้ป่วย</div>}
        size="xl"
        bodyClassName="max-h-[70vh] overflow-y-auto"
        initialFocusSelector="input,select,textarea"
        onConfirm={handleUpdate}
        onClose={()=>setOpenEdit(null)}
        footer={<>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Enter</kbd>
              <span>บันทึก</span>
              <span className="mx-2">•</span>
              <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Esc</kbd>
              <span>ปิด</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2" 
              onClick={()=>setOpenEdit(null)}
            >
              <X size={16}/> ยกเลิก
            </button>
            <button 
              className="px-6 py-2 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg hover:from-orange-700 hover:to-orange-800 transition-all duration-200 shadow-lg flex items-center gap-2" 
              onClick={handleUpdate}
            >
              <CheckCircle size={16}/> บันทึกการแก้ไข
            </button>
          </div>
        </>}
      >
        <PatientForm value={editDraft} onChange={setEditDraft} />
      </Modal>

      {/* Enhanced Appointment Modal */}
      <Modal
        open={!!openAppt}
        title={<div className="flex items-center gap-2"><CalendarPlus size={20} className="text-purple-600"/> เพิ่มการนัดหมาย</div>}
        size="lg"
        initialFocusSelector="input,select,textarea"
        onConfirm={handleCreateAppt}
        onClose={()=>setOpenAppt(null)}
        footer={<>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Enter</kbd>
              <span>บันทึก</span>
              <span className="mx-2">•</span>
              <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Esc</kbd>
              <span>ปิด</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2" 
              onClick={()=>setOpenAppt(null)}
            >
              <X size={16}/> ยกเลิก
            </button>
            <button 
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200 shadow-lg flex items-center gap-2" 
              onClick={handleCreateAppt}
            >
              <CalendarPlus size={16}/> บันทึกนัดหมาย
            </button>
          </div>
        </>}
      >
        <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center gap-2 text-purple-800">
            <User size={16}/>
            <span className="font-medium">ผู้ป่วย:</span>
            <span className="font-mono bg-white px-2 py-1 rounded border">{openAppt || '-'}</span>
          </div>
        </div>
        <AppointmentForm value={apptDraft} onChange={setApptDraft} />
      </Modal>

      {/* Enhanced Mark Deceased Modal */}
      <Modal
        open={!!openDeceased}
        title={<div className="flex items-center gap-2"><Skull size={20} className="text-red-600"/> เปลี่ยนสถานะเป็น "เสียชีวิต"</div>}
        size="lg"
        initialFocusSelector="input,select,textarea"
        onConfirm={handleMarkDeceased}
        onClose={()=>setOpenDeceased(null)}
        footer={<>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Enter</kbd>
              <span>ยืนยัน</span>
              <span className="mx-2">•</span>
              <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Esc</kbd>
              <span>ปิด</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2" 
              onClick={()=>setOpenDeceased(null)}
            >
              <X size={16}/> ยกเลิก
            </button>
            <button 
              className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg flex items-center gap-2" 
              onClick={handleMarkDeceased}
            >
              <CheckCircle size={16}/> ยืนยันการเปลี่ยนสถานะ
            </button>
          </div>
        </>}
      >
        <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-center gap-2 text-red-800">
            <User size={16}/>
            <span className="font-medium">ผู้ป่วย:</span>
            <span className="font-mono bg-white px-2 py-1 rounded border">{openDeceased || '-'}</span>
          </div>
        </div>
        <DeceasedForm value={deadDraft} onChange={setDeadDraft} errors={deadErrors} />
      </Modal>

      {/* Enhanced Verify Modal */}
      <Modal
        open={openVerify}
        title={<div className="flex items-center gap-2"><Eye size={20} className="text-green-600"/> ผลการตรวจสอบผู้ป่วย</div>}
        size="xl"
        bodyClassName="max-h-[80vh] overflow-y-auto"
        onClose={() => { setOpenVerify(false); setVerifyData(null); }}
        onConfirm={() => { setOpenVerify(false); setVerifyData(null); }}
        footer={
          <div className="w-full flex justify-center">
            <button 
              className="px-8 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg flex items-center gap-2" 
              onClick={() => { setOpenVerify(false); setVerifyData(null); }}
            >
              <CheckCircle size={16}/> ปิด
            </button>
          </div>
        }
      >
        {!verifyData ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle size={48} className="text-gray-400 mx-auto mb-4"/>
              <p className="text-gray-500">ไม่มีข้อมูล</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Patient Overview Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-100 rounded-2xl shadow-lg p-6 border border-blue-200">
              <div className="flex items-center space-x-6 mb-4">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {formatCardId(verifyData.patients_id).replace('HN ', '')}
                </div>
                <div className="flex-1">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {verifyData.pname || ''}{verifyData.first_name} {verifyData.last_name}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <User size={14}/> อายุ {calculateAge(verifyData.birthdate)} ปี
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={14}/> HN: {formatCardId(verifyData.patients_id)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-2">
                    <Pill alive={verifyData.status !== 'เสียชีวิต'} />
                  </div>
                  <div className="text-xs text-gray-500">
                    รับเข้า: {formatThaiDateBE(verifyData.admittion_date)}
                  </div>
                </div>
              </div>
            </div>

            {/* Personal Information Section */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-6 pb-3 border-b-2 border-green-100">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <User size={16} className="text-green-600"/>
                </div>
                <h3 className="text-xl font-bold text-gray-800">ข้อมูลส่วนตัว</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <User size={14} className="text-gray-600"/>
                    <span className="font-semibold text-gray-700">เพศ</span>
                  </div>
                  <div className="text-gray-900 text-lg">{verifyData.gender || '-'}</div>
                </div>
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone size={14} className="text-gray-600"/>
                    <span className="font-semibold text-gray-700">เบอร์โทรศัพท์</span>
                  </div>
                  <div className="text-gray-900 text-lg font-mono">{verifyData.phone || verifyData.phone_number || '-'}</div>
                </div>
                <div className="md:col-span-2 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin size={14} className="text-gray-600"/>
                    <span className="font-semibold text-gray-700">ที่อยู่</span>
                  </div>
                  <div className="text-gray-900 leading-relaxed">{verifyData.address || '-'}</div>
                </div>
              </div>
            </div>

            {/* Medical Information Section */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-6 pb-3 border-b-2 border-red-100">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <Droplets size={16} className="text-red-600"/>
                </div>
                <h3 className="text-xl font-bold text-gray-800">ข้อมูลทางการแพทย์</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-xl border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Droplets size={14} className="text-red-600"/>
                    <span className="font-semibold text-gray-700">กรุ๊ปเลือด</span>
                  </div>
                  <div className="text-gray-900 text-lg font-bold">
                    {verifyData.blood_group || '-'} {verifyData.bloodgroup_rh || ''}
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart size={14} className="text-blue-600"/>
                    <span className="font-semibold text-gray-700">ประเภทผู้ป่วย</span>
                  </div>
                  <div className="text-gray-900 text-lg">{verifyData.patients_type || '-'}</div>
                </div>
                <div className="md:col-span-2 p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={14} className="text-yellow-600"/>
                    <span className="font-semibold text-gray-700">โรคประจำตัว / ประวัติการแพทย์</span>
                  </div>
                  <div className="text-gray-900 leading-relaxed">{verifyData.disease || 'ไม่มีข้อมูล'}</div>
                </div>
              </div>
            </div>

            {/* Admission Information Section */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-6 pb-3 border-b-2 border-purple-100">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Calendar size={16} className="text-purple-600"/>
                </div>
                <h3 className="text-xl font-bold text-gray-800">ข้อมูลการรับเข้า</h3>
              </div>
              <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={14} className="text-purple-600"/>
                  <span className="font-semibold text-gray-700">วันที่รับเข้า</span>
                </div>
                <div className="text-gray-900 text-lg font-medium">{formatThaiDateBE(verifyData.admittion_date || '-')}</div>
              </div>
            </div>

            {/* Additional Status Information */}
            {verifyData.status === 'เสียชีวิต' && verifyData.death_date && (
              <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl shadow-lg p-6 border-2 border-gray-300">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-400">
                  <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
                    <Skull size={16} className="text-white"/>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">ข้อมูลการเสียชีวิต</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-white rounded-lg border border-gray-300">
                    <div className="font-semibold text-gray-700 mb-1">วันที่เสียชีวิต</div>
                    <div className="text-gray-900 text-lg">{formatThaiDateBE(verifyData.death_date)}</div>
                  </div>
                  {verifyData.death_cause && (
                    <div className="p-4 bg-white rounded-lg border border-gray-300">
                      <div className="font-semibold text-gray-700 mb-1">สาเหตุ</div>
                      <div className="text-gray-900">{verifyData.death_cause}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function formatThaiDateBE(dateStr) {
  if (!dateStr) return "-";
  let dt;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    dt = new Date(y, m - 1, d);
  } else {
    dt = new Date(dateStr);
  }
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH-u-nu-latn-ca-buddhist", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dt);
}

function calculateAge(birthdateStr) {
  if (!birthdateStr) return "-";
  const birthDate = new Date(birthdateStr);
  if (isNaN(birthDate.getTime())) return "-";
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}