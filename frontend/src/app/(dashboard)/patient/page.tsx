'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import styles from './patient.module.css';
import {
  Search, X, Plus, Pencil, Eye, CalendarPlus, Skull, RefreshCw,
  User, Calendar, FileText, CheckCircle, AlertCircle, Heart,
  Phone, MapPin, Droplets, IdCard,
  MapPinPlusInside,
  Trash2, // ⬅️ ปุ่มลบ
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
import { collectSelectedDocs } from '@/app/lib/patientFiles';
import { uploadPatientFiles } from '@/app/lib/uploadPatientFiles';
import BaselineForm, { Baseline } from '@/app/components/forms/BaselineForm';
import { hasBaselineData } from '@/app/lib/baseline'; // ถ้าคุณวาง util ตามตัวอย่าง

type Status = 'pending' | 'done' | 'cancelled';
// react-select (SSR safe)
const Select = dynamic(() => import('react-select'), { ssr: false });
const animatedComponents = makeAnimated();
const menuPortalTarget = typeof window !== 'undefined' ? document.body : undefined;
const rsx = {
  control: (base, state) => ({
    ...base,
    width: 200,
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
  customClass: { popup: 'swal-popup-on-top' }
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
  isSearchable: false,
  styles: {
    menuPortal: (base: any) => ({ ...base, zIndex: 12050 }),
    menu: (base: any) => ({ ...base, zIndex: 12050 }),
  },
  onKeyDown: (e: any) => { if (e.key === 'Enter') e.stopPropagation(); },
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
const treatatOptions = [
  { value: 'โรงพยาบาล', label: 'โรงพยาบาล' },
  { value: 'บ้าน', label: 'บ้าน' },
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
    ? {}
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

/** ---------- Helper: เติมจำนวนการแพ้ยาให้แต่ละแถว ---------- */
async function hydrateAllergyCounts(list: any[]) {
  const ids = list.map((r: any) => r.patients_id).filter(Boolean);
  if (!ids.length) return list;

  // พยายามเรียก endpoint รวมก่อน (ถ้ามี)
  try {
    const res = await http(`/api/allergies/count-by-patients?ids=${encodeURIComponent(ids.join(','))}`);
    const counts = (res as any)?.counts || {};
    return list.map((r: any) => ({ ...r, allergy_count: Number(counts[r.patients_id] || 0) }));
  } catch {
    // ถ้าไม่มี/พัง → สำรอง เรียกทีละ HN
    const pairs = await Promise.all(
      ids.map(async (id: string) => {
        try {
          const r = await http(`/api/patients/${encodeURIComponent(id)}/allergies?countOnly=1`);
          const c = (r as any)?.count ?? (Array.isArray((r as any)?.data) ? (r as any).data.length : 0);
          return [id, Number(c)] as const;
        } catch {
          return [id, 0] as const;
        }
      })
    );
    const map = Object.fromEntries(pairs);
    return list.map((r: any) => ({ ...r, allergy_count: Number(map[r.patients_id] || 0) }));
  }
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
    if (v instanceof File) return;
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

const EXTRA_DOC_LABELS: Record<string, string> = {
  assistance_letter: 'หนังสือขอความช่วยเหลือ',
  power_of_attorney: 'หนังสือมอบอำนาจ/รับรองบุคคลไร้ญาติ',
  homeless_certificate: 'หนังสือรับรองบุคคลไร้ที่พึ่ง',
  adl_assessment: 'แบบประเมิน ADL',
  clinical_summary: 'ประวัติการรักษา (Clinical Summary)',
  destitute_certificate: 'หนังสือรับรองผู้ยากไร้', // <- คีย์นี้ “ไม่มีใน ALLOWED_TYPES”
};

async function uploadAllPatientFiles(patients_id: string, formValue: any) {
  if (!patients_id) return;
  const url = joinUrl(API_BASE, `/api/patient-files/${encodeURIComponent(patients_id)}`);

  // ส่งเอกสาร “ใหม่” เป็น other + label
  for (const key of Object.keys(EXTRA_DOC_LABELS)) {
    const f: File | undefined = formValue?.[key];
    if (!f) continue;
    const fd = new FormData();
    fd.append('doc_type', 'other');                 // 👈 กัน ENUM
    fd.append('label', EXTRA_DOC_LABELS[key]);      // 👈 ให้รู้ว่าไฟล์ประเภทอะไร
    if (formValue?.appointment_id != null) fd.append('appointment_id', String(formValue.appointment_id));
    fd.append('file', f, f.name);

    const r = await fetch(url, { method: 'POST', body: fd });
    if (!r.ok) {
      let msg = 'อัปโหลดไฟล์ไม่สำเร็จ';
      try { const j = await r.json(); msg = j.message || msg; } catch { }
      throw new Error(`${msg} (${key})`);
    }
  }

  // เอกสารอื่นๆ ที่ผู้ใช้พิมพ์เอง
  const others = Array.isArray(formValue?.other_docs) ? formValue.other_docs : [];
  for (const row of others) {
    if (!row?.file) continue;
    const fd = new FormData();
    fd.append('doc_type', 'other');
    if (row.label) fd.append('label', row.label);
    if (formValue?.appointment_id != null) fd.append('appointment_id', String(formValue.appointment_id));
    fd.append('file', row.file, row.file.name);
    const r = await fetch(url, { method: 'POST', body: fd });
    if (!r.ok) throw new Error('อัปโหลดเอกสารอื่นๆ ไม่สำเร็จ');
  }
}

export default function PatientsPage() {
  // state: query + filters + pagination
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    treat_at: '', gender: '', status: '', blood_group: '', bloodgroup_rh: '', patients_type: '', admit_from: '', admit_to: ''
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
  const [baselineAdd, setBaselineAdd] = useState<Baseline>({ patients_id: '' });
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

  type PatientFile = {
    id: number;
    patients_id: string;
    doc_type: string;
    label?: string | null;
    filename?: string | null;
    mime_type?: string | null;
    uploaded_at?: string | null;
    appointment_id?: number | null;
  };

  const [patientFiles, setPatientFiles] = useState<PatientFile[]>([]);

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

  // fetch list (แนบ/เติมจำนวนแพ้ยา)
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true); setErrMsg('');
      try {
        // ขอให้ backend แนบ allergy_count มาด้วย ถ้าไม่รองรับ เดี๋ยวเติมเอง
        const data = await http(`/api/patients?${qs}&withAllergyCount=1`, { signal: controller.signal });
        if (!alive) return;

        let list = (data as any)?.data || [];
        const hasCountsAlready = list.some((r: any) => 'allergy_count' in r || 'has_allergy' in r || 'allergies_count' in r);

        if (!hasCountsAlready && list.length) {
          try { list = await hydrateAllergyCounts(list); } catch { }
        }

        setRows(list);
        setTotal((data as any)?.totalCount || 0);
      } catch (e) {
        if (!alive) return;
        if ((e as any).name !== 'AbortError') {
          setErrMsg((e as any).message || 'โหลดข้อมูลไม่สำเร็จ');
          $swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: (e as any).message || '' });
        }
      } finally {
        if (alive) setLoading(false);
      }
    }, 350);
    return () => { alive = false; clearTimeout(t); controller.abort(); };
  }, [qs]);

  const clearFilters = () => {
    setFilters({ treat_at: '', gender: '', status: '', blood_group: '', bloodgroup_rh: '', patients_type: '', admit_from: '', admit_to: '' });
    setPage(1); setTick(t => t + 1);
  };
  const activeFilterEntries = useMemo(() => Object.entries(filters).filter(([, v]) => !!v), [filters]);
  const filterLabels = { treat_at: 'รักษาที่', status: 'สถานะผู้ป่วย', gender: 'เพศ', blood_group: 'กรุ๊ปเลือด', bloodgroup_rh: 'Rh', patients_type: 'ประเภทผู้ป่วย', admit_from: 'รับเข้าตั้งแต่', admit_to: 'รับเข้าถึง' };

  // actions
  const refresh = () => setTick(t => t + 1);

  const handleOpenAdd = async () => {
    setErrMsg('');
    try {
      const { nextId } = await http('/api/patients/next-id');
      setAddDraft({ patients_id: nextId, status: 'มีชีวิต' });
      setBaselineAdd({ patients_id: nextId, reason_in_dept: '', reason_admit: '', bedbound_cause: '', other_history: '' });
      setOpenAdd(true);
    } catch (e) {
      $swal.fire({ icon: 'error', title: 'ดึง HN ถัดไปไม่สำเร็จ', text: (e as any).message || '' });
    }
  };

  const handleCreate = async () => {
    if ((addFormRef.current as any)?.validate && !(addFormRef.current as any).validate()) return;

    const { isConfirmed } = await $swal.fire({
      icon: 'question', title: 'ยืนยันบันทึกผู้ป่วยใหม่?', showCancelButton: true,
    });
    if (!isConfirmed) return;

    try {
      const formValues = (addFormRef.current as any).getValues();
      const formData = buildPatientFormData(formValues);

      const created = await http('/api/patients', { method: 'POST', body: formData });

      const patients_id = (created as any)?.patients_id ?? formValues?.patients_id;
      await uploadAllPatientFiles(patients_id, formValues);

      if (hasBaselineData(baselineAdd)) {
        const payload = { ...baselineAdd, patients_id };
        await http(`/api/patients/${encodeURIComponent(patients_id)}/encounters/baseline`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

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
      setEditDraft({ ...(d as any), phone: (d as any).phone ?? (d as any).phone_number ?? '' });
    } catch (e) {
      $swal.fire({ icon: 'error', title: 'ดึงข้อมูลผู้ป่วยไม่สำเร็จ', text: (e as any).message || '' });
      setOpenEdit(null);
    }
  };

  const handleUpdate = async () => {
    if ((editFormRef.current as any)?.validate && !(editFormRef.current as any).validate()) return;

    const { isConfirmed } = await $swal.fire({
      icon: 'question', title: 'ยืนยันบันทึกการแก้ไข?', showCancelButton: true,
    });
    if (!isConfirmed) return;

    try {
      const formValues = (editFormRef.current as any).getValues();
      const formData = buildPatientFormData(formValues);

      await http(`/api/patients/${encodeURIComponent(openEdit!)}`, {
        method: 'PUT',
        body: formData,
      });

      await uploadAllPatientFiles(openEdit!, formValues);

      setOpenEdit(null);
      refresh();
      toast.fire({ icon: 'success', title: 'อัปเดตข้อมูลเรียบร้อย' });
    } catch (e: any) {
      $swal.fire({ icon: 'error', title: 'อัปเดตข้อมูลไม่สำเร็จ', text: e.message || '' });
    }
  };

  const TYPE_OPTIONS = ['โรงพยาบาล', 'บ้านผู้ป่วย'];
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
      const p: any = await http(`/api/patients/${encodeURIComponent(patients_id)}`);
      const full = `${p.pname ?? ''}${p.first_name ?? ''} ${p.last_name ?? ''}`.replace(/\s+/g, ' ').trim();
      setApptForm({
        ...resetApptForm(),
        hn: p.patients_id || patients_id,
        patient: full || patients_id,
        phone: p.phone_number || '',
      });
    } catch {
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
    if ((f as any).phone && !/^[0-9+\-() ]{6,}$/.test((f as any).phone as any)) e.phone = 'รูปแบบเบอร์ไม่ถูกต้อง';

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
      setDeceasedPatient(d as any);
    } catch (e) {
      $swal.fire({ icon: 'error', title: 'ดึงข้อมูลผู้ป่วยไม่สำเร็จ', text: (e as any).message || '' });
      setDeceasedPatient(null);
    }
  };

  const handleMarkDeceased = async () => {
    const e: any = {};
    if (!(deadDraft as any).death_date) e.death_date = 'กรุณาระบุวันที่เสียชีวิต';
    if (!(deadDraft as any).death_cause) e.death_cause = 'กรุณาระบุสาเหตุการเสียชีวิต';
    setDeadErrors(e);
    if (Object.keys(e).length) {
      await $swal.fire({
        icon: 'warning', title: 'กรอกข้อมูลไม่ครบ',
        html: Object.values(e).map((s: any) => `• ${s}`).join('<br/>')
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
      await http(`/api/patients/${encodeURIComponent(openDeceased!)}/deceased`, {
        method: 'PATCH',
        body: JSON.stringify({
          death_date: (deadDraft as any).death_date,
          death_time: (deadDraft as any).death_time || '00:00',
          death_cause: (deadDraft as any).death_cause,
          management: (deadDraft as any).management || null
        })
      });
      Swal.close();
      setOpenDeceased(null); setDeadDraft({});
      refresh();
      $swal.fire({ icon: 'success', title: 'เปลี่ยนสถานะเป็นเสียชีวิตแล้ว' });
    } catch (err: any) {
      Swal.close();
      $swal.fire({ icon: 'error', title: 'บันทึกการเสียชีวิตไม่สำเร็จ', text: err?.message || '' });
    }
  };

  const handleVerify = async (patients_id: string) => {
    try {
      const [d, fl] = await Promise.all([
        http(`/api/patients/${encodeURIComponent(patients_id)}`),
        http(`/api/patient-files/${encodeURIComponent(patients_id)}`),
      ]);
      setVerifyData(d as any);
      setPatientFiles((fl as any)?.data || []);
      setOpenVerify(true);
    } catch (e) {
      $swal.fire({ icon: 'error', title: 'ดึงข้อมูลไม่สำเร็จ', text: (e as any).message || '' });
    }
  };

  // ✅ ฟังก์ชันลบผู้ป่วย (purge อัตโนมัติฝั่งแบ็กเอนด์)
  const handleDelete = async (patients_id: string) => {
    const { isConfirmed } = await $swal.fire({
      icon: 'warning',
      title: 'ยืนยันลบผู้ป่วยถาวร?',
      html: 'การลบนี้จะลบ <b>ประวัติที่ผูกอยู่ทั้งหมด</b> (encounters/appointments/diagnosis/ฯลฯ) และ <b>ย้อนกลับไม่ได้</b>',
      showCancelButton: true,
      confirmButtonText: 'ลบถาวร',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
    });
    if (!isConfirmed) return;

    try {
      await http(`/api/patients/${encodeURIComponent(patients_id)}`, { method: 'DELETE' });
      toast.fire({ icon: 'success', title: 'ลบเรียบร้อย' });
      refresh();
    } catch (e: any) {
      $swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: e?.message || '' });
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

    return [...rows].sort((a: any, b: any) => {
      const r = statusRank(a.status) - statusRank(b.status);
      if (r !== 0) return r;
      const dt = time(b.admittion_date) - time(a.admittion_date);
      if (dt !== 0) return dt;
      return String(b.patients_id).localeCompare(String(a.patients_id));
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
          <div className={styles.label}>รักษาที่</div>
          <Select
          {...RS_PROPS}
            components={animatedComponents}
            styles={rsx}
            menuPortalTarget={menuPortalTarget}
            isClearable
            placeholder="ทั้งหมด"
            options={treatatOptions}
            value={treatatOptions.find(o => o.value === (filters as any).treat_at) ?? null}
            onChange={(opt) => { setFilters((f: any) => ({ ...f, treat_at: (opt as any)?.value || '' })); setPage(1); }}
          />
        </div>
        <div>
          <div className={styles.label}>สถานะผู้ป่วย</div>
          <Select
          {...RS_PROPS}
            components={animatedComponents}
            styles={rsx}
            menuPortalTarget={menuPortalTarget}
            isClearable
            placeholder="ทั้งหมด"
            options={statusOptions}
            value={statusOptions.find(o => o.value === (filters as any).status) ?? null}
            onChange={(opt) => { setFilters((f: any) => ({ ...f, status: (opt as any)?.value || '' })); setPage(1); }}
          />
        </div>
        <div>
          <div className={styles.label}>เพศ</div>
          <Select
          {...RS_PROPS}
            components={animatedComponents}
            styles={rsx}
            menuPortalTarget={menuPortalTarget}
            isClearable
            placeholder="ทั้งหมด"
            options={genderOptions}
            value={genderOptions.find(o => o.value === (filters as any).gender) ?? null}
            onChange={(opt) => { setFilters((f: any) => ({ ...f, gender: (opt as any)?.value || '' })); setPage(1); }}
          />
        </div>
        <div>
          <div className={styles.label}>กรุ๊ปเลือด</div>
          <Select
          {...RS_PROPS}
            components={animatedComponents}
            styles={rsx}
            menuPortalTarget={menuPortalTarget}
            isClearable
            placeholder="ทั้งหมด"
            options={bloodGroupOptions}
            value={bloodGroupOptions.find(o => o.value === (filters as any).blood_group) ?? null}
            onChange={(opt) => { setFilters((f: any) => ({ ...f, blood_group: (opt as any)?.value || '' })); setPage(1); }}
          />
        </div>
        <div>
          <div className={styles.label}>Rh</div>
          <Select
          {...RS_PROPS}
            components={animatedComponents}
            styles={rsx}
            menuPortalTarget={menuPortalTarget}
            isClearable
            placeholder="ทั้งหมด"
            options={rhOptions}
            value={rhOptions.find(o => o.value === (filters as any).bloodgroup_rh) ?? null}
            onChange={(opt) => { setFilters((f: any) => ({ ...f, bloodgroup_rh: (opt as any)?.value || '' })); setPage(1); }}
          />
        </div>
        <div>
          <div className={styles.label}>ประเภทผู้ป่วย</div>
          <Select
          {...RS_PROPS}
            components={animatedComponents}
            styles={rsx}
            menuPortalTarget={menuPortalTarget}
            isClearable
            placeholder="ทั้งหมด"
            options={patientTypeOptions}
            value={patientTypeOptions.find(o => o.value === (filters as any).patients_type) ?? null}
            onChange={(opt) => { setFilters((f: any) => ({ ...f, patients_type: (opt as any)?.value || '' })); setPage(1); }}
          />
        </div>

        {/* ปุ่มล้างตัวกรอง */}
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
              <span>{(filterLabels as any)[k] || k}: {v}</span>
              <button onClick={() => { setFilters((f: any) => ({ ...f, [k]: '' })); setPage(1); setTick(t => t + 1); }}>×</button>
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
              <th className={styles.th}>รักษาที่</th>
              <th className={styles.th}>สถานะ</th>
              <th className={`${styles.th} ${styles.thAction}`}>ตรวจสอบ</th>
              <th className={`${styles.th} ${styles.thAction}`}>แก้ไข</th>
              <th className={`${styles.th} ${styles.thAction}`}>เพิ่มนัด</th>
              <th className={`${styles.th} ${styles.thAction}`}>ประวัติ</th>
              <th className={`${styles.th} ${styles.thAction}`}>แพ้ยา</th>
              <th className={`${styles.th} ${styles.thAction}`}>โรคประจำตัว</th>
              <th className={`${styles.th} ${styles.thAction}`}>เสียชีวิต</th>
              <th className={`${styles.th} ${styles.thAction} ${styles.thDanger}`}>ลบ</th>
            </tr>
          </thead>
          <tbody>
            {(orderedRows || []).map((r: any) => {
              const allergyCount = Number((r as any).allergy_count ?? (r as any).allergies_count ?? 0);
              const hasAllergy = (r as any).has_allergy === true || allergyCount > 0;

              // สไตล์ปุ่มแพ้ยา (inline เพื่อลดการแก้ไฟล์ CSS)
              const allergyBtnStyle: React.CSSProperties = hasAllergy
                ? { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }
                : { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' };

              return (
                <tr key={r.patients_id}>
                  <td className={styles.td}><span className={styles.mono}>{r.patients_id}</span></td>
                  <td className={styles.td}>
                    {r.pname || ''}{r.first_name} {r.last_name}
                    {hasAllergy && (
                      <span
                        title={`แพ้ยา ${allergyCount} รายการ`}
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          marginLeft: 6,
                          verticalAlign: 'middle',
                          borderRadius: 9999,
                          background: '#ef4444'
                        }}
                      />
                    )}
                  </td>
                  <td className={styles.td}>{r.gender || '-'}</td>
                  <td className={styles.td}>{calculateAgeFromBirthdate(r.birthdate || '-')}</td>
                  <td className={styles.td}>{r.blood_group || '-'} {r.bloodgroup_rh || ''}</td>
                  <td className={styles.td}>{r.patients_type || '-'}</td>
                  <td className={styles.td}>{r.treat_at || '-'}</td>
                  <td className={styles.td}><Pill alive={r.status !== 'เสียชีวิต'} /></td>
                  <td className={styles.tdIcon}>
                    <button
                      className={`${styles.iconBtn}`}
                      title="ตรวจสอบ" aria-label="ตรวจสอบ"
                      onClick={() => handleVerify(r.patients_id)}
                    >
                      <Eye size={16} />
                    </button>
                  </td>

                  <td className={styles.tdIcon}>
                    <button
                      className={styles.iconBtn}
                      title="แก้ไข" aria-label="แก้ไข"
                      onClick={() => handleOpenEdit(r.patients_id)}
                    >
                      <Pencil size={16} />
                    </button>
                  </td>

                  <td className={styles.tdIcon}>
                    <button
                      className={styles.iconBtn}
                      title="เพิ่มนัด" aria-label="เพิ่มนัด"
                      onClick={() => handleOpenAppt(r.patients_id)}
                      disabled={r.status === 'เสียชีวิต'}
                    >
                      <CalendarPlus size={16} />
                    </button>
                  </td>

                  <td className={styles.tdIcon}>
                    <Link
                      href={`/patient/${encodeURIComponent(r.patients_id)}/encounters`}
                      className={styles.iconBtn}
                      title="ประวัติ" aria-label="ประวัติ"
                    >
                      <FileText size={16} />
                    </Link>
                  </td>

                  <td className={styles.tdIcon}>
                    <Link
                      href={`/patient/${encodeURIComponent(r.patients_id)}/allergies?name=${encodeURIComponent(
                        `${r.pname || ''}${r.first_name} ${r.last_name}`.replace(/\s+/g, ' ').trim()
                      )}`}
                      className={`${styles.iconBtn} ${styles.iconBadgeWrap}`}
                      style={allergyBtnStyle}
                      title={hasAllergy ? `แพ้ยา ${allergyCount} รายการ` : 'ไม่มีข้อมูลแพ้ยา'}
                      aria-label="แพ้ยา"
                    >
                      <AlertCircle size={16} />
                      {hasAllergy && <span className={styles.iconBadge}>{allergyCount}</span>}
                    </Link>
                  </td>

                  <td className={styles.tdIcon}>
                    <Link
                      href={`/patient/${encodeURIComponent(r.patients_id)}/diagnosis`}
                      className={styles.iconBtn}
                      title="โรคประจำตัว" aria-label="โรคประจำตัว"
                    >
                      <FileText size={16} />
                    </Link>
                  </td>

                  <td className={styles.tdIcon}>
                    <button
                      className={styles.iconBtn}
                      title="เสียชีวิต" aria-label="เสียชีวิต"
                      onClick={() => handleOpenDeceased(r.patients_id)}
                      disabled={r.status === 'เสียชีวิต'}
                    >
                      <Skull size={16} />
                    </button>
                  </td>

                  <td className={styles.tdIcon}>
                    <button
                      className={`${styles.iconBtn} ${styles.iconDanger}`}
                      title="ลบ" aria-label="ลบ"
                      onClick={() => handleDelete(r.patients_id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
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
            <div className="flex items-center gap-2 text-red-800 mb-3">
              <User size={16} />
              <span className="font-medium">ผู้ป่วย:</span>
              <span className="font-mono bg-white px-2 py-1 rounded border text-sm">
                {(deceasedPatient as any).patients_id}
              </span>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-2 gap-3">
              <div className="col-span-full">
                <div className="text-sm text-gray-600 mb-1">ชื่อ-นามสกุล</div>
                <div className="font-semibold text-gray-800">
                  {(deceasedPatient as any).pname || ''}{(deceasedPatient as any).first_name} {(deceasedPatient as any).last_name}
                </div>
              </div>

              <div className="col-span-full">
                <div className="text-sm text-gray-600 mb-1">เลขบัตรประชาชน</div>
                <div className="font-mono text-gray-800">
                  {(deceasedPatient as any).card_id || '-'}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">อายุ</div>
                <div className="text-gray-800">
                  {calculateAge((deceasedPatient as any).birthdate)} ปี
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">เพศ</div>
                <div className="text-gray-800">
                  {(deceasedPatient as any).gender || '-'}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">กรุ๊ปเลือด</div>
                <div className="text-gray-800">
                  {(deceasedPatient as any).blood_group || '-'} {(deceasedPatient as any).bloodgroup_rh || ''}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">เชื้อชาติ</div>
                <div className="text-gray-800">
                  {(deceasedPatient as any).nationality || '-'}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">ศาสนา</div>
                <div className="text-gray-800">
                  {(deceasedPatient as any).religion || '-'}
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
        title={
          <div className="flex items-center gap-2">
            <Eye size={20} className="text-sky-700" />
            ผลการตรวจสอบผู้ป่วย
          </div>
        }
        size="xl"
        bodyClassName="max-h-[80vh] overflow-y-auto"
        onClose={() => { setOpenVerify(false); setVerifyData(null); }}
        onConfirm={() => { setOpenVerify(false); setVerifyData(null); }}
        footer={
          <div className="w-full flex justify-center">
            <button
              className="px-8 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors duration-200 shadow-sm flex items-center gap-2"
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
              <AlertCircle size={48} className="text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">ไม่มีข้อมูล</p>
            </div>
          </div>
        ) : (
          /* ===== NEW LAYOUT ===== */
          <div className="space-y-6">
            {/* Top header strip (compact & readable) */}
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-6">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200 font-mono text-sm">
                      HN {(verifyData as any).patients_id}
                    </span>
                    <div className="text-xl lg:text-2xl font-bold text-slate-900">
                      {(verifyData as any).pname || ''}{(verifyData as any).first_name} {(verifyData as any).last_name}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <User size={14} /> อายุ {calculateAge((verifyData as any).birthdate)} ปี
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={14} /> รับเข้า {formatThaiDateBE((verifyData as any).admittion_date)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPinPlusInside size={14} /> {(verifyData as any).treat_at || '-'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Pill alive={(verifyData as any).status !== 'เสียชีวิต'} />
                </div>
              </div>
            </div>

            {/* Main 2-column content: Left summary (sticky) + Right detail */}
            <div className="grid lg:grid-cols-12 gap-6">
              {/* LEFT: Patient Summary (sticky inside modal scroll) */}
              <aside className="lg:col-span-4">
                <div className="sticky top-2 space-y-4">
                  {/* ID & Quick Facts */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-slate-500">เพศ</div>
                        <div className="font-medium text-slate-900">{(verifyData as any).gender || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">อายุ (ปี)</div>
                        <div className="font-medium text-slate-900">{calculateAge((verifyData as any).birthdate)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">กรุ๊ปเลือด</div>
                        <div className="font-medium text-slate-900">
                          {(verifyData as any).blood_group || '-'} {(verifyData as any).bloodgroup_rh || ''}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">ประเภทผู้ป่วย</div>
                        <div className="font-medium text-slate-900">{(verifyData as any).patients_type || '-'}</div>
                      </div>
                    </div>

                    <div className="mt-4 h-px bg-slate-100" />

                    <div className="mt-4">
                      <div className="text-xs text-slate-500">เบอร์โทรศัพท์</div>
                      <div className="font-mono text-slate-900">{(verifyData as any).phone || (verifyData as any).phone_number || '-'}</div>
                    </div>
                  </div>

                  {/* Contact & Address */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin size={16} className="text-sky-700" />
                      <div className="font-semibold text-slate-800">ที่อยู่</div>
                    </div>
                    <div className="text-slate-700 leading-relaxed text-sm">
                      {(verifyData as any).address || '-'}
                    </div>
                  </div>

                  {/* Quick Actions (documents / history) */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="text-sm text-slate-500 mb-2">การทำงานเร็ว</div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-sm hover:bg-sky-700"
                        href={`/patient/${encodeURIComponent((verifyData as any).patients_id)}/encounters`}
                      >
                        ประวัติการรักษา
                      </a>
                      <a
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                        href={`/patient/${encodeURIComponent((verifyData as any).patients_id)}/diagnosis`}
                      >
                        โรคประจำตัว
                      </a>
                      <a
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                        href={`/patient/${encodeURIComponent((verifyData as any).patients_id)}/allergies?name=${encodeURIComponent(
                          `${(verifyData as any).pname || ''}${(verifyData as any).first_name} ${(verifyData as any).last_name}`.replace(/\s+/g, ' ').trim()
                        )}`}
                      >
                        แพ้ยา
                      </a>
                    </div>
                  </div>
                </div>
              </aside>

              {/* RIGHT: Sections */}
              <section className="lg:col-span-8 space-y-6">
                {/* 1) Personal */}
                <div className="rounded-2xl border border-slate-200 bg-white">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                    <User size={16} className="text-sky-700" />
                    <h3 className="text-base font-semibold text-slate-800">ข้อมูลส่วนตัว</h3>
                  </div>
                  <div className="p-6">
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                      <div>
                        <dt className="text-xs text-slate-500">ชื่อ-นามสกุล</dt>
                        <dd className="text-slate-900">
                          {(verifyData as any).pname} {(verifyData as any).first_name} {(verifyData as any).last_name}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">เลขบัตรประชาชน</dt>
                        <dd className="text-slate-900">{(verifyData as any).card_id || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">เชื้อชาติ</dt>
                        <dd className="text-slate-900">{(verifyData as any).nationality || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">ศาสนา</dt>
                        <dd className="text-slate-900">{(verifyData as any).religion || '-'}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* 2) Medical */}
                <div className="rounded-2xl border border-slate-200 bg-white">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Droplets size={16} className="text-sky-700" />
                    <h3 className="text-base font-semibold text-slate-800">ข้อมูลทางการแพทย์</h3>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                      <div className="text-xs text-slate-600 mb-1">กรุ๊ปเลือด</div>
                      <div className="text-lg font-semibold text-slate-900">
                        {(verifyData as any).blood_group || '-'} {(verifyData as any).bloodgroup_rh || ''}
                      </div>
                    </div>
                    <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
                      <div className="text-xs text-slate-600 mb-1">ประเภทผู้ป่วย</div>
                      <div className="text-lg text-slate-900">{(verifyData as any).patients_type || '-'}</div>
                    </div>
                    <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                      <div className="text-xs text-slate-600 mb-1">รักษาที่</div>
                      <div className="text-lg text-slate-900">{(verifyData as any).treat_at || '-'}</div>
                    </div>
                    <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="text-xs text-slate-600 mb-1">โรคประจำตัว / ประวัติการแพทย์</div>
                      <div className="text-slate-900">{(verifyData as any).disease || 'ไม่มีข้อมูล'}</div>
                    </div>
                  </div>
                </div>

                {/* 3) Admission */}
                <div className="rounded-2xl border border-slate-200 bg-white">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Calendar size={16} className="text-indigo-700" />
                    <h3 className="text-base font-semibold text-slate-800">ข้อมูลการรับเข้า</h3>
                  </div>
                  <div className="p-6">
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                      <div className="text-xs text-slate-600 mb-1">วันที่รับเข้า</div>
                      <div className="text-lg text-slate-900">
                        {formatThaiDateBE((verifyData as any).admittion_date || '-')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4) Attachments */}
                <div className="rounded-2xl border border-slate-200 bg-white">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                    <FileText size={16} className="text-sky-700" />
                    <h3 className="text-base font-semibold text-slate-800">เอกสารแนบ</h3>
                  </div>

                  <div className="p-6">
                    {patientFiles.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {patientFiles.map((f) => {
                          const isImage = (f.mime_type || '').startsWith('image/');
                          const viewUrl = joinUrl(API_BASE, `/api/patient-files/download/${encodeURIComponent(String(f.id))}`);
                          const dlUrl = `${viewUrl}?dl=1`;

                          return (
                            <div key={f.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                              <div className="font-semibold text-slate-800 mb-1">
                                {f.label || f.doc_type || 'ไฟล์แนบ'}
                              </div>
                              <div className="text-xs text-slate-500 mb-3 break-all">
                                {f.filename || '(ไม่ระบุชื่อไฟล์)'}
                              </div>

                              {isImage ? (
                                <img
                                  src={viewUrl}
                                  alt={f.label || f.filename || 'attachment'}
                                  className="w-full h-44 object-cover rounded-lg border"
                                />
                              ) : (
                                <div className="flex items-center gap-2 text-slate-600">
                                  <FileText size={16} className="shrink-0" />
                                  <span className="text-sm">ไฟล์แนบพร้อมใช้งาน</span>
                                </div>
                              )}

                              <div className="mt-3 flex gap-2">
                                <a
                                  href={viewUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-sm hover:bg-sky-700"
                                >
                                  เปิดดู
                                </a>
                                <a
                                  href={dlUrl}
                                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                                >
                                  ดาวน์โหลด
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-slate-500">ไม่มีเอกสารแนบ</div>
                    )}
                  </div>

                </div>

                {/* 5) Death info (if any) */}
                {(verifyData as any).status === 'เสียชีวิต' && (verifyData as any).death_date && (
                  <div className="rounded-2xl border border-slate-300 bg-slate-50">
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                      <Skull size={16} className="text-slate-600" />
                      <h3 className="text-base font-semibold text-slate-800">ข้อมูลการเสียชีวิต</h3>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-white rounded-lg border border-slate-200">
                        <div className="text-xs text-slate-600 mb-1">วันที่เสียชีวิต</div>
                        <div className="text-slate-900 text-lg">{formatThaiDateBE((verifyData as any).death_date)}</div>
                      </div>
                      <div className="p-4 bg-white rounded-lg border border-slate-200">
                        <div className="text-xs text-slate-600 mb-1">เวลาที่เสียชีวิต</div>
                        <div className="text-slate-900 text-lg">{(verifyData as any).death_time} น.</div>
                      </div>
                      {(verifyData as any).death_cause && (
                        <div className="p-4 bg-white rounded-lg border border-slate-200 md:col-span-2">
                          <div className="text-xs text-slate-600 mb-1">สาเหตุ</div>
                          <div className="text-slate-900">{(verifyData as any).death_cause}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
