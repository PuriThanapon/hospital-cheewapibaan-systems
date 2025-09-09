'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
      } catch { }
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

/* ---------- Toast (แก้ให้แสดงนานขึ้น + pause เมื่อ hover) ---------- */
const TOAST_DURATION_MS = 10_000; // 10 วินาที
const toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: TOAST_DURATION_MS,
  timerProgressBar: true,
  didOpen: (el) => {
    el.addEventListener('mouseenter', Swal.stopTimer);
    el.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

const ymdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/* ---------- API wrappers ---------- */
const apiList = () => http('/api/routines').then((d) => normalize(d || []))
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

  // ==== Sound setup (inside component) ====
  const dingRef = useRef<HTMLAudioElement | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  useEffect(() => {
    // ใช้ absolute URL ป้องกัน basePath/assetPrefix เพี้ยน
    const src = new URL('/sounds/chime.wav', window.location.origin).toString();
    const el = new Audio(src);
    el.preload = 'auto';
    el.volume = 0.9;

    const onReady = () => setAudioReady(true);
    const onError = () => console.warn('[audio] load error', el.error);

    el.addEventListener('canplaythrough', onReady, { once: true });
    el.addEventListener('error', onError);

    dingRef.current = el;

    return () => {
      el.removeEventListener('canplaythrough', onReady);
      el.removeEventListener('error', onError);
      dingRef.current = null;
    };
  }, []);

  // ปลดล็อก autoplay ด้วย user gesture ครั้งเดียว
  useEffect(() => {
    function unlockOnce() {
      const a = dingRef.current;
      if (!a) return;
      a.muted = true;
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
          setAudioUnlocked(true);
        })
        .catch((e) => console.debug('[audio] unlock fail (retry on next gesture)', e));
    }
    window.addEventListener('pointerdown', unlockOnce, { once: true });
    return () => window.removeEventListener('pointerdown', unlockOnce);
  }, []);

  async function playDing() {
    const a = dingRef.current;
    if (!a) { console.warn('[audio] no element'); return; }
    try {
      if (!audioReady) {
        // เผื่อบางเครื่องยังไม่ buffer เสร็จ
        await new Promise((r) => setTimeout(r, 50));
      }
      a.currentTime = 0;
      await a.play();
    } catch (err) {
      console.warn('[audio] play() failed', err);
      if (!audioUnlocked) {
        toast.fire({ icon: 'info', title: 'แตะหน้าจอหนึ่งครั้งเพื่อเปิดเสียงแจ้งเตือน' });
      }
    }
  }

  // โหลดรายการ
  useEffect(() => {
    (async () => {
      try {
        const list = await apiList()
        setItems(list)
      } catch (e: any) {
        toast.fire({ icon: 'info', title: 'โหมดตัวอย่าง: ใช้ข้อมูลจำลอง' })
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

  // ขอสิทธิ์ Notification ครั้งแรก
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { });
    }
  }, []);

  // แจ้งเตือนตามเวลา
  const firedRef = useRef<{ ymd: string; keys: Set<string> }>({ ymd: '', keys: new Set() });
  const DEFAULT_LEAD_MIN = 0;       // ล่วงหน้า (นาที) ตอนเทส
  const CHECK_EVERY_MS = 15_000;  // เช็คทุก 15 วิ
  const WINDOW_SEC = 59;      // อนุโลม ±59 วินาที

  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date();
      const today = ymdLocal(now);
      const todayDow = isoDow(now); // 1..7

      // รีเซ็ตกันซ้ำเมื่อขึ้นวันใหม่
      if (firedRef.current.ymd !== today) {
        firedRef.current = { ymd: today, keys: new Set() };
      }

      // เลือกรายการของ "วันจริงวันนี้"
      const todayList = (items || []).filter(it =>
        !it.days_of_week || it.days_of_week.includes(todayDow)
      );

      for (const it of todayList) {
        const targetHHMM = toHHMM(it.time);
        const [hh, mm] = targetHHMM.split(':').map(Number);

        // เวลา "จริง" ของกิจวัตรวันนี้
        const startAt = new Date(`${today}T00:00:00`);
        startAt.setHours(hh || 0, mm || 0, 0, 0);

        // ---- 1) แจ้งเตือนตรงเวลา (±WINDOW_SEC) ----
        const deltaStartSec = Math.abs((startAt.getTime() - now.getTime()) / 1000);
        if (deltaStartSec <= WINDOW_SEC) {
          const key = `${it.routine_id}-${today}-${targetHHMM}-start`;
          if (!firedRef.current.keys.has(key)) {
            firedRef.current.keys.add(key);
            toast.fire({ icon: 'info', title: `${targetHHMM} • ${it.title}` });
            try {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('เตือนกิจวัตร', {
                  body: `${targetHHMM} • ${it.title}${it.note ? ' • ' + it.note : ''}`,
                  tag: key,
                  requireInteraction: true,
                });
              }
              void playDing();
            } catch { }
          }
        }

      }
    }, CHECK_EVERY_MS);

    return () => clearInterval(iv);
  }, [items]);

  // คำนวณรายการแสดงผล (ตามแท็บ จ–อา ที่ผู้ใช้เลือกดู)
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

    const snapshot = items.slice();
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
      setItems(snapshot);
      try { Swal.close(); } catch { }
      await Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: e?.message || '' });
      return;
    } finally {
      try { Swal.close(); } catch { }
    }

    try { toast.fire({ icon: 'success', title: 'ลบแล้ว' }); } catch { }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

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
      days_of_week: form.days_of_week.length ? form.days_of_week : null,
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

    const prevItems = items.slice();

    try {
      if (editing) {
        setItems(arr => arr.map(x => x.routine_id === editing.routine_id ? ({ ...x, ...payload } as any) : x));
        const updated = await apiUpdate(editing.routine_id, payload);
        setItems(arr => arr.map(x => x.routine_id === updated.routine_id ? updated : x));
      } else {
        const tempId = Date.now();
        const tempItem: RoutineItem = { routine_id: tempId, ...(payload as any) };
        setItems(arr => [...arr, tempItem]);

        const created = await apiCreate(payload);
        setItems(arr => arr.map(x => (x.routine_id === tempId ? (created as RoutineItem) : x)));
      }

      Swal.close();
      setIsOpen(false);
      toast.fire({ icon: 'success', title: 'บันทึกสำเร็จ' });
    } catch (err: any) {
      setItems(prevItems);
      Swal.close();

      const isAbort = err?.name === 'AbortError';
      const msg = isAbort
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
            {/* ปุ่มทดสอบเสียง (ปลดคอมเมนต์ถ้าต้องการ) */}
            {/* <button onClick={() => playDing()} className={styles.btnSecondary}>
              ทดสอบเสียง
            </button> */}
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
                      className={`${styles.dayPick} ${form.days_of_week.includes(d) ? styles.dayPickOn : ''}`}
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
