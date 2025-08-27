'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import styles from './patient.module.css';
import {
  Search, X, Plus, Pencil, Eye, CalendarPlus, Skull, RefreshCw,
  User, Calendar, FileText, CheckCircle, AlertCircle, Heart,
  Phone, MapPin, Droplets, IdCard,
  CalendarArrowDown,
  CardSim,
} from 'lucide-react';
import makeAnimated from 'react-select/animated';
import dynamic from 'next/dynamic';
import Swal from 'sweetalert2';

// ⬇️ คอมโพเนนต์ที่แยกไฟล์ออกมา
import Modal from '@/app/components/ui/Modal';
import Pill from '@/app/components/ui/Pill';
import PatientForm from '@/app/components/forms/PatientForm';
import AppointmentForm from '@/app/components/forms/AppointmentForm';
import DeceasedForm from '@/app/components/forms/DeceasedForm';
import DatePickerField from '@/app/components/DatePicker';
import type { AppointmentFormValue } from '@/app/components/forms/AppointmentForm';
import Link from 'next/link';

type Status = 'pending' | 'done' | 'cancelled';
// react-select (SSR safe)
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
    color: '#000000'
  }),
  menuPortal: (base) => ({ ...base, color: '#000000', zIndex: 9999 }),
};

const $swal = Swal.mixin({
  confirmButtonText: 'ตกลง',
  cancelButtonText: 'ยกเลิก',
  confirmButtonColor: '#2563eb',
  cancelButtonColor: '#6b7280',
  customClass: {
    popup: 'swal-popup-on-top'
  }
});
const toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2200,
  timerProgressBar: true,
});

const RS_PROPS = {
  classNamePrefix: 'rs',
  menuPortalTarget: typeof window !== 'undefined' ? document.body : undefined,
  menuPosition: 'fixed',
  menuShouldBlockScroll: true,
  isSearchable: false,                 // ไม่ต้องพิมพ์
  styles: {
    menuPortal: (base: any) => ({ ...base, zIndex: 12050 }), // > overlay(10000)
    menu: (base: any) => ({ ...base, zIndex: 12050 }),
  },
  onKeyDown: (e: any) => {             // กัน Enter วิ่งขึ้นไปที่ Modal
    if (e.key === 'Enter') e.stopPropagation();
  },
} as const;

// ฟิลเตอร์ options
const genderOptions = [
  { value: 'ชาย', label: 'ชาย' },
  { value: 'หญิง', label: 'หญิง' },
  { value: 'ไม่ระบุ', label: 'ไม่ระบุ' },
];
const patientTypeOptions = [
  { value: 'ติดสังคม', label: 'ติดสังคม' },
  { value: 'ติดบ้าน', label: 'ติดบ้าน' },
  { value: 'ติดเตียง', label: 'ติดเตียง' },
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

type FileField =
  | 'patient_id_card'
  | 'house_registration'
  | 'patient_photo'
  | 'relative_id_card';

// ถ้า fields ยังไม่กำหนด type ให้ใส่ด้วย
const fields: Array<{ key: FileField; label: string }> = [
  { key: 'patient_id_card', label: 'สำเนาบัตรประชาชนผู้ป่วย' },
  { key: 'house_registration', label: 'สำเนาทะเบียนบ้านผู้ป่วย/ญาติ' },
  { key: 'patient_photo', label: 'รูปถ่ายผู้ป่วย' },
  { key: 'relative_id_card', label: 'สำเนาบัตรประชาชนญาติ/ผู้ขอฯ' },
];

// HTTP helper
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';
function joinUrl(base, path) {
  if (!base) return path;
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}
async function http(url, options: any = {}) {
  const finalUrl = /^https?:\/\//i.test(url) ? url : joinUrl(API_BASE, url);

  const headers = options.body instanceof FormData
    ? {} // ❌ อย่าใส่ Content-Type เอง ให้ browser จัดการ
    : { 'Content-Type': 'application/json' };

  const res = await fetch(finalUrl, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });

  if (!res.ok) {
    let msg = 'Request failed';
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch { }
    const err: any = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

function buildPatientFormData(values: Record<string, any>) {
  const fd = new FormData();

  const norm = (val: any) => {
    if (val == null) return '';
    if (val instanceof Date) return toISODateLocal(val);
    if (typeof val === 'object' && 'toISOString' in val) {
      try { return (val as any).toISOString().slice(0, 10); } catch { return String(val); }
    }
    return String(val);
  };

  // ใส่ฟิลด์ข้อความ (ข้ามพวกไฟล์)
  Object.entries(values).forEach(([k, v]) => {
    if (!v) return;
    if (v instanceof File) return;                 // ข้ามไฟล์ไว้ก่อน (จะใส่ทีหลัง)
    const s = norm(v);
    if (s !== '') fd.append(k, s);
  });

  // mapping เบอร์โทรให้ backend ด้วย
  if (values.phone && !values.phone_number) {
    fd.append('phone_number', String(values.phone));
  }

  // ใส่ไฟล์ถ้ามี
  if (values.patient_id_card) fd.append('patient_id_card', values.patient_id_card);
  if (values.house_registration) fd.append('house_registration', values.house_registration);
  if (values.patient_photo) fd.append('patient_photo', values.patient_photo);
  if (values.relative_id_card) fd.append('relative_id_card', values.relative_id_card);

  return fd;
}

// Utils
function formatThaiDateBE(dateStr) {
  if (!dateStr) return '-';
  let dt;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    dt = new Date(y, m - 1, d);
  } else {
    dt = new Date(dateStr);
  }
  if (Number.isNaN(dt.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH-u-nu-latn-ca-buddhist', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(dt);
}
function calculateAge(birthdateStr) {
  if (!birthdateStr) return '-';
  const birthDate = new Date(birthdateStr);
  if (isNaN(birthDate.getTime())) return '-';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}
function calculateAgeFromBirthdate(birthdate) {
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
function toISODateLocal(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d)) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function formatCardId(id) {
  if (!id) return '-';
  const parts = id.split('-');
  if (parts.length > 1) return `HN ${parts[1]}`;
  return id;
}

// ---- helpers for download ----
function decodeRFC5987(v: string) {
  try { return decodeURIComponent(v.replace(/\+/g, '%20')); } catch { return v; }
}
function filenameFromContentDisposition(cd?: string | null) {
  if (!cd) return '';
  let m = cd.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (m) return decodeRFC5987(m[1].replace(/"/g, ''));
  m = cd.match(/filename\s*=\s*"([^"]+)"/i);
  if (m) return m[1];
  m = cd.match(/filename\s*=\s*([^;]+)/i);
  if (m) return m[1].trim();
  return '';
}
function extFromName(name?: string) {
  if (!name) return '';
  const i = name.lastIndexOf('.');
  return i > -1 ? name.slice(i) : '';
}
function extFromMime(mime?: string | null) {
  const m = (mime || '').toLowerCase();
  if (m.includes('pdf')) return '.pdf';
  if (m.includes('png')) return '.png';
  if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
  if (m.includes('gif')) return '.gif';
  return '';
}
function safeFilename(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
}
const FILE_LABELS: Record<string, string> = {
  patient_id_card: 'สำเนาบัตรประชาชน',
  house_registration: 'สำเนาทะเบียนบ้าน',
  patient_photo: 'รูปถ่ายผู้ป่วย',
  relative_id_card: 'บัตรประชาชนญาติ',
};

/** ดาวน์โหลดไฟล์แนบของผู้ป่วย */
async function downloadPatientAttachment(
  patient: { patients_id: string; pname?: string; first_name?: string; last_name?: string },
  field: 'patient_id_card' | 'house_registration' | 'patient_photo' | 'relative_id_card'
) {
  const patientsId = patient.patients_id;
  const fullName = `${patient.pname ?? ''}${patient.first_name ?? ''} ${patient.last_name ?? ''}`
    .replace(/\s+/g, ' ')
    .trim();
  const label = FILE_LABELS[field] || field;

  const url = joinUrl(API_BASE, `/api/patients/${encodeURIComponent(patientsId)}/file/${field}`);

  try {
    Swal.fire({
      title: 'กำลังดาวน์โหลด...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      let msg = 'ดาวน์โหลดไม่สำเร็จ';
      try { const j = await res.json(); msg = j.message || msg; } catch { }
      throw new Error(msg);
    }

    const blob = await res.blob();
    const cd = res.headers.get('content-disposition');
    const ct = res.headers.get('content-type');

    // หานามสกุลไฟล์จากชื่อเดิม/ชนิดไฟล์
    const originalName = filenameFromContentDisposition(cd);
    const ext = extFromName(originalName) || extFromMime(ct) || '';

    const custom = safeFilename(`${patientsId}-${fullName}-${label}`) + ext;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = custom;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 300);
    Swal.close();
  } catch (e: any) {
    Swal.close();
    $swal.fire({ icon: 'error', title: 'ดาวน์โหลดไม่สำเร็จ', text: e?.message || '' });
  }
}

export default function PatientsPage() {
  // state: query + filters + pagination
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    gender: '', status: '', blood_group: '', bloodgroup_rh: '', patients_type: '', admit_from: '', admit_to: ''
  });
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [tick, setTick] = useState(0);

  // data
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  // modals
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState<string | null>(null);
  const [openAppt, setOpenAppt] = useState<string | null>(null);
  const [openDeceased, setOpenDeceased] = useState<string | null>(null);
  const [openVerify, setOpenVerify] = useState(false);
  const [verifyData, setVerifyData] = useState(null);

  // drafts
  const [addDraft, setAddDraft] = useState({ status: 'มีชีวิต' });
  const [editDraft, setEditDraft] = useState({});
  const [deadDraft, setDeadDraft] = useState({});
  const [deadErrors, setDeadErrors] = useState({});

  // 🔗 refs สำหรับเรียก validate() จาก PatientForm
  const addFormRef = useRef(null);
  const editFormRef = useRef(null);

  // build query string
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (query.trim()) p.set('q', query.trim());
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v); });
    p.set('page', String(page));
    p.set('limit', String(limit));
    p.set('_t', String(tick));
    return p.toString();
  }, [query, filters, page, limit, tick]);

  // fetch list
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
        if (e.name !== 'AbortError') {
          setErrMsg(e.message || 'โหลดข้อมูลไม่สำเร็จ');
          $swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: e.message || '' });
        }
      } finally {
        if (alive) setLoading(false);
      }
    }, 350);
    return () => { alive = false; clearTimeout(t); controller.abort(); };
  }, [qs]);

  const clearFilters = () => {
    setFilters({ gender: '', status: '', blood_group: '', bloodgroup_rh: '', patients_type: '', admit_from: '', admit_to: '' });
    setPage(1); setTick(t => t + 1);
  };
  const activeFilterEntries = useMemo(() => Object.entries(filters).filter(([, v]) => !!v), [filters]);
  const filterLabels = { status: 'สถานะผู้ป่วย', gender: 'เพศ', blood_group: 'กรุ๊ปเลือด', bloodgroup_rh: 'Rh', patients_type: 'ประเภทผู้ป่วย', admit_from: 'รับเข้าตั้งแต่', admit_to: 'รับเข้าถึง' };

  // actions
  const refresh = () => setTick(t => t + 1);

  const handleOpenAdd = async () => {
    setErrMsg('');
    try {
      const { nextId } = await http('/api/patients/next-id');
      setAddDraft({ patients_id: nextId, status: 'มีชีวิต' });
      setOpenAdd(true);
    } catch (e) {
      $swal.fire({ icon: 'error', title: 'ดึง HN ถัดไปไม่สำเร็จ', text: e.message || '' });
    }
  };

  const handleCreate = async () => {
    if (addFormRef.current?.validate && !addFormRef.current.validate()) return;

    const { isConfirmed } = await $swal.fire({
      icon: 'question', title: 'ยืนยันบันทึกผู้ป่วยใหม่?', showCancelButton: true,
    });
    if (!isConfirmed) return;

    try {
      const formValues = addFormRef.current.getValues();
      const formData = buildPatientFormData(formValues);

      await http('/api/patients', { method: 'POST', body: formData });  // ✅ ใช้ http()
      setOpenAdd(false);
      refresh();
      toast.fire({ icon: 'success', title: 'บันทึกผู้ป่วยเรียบร้อย' });
    } catch (e: any) {
      $swal.fire({ icon: 'error', title: 'บันทึกข้อมูลไม่สำเร็จ', text: e.message || '' });
    }
  };


  const handleOpenEdit = async (patients_id) => {
    setOpenEdit(patients_id);
    try {
      const d = await http(`/api/patients/${encodeURIComponent(patients_id)}`);
      setEditDraft({ ...d, phone: d.phone ?? d.phone_number ?? '' });
    } catch (e) {
      $swal.fire({ icon: 'error', title: 'ดึงข้อมูลผู้ป่วยไม่สำเร็จ', text: e.message || '' });
      setOpenEdit(null);
    }
  };

  const handleUpdate = async () => {
    if (editFormRef.current?.validate && !editFormRef.current.validate()) return;

    const { isConfirmed } = await $swal.fire({
      icon: 'question', title: 'ยืนยันบันทึกการแก้ไข?', showCancelButton: true,
    });
    if (!isConfirmed) return;

    try {
      const formValues = editFormRef.current.getValues();
      const formData = buildPatientFormData(formValues);

      await http(`/api/patients/${encodeURIComponent(openEdit!)}`, {
        method: 'PUT',
        body: formData,     // ✅ ใช้ http() + FormData
      });

      setOpenEdit(null);
      refresh();
      toast.fire({ icon: 'success', title: 'อัปเดตข้อมูลเรียบร้อย' });
    } catch (e: any) {
      $swal.fire({ icon: 'error', title: 'อัปเดตข้อมูลไม่สำเร็จ', text: e.message || '' });
    }
  };


  const TYPE_OPTIONS = ['ตรวจติดตาม', 'ทำแผล', 'เยี่ยมบ้าน', 'กายภาพบำบัด', 'ติดตามอาการ'];
  const PLACE_OPTIONS = ['OPD ชีวาภิบาล', 'ห้องทำแผล 1', 'ห้องทำแผล 2', 'PT Room A', 'บ้านผู้ป่วย'];

  const TODAY_TH = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());

  function parseHHmmToMin(t?: string | null) {
    if (!t) return NaN;
    const m = String(t).match(/^(\d{1,2}):(\d{2})/);
    if (!m) return NaN;
    const h = Number(m[1]), mm = Number(m[2]);
    return h * 60 + mm;
  }

  const resetApptForm = (): AppointmentFormValue => ({
    date: TODAY_TH(),
    start: '09:00',
    end: '09:30',
    status: 'pending',
  });
  const [apptForm, setApptForm] = useState<AppointmentFormValue>(resetApptForm());
  const [apptErrors, setApptErrors] = useState<Partial<Record<keyof AppointmentFormValue, string>>>({});

  const handleOpenAppt = async (patients_id: string) => {
    setOpenAppt(patients_id);
    setApptErrors({});
    try {
      const p = await http(`/api/patients/${encodeURIComponent(patients_id)}`);
      const full = `${p.pname ?? ''}${p.first_name ?? ''} ${p.last_name ?? ''}`.replace(/\s+/g, ' ').trim();
      setApptForm({
        ...resetApptForm(),
        hn: p.patients_id || patients_id,
        patient: full || patients_id,
        phone: p.phone_number || '',
      });
    } catch {
      // ถ้าดึงรายละเอียดผู้ป่วยไม่ได้ ให้เปิดฟอร์มพร้อม HN อย่างน้อย
      setApptForm({ ...resetApptForm(), hn: patients_id });
    }
  };

  function validateAppt(f: AppointmentFormValue) {
    const e: Partial<Record<keyof AppointmentFormValue, string>> = {};
    const get = (k: keyof AppointmentFormValue) => (f[k]?.toString().trim() ?? '');
    const req: (keyof AppointmentFormValue)[] = ['hn', 'date', 'start', 'end', 'type'];
    req.forEach(k => { if (!get(k)) e[k] = 'จำเป็น'; });

    const s = get('start'), ed = get('end');
    const sm = parseHHmmToMin(s), em = parseHHmmToMin(ed);
    if (s && ed && (!isFinite(sm) || !isFinite(em) || em <= sm)) e.end = 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม';
    if (f.phone && !/^[0-9+\-() ]{6,}$/.test(f.phone)) e.phone = 'รูปแบบเบอร์ไม่ถูกต้อง';

    return e;
  }

  const saveAppt = async () => {
    const errs = validateAppt(apptForm);
    setApptErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.fire({ icon: 'warning', title: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
      return;
    }

    const payload = {
      hn: (apptForm.hn || '').trim(),
      date: apptForm.date!,
      start: apptForm.start!,
      end: apptForm.end!,
      type: (apptForm.type || '').trim(),
      place: (apptForm.place || '').trim(),
      status: (apptForm.status as Status) || 'pending',
      note: (apptForm.note || '').trim() || null,
    };

    try {
      // ✅ ไม่ await เวลาเปิด loading
      Swal.fire({
        title: 'กำลังบันทึกนัดหมาย...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });

      try {
        await http('/api/appointments', { method: 'POST', body: JSON.stringify(payload) });
        Swal.close();
        toast.fire({ icon: 'success', title: 'บันทึกนัดหมายแล้ว' });
        setOpenAppt(null);
        setApptForm(resetApptForm());
        refresh();
      } catch (e: any) {
        Swal.close();
        toast.fire({ icon: 'error', title: e?.message || 'บันทึกไม่สำเร็จ(อาจซ้ำช่วงเวลา)' });
      }
      setOpenAppt(null);
      setApptForm(resetApptForm());
      // ไม่มีผลกับตารางผู้ป่วย แต่รีเฟรชไว้ก็ดี ถ้ามี count/สถานะอื่นผูกอยู่
      refresh();
    } catch (e: any) {
      Swal.close();
      toast.fire({ icon: 'error', title: e?.message || 'บันทึกไม่สำเร็จ(อาจซ้ำช่วงเวลา)' });
    }
  };

  const [deceasedPatient, setDeceasedPatient] = useState(null);

  const handleOpenDeceased = async (patients_id) => {
    setOpenDeceased(patients_id);
    setDeadDraft({});
    setDeadErrors({});
    try {
      const d = await http(`/api/patients/${encodeURIComponent(patients_id)}`);
      setDeceasedPatient(d);
    } catch (e) {
      $swal.fire({ icon: 'error', title: 'ดึงข้อมูลผู้ป่วยไม่สำเร็จ', text: e.message || '' });
      setDeceasedPatient(null);
    }
  };


  const handleMarkDeceased = async () => {
    const e = {};
    if (!deadDraft.death_date) e.death_date = 'กรุณาระบุวันที่เสียชีวิต';
    if (!deadDraft.death_cause) e.death_cause = 'กรุณาระบุสาเหตุการเสียชีวิต';
    setDeadErrors(e);
    if (Object.keys(e).length) {
      await $swal.fire({
        icon: 'warning', title: 'กรอกข้อมูลไม่ครบ',
        html: Object.values(e).map(s => `• ${s}`).join('<br/>')
      });
      return;
    }
    const { isConfirmed } = await $swal.fire({
      icon: 'warning',
      title: 'ยืนยันเปลี่ยนสถานะเป็น “เสียชีวิต”?',
      text: 'เมื่อยืนยันแล้ว สถานะผู้ป่วยจะเปลี่ยนเป็นเสียชีวิต',
      showCancelButton: true,
    });
    if (!isConfirmed) return;
    try {
      $swal.fire({ title: 'กำลังอัปเดต...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      await http(`/api/patients/${encodeURIComponent(openDeceased)}/deceased`, {
        method: 'PATCH',
        body: JSON.stringify({
          death_date: deadDraft.death_date,
          death_time: deadDraft.death_time || '00:00',
          death_cause: deadDraft.death_cause,
          management: deadDraft.management || null
        })
      });
      Swal.close();
      setOpenDeceased(null); setDeadDraft({});
      refresh();
      $swal.fire({ icon: 'success', title: 'เปลี่ยนสถานะเป็นเสียชีวิตแล้ว' });
    } catch (err) {
      Swal.close();
      $swal.fire({ icon: 'error', title: 'บันทึกการเสียชีวิตไม่สำเร็จ', text: err?.message || '' });
    }
  };

  const handleVerify = async (patients_id) => {
    try {
      const d = await http(`/api/patients/${encodeURIComponent(patients_id)}`);
      setVerifyData(d);
      setOpenVerify(true);
    } catch (e) {
      $swal.fire({ icon: 'error', title: 'ดึงข้อมูลไม่สำเร็จ', text: e.message || '' });
    }
  };

  // derived
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const orderedRows = useMemo(() => {
    const statusRank = (s?: string) =>
      s === 'มีชีวิต' ? 0 :
        s === 'จำหน่าย' ? 1 :
          s === 'เสียชีวิต' ? 2 : 3;

    const time = (d?: string) => {
      if (!d) return -Infinity;
      const t = new Date(d as any).getTime();
      return Number.isNaN(t) ? -Infinity : t;
    };

    return [...rows].sort((a, b) => {
      const r = statusRank(a.status) - statusRank(b.status);
      if (r !== 0) return r;                               // เรียงตามสถานะก่อน
      const dt = time(b.admittion_date) - time(a.admittion_date);
      if (dt !== 0) return dt;                             // รับเข้าใหม่อยู่ก่อน
      return String(b.patients_id).localeCompare(String(a.patients_id)); // กันชน
    });
  }, [rows]);

  return (
    <div className={styles.wrapper}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.title}>จัดการข้อมูลผู้ป่วย</div>
          <div className={styles.subtitle}>เพิ่ม • ตรวจสอบ • แก้ไข • นัดหมาย • เปลี่ยนสถานะเป็นเสียชีวิต</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.btn} onClick={() => { setQuery(''); clearFilters(); }}>
            <RefreshCw size={16} /> เคลียร์
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleOpenAdd}>
            <Plus size={16} /> เพิ่มผู้ป่วย
          </button>
        </div>
      </div>

      {/* Search */}
      <div className={styles.bar}>
        <div>
          <div className={styles.sectionTitle}>ค้นหา</div>
          <div className={styles.label}>ค้นหา (ชื่อ, HN, เพศ, กรุ๊ปเลือด, โรค, โทร)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className={styles.input}
              placeholder="เช่น HN-00000001 หรือ 1 / สมชาย / เบาหวาน"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
            />
            <button className={styles.btn} onClick={() => { setPage(1); refresh(); }}>
              <Search size={16} /> ค้นหา
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
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

        <div className={styles.dateRangeRow}>
          <div className={styles.formGroup}>
            <div className={styles.label}>รับเข้าตั้งแต่</div>
            <DatePickerField
              value={filters.admit_from || ''}
              onChange={(val) => { setFilters(f => ({ ...f, admit_from: toISODateLocal(val) })); setPage(1); }}
            />
          </div>

          <div className={styles.hyphen}>–</div>

          <div className={styles.formGroup}>
            <div className={styles.label}>รับเข้าถึง</div>
            <DatePickerField
              value={filters.admit_to || ''}
              onChange={(val) => { setFilters(f => ({ ...f, admit_to: toISODateLocal(val) })); setPage(1); }}
            />
          </div>
        </div>

        {/* ปุ่มล้างตัวกรอง (ขวาสุดของแถวเดียวกัน) */}
        <div className={styles.clearWrap}>
          <button className={`${styles.btn} ${styles.btnClearfilter}`} onClick={clearFilters}>
            <X size={16} /> ล้างตัวกรองทั้งหมด
          </button>
        </div>
      </div>

      {activeFilterEntries.length > 0 && (
        <div className={styles.chipsRow}>
          {activeFilterEntries.map(([k, v]) => (
            <span key={k} className={styles.chip}>
              <span>{(filterLabels[k] || k)}: {v}</span>
              <button onClick={() => { setFilters(f => ({ ...f, [k]: '' })); setPage(1); setTick(t => t + 1); }}>×</button>
            </span>
          ))}
          <button className={`${styles.btn} ${styles.btnSm}`} onClick={clearFilters}>ล้างทั้งหมด</button>
        </div>
      )}

      {/* banners */}
      {errMsg && <div className={`${styles.banner} ${styles.bannerError}`}>{errMsg}</div>}
      {!errMsg && loading && (
        <div className={`${styles.banner} ${styles.bannerInfo}`}>
          <span className={styles.spinner}></span> กำลังโหลดข้อมูล...
        </div>
      )}

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
              <th className={styles.th}>สถานะ</th>
              <th className={styles.th}>การทำงาน</th>
            </tr>
          </thead>
          <tbody>
            {(orderedRows || []).map(r => (
              <tr key={r.patients_id}>
                <td className={styles.td}><span className={styles.mono}>{r.patients_id}</span></td>
                <td className={styles.td}>{r.pname || ''}{r.first_name} {r.last_name}</td>
                <td className={styles.td}>{r.gender || '-'}</td>
                <td className={styles.td}>{calculateAgeFromBirthdate(r.birthdate || '-')}</td>
                <td className={styles.td}>{r.blood_group || '-'} {r.bloodgroup_rh || ''}</td>
                <td className={styles.td}>{r.patients_type || '-'}</td>
                <td className={styles.td}>{r.disease || '-'}</td>
                <td className={styles.td}><Pill alive={r.status !== 'เสียชีวิต'} /></td>
                <td className={styles.td}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className={`${styles.btn} ${styles.btnSm}`} onClick={() => handleVerify(r.patients_id)}>
                      <Eye size={14} /> ตรวจสอบ
                    </button>
                    <button className={`${styles.btn} ${styles.btnSm}`} onClick={() => handleOpenEdit(r.patients_id)}>
                      <Pencil size={14} /> แก้ไข
                    </button>
                    {r.status !== 'เสียชีวิต' && (
                      <button className={`${styles.btn} ${styles.btnSm}`} onClick={() => handleOpenAppt(r.patients_id)}>
                        <CalendarPlus size={14} /> เพิ่มนัด
                      </button>
                    )}
                    <Link
                      href={`/patient/${encodeURIComponent(r.patients_id)}/encounters`}
                      className={`${styles.btn} ${styles.btnSm}`}
                    >
                      <FileText size={14} /> ประวัติ
                    </Link>
                    <Link
                      href={`/patient/${encodeURIComponent(r.patients_id)}/allergies?name=${encodeURIComponent(
                        `${r.pname || ''}${r.first_name} ${r.last_name}`.replace(/\s+/g, ' ').trim()
                      )
                        }`}
                      className={`${styles.btn} ${styles.btnSm}`}
                    >
                      <AlertCircle size={14} /> แพ้ยา
                    </Link>
                    {/* ✅ ปุ่มไปหน้าวินิจฉัย */}
                    <Link
                      href={`/patient/${encodeURIComponent(r.patients_id)}/diagnosis`}
                      className={`${styles.btn} ${styles.btnSm}`}
                    >
                      <FileText size={14} /> วินิจฉัย
                    </Link>
                    {r.status !== 'เสียชีวิต' && (
                      <button className={`${styles.btn} ${styles.btnSm}`} onClick={() => handleOpenDeceased(r.patients_id)}>
                        <Skull size={14} /> เสียชีวิต
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td className={styles.td} colSpan={10}>ไม่พบข้อมูลตามเงื่อนไข</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className={styles.pagination}>
        <span className={styles.pageInfo}>ทั้งหมด {total} รายการ</span>
        <button className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>ก่อนหน้า</button>
        <span className={styles.pageInfo}>หน้า {page}/{totalPages}</span>
        <button className={styles.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>ถัดไป</button>
      </div>

      {/* Add Patient */}
      <Modal
        open={openAdd}
        title={<div className="flex items-center gap-2"><Plus size={20} className="text-blue-600" /> เพิ่มผู้ป่วยใหม่</div>}
        size="xl"
        bodyClassName="max-h-[70vh] overflow-y-auto"
        initialFocusSelector="input,select,textarea"
        onConfirm={handleCreate}
        onClose={() => setOpenAdd(false)}
        footer={
          <div className="w-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="order-2 sm:order-1 text-sm text-gray-500 flex items-center gap-1 justify-center sm:justify-start">
              <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Enter</kbd><span>บันทึก</span>
              <span className="mx-2">•</span>
              <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Esc</kbd><span>ปิด</span>
            </div>

            <div className="order-1 sm:order-2 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                className="w-full sm:w-auto px-4 sm:px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2"
                onClick={() => setOpenAdd(false)}
              >
                <X size={16} /> ยกเลิก
              </button>
              <button
                className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg flex items-center gap-2"
                onClick={handleCreate}
              >
                <CheckCircle size={16} /> บันทึกข้อมูล
              </button>
            </div>
          </div>
        }
      >
        {/* ✅ ส่ง ref เพื่อให้เรียก validate() ได้ */}
        <PatientForm ref={addFormRef} value={addDraft} onChange={setAddDraft} />
      </Modal>

      {/* Edit Patient */}
      <Modal
        open={!!openEdit}
        title={<div className="flex items-center gap-2"><Pencil size={20} className="text-orange-600" /> แก้ไขข้อมูลผู้ป่วย</div>}
        size="xl"
        bodyClassName="max-h-[70vh] overflow-y-auto"
        initialFocusSelector="input,select,textarea"
        onConfirm={handleUpdate}
        onClose={() => setOpenEdit(null)}
        footer={
          <div className="w-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="order-2 sm:order-1 text-sm text-gray-500 flex items-center gap-1 justify-center sm:justify-start">
              <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Enter</kbd><span>บันทึก</span>
              <span className="mx-2">•</span>
              <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Esc</kbd><span>ปิด</span>
            </div>

            <div className="order-1 sm:order-2 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                className="w-full sm:w-auto px-4 sm:px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2"
                onClick={() => setOpenEdit(null)}
              >
                <X size={16} /> ยกเลิก
              </button>
              <button
                className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg hover:from-orange-700 hover:to-orange-800 transition-all duration-200 shadow-lg flex items-center gap-2"
                onClick={handleUpdate}
              >
                <CheckCircle size={16} /> บันทึกการแก้ไข
              </button>
            </div>
          </div>
        }
      >
        {/* ✅ ส่ง ref เพื่อให้เรียก validate() ได้ */}
        <PatientForm ref={editFormRef} value={editDraft} onChange={setEditDraft} />
      </Modal>

      {/* Appointment */}
      <Modal
        open={!!openAppt}
        title={
          <div className="flex items-center gap-2">
            <CalendarPlus size={20} className="text-purple-600" /> เพิ่มการนัดหมาย
          </div>
        }
        size="lg"
        initialFocusSelector="input,select,textarea"
        onConfirm={saveAppt}
        onClose={() => { setOpenAppt(null); setApptForm(resetApptForm()); setApptErrors({}); }}
        footer={
          <div className="w-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="order-2 sm:order-1 text-sm text-gray-500 flex items-center gap-1 justify-center sm:justify-start">
              <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Enter</kbd><span>บันทึก</span>
              <span className="mx-2">•</span>
              <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Esc</kbd><span>ปิด</span>
            </div>

            <div className="order-1 sm:order-2 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                className="w-full sm:w-auto px-4 sm:px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2"
                onClick={() => { setOpenAppt(null); setApptForm(resetApptForm()); setApptErrors({}); }}
              >
                <X size={16} /> ยกเลิก
              </button>
              <button
                className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200 shadow-lg flex items-center gap-2"
                onClick={saveAppt}
              >
                <CalendarPlus size={16} /> บันทึกนัดหมาย
              </button>
            </div>
          </div>
        }
      >
        {/* แถบ HN ผู้ป่วย (optional) */}

        <AppointmentForm
          value={apptForm}
          onChange={setApptForm}
          errors={apptErrors}
          TYPE_OPTIONS={TYPE_OPTIONS}
          PLACE_OPTIONS={PLACE_OPTIONS}
        />
      </Modal>


      {/* Mark Deceased */}
      <Modal
        open={!!openDeceased}
        title={<div className="flex items-center gap-2"><Skull size={20} className="text-red-600" /> เปลี่ยนสถานะเป็น "เสียชีวิต"</div>}
        size="lg"
        initialFocusSelector="input,select,textarea"
        onConfirm={handleMarkDeceased}
        onClose={() => { setOpenDeceased(null); setDeceasedPatient(null); }}
        footer={
          <div className="w-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="order-2 sm:order-1 text-sm text-gray-500 flex items-center gap-1 justify-center sm:justify-start">
              <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Enter</kbd><span>ยืนยัน</span>
              <span className="mx-2">•</span>
              <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Esc</kbd><span>ปิด</span>
            </div>

            <div className="order-1 sm:order-2 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button
                className="w-full sm:w-auto px-4 sm:px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2"
                onClick={() => setOpenDeceased(null)}
              >
                <X size={16} /> ยกเลิก
              </button>
              <button
                className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg flex items-center gap-2"
                onClick={handleMarkDeceased}
              >
                <CheckCircle size={16} /> ยืนยันการเปลี่ยนสถานะ
              </button>
            </div>
          </div>
        }
      >
        {deceasedPatient ? (
          <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
            {/* Header Section */}
            <div className="flex items-center gap-2 text-red-800 mb-3">
              <User size={16} />
              <span className="font-medium">ผู้ป่วย:</span>
              <span className="font-mono bg-white px-2 py-1 rounded border text-sm">
                {deceasedPatient.patients_id}
              </span>
            </div>

            {/* Patient Information Grid */}
            <div className="grid grid-cols-3 md:grid-cols-2 gap-3">
              {/* ชื่อ-นามสกุล */}
              <div className="col-span-full">
                <div className="text-sm text-gray-600 mb-1">ชื่อ-นามสกุล</div>
                <div className="font-semibold text-gray-800">
                  {deceasedPatient.pname || ''}{deceasedPatient.first_name} {deceasedPatient.last_name}
                </div>
              </div>

              {/* เลขบัตรประชาชน */}
              <div className="col-span-full">
                <div className="text-sm text-gray-600 mb-1">เลขบัตรประชาชน</div>
                <div className="font-mono text-gray-800">
                  {deceasedPatient.card_id || '-'}
                </div>
              </div>

              {/* อายุ */}
              <div>
                <div className="text-sm text-gray-600 mb-1">อายุ</div>
                <div className="text-gray-800">
                  {calculateAge(deceasedPatient.birthdate)} ปี
                </div>
              </div>

              {/* เพศ */}
              <div>
                <div className="text-sm text-gray-600 mb-1">เพศ</div>
                <div className="text-gray-800">
                  {deceasedPatient.gender || '-'}
                </div>
              </div>

              {/* กรุ๊ปเลือด */}
              <div>
                <div className="text-sm text-gray-600 mb-1">กรุ๊ปเลือด</div>
                <div className="text-gray-800">
                  {deceasedPatient.blood_group || '-'} {deceasedPatient.bloodgroup_rh || ''}
                </div>
              </div>

              {/* เชื้อชาติ */}
              <div>
                <div className="text-sm text-gray-600 mb-1">เชื้อชาติ</div>
                <div className="text-gray-800">
                  {deceasedPatient.nationality || '-'}
                </div>
              </div>

              {/* ศาสนา */}
              <div>
                <div className="text-sm text-gray-600 mb-1">ศาสนา</div>
                <div className="text-gray-800">
                  {deceasedPatient.religion || '-'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200 text-gray-600">
            กำลังโหลดข้อมูลผู้ป่วย...
          </div>
        )}

        <DeceasedForm value={deadDraft} onChange={setDeadDraft} errors={deadErrors} />
      </Modal>

      {/* Verify */}
      <Modal
        open={openVerify}
        title={<div className="flex items-center gap-2"><Eye size={20} className="text-green-600" /> ผลการตรวจสอบผู้ป่วย</div>}
        size="xl"
        bodyClassName="max-h-[80vh] overflow-y-auto"
        onClose={() => { setOpenVerify(false); setVerifyData(null); }}
        onConfirm={() => { setOpenVerify(false); setVerifyData(null); }}
        footer={
          <div className="w-full flex justify-center">
            <button
              className="px-8 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg flex items-center gap-2"
              onClick={() => { setOpenVerify(false); setVerifyData(null); }}
            >
              <X size={16} /> ปิด
            </button>
          </div>
        }
      >
        {!verifyData ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle size={48} className="text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">ไม่มีข้อมูล</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Patient Overview Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-100 rounded-2xl shadow-lg p-6 border border-blue-200">
              <div className="flex items-center space-x-6 mb-4">
                <div className="w-40 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {verifyData.patients_id}
                </div>
                <div className="flex-1">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {verifyData.pname || ''}{verifyData.first_name} {verifyData.last_name}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <User size={14} /> อายุ {calculateAge(verifyData.birthdate)} ปี
                    </span>
                    <span className="flex items-center gap-1">
                      ประเภทผู้ป่วย: {verifyData.patients_type}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-2"><Pill alive={verifyData.status !== 'เสียชีวิต'} /></div>
                  <div className="text-xs text-gray-500">รับเข้า: {formatThaiDateBE(verifyData.admittion_date)}</div>
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-6 pb-3 border-b-2 border-green-100">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <User size={16} className="text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">ข้อมูลส่วนตัว</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <User size={14} className="text-gray-600" />
                    <span className="font-semibold text-gray-700">ชื่อ-นามสกุล</span>
                  </div>
                  <div className="text-gray-900 text-lg">{verifyData.pname} {verifyData.first_name} {verifyData.last_name}</div>
                </div>
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <IdCard size={14} className="text-gray-600" />
                    <span className="font-semibold text-gray-700">เลขบัตรประชาชน</span>
                  </div>
                  <div className="text-gray-900 text-lg">{verifyData.card_id || '-'}</div>
                </div>
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-700">อายุ</span>
                  </div>
                  <div className="text-gray-900 text-lg">{calculateAgeFromBirthdate(verifyData.birthdate || '-')}</div>
                </div>
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-700">เพศ</span>
                  </div>
                  <div className="text-gray-900 text-lg">{verifyData.gender || '-'}</div>
                </div>
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-700">เชื้อชาติ</span>
                  </div>
                  <div className="text-gray-900 text-lg">{verifyData.nationality || '-'}</div>
                </div>
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-700">ศาสนา</span>
                  </div>
                  <div className="text-gray-900 text-lg">{verifyData.religion || '-'}</div>
                </div>
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone size={14} className="text-gray-600" />
                    <span className="font-semibold text-gray-700">เบอร์โทรศัพท์</span>
                  </div>
                  <div className="text-gray-900 text-lg font-mono">{verifyData.phone || verifyData.phone_number || '-'}</div>
                </div>
                <div className="md:col-span-2 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin size={14} className="text-gray-600" />
                    <span className="font-semibold text-gray-700">ที่อยู่</span>
                  </div>
                  <div className="text-gray-900 leading-relaxed">{verifyData.address || '-'}</div>
                </div>
              </div>
            </div>

            {/* Medical Information */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-6 pb-3 border-b-2 border-red-100">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <Droplets size={16} className="text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">ข้อมูลทางการแพทย์</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-xl border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Droplets size={14} className="text-red-600" />
                    <span className="font-semibold text-gray-700">กรุ๊ปเลือด</span>
                  </div>
                  <div className="text-gray-900 text-lg font-bold">
                    {verifyData.blood_group || '-'} {verifyData.bloodgroup_rh || ''}
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart size={14} className="text-blue-600" />
                    <span className="font-semibold text-gray-700">ประเภทผู้ป่วย</span>
                  </div>
                  <div className="text-gray-900 text-lg">{verifyData.patients_type || '-'}</div>
                </div>
                <div className="md:col-span-2 p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={14} className="text-yellow-600" />
                    <span className="font-semibold text-gray-700">โรคประจำตัว / ประวัติการแพทย์</span>
                  </div>
                  <div className="text-gray-900 leading-relaxed">{verifyData.disease || 'ไม่มีข้อมูล'}</div>
                </div>
              </div>
            </div>

            {/* Admission */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-6 pb-3 border-b-2 border-purple-100">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Calendar size={16} className="text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">ข้อมูลการรับเข้า</h3>
              </div>
              <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={14} className="text-purple-600" />
                  <span className="font-semibold text-gray-700">วันที่รับเข้า</span>
                </div>
                <div className="text-gray-900 text-lg font-medium">{formatThaiDateBE(verifyData.admittion_date || '-')}</div>
              </div>
            </div>

            {/* Attachments */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-6 pb-3 border-b-2 border-blue-100">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <FileText size={16} className="text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">เอกสารแนบ</h3>
              </div>

              {(() => {
                // ฟิลด์ไฟล์ที่รองรับ จะมี flag has_* กลับมาจาก backend
                const fields = [
                  { key: 'patient_id_card', label: 'สำเนาบัตรประชาชนผู้ป่วย' },
                  { key: 'house_registration', label: 'สำเนาทะเบียนบ้านผู้ป่วย/ญาติ' },
                  { key: 'patient_photo', label: 'รูปถ่ายผู้ป่วย' },
                  { key: 'relative_id_card', label: 'สำเนาบัตรประชาชนญาติ/ผู้ขอความอนุเคราะห์' },
                ] as const;

                const hasAny =
                  fields.some(f => Boolean((verifyData as any)[`has_${f.key}`]));

                const fileUrl = (field: string) =>
                  joinUrl(API_BASE, `/api/patients/${encodeURIComponent(verifyData.patients_id)}/file/${field}`);

                if (!hasAny) {
                  return (
                    <div className="text-gray-500">ไม่มีเอกสารแนบ</div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {fields.map(f => {
                      const hasFile = (verifyData as any)[`has_${f.key}`];
                      if (!hasFile) return null;

                      // ปุ่ม action เหมือนกันทุกไฟล์
                      const Actions = (
                        <div className="mt-3 flex gap-2">
                          <a
                            href={fileUrl(f.key)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                            title="เปิดดู"
                          >
                            เปิดดู
                          </a>
                          <button
                            type="button"
                            onClick={() => downloadPatientAttachment(verifyData, f.key)}
                            className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
                          >
                            ดาวน์โหลด
                          </button>
                        </div>
                      );

                      return (
                        <div key={f.key} className="p-4 border border-gray-200 rounded-xl bg-gradient-to-br from-gray-50 to-white">
                          <div className="font-semibold text-gray-800 mb-2">{f.label}</div>

                          {/* พรีวิวรูปเฉพาะ patient_photo */}
                          {f.key === 'patient_photo' ? (
                            <img
                              src={fileUrl(f.key)}
                              alt={f.label}
                              className="w-full h-40 object-cover rounded-lg border"
                            />
                          ) : (
                            // ไฟล์อื่นให้ข้อความและเปิดดู/ดาวน์โหลด (รองรับทั้งภาพ/ PDF)
                            <div className="text-sm text-gray-500">
                              มีไฟล์แนบพร้อมใช้งาน
                            </div>
                          )}

                          {Actions}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Death info (if any) */}
            {verifyData.status === 'เสียชีวิต' && verifyData.death_date && (
              <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl shadow-lg p-6 border-2 border-gray-300">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-400">
                  <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
                    <Skull size={16} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">ข้อมูลการเสียชีวิต</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-white rounded-lg border border-gray-300">
                    <div className="font-semibold text-gray-700 mb-1">วันที่เสียชีวิต</div>
                    <div className="text-gray-900 text-lg">{formatThaiDateBE(verifyData.death_date)}</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-gray-300">
                    <div className="font-semibold text-gray-700 mb-1">เวลาที่เสียชีวิต</div>
                    <div className="text-gray-900 text-lg">{verifyData.death_time} น.</div>
                  </div>
                  {verifyData.death_cause && (
                    <div className="p-4 bg-white rounded-lg border border-gray-300">
                      <div className="font-semibold text-gray-700 mb-1">สาเหตุ</div>
                      <div className="text-gray-900 text-lg">{verifyData.death_cause}</div>
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
