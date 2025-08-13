'use client';

import React, { useMemo, useState } from 'react';
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
  type: string;   // ประเภทนัด เช่น ตรวจติดตาม/ทำแผล/เยี่ยมบ้าน
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

  // เช็คว่าง
  for (const k of REQUIRED) {
    if (!get(k)) e[k] = 'จำเป็น';
  }

  // เช็คช่วงเวลา
  const s = get('start');
  const ed = get('end');
  if (s && ed && ed <= s) e.end = 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม';

  // เช็คเบอร์ (ถ้ากรอก)
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

export default function AppointmentsPage() {
  const [items, setItems] = useState<Appointment[]>(MOCK_APPOINTMENTS);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | Status>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [view, setView] = useState<'table' | 'cards'>('table');

  // Modal & form
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Appointment>>({
    date: new Date().toISOString().slice(0, 10),
    start: '09:00',
    end: '09:30',
    status: 'pending',
  });

  // Validation state
  const [errors, setErrors] = useState<FormErrors>({});
  const isValid = useMemo(() => Object.keys(validate(form)).length === 0, [form]);

  const filtered = useMemo(() => {
    return items.filter((a) => {
      const text = (a.patient + a.hn + a.provider + a.type + a.place).toLowerCase();
      const okText = q ? text.includes(q.toLowerCase()) : true;
      const okStatus = status === 'all' ? true : a.status === status;
      const okFrom = from ? a.date >= from : true;
      const okTo = to ? a.date <= to : true;
      return okText && okStatus && okFrom && okTo;
    });
  }, [items, q, status, from, to]);

  const counts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: items.length,
      today: items.filter((i) => i.date === today).length,
      pending: items.filter((i) => i.status === 'pending').length,
    };
  }, [items]);

  // Create appointment (no defaults for required fields)
  const add = () => {
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // กันเวลาชนในวันเดียวกัน (ออปชัน)
    const overlap = items.some(i =>
      i.date === form.date &&
      !((form.end as string) <= i.start || (form.start as string) >= i.end)
    );
    if (overlap) {
      setErrors(prev => ({ ...prev, start: 'ชนกับนัดอื่น', end: 'ชนกับนัดอื่น' }));
      return;
    }

    const id = 'AP-' + String(items.length + 1).padStart(4, '0');
    const trim = (s?: string) => (s ?? '').trim();

    const newItem: Appointment = {
      id,
      patient: trim(form.patient),
      hn: trim(form.hn),
      phone: trim(form.phone),
      date: form.date!,     // ผ่าน validate แล้ว
      start: form.start!,
      end: form.end!,
      type: trim(form.type),
      place: trim(form.place) || 'OPD ชีวาภิบาล', // default ได้ถ้าต้องการ
      provider: trim(form.provider),
      status: (form.status as Status) || 'pending',
      note: trim(form.note),
    };

    setItems(prev => [newItem, ...prev]);
    setOpen(false);
    setForm({ date: newItem.date, start: '09:00', end: '09:30', status: 'pending' });
    setErrors({});
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1>การนัดหมาย (ชีวาภิบาล)</h1>
        <div className={styles.actions}>
          <button className={styles.primary} onClick={() => setOpen(true)}>+ สร้างนัดหมาย</button>
          <div className={styles.segment}>
            <button
              className={view === 'table' ? styles.segmentActive : ''}
              onClick={() => setView('table')}
              type="button"
            >
              ตาราง
            </button>
            <button
              className={view === 'cards' ? styles.segmentActive : ''}
              onClick={() => setView('cards')}
              type="button"
            >
              การ์ด
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <section className={styles.kpis}>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>ทั้งหมด</div>
          <div className={styles.kpiValue}>{counts.total}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>วันนี้</div>
          <div className={styles.kpiValue}>{counts.today}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>รอดำเนินการ</div>
          <div className={styles.kpiValue}>{counts.pending}</div>
        </div>
      </section>

      {/* Filters */}
      <form className={styles.filters} onSubmit={(e) => e.preventDefault()}>
        <input
          className={styles.input}
          placeholder="ค้นหา: ชื่อผู้ป่วย / HN / ผู้รับผิดชอบ / ประเภท / สถานที่"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className={styles.select}
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
        >
          <option value="all">สถานะทั้งหมด</option>
          <option value="pending">รอดำเนินการ</option>
          <option value="checked">มาตามนัด</option>
          <option value="done">เสร็จสิ้น</option>
          <option value="cancelled">ยกเลิก</option>
        </select>
        <label className={styles.inline}>
          จาก
          <input type="date" className={styles.input} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className={styles.inline}>
          ถึง
          <input type="date" className={styles.input} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button
          type="button"
          className={styles.ghost}
          onClick={() => { setQ(''); setStatus('all'); setFrom(''); setTo(''); }}
        >
          ล้างตัวกรอง
        </button>
      </form>

      {/* View */}
      {view === 'table' ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>เลขนัด</th>
                <th>ผู้ป่วย</th>
                <th>วัน-เวลา</th>
                <th>ประเภท/สถานที่</th>
                <th>ผู้รับผิดชอบ</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td className={styles.mono}>{a.id}</td>
                  <td>
                    <div className={styles.patient}>
                      <div className={styles.name}>{a.patient}</div>
                      <div className={styles.sub}>{a.hn}</div>
                    </div>
                  </td>
                  <td>
                    {TH_DATE(a.date)}
                    <div className={styles.sub}>{a.start}–{a.end}</div>
                  </td>
                  <td>
                    {a.type}
                    <div className={styles.sub}>{a.place}</div>
                  </td>
                  <td>{a.provider}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td className={styles.actionsCell}>
                    <button className={styles.ghost} type="button">ดู</button>
                    <button className={styles.ghost} type="button">แก้ไข</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.cards}>
          {filtered.map((a) => (
            <div className={styles.card} key={a.id}>
              <div className={styles.cardHeader}>
                <span className={styles.mono}>{a.id}</span>
                <StatusBadge status={a.status} />
              </div>
              <div className={styles.cardRow}>
                <strong>{a.patient}</strong>
                <span className={styles.sub}>{a.hn}</span>
              </div>
              <div className={styles.cardRow}>{TH_DATE(a.date)} · {a.start}–{a.end}</div>
              <div className={styles.cardRow}>{a.type} · {a.place}</div>
              <div className={styles.cardRow}>ผู้รับผิดชอบ: {a.provider}</div>
              {a.note && <div className={styles.note}>หมายเหตุ: {a.note}</div>}
              <div className={styles.cardActions}>
                <button className={styles.ghost} type="button">ดู</button>
                <button className={styles.ghost} type="button">แก้ไข</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>สร้างนัดหมาย</h3>
              <button className={styles.iconBtn} onClick={() => setOpen(false)} aria-label="close" type="button">×</button>
            </div>
            <div className={styles.formGrid}>
              <label>
                ผู้ป่วย
                <input
                  className={`${styles.input} ${errors.patient ? styles.invalid : ''}`}
                  value={form.patient || ''}
                  onChange={(e) => setForm((f) => ({ ...f, patient: e.target.value }))}
                  onBlur={() => setErrors(validate(form))}
                  placeholder="เช่น สมชาย ใจดี"
                  required
                />
                {errors.patient && <div className={styles.err}>{errors.patient}</div>}
              </label>

              <label>
                HN
                <input
                  className={`${styles.input} ${errors.hn ? styles.invalid : ''}`}
                  value={form.hn || ''}
                  onChange={(e) => setForm((f) => ({ ...f, hn: e.target.value }))}
                  onBlur={() => setErrors(validate(form))}
                  placeholder="เช่น HN001234"
                  required
                />
                {errors.hn && <div className={styles.err}>{errors.hn}</div>}
              </label>

              <label>
                วันที่
                <input
                  type="date"
                  className={`${styles.input} ${errors.date ? styles.invalid : ''}`}
                  value={form.date || ''}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  onBlur={() => setErrors(validate(form))}
                  required
                />
                {errors.date && <div className={styles.err}>{errors.date}</div>}
              </label>

              <label>
                เริ่ม
                <input
                  type="time"
                  className={`${styles.input} ${errors.start ? styles.invalid : ''}`}
                  value={form.start || ''}
                  onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                  onBlur={() => setErrors(validate(form))}
                  required
                />
                {errors.start && <div className={styles.err}>{errors.start}</div>}
              </label>

              <label>
                สิ้นสุด
                <input
                  type="time"
                  className={`${styles.input} ${errors.end ? styles.invalid : ''}`}
                  value={form.end || ''}
                  onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
                  onBlur={() => setErrors(validate(form))}
                  required
                />
                {errors.end && <div className={styles.err}>{errors.end}</div>}
              </label>

              <label>
                ประเภท
                <input
                  className={`${styles.input} ${errors.type ? styles.invalid : ''}`}
                  value={form.type || ''}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  onBlur={() => setErrors(validate(form))}
                  placeholder="ตรวจติดตาม/ทำแผล/เยี่ยมบ้าน"
                  required
                />
                {errors.type && <div className={styles.err}>{errors.type}</div>}
              </label>

              <label>
                สถานที่
                <input
                  className={styles.input}
                  value={form.place || ''}
                  onChange={(e) => setForm((f) => ({ ...f, place: e.target.value }))}
                  placeholder="OPD ชีวาภิบาล/บ้านผู้ป่วย"
                />
              </label>

              <label>
                ผู้รับผิดชอบ
                <input
                  className={`${styles.input} ${errors.provider ? styles.invalid : ''}`}
                  value={form.provider || ''}
                  onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                  onBlur={() => setErrors(validate(form))}
                  placeholder="ชื่อพยาบาล/แพทย์"
                  required
                />
                {errors.provider && <div className={styles.err}>{errors.provider}</div>}
              </label>

              <label>
                สถานะ
                <select
                  className={styles.select}
                  value={(form.status as string) || 'pending'}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Status }))}
                >
                  <option value="pending">รอดำเนินการ</option>
                  <option value="checked">มาตามนัด</option>
                  <option value="done">เสร็จสิ้น</option>
                  <option value="cancelled">ยกเลิก</option>
                </select>
              </label>

              <label className={styles.span2}>
                หมายเหตุ
                <textarea
                  className={styles.textarea}
                  value={form.note || ''}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                />
              </label>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.ghost} onClick={() => setOpen(false)} type="button">ยกเลิก</button>
              <button className={styles.primary} onClick={add} type="button" disabled={!isValid}>
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
