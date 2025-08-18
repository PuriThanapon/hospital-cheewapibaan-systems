'use client';

import React, { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';

type Status = 'pending' | 'checked' | 'done' | 'cancelled';

type Appointment = {
  id: string;
  patient: string;
  hn: string;
  phone?: string;
  date: string;   // YYYY-MM-DD
  start: string;  // HH:mm
  end: string;    // HH:mm
  type: string;   // ประเภทนัด
  place: string;  // สถานที่
  provider: string; // ผู้รับผิดชอบ
  status: Status;
  note?: string;
};

// ---------- Validation ----------
type FormErrors = Partial<Record<keyof Appointment, string>>;
const REQUIRED: (keyof Appointment)[] = ['patient', 'hn', 'date', 'start', 'end', 'type', 'provider'];

function validate(f: Partial<Appointment>): FormErrors {
  const e: FormErrors = {};
  const get = (k: keyof Appointment) => (f[k]?.toString().trim() ?? '');
  for (const k of REQUIRED) if (!get(k)) e[k] = 'จำเป็น';
  const s = get('start');
  const ed = get('end');
  if (s && ed && ed <= s) e.end = 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม';
  if (f.phone && !/^[0-9+\-() ]{6,}$/.test(f.phone)) e.phone = 'รูปแบบเบอร์ไม่ถูกต้อง';
  return e;
}

// ---------- Mock data ----------
const MOCK_APPOINTMENTS: Appointment[] = [
  { id:'AP-0001', patient:'สมพร แซ่ลิ้ม', hn:'HN001234', phone:'089-123-4567', date:'2025-08-13', start:'09:00', end:'09:30', type:'ตรวจติดตาม', place:'OPD ชีวาภิบาล', provider:'พยาบาลศิริพร', status:'pending', note:'ประเมินแผลกดทับ' },
  { id:'AP-0002', patient:'บุญช่วย สุขดี', hn:'HN001235', phone:'081-555-0001', date:'2025-08-13', start:'10:00', end:'10:30', type:'ทำแผล', place:'ห้องทำแผล 2', provider:'พยาบาลอารีย์', status:'checked' },
  { id:'AP-0003', patient:'อารีย์ ใจงาม', hn:'HN001236', date:'2025-08-13', start:'13:30', end:'14:00', type:'เยี่ยมบ้าน', place:'บ้านผู้ป่วย', provider:'นักกายภาพนที', status:'pending', note:'เตียงผู้ป่วยชั้น 2' },
  { id:'AP-0004', patient:'สมจิตร แสนดี', hn:'HN001237', date:'2025-08-14', start:'08:30', end:'09:00', type:'กายภาพบำบัด', place:'PT Room A', provider:'นักกายภาพมุก', status:'done' },
  { id:'AP-0005', patient:'ทวีศักดิ์ มาไว', hn:'HN001238', date:'2025-08-14', start:'11:00', end:'11:30', type:'ติดตามอาการ', place:'OPD ชีวาภิบาล', provider:'พยาบาลศิริพร', status:'cancelled', note:'เลื่อนเพราะครอบครัวติดธุระ' },
  { id:'AP-0006', patient:'ชุติมา มานะ', hn:'HN001239', date:'2025-08-15', start:'09:30', end:'10:00', type:'ตรวจติดตาม', place:'OPD ชีวาภิบาล', provider:'แพทย์ธนา', status:'pending' },
  { id:'AP-0007', patient:'พิสมัย มาเยือน', hn:'HN001240', date:'2025-08-15', start:'14:00', end:'14:30', type:'เยี่ยมบ้าน', place:'บ้านผู้ป่วย', provider:'พยาบาลอารีย์', status:'pending' },
  { id:'AP-0008', patient:'วรางคณา อ่อนหวาน', hn:'HN001241', date:'2025-08-16', start:'10:00', end:'10:30', type:'ทำแผล', place:'ห้องทำแผล 1', provider:'พยาบาลพิณ', status:'done' },
  // duplicate samples
  { id:'AP-0009',  patient:'สมพร แซ่ลิ้ม', hn:'HN001234', phone:'089-123-4567', date:'2025-08-13', start:'09:00', end:'09:30', type:'ตรวจติดตาม', place:'OPD ชีวาภิบาล', provider:'พยาบาลศิริพร', status:'pending', note:'ประเมินแผลกดทับ' },
  { id:'AP-0010', patient:'บุญช่วย สุขดี', hn:'HN001235', phone:'081-555-0001', date:'2025-08-13', start:'10:00', end:'10:30', type:'ทำแผล', place:'ห้องทำแผล 2', provider:'พยาบาลอารีย์', status:'checked' },
  { id:'AP-0011', patient:'อารีย์ ใจงาม', hn:'HN001236', date:'2025-08-13', start:'13:30', end:'14:00', type:'เยี่ยมบ้าน', place:'บ้านผู้ป่วย', provider:'นักกายภาพนที', status:'pending', note:'เตียงผู้ป่วยชั้น 2' },
  { id:'AP-0012', patient:'สมจิตร แสนดี', hn:'HN001237', date:'2025-08-14', start:'08:30', end:'09:00', type:'กายภาพบำบัด', place:'PT Room A', provider:'นักกายภาพมุก', status:'done' },
  { id:'AP-0013', patient:'ทวีศักดิ์ มาไว', hn:'HN001238', date:'2025-08-14', start:'11:00', end:'11:30', type:'ติดตามอาการ', place:'OPD ชีวาภิบาล', provider:'พยาบาลศิริพร', status:'cancelled', note:'เลื่อนเพราะครอบครัวติดธุระ' },
  { id:'AP-0014', patient:'ชุติมา มานะ', hn:'HN001239', date:'2025-08-15', start:'09:30', end:'10:00', type:'ตรวจติดตาม', place:'OPD ชีวาภิบาล', provider:'แพทย์ธนา', status:'pending' },
  { id:'AP-0015', patient:'พิสมัย มาเยือน', hn:'HN001240', date:'2025-08-15', start:'14:00', end:'14:30', type:'เยี่ยมบ้าน', place:'บ้านผู้ป่วย', provider:'พยาบาลอารีย์', status:'pending' },
  { id:'AP-0016', patient:'วรางคณา อ่อนหวาน', hn:'HN001241', date:'2025-08-16', start:'10:00', end:'10:30', type:'ทำแผล', place:'ห้องทำแผล 1', provider:'พยาบาลพิณ', status:'done' },
];

const TH_DATE = (d: string) =>
  new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(d));

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; className: string }> = {
    pending:   { label: 'รอดำเนินการ', className: styles.badgePending },
    checked:   { label: 'มาตามนัด',   className: styles.badgeChecked },
    done:      { label: 'เสร็จสิ้น',   className: styles.badgeDone },
    cancelled: { label: 'ยกเลิก',      className: styles.badgeCancelled },
  };
  return <span className={`${styles.badge} ${map[status].className}`}>{map[status].label}</span>;
}

// ---------- Helper & options ----------
type PatientMini = { name: string; hn: string; phone?: string };
const TYPE_OPTIONS = ['ตรวจติดตาม','ทำแผล','เยี่ยมบ้าน','กายภาพบำบัด','ติดตามอาการ'];
const PLACE_OPTIONS = ['OPD ชีวาภิบาล','ห้องทำแผล 1','ห้องทำแผล 2','PT Room A','บ้านผู้ป่วย'];

// escape RegExp for highlight
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const highlight = (text: string, q: string) => {
  const t = text ?? '';
  const query = (q || '').trim();
  if (!query) return t;
  const re = new RegExp(`(${esc(query)})`, 'i');
  const parts = t.split(re);
  return parts.map((p, i) => i % 2 === 1 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>);
};

// ---------- Pagination component ----------
function Pager({
  page, pageCount, onPage, start, end, total,
}: {
  page: number; pageCount: number; onPage: (p:number)=>void;
  start: number; end: number; total: number;
}) {
  const go = (p: number) => onPage(Math.min(pageCount, Math.max(1, p)));
  const btns: number[] = [];
  const from = Math.max(1, page - 2);
  const to = Math.min(pageCount, page + 2);
  for (let i = from; i <= to; i++) btns.push(i);
  return (
    <div className={styles.pager}>
      <button className={styles.ghost} onClick={() => go(1)} disabled={page === 1}>« แรก</button>
      <button className={styles.ghost} onClick={() => go(page - 1)} disabled={page === 1}>‹ ก่อนหน้า</button>
      <div className={styles.pagerNums}>
        {btns.map(n => (
          <button key={n}
            className={`${styles.pageBtn} ${n === page ? styles.pageActive : ''}`}
            onClick={() => go(n)}
          >{n}</button>
        ))}
      </div>
      <button className={styles.ghost} onClick={() => go(page + 1)} disabled={page === pageCount}>ถัดไป ›</button>
      <button className={styles.ghost} onClick={() => go(pageCount)} disabled={page === pageCount}>สุดท้าย »</button>
      <div className={styles.pagerInfo}>แสดง {start}–{end} จาก {total}</div>
    </div>
  );
}

export default function AppointmentsPage() {
  const [items, setItems] = useState<Appointment[]>(MOCK_APPOINTMENTS);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | Status>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [view, setView] = useState<'table' | 'cards'>('table');

  // ---- Sorting
  const [sortKey, setSortKey] = useState<
    'datetime' | 'created' | 'patient' | 'hn' | 'provider' | 'status' | 'type' | 'place'
  >('datetime');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // --- Pagination & Density ---
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10);
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  useEffect(() => { setPage(1); }, [q, status, from, to, sortKey, sortDir, view]);

  // Modal & form (create/edit)
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const resetForm = () => ({ date: new Date().toISOString().slice(0, 10), start: '09:00', end: '09:30', status: 'pending' as Status });
  const [form, setForm] = useState<Partial<Appointment>>(resetForm());

  const [errors, setErrors] = useState<FormErrors>({});
  const isValid = useMemo(() => Object.keys(validate(form)).length === 0, [form]);

  // Filters
  const filteredOnly = useMemo(() =>
    items.filter((a) => {
      const text = (a.patient + a.hn + a.provider + a.type + a.place).toLowerCase();
      const okText = q ? text.includes(q.toLowerCase()) : true;
      const okStatus = status === 'all' ? true : a.status === status;
      const okFrom = from ? a.date >= from : true;
      const okTo = to ? a.date <= to : true;
      return okText && okStatus && okFrom && okTo;
    })
  , [items, q, status, from, to]);

  // Sort
  const sorted = useMemo(() => {
    const collator = new Intl.Collator('th', { sensitivity: 'base', numeric: true });
    const numId = (id: string) => parseInt(id.replace(/[^\d]/g, ''), 10) || 0;
    const statusOrder: Status[] = ['pending','checked','done','cancelled'];

    const cmp = (a: Appointment, b: Appointment) => {
      let v = 0;
      switch (sortKey) {
        case 'datetime': v = (a.date + a.start).localeCompare(b.date + b.start); break;
        case 'created': v = numId(a.id) - numId(b.id); break;
        case 'patient': v = collator.compare(a.patient, b.patient); break;
        case 'hn':      v = collator.compare(a.hn, b.hn); break;
        case 'provider':v = collator.compare(a.provider, b.provider); break;
        case 'status':  v = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status); break;
        case 'type':    v = collator.compare(a.type, b.type); break;
        case 'place':   v = collator.compare(a.place, b.place); break;
      }
      if (v === 0) {
        v = (b.date + b.start).localeCompare(a.date + a.start);
        if (v === 0) v = numId(b.id) - numId(a.id);
      }
      return sortDir === 'asc' ? v : -v;
    };

    return [...filteredOnly].sort(cmp);
  }, [filteredOnly, sortKey, sortDir]);

  // Pagination slice
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(sorted.length, startIdx + pageSize);
  const paged = useMemo(() => sorted.slice(startIdx, endIdx), [sorted, startIdx, endIdx]);

  const counts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return { total: items.length, today: items.filter(i => i.date === today).length, pending: items.filter(i => i.status === 'pending').length };
  }, [items]);

  // Typeahead
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
    setForm(f => ({ ...f, patient: p.name, hn: p.hn, phone: p.phone }));
    setErrors(validate({ ...form, patient: p.name, hn: p.hn }));
    setPatOpen(false);
  };

  // Row details & Cards toggle
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const toggleRow = (id: string) => setOpenRowId(prev => prev === id ? null : id);

  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const toggleCard = (id: string) => setOpenCards(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Create / Edit
  const startCreate = () => { setEditingId(null); setForm(resetForm()); setErrors({}); setOpen(true); };
  const startEdit = (a: Appointment) => { setEditingId(a.id); setForm({ ...a }); setErrors({}); setOpen(true); };

  const save = () => {
    const errs = validate(form); setErrors(errs); if (Object.keys(errs).length > 0) return;
    const overlap = items.some(i => i.date === form.date && i.id !== editingId && !((form.end as string) <= i.start || (form.start as string) >= i.end));
    if (overlap) { setErrors(prev => ({ ...prev, start: 'ชนกับนัดอื่น', end: 'ชนกับนัดอื่น' })); return; }

    const trim = (s?: string) => (s ?? '').trim();
    const base: Appointment = {
      id: editingId ?? ('AP-' + String(items.length + 1).padStart(4, '0')),
      patient: trim(form.patient),
      hn: trim(form.hn),
      phone: trim(form.phone),
      date: form.date!, start: form.start!, end: form.end!,
      type: trim(form.type),
      place: trim(form.place) || 'OPD ชีวาภิบาล',
      provider: trim(form.provider),
      status: (form.status as Status) || 'pending',
      note: trim(form.note),
    };

    if (editingId) setItems(prev => prev.map(i => i.id === editingId ? base : i));
    else setItems(prev => [base, ...prev]);

    setOpen(false); setEditingId(null); setForm(resetForm());
  };

  // Delete
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const startDelete = (id: string) => setConfirmDelId(id);
  const doDelete = () => {
    if (!confirmDelId) return;
    setItems(prev => prev.filter(i => i.id !== confirmDelId));
    setOpenRowId(prev => (prev === confirmDelId ? null : prev));
    setOpenCards(prev => { const n = new Set(prev); n.delete(confirmDelId); return n; });
    if (editingId === confirmDelId) { setOpen(false); setEditingId(null); }
    setConfirmDelId(null);
  };

  // History
  const [historyFor, setHistoryFor] = useState<{ hn: string; name: string } | null>(null);
  const historyList = useMemo(() => {
    if (!historyFor) return [] as Appointment[];
    return [...items.filter(i => i.hn === historyFor.hn)]
      .sort((a,b) => (b.date + b.start).localeCompare(a.date + a.start));
  }, [items, historyFor]);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1>การนัดหมาย</h1>
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
          placeholder="ค้นหา: ชื่อผู้ป่วย / HN / ผู้รับผิดชอบ / ประเภท / สถานที่"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="all">สถานะทั้งหมด</option>
          <option value="pending">รอดำเนินการ</option>
          <option value="checked">มาตามนัด</option>
          <option value="done">เสร็จสิ้น</option>
          <option value="cancelled">ยกเลิก</option>
        </select>
        <label className={styles.inline}>จาก <input type="date" className={styles.input} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className={styles.inline}>ถึง <input type="date" className={styles.input} value={to} onChange={(e) => setTo(e.target.value)} /></label>

        <select className={styles.select} value={sortKey} onChange={(e) => setSortKey(e.target.value as any)} aria-label="เรียงตาม">
          <option value="datetime">เรียงตาม: วัน–เวลา</option>
          <option value="created">เรียงตาม: เลขนัด</option>
          <option value="patient">เรียงตาม: ชื่อผู้ป่วย</option>
          <option value="hn">เรียงตาม: HN</option>
          <option value="provider">เรียงตาม: ผู้รับผิดชอบ</option>
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
          }}
        >
          ล้างตัวกรอง
        </button>
      </form>

      {/* Controls (Page size / Density / Pager) */}
      <div className={styles.listToolbar}>
        <div className={styles.inline}>
          แสดงต่อหน้า:
          <select
            className={styles.select}
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) as any)}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className={styles.inline}>
          ความหนาแน่น:
          <select
            className={styles.select}
            value={density}
            onChange={(e) => setDensity(e.target.value as any)}
          >
            <option value="comfortable">ปกติ</option>
            <option value="compact">กระชับ</option>
          </select>
        </div>
        <div className={styles.grow} />
        <Pager
          page={page} pageCount={pageCount} onPage={setPage}
          start={sorted.length === 0 ? 0 : startIdx + 1}
          end={endIdx} total={sorted.length}
        />
      </div>

      {/* View */}
      {view === 'table' ? (
        <div className={`${styles.tableWrap} ${density === 'compact' ? styles.compact : ''}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>เลขนัด</th><th>ผู้ป่วย</th><th>วัน-เวลา</th><th>ประเภท/สถานที่</th><th>ผู้รับผิดชอบ</th><th>สถานะ</th><th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map(a => (
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
                    <td className={styles.cellEllipsis}>{highlight(a.provider, q)}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className={styles.actionsCell}>
                      <button className={styles.ghost} type="button" onClick={() => setHistoryFor({ hn: a.hn, name: a.patient })}>ประวัติ</button>
                      <button className={styles.ghost} type="button" onClick={() => toggleRow(a.id)} aria-expanded={openRowId === a.id}>{openRowId === a.id ? 'ซ่อน' : 'ดู'}</button>
                      <button className={styles.ghost} type="button" onClick={() => startEdit(a)}>แก้ไข</button>
                      <button className={styles.danger} type="button" onClick={() => startDelete(a.id)}>ลบ</button>
                    </td>
                  </tr>
                  {openRowId === a.id && (
                    <tr className={styles.detailRow}><td colSpan={7}>
                      <div className={styles.detailWrap}>
                        <div className={styles.detailGrid}>
                          <div><div className={styles.detailLabel}>วันที่/เวลา</div><div className={styles.detailValue}>{TH_DATE(a.date)} · {a.start}–{a.end}</div></div>
                          <div><div className={styles.detailLabel}>ประเภท</div><div className={styles.detailValue}>{a.type}</div></div>
                          <div><div className={styles.detailLabel}>สถานที่</div><div className={styles.detailValue}>{a.place}</div></div>
                          <div><div className={styles.detailLabel}>ผู้รับผิดชอบ</div><div className={styles.detailValue}>{a.provider}</div></div>
                          <div><div className={styles.detailLabel}>สถานะ</div><div className={styles.detailValue}><StatusBadge status={a.status} /></div></div>
                          {a.phone && (<div><div className={styles.detailLabel}>เบอร์โทร</div><div className={styles.detailValue}>{a.phone}</div></div>)}
                        </div>
                        {a.note && (<div className={styles.detailNote}><div className={styles.detailLabel}>หมายเหตุ</div><div>{a.note}</div></div>)}
                        <div className={styles.detailActions}>
                          <button className={styles.ghost} type="button" onClick={() => setOpenRowId(null)}>ปิดรายละเอียด</button>
                          <button className={styles.primary} type="button" onClick={() => startEdit(a)}>แก้ไขนัดหมาย</button>
                          <button className={styles.danger} type="button" onClick={() => startDelete(a.id)}>ลบ</button>
                        </div>
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}

              {paged.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.emptyCell}>
                    ไม่มีข้อมูลการนัดหมายในช่วงที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pager (ล่างตาราง) */}
          <Pager
            page={page} pageCount={pageCount} onPage={setPage}
            start={sorted.length === 0 ? 0 : startIdx + 1}
            end={endIdx} total={sorted.length}
          />
        </div>
      ) : (
        <>
          <div className={`${styles.cards} ${density === 'compact' ? styles.compact : ''}`}>
            {paged.map(a => (
              <div className={styles.card} key={a.id}>
                <div className={styles.cardHeader}><span className={styles.mono}>{a.id}</span><StatusBadge status={a.status} /></div>
                <div className={styles.cardRow}><strong className={styles.cellEllipsis}>{a.patient}</strong><span className={styles.sub}>{a.hn}</span></div>
                <div className={styles.cardRow}>{TH_DATE(a.date)} · {a.start}–{a.end}</div>
                <div className={styles.cardRow}>{a.type} · {a.place}</div>
                <div className={styles.cardRow}>ผู้รับผิดชอบ: {a.provider}</div>
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
                  <button className={styles.danger} type="button" onClick={() => startDelete(a.id)}>ลบ</button>
                </div>
              </div>
            ))}
          </div>

          {/* ✅ Pager (ล่างการ์ด — อยู่นอก .cards เพื่อให้อยู่ใต้กริดเสมอ) */}
          <Pager
            page={page} pageCount={pageCount} onPage={setPage}
            start={sorted.length === 0 ? 0 : startIdx + 1}
            end={endIdx} total={sorted.length}
          />
        </>
      )}

      {/* Create/Edit Modal */}
      {open && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>{editingId ? 'แก้ไขนัดหมาย' : 'สร้างนัดหมาย'}</h3>
              <button className={styles.iconBtn} onClick={() => { setOpen(false); setEditingId(null); }} aria-label="close" type="button">×</button>
            </div>

            <div className={styles.formGrid}>
              {/* ผู้ป่วย (Typeahead) */}
              <label className={styles.span2}>
                ผู้ป่วย
                <div className={styles.comboWrap}>
                  <input
                    className={`${styles.input} ${errors.patient ? styles.invalid : ''}`}
                    value={form.patient || ''}
                    onChange={(e) => { const v = e.target.value; setForm(f => ({ ...f, patient: v })); setPatOpen(true); setPatActive(0); }}
                    onFocus={() => setPatOpen(true)}
                    onBlur={() => { setTimeout(() => setPatOpen(false), 120); setErrors(validate(form)); }}
                    onKeyDown={(e) => {
                      if (!patOpen || patSugs.length === 0) return;
                      if (e.key === 'ArrowDown') { e.preventDefault(); setPatActive(i => Math.min(i + 1, patSugs.length - 1)); }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setPatActive(i => Math.max(i - 1, 0)); }
                      else if (e.key === 'Enter') { e.preventDefault(); choosePatient(patSugs[patActive]); }
                      else if (e.key === 'Escape') { setPatOpen(false); }
                    }}
                    placeholder="เช่น สมชาย ใจดี (พิมพ์ HN ก็ได้)" required
                    role="combobox" aria-expanded={patOpen && patSugs.length > 0} aria-controls="patient-listbox" aria-autocomplete="list"
                  />
                  {patOpen && (
                    <ul id="patient-listbox" role="listbox" className={styles.suggestList}>
                      {patSugs.length === 0 && (
                        <li className={styles.suggestEmpty}>ไม่พบผลลัพธ์</li>
                      )}
                      {patSugs.map((p, idx) => (
                        <li
                          key={p.hn || p.name + idx}
                          role="option"
                          aria-selected={idx === patActive}
                          className={`${styles.suggestItem} ${idx === patActive ? styles.active : ''}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => choosePatient(p)}
                        >
                          <div>
                            <div className={styles.suggestName}>{highlight(p.name, patQuery)}</div>
                            <div className={styles.suggestSub}>{highlight(p.hn, patQuery)}{p.phone ? ` · ${p.phone}` : ''}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {errors.patient && <div className={styles.err}>{errors.patient}</div>}
              </label>

              <label>HN
                <input className={`${styles.input} ${errors.hn ? styles.invalid : ''}`} value={form.hn || ''}
                       onChange={(e) => setForm(f => ({ ...f, hn: e.target.value }))} onBlur={() => setErrors(validate(form))}
                       placeholder="เช่น HN001234" required />
                {errors.hn && <div className={styles.err}>{errors.hn}</div>}
              </label>

              <label>วันที่
                <input type="date" className={`${styles.input} ${errors.date ? styles.invalid : ''}`} value={form.date || ''}
                       onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} onBlur={() => setErrors(validate(form))} required />
                {errors.date && <div className={styles.err}>{errors.date}</div>}
              </label>

              <label>เริ่ม
                <input type="time" className={`${styles.input} ${errors.start ? styles.invalid : ''}`} value={form.start || ''}
                       onChange={(e) => setForm(f => ({ ...f, start: e.target.value }))} onBlur={() => setErrors(validate(form))} required />
                {errors.start && <div className={styles.err}>{errors.start}</div>}
              </label>

              <label>สิ้นสุด
                <input type="time" className={`${styles.input} ${errors.end ? styles.invalid : ''}`} value={form.end || ''}
                       onChange={(e) => setForm(f => ({ ...f, end: e.target.value }))} onBlur={() => setErrors(validate(form))} required />
                {errors.end && <div className={styles.err}>{errors.end}</div>}
              </label>

              <label>ประเภท
                <select className={`${styles.select} ${errors.type ? styles.invalid : ''}`} value={form.type || ''}
                        onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))} onBlur={() => setErrors(validate(form))} required>
                  <option value="">เลือกประเภท</option>
                  {TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                {errors.type && <div className={styles.err}>{errors.type}</div>}
              </label>

              <label>สถานที่
                <select className={styles.select} value={form.place || ''} onChange={(e) => setForm(f => ({ ...f, place: e.target.value }))}>
                  <option value="">เลือกสถานที่</option>
                  {PLACE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </label>

              <label>ผู้รับผิดชอบ
                <input className={`${styles.input} ${errors.provider ? styles.invalid : ''}`} value={form.provider || ''}
                       onChange={(e) => setForm(f => ({ ...f, provider: e.target.value }))} onBlur={() => setErrors(validate(form))}
                       placeholder="ชื่อพยาบาล/แพทย์" required />
                {errors.provider && <div className={styles.err}>{errors.provider}</div>}
              </label>

              <label>สถานะ
                <select className={styles.select} value={(form.status as string) || 'pending'} onChange={(e) => setForm(f => ({ ...f, status: e.target.value as Status }))}>
                  <option value="pending">รอดำเนินการ</option>
                  <option value="checked">มาตามนัด</option>
                  <option value="done">เสร็จสิ้น</option>
                  <option value="cancelled">ยกเลิก</option>
                </select>
              </label>

              <label className={styles.span2}>หมายเหตุ
                <textarea className={styles.textarea} value={form.note || ''} onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))} />
              </label>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.ghost} onClick={() => { setOpen(false); setEditingId(null); }} type="button">ยกเลิก</button>
              <button className={styles.primary} onClick={save} type="button" disabled={!isValid}>{editingId ? 'บันทึกการแก้ไข' : 'บันทึก'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelId && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={`${styles.modal} ${styles.modalSmall}`}>
            <div className={styles.modalHeader}>
              <h3>ลบนัดหมาย?</h3>
              <button className={styles.iconBtn} onClick={() => setConfirmDelId(null)} aria-label="close" type="button">×</button>
            </div>
            <div className={styles.confirmBody}>
              {(() => { const t = items.find(i => i.id === confirmDelId); return (
                <>
                  <div className={styles.confirmLine}><span className={styles.mono}>{t?.id}</span> · {t?.patient} <span className={styles.sub}>({t?.hn})</span></div>
                  <div className={styles.sub}>{t && `${TH_DATE(t.date)} · ${t.start}–${t.end} · ${t.type} @ ${t.place}`}</div>
                  <div className={styles.warn}>การลบนี้เป็นถาวรและไม่สามารถกู้คืนได้</div>
                </>
              ); })()}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.ghost} onClick={() => setConfirmDelId(null)} type="button">ยกเลิก</button>
              <button className={styles.dangerSolid} onClick={doDelete} type="button">ลบ</button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyFor && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={`${styles.modal} ${styles.modalWide}`}>
            <div className={styles.modalHeader}>
              <h3>ประวัติการนัดหมาย — {historyFor.name} <span className={styles.sub}>{historyFor.hn}</span></h3>
              <button className={styles.iconBtn} onClick={() => setHistoryFor(null)} aria-label="close" type="button">×</button>
            </div>
            <div className={styles.historyBody}>
              {historyList.length === 0 ? (
                <div className={styles.sub}>ไม่มีประวัติ</div>
              ) : (
                <ul className={styles.historyList}>
                  {historyList.map(h => (
                    <li key={h.id} className={styles.historyItem}>
                      <div className={styles.historyTop}>
                        <div className={styles.historyWhen}>{TH_DATE(h.date)} · {h.start}–{h.end}</div>
                        <StatusBadge status={h.status} />
                      </div>
                      <div className={styles.historyLine}>{h.type} · {h.place}</div>
                      <div className={styles.historyLine}>ผู้รับผิดชอบ: {h.provider}</div>
                      {h.phone && <div className={styles.historyLine}>โทร: {h.phone}</div>}
                      {h.note && <div className={styles.historyNote}>หมายเหตุ: {h.note}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.ghost} onClick={() => setHistoryFor(null)} type="button">ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}