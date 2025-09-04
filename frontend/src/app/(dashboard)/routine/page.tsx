'use client'

import React, { useEffect, useMemo, useState } from 'react'
import styles from './routine.module.css'
import Swal from 'sweetalert2'

/* ---------- Types ---------- */
type RoutineItem = {
  routine_id: number
  title: string
  time: string            // 'HH:MM' หรือ 'HH:MM:SS'
  days_of_week?: number[] | null // 1..7 => จันทร์=1 ... อาทิตย์=7 (null = ทุกวัน)
  note?: string | null
}

type ViewMode = 'list' | 'grid'
type RoutineForm = { title: string; time: string; days_of_week: number[]; note: string }

/* ---------- Consts ---------- */
const TH_DAYS = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์']
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 7]

/* แทนที่ฟังก์ชัน http เดิมทั้งหมดด้วยเวอร์ชันนี้ */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';
function joinUrl(base: string, path: string) {
  if (!base) return path;
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}
async function http(url: string, options: any = {}, timeoutMs = 12000) {
  const finalUrl = /^https?:\/\//i.test(url) ? url : joinUrl(API_BASE, url);
  const headers =
    options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(new DOMException('timeout', 'AbortError')), timeoutMs);

  try {
    const res = await fetch(finalUrl, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
      signal: ctrl.signal,
      cache: 'no-store',
    });

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        msg = j.message || j.error || msg;
      } catch {}
      const err: any = new Error(msg);
      err.status = res.status;
      throw err;
    }

    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
  } finally {
    clearTimeout(tid);
  }
}


/* ---------- Utils ---------- */
const isoDow = (d: Date) => (d.getDay() === 0 ? 7 : d.getDay())

function toHHMM(s: string): string {
  const m = s?.match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/)
  if (!m) return '00:00'
  return `${m[1].padStart(2, '0')}:${m[2]}`
}
function isValidHHMM(s: string) {
  return /^(\d{1,2}):([0-5]\d)$/.test(s)
}
function timeToMinutes(t: string): number {
  const [hh, mm] = toHHMM(t).split(':').map(Number)
  return (hh ?? 0) * 60 + (mm ?? 0)
}
function minutesToHourLabel(minFromMidnight: number) {
  const hh = Math.floor(minFromMidnight / 60)
  return `${String(hh).padStart(2, '0')}:00`
}
function normalize(items: RoutineItem[]): RoutineItem[] {
  return (items || []).map((it) => ({
    ...it,
    title: it.title?.trim() || 'กิจวัตร',
    time: toHHMM(it.time),
  }))
}

// ด้านบนไฟล์
const toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 1800,
  timerProgressBar: true,
});

/* ---------- API wrappers (ยึดโครงเดียวกับหน้า “ผู้ป่วย”) ---------- */
const apiList   = () => http('/api/routines').then((d) => normalize(d || []))
const apiCreate = (payload: Omit<RoutineItem, 'routine_id'>) =>
  http('/api/routines', { method: 'POST', body: JSON.stringify(payload) })
const apiUpdate = (id: number, payload: Partial<Omit<RoutineItem, 'routine_id'>>) =>
  http(`/api/routines/${encodeURIComponent(String(id))}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
const apiDelete = (id: number) =>
  http(`/api/routines/${encodeURIComponent(String(id))}`, { method: 'DELETE' })

/* ---------- Component ---------- */
export default function DailyRoutinePage() {
  const [items, setItems] = useState<RoutineItem[]>([])
  const [view, setView] = useState<ViewMode>('list')
  const [day, setDay] = useState<number>(() => isoDow(new Date()))
  const [search, setSearch] = useState('')

  const [isOpen, setIsOpen] = useState(false)
  const [editing, setEditing] = useState<RoutineItem | null>(null)
  const [form, setForm] = useState<RoutineForm>({
    title: '',
    time: '08:00',
    days_of_week: [],
    note: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const list = await apiList()
        setItems(list)
      } catch (e: any) {
        // โหมดตัวอย่าง
        Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1800 })
          .fire({ icon: 'info', title: 'โหมดตัวอย่าง: ใช้ข้อมูลจำลอง' })
        setItems(
          normalize([
            { routine_id: 1, title: 'ตื่นนอน', time: '06:00', days_of_week: [1] },
            { routine_id: 2, title: 'แปรงฟัน', time: '08:00', days_of_week: [5] },
            { routine_id: 3, title: 'ทานยาเช้า', time: '08:30' },
            { routine_id: 4, title: 'ทำกายภาพ', time: '10:00', days_of_week: [2, 4] },
            { routine_id: 5, title: 'พักผ่อน', time: '13:00' },
            { routine_id: 6, title: 'ทานยาเย็น', time: '18:00' },
            { routine_id: 7, title: 'อาบน้ำ', time: '19:00', days_of_week: [1, 3, 5] },
            { routine_id: 8, title: 'ตรวจสัญญาณชีพ', time: '07:00', days_of_week: [1, 2, 3, 4, 5, 6, 7] },
            { routine_id: 9, title: 'นอน', time: '22:00' },
          ]),
        )
      }
    })()
  }, [])

  const todays = useMemo(() => {
    return items
      .filter((it) => !it.days_of_week || it.days_of_week.includes(day))
      .filter((it) =>
        search.trim() ? it.title.toLowerCase().includes(search.trim().toLowerCase()) : true,
      )
      .slice()
      .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
  }, [items, day, search])

  const gridByHour = useMemo(() => {
    const map: Record<number, RoutineItem[]> = {}
    for (let h = 0; h < 24; h++) map[h] = []
    todays.forEach((it) => {
      const hour = Math.floor(timeToMinutes(it.time) / 60)
      map[hour].push(it)
    })
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)),
    )
    return map
  }, [todays])

  function openCreate() {
    setEditing(null)
    setForm({ title: '', time: '08:00', days_of_week: [], note: '' })
    setIsOpen(true)
  }
  function openEdit(item: RoutineItem) {
    setEditing(item)
    setForm({
      title: item.title,
      time: toHHMM(item.time),
      days_of_week: item.days_of_week || [],
      note: item.note || '',
    })
    setIsOpen(true)
  }
  function toggleDayInForm(d: number) {
    setForm((f) => {
      const has = f.days_of_week.includes(d)
      const next = has ? f.days_of_week.filter((x) => x !== d) : [...f.days_of_week, d]
      next.sort((a, b) => a - b)
      return { ...f, days_of_week: next }
    })
  }

async function handleDelete(item: RoutineItem) {
  const { isConfirmed } = await Swal.fire({
    title: 'ลบกิจวัตร?',
    text: `${item.title} เวลา ${toHHMM(item.time)}`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#e11d48',
  });
  if (!isConfirmed) return;

  const snapshot = items.slice();                      // เผื่อ revert
  setItems(arr => arr.filter(x => x.routine_id !== item.routine_id)); // optimistic

  void Swal.fire({
    title: 'กำลังลบ...',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading(),
  });

  try {
    await apiDelete(item.routine_id);
  } catch (e: any) {
    setItems(snapshot);                                // ล้มเหลว → ย้อนกลับ
    try { Swal.close(); } catch {}
    await Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: e?.message || '' });
    return;                                            // ออกจากฟังก์ชันทันที
  } finally {
    try { Swal.close(); } catch {}
  }

  // สำเร็จ → แค่โชว์ toast (อย่าให้พัง)
  try { toast.fire({ icon: 'success', title: 'ลบแล้ว' }); } catch {}
}



  /* แก้เฉพาะ handleSave ให้เป็นแบบนี้ */
async function handleSave(e: React.FormEvent) {
  e.preventDefault();
  if (saving) return; // กันกดซ้ำ

  const hhmm = toHHMM(form.time);
  if (!form.title.trim()) {
    await Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบ', text: 'กรุณากรอกชื่อกิจวัตร' });
    return;
  }
  if (!isValidHHMM(hhmm)) {
    await Swal.fire({ icon: 'warning', title: 'เวลาไม่ถูกต้อง', text: 'ใช้รูปแบบ HH:MM เช่น 06:00 หรือ 18:30' });
    return;
  }

  const payload: Omit<RoutineItem, 'routine_id'> = {
    title: form.title.trim(),
    time: hhmm,
    days_of_week: form.days_of_week.length ? form.days_of_week : null, // null = ทุกวัน
    note: form.note?.trim() ? form.note.trim() : null,
  };

  setSaving(true);
  const swal = Swal.fire({
    title: editing ? 'กำลังบันทึกการแก้ไข...' : 'กำลังเพิ่มกิจวัตร...',
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => Swal.showLoading(),
    showConfirmButton: false,
  });

  // เก็บ snapshot เพื่อ revert ถ้าพัง
  const prevItems = items.slice();

  try {
    if (editing) {
      // optimistic update
      setItems(arr => arr.map(x => x.routine_id === editing.routine_id ? ({ ...x, ...payload } as any) : x));

      // ใส่ timeout ที่ http (12s) – ถ้าช้า/เงียบจะ abort
      const updated = await apiUpdate(editing.routine_id, payload);
      setItems(arr => arr.map(x => x.routine_id === updated.routine_id ? updated : x));
    } else {
      // optimistic create
      const tempId = Date.now();
      const tempItem: RoutineItem = { routine_id: tempId, ...(payload as any) };
      setItems(arr => [...arr, tempItem]);

      const created = await apiCreate(payload); // มี timeout จาก http()
      setItems(arr => arr.map(x => (x.routine_id === tempId ? (created as RoutineItem) : x)));
    }

    Swal.close();
    setIsOpen(false);
    Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1800 })
      .fire({ icon: 'success', title: 'บันทึกสำเร็จ' });
  } catch (err: any) {
    // revert UI กลับก่อน
    setItems(prevItems);
    Swal.close();

    const isAbort = err?.name === 'AbortError';
    const msg =
      isAbort
        ? 'การเชื่อมต่อช้าหรือเซิร์ฟเวอร์ไม่ตอบสนอง (timeout)'
        : (err?.message || 'บันทึกไม่สำเร็จ');

    await Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: msg });
  } finally {
    setSaving(false);
  }
}

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>กิจวัตรประจำวัน (Daily Routine)</h1>
            <p className={styles.subtitle}>เลือกวัน แล้วดูรายการเรียงเวลาตั้งแต่เช้าจนถึง 24 ชม.</p>
          </div>
          <div className={styles.headerBtns}>
            <button
              onClick={() => setView('list')}
              className={`${styles.viewBtn} ${view === 'list' ? styles.active : ''}`}
            >
              โหมดรายการ
            </button>
            <button
              onClick={() => setView('grid')}
              className={`${styles.viewBtn} ${view === 'grid' ? styles.active : ''}`}
            >
              ตาราง 24 ชม.
            </button>
            <button onClick={openCreate} className={styles.primaryBtn}>
              + เพิ่มกิจวัตร
            </button>
          </div>
        </div>

        <div className={styles.dayTabs}>
          {DAY_VALUES.map((d) => (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={`${styles.dayBtn} ${d === day ? styles.dayBtnActive : ''}`}
              aria-pressed={d === day}
            >
              {TH_DAYS[d]}
            </button>
          ))}
        </div>

        <div className={styles.searchWrap}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหากิจวัตร เช่น ทานยา, อาบน้ำ"
            className={styles.searchInput}
          />
        </div>

        {view === 'list' ? (
          <section className={styles.listSection}>
            {todays.length === 0 ? (
              <div className={styles.empty}>— ไม่มีรายการของวัน{TH_DAYS[day]} —</div>
            ) : (
              todays.map((it) => (
                <div key={it.routine_id} className={styles.item}>
                  <div className={styles.itemMain}>
                    <div className={styles.timeBadge}>{toHHMM(it.time)}</div>
                    <div className={styles.itemText}>
                      <div className={styles.itemTitle}>{it.title}</div>
                      {it.note ? <div className={styles.itemNote}>{it.note}</div> : null}
                    </div>
                  </div>
                  <div className={styles.itemRight}>
                    <button onClick={() => openEdit(it)} className={styles.actionEdit}>
                      แก้ไข
                    </button>
                    <button onClick={() => handleDelete(it)} className={styles.actionDelete}>
                      ลบ
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        ) : (
          <section className={styles.grid}>
            <div className={styles.gridHeader}>
              <div>เวลา</div>
              <div>กิจวัตรของวัน{TH_DAYS[day]}</div>
            </div>
            <div>
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={h}
                  className={`${styles.gridRow} ${h % 2 ? styles.rowOdd : styles.rowEven}`}
                >
                  <div className={styles.gridHour}>{minutesToHourLabel(h * 60)}</div>
                  <div className={styles.gridCell}>
                    <div className={styles.chipWrap}>
                      {gridByHour[h].length === 0 ? (
                        <span className={styles.dim}>—</span>
                      ) : (
                        gridByHour[h].map((it) => (
                          <span
                            key={it.routine_id}
                            className={styles.chip}
                            title={`เวลา ${toHHMM(it.time)}${it.note ? ' • ' + it.note : ''}`}
                          >
                            <span className={styles.chipTime}>{toHHMM(it.time)}</span>
                            {it.title}
                            <button onClick={() => openEdit(it)} className={styles.chipEdit}>
                              แก้ไข
                            </button>
                            <button onClick={() => handleDelete(it)} className={styles.chipDelete}>
                              ลบ
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className={styles.tip}>
          เคล็ดลับ: ถ้ากิจวัตรใดทำทุกวัน ให้ไม่ต้องกำหนด <code>days_of_week</code> ก็ได้
          ระบบจะแสดงทุกวันอัตโนมัติ
        </div>
      </div>

      {isOpen && (
        <div className={styles.modalOverlay}>
          <form onSubmit={handleSave} className={styles.modal}>
            <div className={styles.modalHead}>
              <h2 className={styles.modalTitle}>{editing ? 'แก้ไขกิจวัตร' : 'เพิ่มกิจวัตร'}</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={styles.modalClose}
                aria-label="close"
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <label className={styles.field}>
                <span className={styles.label}>ชื่อกิจวัตร</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={styles.input}
                  placeholder="เช่น ตื่นนอน, ทานยาเช้า, ทำกายภาพ"
                  required
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>เวลา (HH:MM)</span>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className={styles.input}
                  required
                />
              </label>

              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>วันที่ทำ (เว้นว่าง = ทุกวัน)</legend>
                <div className={styles.dayGrid}>
                  {DAY_VALUES.map((d) => (
                    <label
                      key={d}
                      className={`${styles.dayPick} ${
                        form.days_of_week.includes(d) ? styles.dayPickOn : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={form.days_of_week.includes(d)}
                        onChange={() => toggleDayInForm(d)}
                      />
                      {TH_DAYS[d]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className={styles.field}>
                <span className={styles.label}>หมายเหตุ (ถ้ามี)</span>
                <input
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className={styles.input}
                  placeholder="เช่น หลังอาหาร, แจ้งพยาบาลก่อน"
                />
              </label>
            </div>

            <div className={styles.modalFoot}>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={styles.btnSecondary}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={saving}
                className={saving ? styles.btnDisabled : styles.btnPrimary}
              >
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
