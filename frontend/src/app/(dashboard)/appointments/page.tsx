'use client';

import React, { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';
import { CalendarPlus, User, X, Edit3, ClipboardList, Eye, Pencil, CheckCircle } from 'lucide-react';
import Modal from '@/app/components/ui/Modal';
import AppointmentForm, {type AppointmentFormValue} from '@/app/components/forms/AppointmentForm';
import DatePickerField from '@/app/components/DatePicker';
import { notifyBadgeInvalidate } from '@/app/components/Navbar';

import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

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
  didOpen: (t) => {
    t.onmouseenter = Swal.stopTimer;
    t.onmouseleave = Swal.resumeTimer;
  },
});

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const STYLE_ID = 'swal-zfix';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* ยกทั้ง dialog, toast, และ backdrop ของ SweetAlert ให้อยู่บนสุด */
      .swal2-container { z-index: 999999 !important; }
    `;
    document.head.appendChild(style);
  }
}

// ✅ แก้: ห้าม await ตอนเปิด loading
async function withLoading<T>(
  task: () => Promise<T>,
  opts?: { title?: string; success?: string; error?: string }
): Promise<T> {
  Swal.fire({
    title: opts?.title ?? 'กำลังดำเนินการ...',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading(),
  });
  try {
    const res = await task();
    Swal.close();
    if (opts?.success) toast.fire({ icon: 'success', title: opts.success });
    return res;
  } catch (e: any) {
    Swal.close();
    toast.fire({ icon: 'error', title: opts?.error ?? (e?.message || 'เกิดข้อผิดพลาด') });
    throw e;
  }
}

type Status = 'pending' | 'done' | 'cancelled';

type Appointment = {
  id: string;
  patient: string;
  hn: string;
  phone?: string;
  date: string;
  start: string;
  end: string;
  type: string;
  hospital_address?: string;
  place: string;
  status: Status;
  note?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';
function joinUrl(base: string, path: string) {
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}
async function http<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const finalUrl = /^https?:\/\//i.test(url) ? url : joinUrl(API_BASE, url);
  const res = await fetch(finalUrl, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    cache: 'no-store',
  });
  let data: any = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) data = await res.json().catch(() => null);
  else data = await res.text().catch(() => null);

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Request failed (${res.status})`;
    const err: any = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data as T;
}

const TH_DATE = (d: string) =>
  new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(d));
const YMD_TH = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d);
const TODAY_TH = () => YMD_TH(new Date());

function parseHHmmToMin(t?: string | null) {
  if (!t) return NaN;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return NaN;
  const h = Number(m[1]), mm = Number(m[2]);
  return h * 60 + mm;
}
function toHHmm(t?: string | null) {
  if (!t) return '';
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2,'0')}:${m[2]}` : String(t);
}
function normalizeHN(v: string) {
  const digits = v.replace(/\D/g, '');
  if (!digits) return '';
  return 'HN-' + digits.padStart(8, '0');
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; className: string }> = {
    pending:   { label: 'รอดำเนินการ', className: styles.badgePending },
    done:      { label: 'เสร็จสิ้น',   className: styles.badgeDone },
    cancelled: { label: 'ยกเลิก',      className: styles.badgeCancelled },
  };
  return <span className={`${styles.badge} ${map[status].className}`}>{map[status].label}</span>;
}

const TYPE_OPTIONS = ['โรงพยาบาล','บ้านผู้ป่วย'];
const PLACE_OPTIONS = ['บ้านผู้ป่วย'];

const TYPE_VALUE_FROM_LABEL = (label?: string) =>
  label === 'โรงพยาบาล' ? 'hospital' :
  label === 'บ้านผู้ป่วย' ? 'home' : (label || '');
const TYPE_LABEL_FROM_VALUE = (val?: string) =>
  val === 'hospital' ? 'โรงพยาบาล' :
  val === 'home' ? 'บ้านผู้ป่วย' : (val || '');

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const highlight = (text: string, q: string) => {
  const t = text ?? '';
  const query = (q || '').trim();
  if (!query) return t;
  const re = new RegExp(`(${esc(query)})`, 'i');
  const parts = t.split(re);
  return parts.map((p, i) => i % 2 === 1 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>);
};

function Pager({
  page, pageCount, onPage, start, end, total,
}: {
  page: number; pageCount: number; onPage: (p:number)=>void;
  start: number; end: number; total: number;
}) {
  const prev = () => onPage(Math.max(1, page - 1));
  const next = () => onPage(Math.min(pageCount, page + 1));

  return (
    <div className={styles.pagination}>
      <span className={styles.pageInfo}>
        {total === 0 ? 'ทั้งหมด 0 รายการ' : `${start}–${end} จาก ${total} รายการ`}
      </span>
      <button className={styles.pageBtn} onClick={prev} disabled={page <= 1} type="button">ก่อนหน้า</button>
      <span className={styles.pageInfo}>หน้า {page}/{pageCount}</span>
      <button className={styles.pageBtn} onClick={next} disabled={page >= pageCount} type="button">ถัดไป</button>
    </div>
  );
}

type ApiRow = {
  appointment_code?: string;
  appointment_id?: number;
  patients_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  appointment_type?: string;
  place?: string;
  hospital_address?: string;
  display_place?: string;
  status: Status;
  note?: string;
  pname?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
};

function mapRow(r: ApiRow): Appointment {
  const full =
    `${r.pname ?? ''}${r.first_name ?? ''} ${r.last_name ?? ''}`.replace(/\s+/g, ' ').trim();
  return {
    id: r.appointment_code || (r.appointment_id ? `AP-${String(r.appointment_id).padStart(6,'0')}` : '-'),
    patient: full || r.patients_id,
    hn: r.patients_id,
    phone: r.phone_number || undefined,
    date: r.appointment_date,
    start: toHHmm(r.start_time),
    end: toHHmm(r.end_time),
    type: TYPE_LABEL_FROM_VALUE(r.appointment_type || ''),               // "โรงพยาบาล" | "บ้านผู้ป่วย"
    place: r.display_place || r.place || (r.appointment_type === 'home' ? 'บ้านผู้ป่วย' : ''),
    hospital_address: r.hospital_address || undefined,
    status: r.status,
    note: r.note || undefined,
  };
}

export default function AppointmentsPage() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | Status>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [view, setView] = useState<'table' | 'cards'>('table');

  const [sortKey, setSortKey] = useState<'datetime'|'created'|'patient'|'hn'|'status'|'type'|'place'>('status');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10);
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');

  useEffect(() => { setPage(1); }, [q, status, from, to, sortKey, sortDir, view, pageSize]);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const resetForm = (): AppointmentFormValue => ({
    date: TODAY_TH(),
    start: '09:00',
    end: '09:30',
    type: 'บ้านผู้ป่วย',
    place: 'บ้านผู้ป่วย',
    hospital_address: '',
    status: 'pending' as Status,
  });
  const [form, setForm] = useState<AppointmentFormValue>(resetForm());

  type FormErrors = Partial<Record<keyof AppointmentFormValue | 'hospital_address', string>>;
  const REQUIRED: (keyof AppointmentFormValue)[] = ['hn', 'date', 'start', 'end', 'type'];
  function validate(f: Partial<AppointmentFormValue>): FormErrors {
    const e: FormErrors = {};
    const get = (k: keyof AppointmentFormValue) => (f[k]?.toString().trim() ?? '');
    for (const k of REQUIRED) if (!get(k)) e[k] = 'จำเป็น';

    const s = get('start');
    const ed = get('end');
    const sm = parseHHmmToMin(s);
    const em = parseHHmmToMin(ed);
    if (s && ed && (!isFinite(sm) || !isFinite(em) || em <= sm)) e.end = 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม';
    const tVal = TYPE_VALUE_FROM_LABEL(get('type'));
    if (tVal === 'hospital' && !get('hospital_address')) e.hospital_address = 'กรอกชื่อ/ที่อยู่โรงพยาบาล';
    if (f.phone && !/^[0-9+\-() ]{6,}$/.test(f.phone)) e.phone = 'รูปแบบเบอร์ไม่ถูกต้อง';
    return e;
  }

  const [errors, setErrors] = useState<FormErrors>({});
  const isValid = useMemo(() => Object.keys(validate(form)).length === 0, [form]);

  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const toggleRow = (id: string) => setOpenRowId(prev => prev === id ? null : id);
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const toggleCard = (id: string) => setOpenCards(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [historyFor, setHistoryFor] = useState<{ hn: string; name: string } | null>(null);
  const [historyList, setHistoryList] = useState<Appointment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyErr, setHistoryErr] = useState('');

  const [qDeb, setQDeb] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setQDeb(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const abortRef = React.useRef<AbortController | null>(null);

  async function fetchList() {
    setLoading(true); setErr('');
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const params = new URLSearchParams();
      if (qDeb.trim()) params.set('q', qDeb.trim());
      if (status !== 'all') params.set('status', status);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      params.set('sort', sortKey);
      params.set('dir', sortDir);
      params.set('page', String(page));
      params.set('limit', String(pageSize));

      const data = await http<{ data: ApiRow[]; page: number; limit: number; totalCount: number }>(
        `/api/appointments?${params.toString()}`,
        { signal: ac.signal as any }
      );
      setItems((data.data || []).map(mapRow));
      setTotalCount(data.totalCount || 0);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setErr(e?.message || 'โหลดข้อมูลไม่สำเร็จ');
      setItems([]); setTotalCount(0);
      toast.fire({ icon: 'error', title: e?.message || 'โหลดข้อมูลไม่สำเร็จ' });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDeb, status, from, to, sortKey, sortDir, page, pageSize]);

  const counts = useMemo(() => {
    const today = TODAY_TH();
    return {
      total: totalCount,
      today: items.filter(i => i.date === today).length,
      pending: items.filter(i => i.status === 'pending').length
    };
  }, [items, totalCount]);

  type PatientMini = { name: string; hn: string; phone?: string };
  const [patOpen, setPatOpen] = useState(false);
  const [patActive, setPatActive] = useState(0);
  const patients = useMemo<PatientMini[]>(() => {
    const m = new Map<string, PatientMini>();
    items.forEach(i => { const key = i.hn || i.patient; if (!m.has(key)) m.set(key, { name: i.patient, hn: i.hn, phone: i.phone }); });
    return Array.from(m.values());
  }, [items]);
  const patQuery = (form.patient || '').trim();
  const patSugs = useMemo(() => {
    if (!patQuery) return [];
    const qLower = patQuery.toLowerCase();
    return patients.filter(p =>
      p.name.toLowerCase().startsWith(qLower) || p.hn.toLowerCase().startsWith(qLower)
    ).slice(0, 8);
  }, [patients, patQuery]);
  const choosePatient = (p: PatientMini) => {
    const hn = normalizeHN(p.hn || '');
    setForm(f => ({ ...f, patient: p.name, hn, phone: p.phone }));
    setErrors(validate({ ...form, patient: p.name, hn }));
    setPatOpen(false);
  };

  const [savingId, setSavingId] = useState<string | null>(null);
  async function updateStatus(id: string, newStatus: Status) {
    const target = items.find(i => i.id === id);
    if (!target || target.status !== 'pending') return;

    setSavingId(id);
    setItems(prev => prev.map(it => it.id === id ? { ...it, status: newStatus } : it));
    try {
      await withLoading(
        () => http(`/api/appointments/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus }),
        }),
        { title: 'กำลังอัปเดตสถานะ...', success: 'อัปเดตสถานะสำเร็จ', error: 'อัปเดตสถานะไม่สำเร็จ' }
        
      );
      await fetchList();
      notifyBadgeInvalidate();
    } catch {
      setItems(prev => prev.map(it => it.id === id ? { ...it, status: target.status } : it));
    } finally {
      setSavingId(null);
    }
  }
  async function handleStatus(id: string, newStatus: Status) {
    if (newStatus === 'cancelled') {
      const t = items.find(i => i.id === id);
      const c = await $swal.fire({
        title: 'ยืนยันยกเลิกนัดหมายนี้?',
        html: `<div style="font-family:inherit;opacity:.85">${t ? `${TH_DATE(t.date)} · ${t.start}–${t.end} · ${t.type} @ ${t.place}` : ''}</div>`,
        icon: 'warning',
        showCancelButton: true,
      });
      if (!c.isConfirmed) { toast.fire({ icon: 'info', title: 'ยกเลิกการทำรายการ' }); return; }
    }
    await updateStatus(id, newStatus);
  }

  async function confirmDelete(id: string) {
    const t = items.find(i => i.id === id);
    const c = await $swal.fire({
      title: 'ลบนัดหมายนี้หรือไม่?',
      html: `<div style="font-family:inherit">
              <div><code>${t?.id || ''}</code> · ${t?.patient || ''} <span style="opacity:.7">(${t?.hn || ''})</span></div>
              <div style="opacity:.8">${t ? `${TH_DATE(t.date)} · ${t.start}–${t.end} · ${t.type} @ ${t.place}` : ''}</div>
             </div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      confirmButtonColor: '#dc2626',
    });
    if (!c.isConfirmed) return;

    try {
      await withLoading(
        () => http(`/api/appointments/${encodeURIComponent(id)}`, { method: 'DELETE' }),
        { title: 'กำลังลบ...', success: 'ลบเรียบร้อย', error: 'ลบไม่สำเร็จ' }
      );
      setOpenRowId(prev => (prev === id ? null : prev));
      setOpenCards(prev => { const n = new Set(prev); n.delete(id); return n; });
      fetchList();
    } catch {}
  }

  const startCreate = () => { setEditingId(null); setForm(resetForm()); setErrors({}); setOpen(true); };
  const startEdit = (a: Appointment) => {
   setEditingId(a.id);
   setForm({
     patient: a.patient,
     hn: a.hn,
     phone: a.phone,
     date: a.date,
     start: a.start,
     end: a.end,
     type: a.type,                                                         // "โรงพยาบาล" | "บ้านผู้ป่วย"
     place: a.type === 'บ้านผู้ป่วย' ? (a.place || 'บ้านผู้ป่วย') : '',
     hospital_address: a.type === 'โรงพยาบาล' ? (a.hospital_address || a.place || '') : '',
     status: a.status,
     note: a.note,
   });
   setErrors({});
   setOpen(true);
 };

  const save = async () => {
    const errs = validate(form); setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.fire({ icon: 'warning', title: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
      return;
    }
    

    const t = TYPE_VALUE_FROM_LABEL(form.type || (form.hospital_address ? 'โรงพยาบาล' : 'บ้านผู้ป่วย'));
    const base = {
      hn: (form.hn || '').trim(),
      appointment_date: form.date!,
      start_time: form.start!,
      end_time: form.end!,
      appointment_type: t,                // << home | hospital
      status: (form.status as Status) || 'pending',
      note: (form.note || '').trim() || null,
    };
    const payload =
      t === 'hospital'
        ? { ...base, hospital_address: (form.hospital_address || '').trim() }
        : { ...base, place: (form.place || 'บ้านผู้ป่วย').trim(), hospital_address: null };

    try {
      await withLoading(
        () => editingId
          ? http(`/api/appointments/${encodeURIComponent(editingId)}`, {
              method: 'PATCH',
              body: JSON.stringify(payload),
            })
          : http(`/api/appointments`, {
              method: 'POST',
              body: JSON.stringify({ ...payload }),
            }),
        {
          title: editingId ? 'กำลังบันทึกการแก้ไข...' : 'กำลังบันทึกนัดหมาย...',
          success: editingId ? 'บันทึกการแก้ไขแล้ว' : 'บันทึกนัดหมายแล้ว',
          error: 'บันทึกไม่สำเร็จ(มีผู้ป่วยนัดหมายช่วงเวลานี้แล้ว)',
        }
      );
      setOpen(false); setEditingId(null); setForm(resetForm());
      fetchList();
    } catch {}
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!historyFor) return;
      setHistoryLoading(true); setHistoryErr(''); setHistoryList([]);
      try {
        const params = new URLSearchParams({
          q: historyFor.hn,
          status: 'all',
          sort: 'datetime',
          dir: 'desc',
          page: '1',
          limit: '500',
        });
        const data = await http<{ data: ApiRow[] }>(`/api/appointments?${params.toString()}`);
        if (!alive) return;
        setHistoryList((data.data || []).map(mapRow));
      } catch (e: any) {
        if (!alive) return;
        setHistoryErr(e?.message || 'โหลดประวัติไม่สำเร็จ');
        toast.fire({ icon: 'error', title: e?.message || 'โหลดประวัติไม่สำเร็จ' });
      } finally {
        if (alive) setHistoryLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [historyFor]);

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end   = Math.min(totalCount, page * pageSize);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.title}>การนัดหมาย</div>
          <div className={styles.subtitle}>
            รายการนัดหมายทั้งหมดในแผนก
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.primary} onClick={startCreate}>+ สร้างนัดหมาย</button>
          <div className={styles.segment}>
            <button className={view === 'table' ? styles.segmentActive : ''} onClick={() => setView('table')} type="button">ตาราง</button>
            <button className={view === 'cards' ? styles.segmentActive : ''} onClick={() => setView('cards')} type="button">การ์ด</button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <section className={styles.kpis}>
        <div className={styles.kpi}><div className={styles.kpiLabel}>ทั้งหมด</div><div className={styles.kpiValue}>{counts.total}</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>วันนี้</div><div className={styles.kpiValue}>{counts.today}</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>รอดำเนินการ</div><div className={styles.kpiValue}>{counts.pending}</div></div>
      </section>

      {/* Filters */}
      <form className={`${styles.filters} ${styles.stickyToolbar}`} onSubmit={(e) => e.preventDefault()}>
        <input
          className={`${styles.input} ${styles.search}`}
          placeholder="ค้นหา: ชื่อผู้ป่วย / HN / ประเภท / สถานที่"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => q && toast.fire({ icon: 'info', title: 'กำลังค้นหา...' })}
        />
        <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="all">สถานะทั้งหมด</option>
          <option value="pending">รอดำเนินการ</option>
          <option value="done">เสร็จสิ้น</option>
          <option value="cancelled">ยกเลิก</option>
        </select>

        <label className={styles.inline}>จาก
          <DatePickerField value={from} onChange={(v) => setFrom(v)} />
        </label>
        <label className={styles.inline}>ถึง
          <DatePickerField value={to} onChange={(v) => setTo(v)} />
        </label>

        <select className={styles.select} value={sortKey} onChange={(e) => setSortKey(e.target.value as any)} aria-label="เรียงตาม">
          <option value="datetime">เรียงตาม: วัน–เวลา</option>
          <option value="created">เรียงตาม: เลขนัด</option>
          <option value="patient">เรียงตาม: ชื่อผู้ป่วย</option>
          <option value="hn">เรียงตาม: HN</option>
          <option value="status">เรียงตาม: สถานะ</option>
          <option value="type">เรียงตาม: ประเภท</option>
          <option value="place">เรียงตาม: สถานที่</option>
        </select>
        <select className={styles.select} value={sortDir} onChange={(e) => setSortDir(e.target.value as any)} aria-label="ทิศทาง">
          <option value="desc">ใหม่ → เก่า</option>
          <option value="asc">เก่า → ใหม่</option>
        </select>

        <button
          type="button"
          className={styles.ghost}
          onClick={() => {
            setQ(''); setStatus('all'); setFrom(''); setTo('');
            setSortKey('datetime'); setSortDir('desc');
            toast.fire({ icon: 'info', title: 'ล้างตัวกรองแล้ว' });
          }}
        >
          ล้างตัวกรอง
        </button>
      </form>

      {/* banners */}
      {err && <div className={`${styles.banner} ${styles.bannerError}`}>{err}</div>}
      {!err && loading && (
        <div className={`${styles.banner} ${styles.bannerInfo}`}>
          <span className={styles.spinner}></span> กำลังโหลดข้อมูล...
        </div>
      )}

      {/* Controls */}
      <div className={styles.listToolbar}>
        <div className={styles.inline}>
          แสดงต่อหน้า:
          <select
            className={styles.select}
            value={pageSize}
            onChange={(e) => {
              const v = Number(e.target.value) as 10|25|50;
              setPageSize(v);
              toast.fire({ icon: 'info', title: `แสดง ${v} รายการ/หน้า` });
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className={styles.grow} />
      </div>

      {/* View */}
      {view === 'table' ? (
        <div className={`${styles.tableWrap} ${density === 'compact' ? styles.compact : ''}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>เลขนัด</th><th>ผู้ป่วย</th><th>วัน-เวลา</th><th>ประเภท/สถานที่</th><th>สถานะ</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(a => (
                <React.Fragment key={a.id}>
                  <tr>
                    <td className={`${styles.mono} ${styles.cellEllipsis}`}>{a.id}</td>
                    <td className={styles.cellEllipsis}>
                      <div className={styles.patient}>
                        <div className={styles.name}>{highlight(a.patient, q)}</div>
                        <div className={styles.sub}>{highlight(a.hn, q)}</div>
                      </div>
                    </td>
                    <td className={styles.cellEllipsis}>
                      {TH_DATE(a.date)}<div className={styles.sub}>{a.start}–{a.end}</div>
                    </td>
                    <td className={styles.cellEllipsis}>
                      {highlight(a.type, q)}<div className={styles.sub}>{highlight(a.place, q)}</div>
                    </td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className={styles.actionsCell}>
                      <button className={styles.ghost} type="button" onClick={() => setHistoryFor({ hn: a.hn, name: a.patient })}><ClipboardList size={14}/>ประวัติ</button>
                      <button className={styles.ghost} type="button" onClick={() => toggleRow(a.id)} aria-expanded={openRowId === a.id}><Eye size={14}/>{openRowId === a.id ? 'ซ่อน' : 'ตรวจสอบ'}</button>
                      <button className={styles.ghost} type="button" onClick={() => startEdit(a)}><Pencil size={14}/>แก้ไข</button>

                      {a.status === 'pending' && (
                        <>
                          <button className={styles.primary} type="button" onClick={() => handleStatus(a.id, 'done')} disabled={savingId === a.id}><CheckCircle width={14} height={14} />เสร็จสิ้น</button>
                          <button className={styles.danger} type="button" onClick={() => handleStatus(a.id, 'cancelled')} disabled={savingId === a.id}><X width={14} height={14} />ยกเลิก</button>
                        </>
                      )}

                      <button className={styles.danger} type="button" onClick={() => confirmDelete(a.id)}>ลบ</button>
                    </td>
                  </tr>
                  {openRowId === a.id && (
                    <tr className={styles.detailRow}><td colSpan={6}>
                      <div className={styles.detailWrap}>
                        <div className={styles.detailGrid}>
                          <div><div className={styles.detailLabel}>วันที่/เวลา</div><div className={styles.detailValue}>{TH_DATE(a.date)} · {a.start}–{a.end}</div></div>
                          <div><div className={styles.detailLabel}>ประเภท</div><div className={styles.detailValue}>{a.type}</div></div>
                          <div><div className={styles.detailLabel}>สถานที่</div><div className={styles.detailValue}>{a.place}</div></div>
                          <div><div className={styles.detailLabel}>สถานะ</div><div className={styles.detailValue}><StatusBadge status={a.status} /></div></div>
                          {a.phone && (<div><div className={styles.detailLabel}>เบอร์โทร</div><div className={styles.detailValue}>{a.phone}</div></div>)}
                        </div>
                        {a.note && (<div className={styles.detailNote}><div className={styles.detailLabel}>หมายเหตุ</div><div>{a.note}</div></div>)}
                        <div className={styles.detailActions}>
                          <button className={styles.ghost} type="button" onClick={() => setOpenRowId(null)}>ปิดรายละเอียด</button>
                          <button className={styles.primary} type="button" onClick={() => startEdit(a)}>แก้ไขนัดหมาย</button>
                          {a.status === 'pending' && (
                            <>
                              <button className={styles.primary} type="button" onClick={() => handleStatus(a.id, 'done')} disabled={savingId === a.id}>เสร็จสิ้น</button>
                              <button className={styles.danger} type="button" onClick={() => handleStatus(a.id, 'cancelled')} disabled={savingId === a.id}>ยกเลิก</button>
                            </>
                          )}
                          <button className={styles.danger} type="button" onClick={() => confirmDelete(a.id)}>ลบ</button>
                        </div>
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}

              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>ไม่มีข้อมูลการนัดหมายในช่วงที่เลือก</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className={`${styles.cards} ${density === 'compact' ? styles.compact : ''}`}>
            {items.map(a => (
              <div className={styles.card} key={a.id}>
                <div className={styles.cardHeader}><span className={styles.mono}>{a.id}</span><StatusBadge status={a.status} /></div>
                <div className={styles.cardRow}><strong className={styles.cellEllipsis}>{a.patient}</strong><span className={styles.sub}>{a.hn}</span></div>
                <div className={styles.cardRow}>{TH_DATE(a.date)} · {a.start}–{a.end}</div>
                <div className={styles.cardRow}>{a.type} · {a.place}</div>
                {openCards.has(a.id) && (
                  <div className={styles.cardDetail}>
                    {a.phone && (<div className={styles.cardDetailRow}><span className={styles.detailLabel}>เบอร์โทร</span><span>{a.phone}</span></div>)}
                    {a.note && (<div className={styles.cardDetailRow}><span className={styles.detailLabel}>หมายเหตุ</span><div className={styles.cardNote}>{a.note}</div></div>)}
                  </div>
                )}
                <div className={styles.cardActions}>
                  <button className={styles.ghost} type="button" onClick={() => setHistoryFor({ hn: a.hn, name: a.patient })}>ประวัติ</button>
                  <button className={styles.ghost} type="button" onClick={() => toggleCard(a.id)}>{openCards.has(a.id) ? 'ซ่อน' : 'ดู'}</button>
                  <button className={styles.ghost} type="button" onClick={() => startEdit(a)}>แก้ไข</button>
                  {a.status === 'pending' && (
                    <>
                      <button className={styles.primary} type="button" onClick={() => handleStatus(a.id, 'done')} disabled={savingId === a.id}>เสร็จสิ้น</button>
                      <button className={styles.danger} type="button" onClick={() => handleStatus(a.id, 'cancelled')} disabled={savingId === a.id}>ยกเลิก</button>
                    </>
                  )}
                  <button className={styles.danger} type="button" onClick={() => confirmDelete(a.id)}>ลบ</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Pager page={page} pageCount={pageCount} onPage={setPage} start={start} end={end} total={totalCount} />

      {open && (
        <Modal
          open={open}
          size="lg"
          initialFocusSelector="input,select,textarea"
          onClose={() => { setOpen(false); setEditingId(null); }}
          onConfirm={save}
          title={
            <div className="flex items-center gap-2">
              {editingId ? <Edit3 size={20} className="text-purple-600"/> : <CalendarPlus size={20} className="text-purple-600"/>}
              <span>{editingId ? 'แก้ไขนัดหมาย' : 'เพิ่มการนัดหมาย'}</span>
            </div>
          }
          footer={
            <div className="w-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="order-2 sm:order-1 text-sm text-gray-500 flex items-center gap-1 justify-center sm:justify-start">
                <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Enter</kbd><span>บันทึก</span>
                <span className="mx-2">•</span>
                <kbd className="px-2 py-1 text-xs bg-gray-100 border rounded">Esc</kbd><span>ปิด</span>
              </div>

              <div className="order-1 sm:order-2 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  className="w-full sm:w-auto px-4 sm:px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2"
                  onClick={() => { setOpen(false); setEditingId(null); toast.fire({ icon: 'info', title: 'ยกเลิกการแก้ไข' }); }}
                >
                  <X size={16}/> ยกเลิก
                </button>
                <button
                  type="button"
                  className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200 shadow-lg flex items-center gap-2"
                  onClick={save}
                  disabled={!isValid}
                >
                  <CalendarPlus size={16}/> {editingId ? 'บันทึกการแก้ไข' : 'บันทึกนัดหมาย'}
                </button>
              </div>
            </div>
          }
        >

          <AppointmentForm
            value={form}
            onChange={setForm}
            errors={errors}
            TYPE_OPTIONS={TYPE_OPTIONS}
            PLACE_OPTIONS={PLACE_OPTIONS}
          />
        </Modal>
      )}

      {historyFor && (
        <Modal
          open
          title={
            <div className="flex items-center gap-2">
              <ClipboardList size={20} className="text-blue-600" />
              ประวัติการนัดหมาย — {historyFor.name} <span className="text-gray-500 text-sm">({historyFor.hn})</span>
            </div>
          }
          size="xl"                                // เหมือนหน้า treatment
          bodyClassName="max-h-[80vh] overflow-y-auto" // เนื้อหาภายใน scroll ได้
          onClose={() => setHistoryFor(null)}
          onConfirm={() => setHistoryFor(null)}
          footer={
            <div className="w-full flex justify-center">
              <button
                className="px-8 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg flex items-center gap-2"
                onClick={() => setHistoryFor(null)}
              >
                <X size={16}/> ปิด
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* แบนเนอร์ข้อมูลผู้ป่วย (สไตล์ใกล้เคียง treatment) */}
            <div className="p-6 rounded-2xl border bg-gradient-to-br from-blue-50 via-white to-indigo-50 border-blue-200 space-y-4 shadow-sm">
              <div className="flex items-center gap-4 pb-4 border-b border-blue-200">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-xl shadow">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-mono px-4 py-2 bg-white rounded-xl border-2 border-blue-200 text-blue-700">
                    {historyFor.hn}
                  </div>
                  <div className="font-bold text-lg text-gray-800">{historyFor.name || '-'}</div>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                ประวัติการนัดหมายทั้งหมดของผู้ป่วยรายนี้
              </div>
            </div>

            {/* สถานะโหลด/ข้อผิดพลาด */}
            {historyLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="animate-spin inline-block w-4 h-4 rounded-full border-2 border-gray-300 border-t-transparent"></span>
                กำลังโหลด...
              </div>
            )}
            {!historyLoading && historyErr && (
              <div className="text-sm text-red-600">{historyErr}</div>
            )}
            {!historyLoading && !historyErr && historyList.length === 0 && (
              <div className="text-sm text-gray-500">ไม่มีประวัติ</div>
            )}

            {/* รายการประวัติ (list แบบอ่านง่าย + responsive) */}
            {!historyLoading && !historyErr && historyList.length > 0 && (
              <ul className="divide-y divide-gray-200">
                {historyList.map(h => (
                  <li key={h.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm text-gray-700">
                          {TH_DATE(h.date)} · {h.start}–{h.end}
                        </div>
                        <div className="text-[15px] font-medium text-gray-900">
                          {h.type} · {h.place}
                        </div>
                        {h.phone && (
                          <div className="text-sm text-gray-600">โทร: {h.phone}</div>
                        )}
                        {h.note && (
                          <div className="mt-1 text-sm text-gray-700">
                            <span className="text-gray-500">หมายเหตุ:</span> {h.note}
                          </div>
                        )}
                      </div>
                      <StatusBadge status={h.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
