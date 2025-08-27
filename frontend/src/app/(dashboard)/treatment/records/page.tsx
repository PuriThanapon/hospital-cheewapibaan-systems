
'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Zap, Stethoscope, Filter, Search, CalendarDays, X,
  LayoutList, LayoutGrid, Clock, User, ClipboardList,
  BadgeInfo, RefreshCw, CheckCircle, Trash2, Eye, AlertCircle, 
  Calendar, Droplets, Shield, Heart, Edit3, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import styles from '../treatment.module.css';
import Modal from '@/app/components/ui/Modal';
import DatePickerField from '@/app/components/DatePicker';
import TreatmentForm, { TreatmentDraft, TreatmentFormHandle } from '@/app/components/forms/TreatmentForm';
type TreatmentFormHandleExt = TreatmentFormHandle & { setPatientInfo?: (p: any) => void };
import PatientLookupModal from '@/app/components/modals/PatientLookupModal';
import TreatmentStatusPill from '@/app/components/ui/TreatmentPill';
import Swal from 'sweetalert2';

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

/** ---------------------- Helpers ---------------------- */
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
    try { const j = await res.json(); msg = (j as any).message || (j as any).error || msg; } catch {}
    const err: any = new Error(msg);
    (err as any).status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

function cx(...arr: Array<string | false | undefined>) { return arr.filter(Boolean).join(' '); }
function toISODateLocal(val?: string | Date) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function formatThaiDate(iso?: string) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' });
  } catch { return iso as string; }
}
function formatThaiDateTime(iso?: string) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
  } catch { return iso as string; }
}
function thaiDateGroupLabel(iso: string) {
  const now = new Date();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const isSame = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const d = new Date(iso);
  if (isSame(d, now)) return 'วันนี้';
  if (isSame(d, y)) return 'เมื่อวานนี้';
  if (d >= weekStart) return 'สัปดาห์นี้';
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
}

function formatRelativeThai(iso?: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  if (isNaN(diffMs)) return '-';

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'เมื่อสักครู่';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ชั่วโมงที่แล้ว`;
  const day = Math.floor(hr / 24);
  return `${day} วันที่แล้ว`;
}

// เพิ่งแก้ไขในช่วง 10 นาทีที่ผ่านมา
function isRecentlyUpdated(iso?: string, minutes = 10) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && (Date.now() - t) <= minutes * 60 * 1000;
}

function importanceScore(r: any) {
  let score = 0;
  if (r.treatment_type === 'ทำครั้งเดียว' && !r.completed_at) score += 100; // เด่นสุด
  if (isRecentlyUpdated(r.updated_at)) score += 20;                            // บูสต์ถ้าเพิ่งแก้
  const d = new Date(r.treatment_date).getTime();
  if (!Number.isNaN(d)) score += Math.max(0, 5 - Math.floor((Date.now() - d) / 86400000)); // ยิ่งใหม่ยิ่งได้แต้ม
  return score;
}

const byDateDesc = (a: any, b: any) =>
  new Date(b.treatment_date).getTime() - new Date(a.treatment_date).getTime();

/** ---------------------- Tiny UI ---------------------- */
const TypeBadge = ({ type }: { type: string }) => (
  <span className={cx(styles.badgeType, type === 'ทำครั้งเดียว' ? styles.isEmergency : styles.isRegular)}>
    {type === 'ทำครั้งเดียว' ? <Zap width={14} height={14} /> : <Stethoscope width={14} height={14} />} {type}
  </span>
);

const SummaryCard = ({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) => (
  <div className={styles.summaryCard}>
    <div className={styles.summaryIcon}>{icon}</div>
    <div className={styles.grid2}>
      <div className={styles.summaryTitle}>{title}</div>
      <div className={styles.summaryValue}>{value}</div>
    </div>
  </div>
);

function Chip({ text, onClear }: { text: string; onClear: () => void }) {
  return (
    <span className={styles.chip}>
      <Filter width={12} height={12} />
      {text}
      <button onClick={onClear} className={styles.chipClose}><X width={12} height={12} /></button>
    </span>
  );
}

function Th({ children, className }: any) { return <th className={cx(styles.th, className)}>{children}</th>; }
function Td({ children, className }: any) { return <td className={cx(styles.td, className)}>{children}</td>; }
function ActionBtn({ children, variant = 'ghost', size = 'md', ...rest }: any) {
  const cls = cx(styles.btn, variant === 'primary' && styles.btnPrimary, size === 'sm' && styles.btnSm);
  return <button className={cls} {...rest}>{children}</button>;
}

/** ---------------------- Patient Banner (Edit only) ---------------------- */
function PatientBanner({
  loading, err, info, hn
}: { loading: boolean; err: string; info: any | null; hn: string; }) {
  if (!hn) return null;
  return (
    <div className="mb-4 p-4 rounded-2xl border bg-gradient-to-br from-blue-50 via-white to-indigo-50 border-blue-200 space-y-3">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg shadow">
          <User className="w-5 h-5 text-white" />
        </div>
        <div className="font-mono px-3 py-1 bg-white rounded-lg border-2 border-blue-200 text-blue-700">
          {hn}
        </div>
        {loading && <div className="text-sm text-gray-600">กำลังดึงข้อมูลผู้ป่วย...</div>}
        {!loading && err && <div className="text-sm text-red-600">ไม่พบข้อมูลผู้ป่วย: {err}</div>}
      </div>

      {!loading && info && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-full">
            <Calendar className="w-4 h-4 text-emerald-700" />
            อายุ: <span className="font-semibold">{calculateAgeFromBirthdate(info.birthdate) || '-'}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-full">
            <User className="w-4 h-4 text-orange-700" />
            เพศ: <span className="font-semibold">{info.gender || '-'}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-full">
            <Droplets className="w-4 h-4 text-red-700" />
            กรุ๊ปเลือด: <span className="font-semibold">{(info.blood_group || '-') + (info.bloodgroup_rh || '')}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-full">
            <Shield className="w-4 h-4 text-blue-700" />
            ประเภทผู้ป่วย: <span className="font-semibold">{info.patient_type || info.patients_type || '-'}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-pink-50 border border-pink-200 rounded-full">
            <Heart className="w-4 h-4 text-pink-700" />
            โรคประจำตัว: <span className="font-semibold">{info.disease || '-'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** ---------------------- Sub-Views ---------------------- */
function TableView({
  rows, onComplete, onDelete, onDetail, onHistory, onEdit
}: {
  rows: any[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onDetail: (row: any) => void;
  onHistory: (row: any) => void;
  onEdit: (row: any) => void;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            <Th>ประเภท</Th>
            <Th>รหัสผู้ป่วย-รหัสการรักษา</Th>
            <Th>ชื่อ-นามสกุล</Th>
            <Th>สรุปการรักษา</Th>
            <Th>วันที่บันทึก</Th>
            <Th>แก้ไขล่าสุด</Th>
            <Th>สถานะ</Th>
            <Th>การทำงาน</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.treatment_id}>
              <Td><TypeBadge type={r.treatment_type} /></Td>
              <Td>
                <div className={styles.bold}>{r.patients_id}</div>
                <div className={styles.small}>รหัส: {r.treatment_id}</div>
              </Td>
              <Td><div className={styles.bold}>{r.pname} {r.first_name} {r.last_name}</div></Td>
              <Td>
                <div className={styles.textDim}><BadgeInfo width={16} height={16} /> {r.diagnosis_summary || '-'}</div>
                {r.note && <div className={styles.small} style={{ opacity: .8 }}>หมายเหตุ: {r.note}</div>}
              </Td>
              <Td>{formatThaiDate(r.treatment_date)}</Td>
              <Td>
                <div className={styles.small}>{formatRelativeThai(r.updated_at)}</div>
                {r.treatment_type === 'ประจำ' && isRecentlyUpdated(r.updated_at) && (
                  <span
                    className={styles.pill}
                    style={{ marginTop: 4, background: '#DCFCE7', color: '#166534', borderColor: '#86EFAC' }}
                  >
                    เพิ่งแก้ไข
                  </span>
                )}
              </Td>
              <Td><TreatmentStatusPill completed={!!r.completed_at} /></Td>
              <Td className={styles.left}>
                <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
                  <ActionBtn size="sm" onClick={() => onDetail(r)}>
                    <Eye width={14} height={14} /> รายละเอียด
                  </ActionBtn>
                  <ActionBtn size="sm" onClick={() => onEdit(r)}>
                    <Edit3 width={14} height={14}/> แก้ไข
                  </ActionBtn>
                  {r.treatment_type === 'ทำครั้งเดียว' && !r.completed_at && (
                    <ActionBtn size="sm" variant="primary" onClick={() => onComplete(r.treatment_id)}>
                      <CheckCircle width={14} height={14} /> เสร็จสิ้น
                    </ActionBtn>
                  )}
                  <ActionBtn size="sm" onClick={() => onDelete(r.treatment_id)}>
                    <Trash2 width={14} height={14} /> ลบ
                  </ActionBtn>
                  <ActionBtn size="sm" onClick={() => onHistory(r)}>
                    <ClipboardList width={14} height={14} /> ประวัติ
                  </ActionBtn>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CardsView({ rows, onComplete, onDelete, onDetail, onHistory, onEdit }: any) {
  return (
    <div className={styles.cards}>
      {rows.map((r: any) => (
        <div key={r.treatment_id} className={cx(styles.card, r.treatment_type === 'ทำครั้งเดียว' && styles.cardEmg)}>
          <div className={styles.rowBetween}>
            <TypeBadge type={r.treatment_type} />
            <TreatmentStatusPill completed={!!r.completed_at} />
          </div>
          <div className={styles.grid2}>
            <div className={styles.bold} style={{ fontSize: 16 }}>{r.patients_id}</div>
            <div className={styles.textDim}><User width={16} height={16} /> รหัส: {r.treatment_id}</div>
          </div>
          <div className={styles.textDim}><BadgeInfo width={16} height={16} /> {r.diagnosis_summary || '-'}</div>
          {r.note && <div className={styles.small} style={{ opacity: .8 }}>หมายเหตุ: {r.note}</div>}
          <div className={styles.rowBetween}>
            <div> <span className={styles.inline}>วันที่บันทึก:</span> {formatThaiDate(r.treatment_date)}</div>
            <div className={styles.textDim}>
              <Clock width={16} height={16}/> แก้ไขล่าสุด {formatRelativeThai(r.updated_at)}
            </div>
            {r.treatment_type === 'ประจำ' && isRecentlyUpdated(r.updated_at) && (
              <span
                className={styles.pill}
                style={{ marginTop: 6, background: '#DCFCE7', color: '#166534', borderColor: '#86EFAC' }}
              >
                เพิ่งแก้ไข
              </span>
            )}
          </div>
          <div>
            <div style={{ display: 'inline-flex', gap: 8 }}>
              <ActionBtn size="sm" onClick={() => onDetail(r)}><Eye width={14} height={14} /> รายละเอียด</ActionBtn>
              <ActionBtn size="sm" onClick={() => onEdit(r)}>
                <Edit3 width={14} height={14}/> แก้ไข
              </ActionBtn>
              {r.treatment_type === 'ทำครั้งเดียว' && !r.completed_at && (
                <ActionBtn size="sm" variant="primary" onClick={() => onComplete(r.treatment_id)}>
                  เสร็จสิ้น
                </ActionBtn>
              )}
              <ActionBtn size="sm" onClick={() => onDelete(r.treatment_id)}><Trash2 width={14} height={14} />ลบ</ActionBtn>
              <ActionBtn size="sm" onClick={() => onHistory(r)}>
                <ClipboardList width={14} height={14} /> ประวัติ
              </ActionBtn>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineView({ rows, onComplete, onDelete, onDetail, onHistory, onEdit }: any) {
  const groups = rows.reduce((acc: Record<string, any[]>, r: any) => {
    const label = thaiDateGroupLabel(r.treatment_date);
    (acc[label] = acc[label] || []).push(r);
    return acc;
  }, {});
  const labels = Object.keys(groups);
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {labels.map(label => (
        <div key={label}>
          <div className={styles.sectionTitle}>{label}</div>
          <div className={styles.timelineGroup}>
            <div className={styles.timelineLine} />
            <div style={{ display: 'grid', gap: 16 }}>
              {groups[label].sort(byDateDesc).map((r: any) => (
                <div key={r.treatment_id} className={styles.timelineItem}>
                  <div className={cx(styles.timelineDot, r.treatment_type === 'ทำครั้งเดียว' && styles.timelineDotEmg)}>
                    {r.treatment_type === 'ทำครั้งเดียว'
                      ? <Zap width={14} height={14} />
                      : <Stethoscope width={14} height={14} />}
                  </div>
                  <div className={styles.timelineCard}>
                    <div className={styles.rowBetween}>
                      <div className={styles.bold}>{r.patients_id}</div>
                      <TreatmentStatusPill completed={!!r.completed_at} />
                    </div>
                    <div className={styles.textDim}><BadgeInfo width={16} height={16} /> {r.diagnosis_summary || '-'}</div>
                    {r.note && <div className={styles.small} style={{ opacity: .8 }}>หมายเหตุ: {r.note}</div>}
                    <div className={styles.small} style={{opacity:.8}}>
                      วันที่บันทึก: {formatThaiDate(r.treatment_date)} • รหัส {r.treatment_id} • แก้ไข {formatRelativeThai(r.updated_at)}
                    </div>
                    {r.treatment_type === 'ประจำ' && isRecentlyUpdated(r.updated_at) && (
                      <span
                        className={styles.pill}
                        style={{ marginTop: 6, background: '#DCFCE7', color: '#166534', borderColor: '#86EFAC' }}
                      >
                        เพิ่งแก้ไข
                      </span>
                    )}
                    <div style={{ display: 'inline-flex', gap: 8, marginTop: 8 }}>
                      <ActionBtn size="sm" onClick={() => onDetail(r)}><Eye width={14} height={14} /> รายละเอียด</ActionBtn>
                      <ActionBtn size="sm" onClick={() => onEdit(r)}>
                        <Edit3 width={14} height={14}/> แก้ไข
                      </ActionBtn>
                      {r.treatment_type === 'ทำครั้งเดียว' && !r.completed_at && (
                        <ActionBtn size="sm" variant="primary" onClick={() => onComplete(r.treatment_id)}>
                          เสร็จสิ้น
                        </ActionBtn>
                      )}
                      <ActionBtn size="sm" onClick={() => onDelete(r.treatment_id)}><Trash2 width={14} height={14} />ลบ</ActionBtn>
                      <ActionBtn size="sm" onClick={() => onHistory(r)}>
                        <ClipboardList width={14} height={14} /> ประวัติ
                      </ActionBtn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function calculateAgeFromBirthdate(birthdate: string) {
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

function normalizePatientsId(id: string) {
  if (!id) return "";
  id = String(id).trim();
  if (/^\d+$/.test(id)) {
    return "HN-" + id.padStart(8, "0");
  }
  return id.toUpperCase();
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

function isNameQuery(s: string) {
  return /[A-Za-zก-๙]/.test(s);
}

/** ---------------------- Main ---------------------- */
export default function TreatmentsListPage() {
  const searchParams = useSearchParams();
  const patientIdFromUrl = searchParams.get('patients_id') || searchParams.get('patient_id') || '';
  const historyReqRef = useRef(0);

  const [tab, setTab] = useState<'ทั้งหมด' | 'ประจำ' | 'ทำครั้งเดียว'>('ทั้งหมด');
  const [view, setView] = useState<'ตาราง' | 'การ์ด' | 'ไทม์ไลน์'>('ตาราง');
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeOnly, setActiveOnly] = useState(true); // ซ่อน “ทำครั้งเดียว” ที่เสร็จแล้ว

  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0); // 🔁 ใช้ trigger reload

  // History modal states
  const [openHistory, setOpenHistory] = useState(false);
  const [historyMeta, setHistoryMeta] = useState<null | { id: string; name: string; gender?: string; blood_group?: string; bloodgroup_rh?: string; patients_type?: string; disease?: string; age?: string }>(null);
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyErr, setHistoryErr] = useState('');

  // Add Treatment Modal
  const [openAdd, setOpenAdd] = useState(false);
  const addFormRef = useRef<TreatmentFormHandleExt>(null);
  const [draft, setDraft] = useState<TreatmentDraft>({
    patients_id: patientIdFromUrl ? normalizePatientsId(patientIdFromUrl) : '',
    treatment_type: '',
    treatment_date: toISODateLocal(new Date()),
    diagnosis_summary: '',
    note: ''
  });

  // Edit Treatment Modal
  const [openEdit, setOpenEdit] = useState(false);
  const editFormRef = useRef<TreatmentFormHandleExt>(null);
  const [editDraft, setEditDraft] = useState<TreatmentDraft | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const [lookupFor, setLookupFor] = useState<null | 'add' | 'edit'>(null);

  // Patient auto-fetch for EDIT only
  const [editPatient, setEditPatient] = useState<any | null>(null);
  const [editPatientLoading, setEditPatientLoading] = useState(false);
  const [editPatientErr, setEditPatientErr] = useState('');

  const [searchText, setSearchText] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');

  const handleOpenEdit = (row: any) => {
    setEditId(row.treatment_id);
    setEditDraft({
      patients_id: row.patients_id,
      treatment_type: row.treatment_type,
      treatment_date: toISODateLocal(row.treatment_date),
      diagnosis_summary: row.diagnosis_summary,
      note: row.note,
    });
    setOpenEdit(true);
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      setEditPatient(null);
      setEditPatientErr('');
      if (!openEdit) return;

      const raw = (editDraft?.patients_id || '').trim();
      if (!raw) return;

      try {
        setEditPatientLoading(true);
        const p = await fetchPatientSmart(raw);
        if (!alive) return;
        setEditPatient(p);
        editFormRef.current?.setPatientInfo?.(p); // ส่งข้อมูลไปให้ TreatmentForm แสดงการ์ด
      } catch (e: any) {
        if (!alive) return;
        setEditPatientErr(e?.message || 'ไม่พบข้อมูล');
      } finally {
        if (alive) setEditPatientLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [openEdit, editDraft?.patients_id]);


  const handleUpdateTreatment = async () => {
    if (!editId || !editDraft) return;
    if (editFormRef.current?.validate && !editFormRef.current.validate()) return;

    const { isConfirmed } = await $swal.fire({
      icon: 'question',
      title: 'ยืนยันบันทึกการแก้ไข?',
      showCancelButton: true,
    });
    if (!isConfirmed) return;
    try {
      const body = {
        patients_id: normalizePatientsId(editDraft.patients_id.trim()),
        treatment_type: editDraft.treatment_type,
        treatment_date: toISODateLocal(editDraft.treatment_date),
        diagnosis_summary: editDraft.diagnosis_summary?.trim() || null,
        note: editDraft.note?.trim() || null,
      };

      // ✅ แก้ endpoint ให้ตรงกับที่ใช้ส่วนอื่น ๆ (singular)
      $swal.fire({ title: 'กำลังอัปเดต...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      await http(`/api/treatment/${encodeURIComponent(editId)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      // ปิด modal
      setOpenEdit(false);
      setEditId(null);
      setEditDraft(null);

      // SweetAlert2 สำเร็จ
      Swal.fire({
        icon: 'success',
        title: 'อัปเดตข้อมูลสำเร็จ',
        text: 'ข้อมูลการรักษาถูกแก้ไขเรียบร้อยแล้ว',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#3085d6'
      });
      Swal.close();
      toast.fire({ icon: 'success', title: 'อัปเดตข้อมูลสำเร็จ' });

      refresh();
    } catch (e: any) {
      Swal.close();
      $swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: e?.message || 'แก้ไขข้อมูลไม่สำเร็จ',
        confirmButtonText: 'ปิด',
      });
    }
  };

  // Detail Treatment Modal
  const [openDetail, setOpenDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState('');
  const [detail, setDetail] = useState<any | null>(null);

  // build query string for API
  const qs = useMemo(() => {
    const p = new URLSearchParams();

    // ถ้ามีค่าใน URL มาก่อน ให้ใช้เฉพาะตอนที่ยังไม่ได้พิมพ์อะไร
    if (!appliedQuery && patientIdFromUrl) {
      p.set('patient_id', normalizePatientsId(patientIdFromUrl));
    }

    if (tab !== 'ทั้งหมด') p.set('treatment_type', tab);

    if (appliedQuery.trim()) {
      if (isNameQuery(appliedQuery)) {
        // ค้นหาด้วย "ชื่อ"
        p.set('q', appliedQuery.trim());
      } else {
        // ค้นหาด้วย "HN"
        p.set('patient_id', normalizePatientsId(appliedQuery.trim()));
      }
    }

    if (dateFrom) p.set('from', toISODateLocal(dateFrom));
    if (dateTo)   p.set('to',   toISODateLocal(dateTo));
    p.set('active_only', activeOnly ? '1' : '0');
    p.set('page', String(page));
    p.set('limit', String(limit));
    p.set('sort', 'importance');
    p.set('_t', String(tick));
    return p.toString();
  }, [patientIdFromUrl, tab, appliedQuery, dateFrom, dateTo, activeOnly, page, limit, tick]);


  const ordered = rows;

  useEffect(() => {
    if (patientIdFromUrl) {
      setDraft(d => ({ ...d, patients_id: normalizePatientsId(patientIdFromUrl) }));
    }
  }, [patientIdFromUrl]);

  // fetch list
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const doFetch = async () => {
      setLoading(true); setErr('');
      try {
        const data = await http(`/api/treatment?${qs}`, { signal: controller.signal });
        if (!alive) return;
        setRows((data as any).data || []);
        const d: any = data;
          const totalItems =
            (typeof d?.totalCount === 'number' ? d.totalCount :
            typeof d?.total      === 'number' ? d.total      :
            typeof d?.count      === 'number' ? d.count      :
            typeof d?.pagination?.total === 'number' ? d.pagination.total :
            Array.isArray(d?.data) ? d.data.length : 0);

          setTotal(totalItems);
      } catch (e: any) {
        if (!alive) return;
        setErr(e.message || 'โหลดข้อมูลไม่สำเร็จ');
        if (e?.name !== 'AbortError') {
          $swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: e?.message || '' });
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    doFetch();
    return () => { alive = false; controller.abort(); };
  }, [qs]);

  // counters (นับจากข้อมูลที่แสดงอยู่)
  const counters = useMemo(() => {
    const total = rows.length;
    const reg = rows.filter(r => r.treatment_type === 'ประจำ').length;
    const once = rows.filter(r => r.treatment_type === 'ทำครั้งเดียว').length;
    return { total, reg, once };
  }, [rows]);

  const openAddModal = () => {
    setDraft(d => ({
      ...d,
      patients_id: patientIdFromUrl ? normalizePatientsId(patientIdFromUrl) : d.patients_id,
      treatment_date: d.treatment_date || toISODateLocal(new Date()),
    }));
    setOpenAdd(true);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    setPage(p => Math.min(Math.max(1, totalPages), p));
  }, [totalPages]);



  const clearAllFilters = () => {
    setSearchText('');
    setAppliedQuery('');
    setDateFrom('');
    setDateTo('');
    setActiveOnly(true);
    setTab('ทั้งหมด');
    setPage(1);
    setTick(t => t + 1);
  };

  // actions
  const refresh = () => setTick(t => t + 1);
  const handleCreateTreatment = async () => {
    if (addFormRef.current?.validate && !addFormRef.current.validate()) return;
    const { isConfirmed } = await $swal.fire({
      icon: 'question',
      title: 'ยืนยันบันทึกข้อมูลการรักษา?',
      showCancelButton: true,
      });
    if (!isConfirmed) return;
    try {
      const body = {
        patients_id: normalizePatientsId(draft.patients_id.trim()),
        treatment_type: draft.treatment_type,
        treatment_date: toISODateLocal(draft.treatment_date),
        diagnosis_summary: draft.diagnosis_summary?.trim() || null,
        note: draft.note?.trim() || null,
      };
      $swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      await http('/api/treatment', { method: 'POST', body: JSON.stringify(body) });
      Swal.close();
      setOpenAdd(false);
      setDraft(initialDraft());
      addFormRef.current?.reset?.();
      setTick(t => t + 1);
    } catch (e: any) {
      Swal.close();
      $swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: e?.message || 'บันทึกข้อมูลการรักษาไม่สำเร็จ' });
      return;
    }
    toast.fire({ icon: 'success', title: 'บันทึกข้อมูลสำเร็จ' });
  };
  const handleComplete = async (treatment_id: string) => {
    const { isConfirmed } = await $swal.fire({
      icon: 'question',
      title: 'ยืนยันทำเครื่องหมายว่าเสร็จสิ้น?',
      showCancelButton: true,
    });
    if (!isConfirmed) return;
    try {
      $swal.fire({ title: 'กำลังอัปเดต...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      await http(`/api/treatment/${encodeURIComponent(treatment_id)}/complete`, { method: 'PATCH' });
      Swal.close();
      toast.fire({ icon: 'success', title: 'ทำเครื่องหมายเสร็จสิ้นแล้ว' });
      refresh();
    } catch (e: any) {
      Swal.close();
      $swal.fire({ icon: 'error', title: 'ทำเครื่องหมายไม่สำเร็จ', text: e?.message || '' });
    }
  };

  const handleDelete = async (treatment_id: string) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบรายการนี้?',
      text: 'เมื่อยืนยันแล้วจะไม่สามารถกู้คืนได้',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      reverseButtons: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        try {
          await http(`/api/treatment/${encodeURIComponent(treatment_id)}`, {
            method: 'DELETE'
          });
        } catch (e: any) {
          Swal.showValidationMessage(e?.message || 'ลบไม่สำเร็จ');
          throw e;
        }
      },
    });

    if (result.isConfirmed) {
      await Swal.fire({
        title: 'ลบแล้ว',
        text: 'รายการถูกลบเรียบร้อย',
        icon: 'success',
        timer: 1400,
        showConfirmButton: false,
      });
      refresh();
    }
  };

  const handleSearch = () => {
    setAppliedQuery(searchText.trim());  // ใช้ค่าที่พิมพ์จริง
    setPage(1);
    setTick(t => t + 1);
  };

  const initialDraft = (): TreatmentDraft => ({
    patients_id: '',
    treatment_type: '',
    treatment_date: (() => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    })(),
    diagnosis_summary: '',
    note: '',
  });

  const closeAddModal = () => {
    setOpenAdd(false);
    setDraft(initialDraft());
    addFormRef.current?.reset?.();
  };

  async function fetchAllTreatments(patients_idRaw: string) {
    const patients_id = normalizePatientsId(patients_idRaw || '');
    if (!patients_id) throw new Error('ไม่พบรหัสผู้ป่วย');

    const acc: any[] = [];
    let page = 1;
    const limit = 200;
    for (; page <= 1000; page++) {
      const qs = new URLSearchParams({
        patient_id: patients_id,
        page: String(page),
        limit: String(limit),
        active_only: '0',
        sort: 'date_desc',
      }).toString();

      let data: any;
      try {
        data = await http(`/api/treatment?${qs}`);
      } catch (e: any) {
        if (e?.status === 404) break;
        throw e;
      }

      const chunk = Array.isArray(data?.data) ? data.data : [];
      if (chunk.length === 0) break;
      acc.push(...chunk);
      if (chunk.length < limit) break;
    }

    const byId = new Map<string, any>();
    for (const r of acc) byId.set(r.treatment_id, r);
    return Array.from(byId.values()).sort((a, b) => {
      const d = byDateDesc(a, b);
      if (d !== 0) return d;
      return String(b.treatment_id).localeCompare(String(a.treatment_id));
    });
  }

  const handleOpenHistory = async (row: any) => {
    const name = `${row.pname || ''}${row.first_name} ${row.last_name}`.trim();
    const patients_id = normalizePatientsId(row.patients_id);

    const calcAge = (birthdate: string) => {
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
      if (years > 0) return `${years} ปี`;
      return `${months} เดือน`;
    };

    setHistoryMeta({
      id: patients_id || row.patients_id,
      name,
      gender: row.gender,
      blood_group: row.blood_group,
      bloodgroup_rh: row.bloodgroup_rh,
      patients_type: row.patients_type,
      disease: row.disease,
      age: calcAge(row.birthdate)
    });

    setOpenHistory(true);
    setHistoryLoading(true);
    setHistoryErr('');
    setHistoryRows([]);

    const reqId = ++historyReqRef.current;

    try {
      if (!patients_id) throw new Error('ไม่พบรหัสผู้ป่วย (patients_id)');

      const all = await fetchAllTreatments(patients_id);

      if (historyReqRef.current !== reqId) return;
      setHistoryRows(all);
    } catch (e: any) {
      if (historyReqRef.current !== reqId) return;
      setHistoryErr(e?.message || 'โหลดประวัติไม่สำเร็จ');
      $swal.fire({ icon: 'error', title: 'โหลดประวัติไม่สำเร็จ', text: e?.message || '' });
    } finally {
      if (historyReqRef.current === reqId) setHistoryLoading(false);
    }
  };

  // 🔎 เปิด Modal รายละเอียดจากปุ่มในตาราง
  const handleOpenDetail = async (row: any) => {
    setDetailErr('');
    setDetailLoading(true);
    setDetail(row);
    setOpenDetail(true);
    try {
      const d = await http(`/api/treatment/${encodeURIComponent(row.treatment_id)}`);

      const pid = d.patients_id || row.patients_id;
      let patient = null;
      if (pid) {
        try {
          patient = await http(`/api/patients/${encodeURIComponent(pid)}`);
        } catch {}
      }

      setDetail({ ...row, ...d, patient });
    } catch (e: any) {
      setDetailErr(e.message || 'โหลดรายละเอียดไม่สำเร็จ');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.title}>รายการการรักษา</div>
          <div className={styles.subtitle}>
            {patientIdFromUrl ? `ประวัติของผู้ป่วย: ${patientIdFromUrl}` : 'รายการรักษาทั้งหมดในแผนก'}
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={openAddModal}>
            <Stethoscope width={16} height={16} style={{ marginRight: 6 }} />
            เพิ่มข้อมูลการรักษา
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className={styles.summaryGrid}>
        <SummaryCard title="ทั้งหมด (หน้านี้)" value={counters.total} icon={<ClipboardList width={20} height={20} />} />
        <SummaryCard title="ประจำ" value={counters.reg} icon={<Stethoscope width={20} height={20} />} />
        <SummaryCard title="ทำครั้งเดียว" value={counters.once} icon={<Zap width={20} height={20} />} />
      </div>

      {/* Tabs & view toggle */}
      <div className={styles.tabs}>
        {['ทั้งหมด', 'ประจำ', 'ทำครั้งเดียว'].map(t => (
          <button key={t} onClick={() => { setTab(t as any); setPage(1); }}
                  className={cx(styles.tabBtn, t === tab && styles.tabBtnActive)}>
            {t}
          </button>
        ))}
        <div className={styles.viewBtns}>
          <button onClick={() => setView('ตาราง')} className={cx(styles.viewBtn, view === 'ตาราง' && styles.viewBtnActive)}><LayoutList width={16} height={16} /> ตาราง</button>
          <button onClick={() => setView('การ์ด')} className={cx(styles.viewBtn, view === 'การ์ด' && styles.viewBtnActive)}><LayoutGrid width={16} height={16} /> การ์ด</button>
          <button onClick={() => setView('ไทม์ไลน์')} className={cx(styles.viewBtn, view === 'ไทม์ไลน์' && styles.viewBtnActive)}><Clock width={16} height={16} /> ไทม์ไลน์</button>
        </div>
        <button onClick={clearAllFilters} className={styles.resetBtn}>
          <RefreshCw width={16} height={16} /> ล้างตัวกรองทั้งหมด
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div>
          <label className={styles.label}>ค้นหา</label>
          <div className={styles.searchWrap}>
            <Search width={16} height={16} className={styles.searchIcon} />
            <input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="พิมพ์ HN (เช่น HN-00000001/1) หรือชื่อ (เช่น สมชาย)"
              className={cx(styles.input, styles.inputWithIcon)}
            />
          </div>
        </div>
        <div>
          <label className={styles.label}>จากวันที่รักษา</label>
          <DatePickerField
            value={dateFrom ? new Date(`${dateFrom}T00:00:00`) : null}
            onChange={(val: string | null) => {
              setDateFrom(val || '');
              setPage(1);
            }}
            placeholder="เลือกวันที่เริ่มต้น"
          />
        </div>

        <div>
          <label className={styles.label}>ถึงวันที่รักษา</label>
          <DatePickerField
            value={dateTo ? new Date(`${dateTo}T00:00:00`) : null}
            onChange={(val: string | null) => {
              setDateTo(val || '');
              setPage(1);
            }}
            placeholder="เลือกวันที่สิ้นสุด"
          />
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={activeOnly} onChange={e => { setActiveOnly(e.target.checked); setPage(1); }} />
            ซ่อน “ทำครั้งเดียว” ที่เสร็จสิ้นแล้ว
          </label>
          {(appliedQuery || dateFrom || dateTo || !activeOnly) && (
            <div className={styles.chips}>
              {appliedQuery && <Chip text={`ค้นหา: ${appliedQuery}`} onClear={() => { setSearchText(''); setAppliedQuery(''); }} />}
              {dateFrom && <Chip text={`จาก: ${dateFrom}`} onClear={() => setDateFrom('')} />}
              {dateTo && <Chip text={`ถึง: ${dateTo}`} onClear={() => setDateTo('')} />}
              {!activeOnly && <Chip text={`แสดงรายการที่เสร็จสิ้นแล้ว`} onClear={() => setActiveOnly(true)} />}
            </div>
          )}
        </div>
      </div>

      {/* banners */}
      {err && <div className={`${styles.banner} ${styles.bannerError}`}>{err}</div>}
      {!err && loading && (
        <div className={`${styles.banner} ${styles.bannerInfo}`}>
          <span className={styles.spinner}></span> กำลังโหลดข้อมูล...
        </div>
      )}

      {/* Content */}
      <div>
        {view === 'ตาราง'   && <TableView   rows={ordered} onComplete={handleComplete} onDelete={handleDelete} onDetail={handleOpenDetail} onHistory={handleOpenHistory} onEdit={handleOpenEdit}/>}
        {view === 'การ์ด'    && <CardsView   rows={ordered} onComplete={handleComplete} onDelete={handleDelete} onDetail={handleOpenDetail} onHistory={handleOpenHistory} onEdit={handleOpenEdit}/>}
        {view === 'ไทม์ไลน์' && <TimelineView rows={ordered} onComplete={handleComplete} onDelete={handleDelete} onDetail={handleOpenDetail} onHistory={handleOpenHistory} onEdit={handleOpenEdit}/>}
        {!loading && ordered.length === 0 && (
          <div>ไม่พบรายการที่ตรงกับเงื่อนไข — ลองปรับตัวกรองใหม่</div>
        )}
      </div>

      {/* pagination */}
      <div className={styles.pagination}>
        <span className={styles.pageInfo}>ทั้งหมด {total} รายการ</span>
        <button
          className={styles.pageBtn}
          disabled={page <= 1}
          onClick={() => setPage(p => Math.max(1, p - 1))}
        >
          ก่อนหน้า
        </button>
        <span className={styles.pageInfo}>หน้า {page}/{totalPages}</span>
        <button
          className={styles.pageBtn}
          disabled={page >= totalPages}
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
        >
          ถัดไป
        </button>
      </div>


      {/* Add Treatment Modal */}
      <Modal
        open={openAdd}
        title={
          <div className="flex items-center gap-2">
            <Stethoscope size={20} className="text-emerald-600" />
            เพิ่มข้อมูลการรักษา
          </div>
        }
        size="lg"
        initialFocusSelector="input,select,textarea"
        onClose={closeAddModal}
        onConfirm={handleCreateTreatment}
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
                onClick={closeAddModal}
              >
                <X size={16}/> ยกเลิก
              </button>
              <button
                className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition-all duration-200 shadow-lg flex items-center gap-2"
                onClick={handleCreateTreatment}
              >
                <CheckCircle size={16}/> บันทึกข้อมูล
              </button>
            </div>
          </div>
        }
      >
        <TreatmentForm ref={addFormRef} value={draft} onChange={setDraft} />
      </Modal>

      {/* Detail Treatment Modal */}
      <Modal
        open={openDetail}
        title={<div className="flex items-center gap-2"><Eye size={20} className="text-blue-600"/> รายละเอียดการรักษา</div>}
        zIndex={60}
        size="xl"
        bodyClassName="max-h-[80vh] overflow-y-auto"
        onClose={() => { setOpenDetail(false); setDetail(null); setDetailErr(''); }}
        onConfirm={() => { setOpenDetail(false); setDetail(null); setDetailErr(''); }}
        footer={
          <div className="w-full flex justify-center">
            <button
              className="px-8 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg flex items-center gap-2"
              onClick={() => { setOpenDetail(false); setDetail(null); setDetailErr(''); }}
            >
              <X size={16}/> ปิด
            </button>
          </div>
        }
      >
        {detailErr ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle size={48} className="text-red-400 mx-auto mb-4"/>
              <p className="text-gray-600">{detailErr}</p>
            </div>
          </div>
        ) : !detail ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center text-gray-500">กำลังโหลดรายละเอียด...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overview */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-100 rounded-2xl shadow-lg p-6 border border-blue-200">
              <div className="flex items-center space-x-6 mb-4">
                <div className="w-40 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {detail.patients_id}
                </div>
                <div className="flex-1">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {detail.pname || ''} {detail.first_name} {detail.last_name}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600 flex-wrap">
                    <TypeBadge type={detail.treatment_type} />
                    <TreatmentStatusPill completed={!!detail.completed_at} />
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      <CalendarDays size={14}/> {formatThaiDate(detail.treatment_date)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-gray-500">
                      <Clock size={14}/> อัปเดต {formatRelativeThai(detail.updated_at)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-600">รหัสการรักษา</div>
                  <div className="font-mono text-sm bg-white px-2 py-1 rounded border inline-block">{detail.treatment_id}</div>
                </div>
              </div>
            </div>

            {/* Patient basic info */}
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
                    <span className="font-semibold text-gray-700">อายุ</span>
                  </div>
                  <div className="text-gray-900 text-lg">{calculateAgeFromBirthdate(detail.birthdate || '-')}</div>
                </div>
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-700">เพศ</span>
                  </div>
                  <div className="text-gray-900 text-lg">{detail.gender || '-'}</div>
                </div>
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-700">กรุ๊ปเลือด</span>
                  </div>
                  <div className="text-gray-900 text-lg">{detail.blood_group || '-'} {detail.bloodgroup_rh || '-'}</div>
                </div>
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-700">ประเภทผู้ป่วย</span>
                  </div>
                  <div className="text-gray-900 text-lg">{detail.patient_type || '-'}</div>
                </div>
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-700">น้ำหนัก</span>
                  </div>
                  <div className="text-gray-900 text-lg">{detail.weight || '-'}</div>
                </div>
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-700">ส่วนสูง</span>
                  </div>
                  <div className="text-gray-900 text-lg">{detail.height || '-'}</div>
                </div>
                <div className="md:col-span-2 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-700">โรคประจำตัว</span>
                  </div>
                  <div className="text-gray-900 text-lg">{detail.disease || '-'}</div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-gray-100">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <BadgeInfo size={16} className="text-gray-700"/>
                </div>
                <h3 className="text-xl font-bold text-gray-800">รายละเอียด</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="font-semibold text-gray-700 mb-1">ประเภทการรักษา</div>
                  <div className="text-gray-900">{detail.treatment_type}</div>
                </div>
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="font-semibold text-gray-700 mb-1">วันที่รักษา</div>
                  <div className="text-gray-900">{formatThaiDate(detail.treatment_date)}</div>
                </div>
                <div className="md:col-span-2 p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200">
                  <div className="font-semibold text-gray-700 mb-1">สรุปการรักษา</div>
                  <div className="text-gray-900 leading-relaxed">{detail.diagnosis_summary || '—'}</div>
                </div>
                {detail.note && (
                  <div className="md:col-span-2 p-4 bg-gradient-to-r from-rose-50 to-rose-100 rounded-xl border border-rose-200">
                    <div className="font-semibold text-gray-700 mb-1">หมายเหตุ</div>
                    <div className="text-gray-900 leading-relaxed">{detail.note}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Timestamps */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-gray-100">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Clock size={16} className="text-purple-700"/>
                </div>
                <h3 className="text-xl font-bold text-gray-800">เวลา</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {detail.created_at && (
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                    <div className="font-semibold text-gray-700 mb-1">สร้างเมื่อ</div>
                    <div className="text-gray-900">{formatThaiDateTime(detail.created_at)}</div>
                  </div>
                )}
                {detail.updated_at && (
                  <div className="p-4 bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-xl border border-indigo-200">
                    <div className="font-semibold text-gray-700 mb-1">แก้ไขล่าสุด</div>
                    <div className="text-gray-900">{formatThaiDateTime(detail.updated_at)} ({formatRelativeThai(detail.updated_at)})</div>
                  </div>
                )}
                {detail.completed_at && (
                  <div className="p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 md:col-span-2">
                    <div className="font-semibold text-gray-700 mb-1">เสร็จสิ้น</div>
                    <div className="text-gray-900">{formatThaiDateTime(detail.completed_at)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={openHistory}
        title={
          <div className="flex items-center gap-2">
            <ClipboardList size={20} className="text-blue-600" />
            ประวัติการรักษาทั้งหมดของผู้ป่วย
          </div>
        }
        zIndex={50}
        size="xl"
        bodyClassName="max-h-[80vh] overflow-y-auto"
        onClose={() => { setOpenHistory(false); setHistoryRows([]); setHistoryMeta(null); }}
        onConfirm={() => { setOpenHistory(false); }}
        footer={
          <div className="w-full flex justify-center">
            <button
              className="px-8 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg flex items-center gap-2"
              onClick={() => setOpenHistory(false)}
            >
              <X size={16}/> ปิด
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {historyMeta && (
            <div className="p-6 rounded-2xl border bg-gradient-to-br from-blue-50 via-white to-indigo-50 border-blue-200 space-y-4 shadow-lg hover:shadow-xl transition-all duration-300">
              {/* Header Section */}
              <div className="flex items-center gap-4 pb-4 border-b border-blue-200">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-xl shadow-lg">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-3 text-blue-900">
                  <div className="font-mono px-4 py-2 bg-white rounded-xl border-2 border-blue-200 shadow-sm font-semibold text-blue-700">
                    {historyMeta.id}
                  </div>
                  <div className="font-bold text-xl text-gray-800">{historyMeta.name || '-'}</div>
                </div>
              </div>

              {/* Patient Information Row */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-100 to-emerald-50 border border-emerald-200 rounded-full shadow-sm">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span className="font-medium text-emerald-800">
                    อายุ: <span className="font-bold">{historyMeta.age || '-'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-100 to-orange-50 border border-orange-200 rounded-full shadow-sm">
                  <User className="w-4 h-4 text-orange-600" />
                  <span className="font-medium text-orange-800">
                    เพศ: <span className="font-bold">{historyMeta.gender || '-'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-red-100 to-red-50 border border-red-200 rounded-full shadow-sm">
                  <Droplets className="w-4 h-4 text-red-600" />
                  <span className="font-medium text-red-800">
                    กรุ๊ปเลือด: <span className="font-bold">{historyMeta.blood_group}{historyMeta.bloodgroup_rh || ''}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-100 to-blue-50 border border-blue-200 rounded-full shadow-sm">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-800">
                    ประเภทผู้ป่วย: <span className="font-bold">{historyMeta.patients_type || '-'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-pink-100 to-pink-50 border border-pink-200 rounded-full shadow-sm">
                  <Heart className="w-4 h-4 text-pink-600" />
                  <span className="font-medium text-pink-800">
                    โรคประจำตัว: <span className="font-bold">{historyMeta.disease || '-'}</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {historyLoading && (
            <div className={`${styles.banner} ${styles.bannerInfo}`}>
              <span className={styles.spinner}></span> กำลังโหลดประวัติทั้งหมด...
            </div>
          )}

          {!historyLoading && historyErr && (
            <div className={`${styles.banner} ${styles.bannerError}`}>{historyErr}</div>
          )}

          {!historyLoading && !historyErr && historyRows.length === 0 && (
            <div className={`${styles.banner} ${styles.bannerInfo}`}>ยังไม่มีประวัติการรักษา</div>
          )}

          {!historyLoading && !historyErr && historyRows.length > 0 && (
            <div className={styles.timelineGroup}>
              <div className={styles.timelineLine} />
              <div style={{ display: 'grid', gap: 16 }}>
                {historyRows.map((r: any) => (
                  <div key={r.treatment_id} className={styles.timelineItem}>
                    <div className={cx(
                      styles.timelineDot,
                      r.treatment_type === 'ทำครั้งเดียว' && styles.timelineDotEmg
                    )}>
                      {r.treatment_type === 'ทำครั้งเดียว'
                        ? <Zap width={14} height={14} />
                        : <Stethoscope width={14} height={14} />}
                    </div>
                    <div className={styles.timelineCard}>
                      <div className={styles.rowBetween}>
                        <div className={styles.bold}>{formatThaiDate(r.treatment_date)}</div>
                        <TreatmentStatusPill completed={!!r.completed_at} />
                      </div>
                      <div className={styles.textDim}>
                        <BadgeInfo width={16} height={16} /> {r.diagnosis_summary || '-'}
                      </div>
                      {r.note && (
                        <div className={styles.small} style={{ opacity: .8 }}>
                          หมายเหตุ: {r.note}
                        </div>
                      )}
                      <div className={styles.small} style={{ opacity: .8 }}>
                        ประเภท: {r.treatment_type} • รหัสการรักษา: {r.treatment_id} • แก้ไข {formatRelativeThai(r.updated_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Treatment Modal (แสดงข้อมูลผู้ป่วยอัตโนมัติ) */}
      <Modal
        open={openEdit}
        title={
          <div className="flex items-center gap-2">
            <Stethoscope size={20} className="text-amber-600" />
            แก้ไขข้อมูลการรักษา
          </div>
        }
        size="lg"
        initialFocusSelector="input,select,textarea"
        onClose={() => { setOpenEdit(false); setEditId(null); setEditDraft(null); }}
        onConfirm={handleUpdateTreatment}
        footer={
          <div className="w-full flex justify-end gap-3">
            <button
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              onClick={() => { setOpenEdit(false); setEditId(null); setEditDraft(null); }}
            >
              <X size={16}/> ยกเลิก
            </button>
            <button
              className="px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-lg hover:from-amber-700 hover:to-amber-800 transition-all duration-200 shadow-lg flex items-center gap-2"
              onClick={handleUpdateTreatment}
            >
              <CheckCircle size={16}/> บันทึกการแก้ไข
            </button>
          </div>
        }
      >
        {editDraft && (
          <>
            <TreatmentForm ref={editFormRef} value={editDraft} onChange={setEditDraft} />
          </>
        )}
      </Modal>

      {/* 🔎 Patient Lookup (แชร์ทั้ง Add/Edit) */}
      <PatientLookupModal
        open={!!lookupFor}
        onClose={() => setLookupFor(null)}
        onSelect={(p) => {
          if (lookupFor === 'add') {
            setDraft((v) => ({ ...v, patients_id: p.patients_id }));
            addFormRef.current?.setPatientInfo?.(p);   // แสดงการ์ดใน TreatmentForm เลย
          } else if (lookupFor === 'edit' && editDraft) {
            setEditDraft((v) => v ? ({ ...v, patients_id: p.patients_id }) : v);
            editFormRef.current?.setPatientInfo?.(p);  // แสดงการ์ดใน TreatmentForm เลย
          }
          setLookupFor(null);
        }}
      />
    </div>
  );
}