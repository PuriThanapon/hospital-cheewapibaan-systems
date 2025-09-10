'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import {
  ClipboardList, ArrowLeft, RotateCw, Save,
  Plus, Trash2, ArrowUp, ArrowDown
} from 'lucide-react';
import s from './patient-form.module.css';

/* ===== HTTP helpers ===== */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '')
  .replace(/\/+$/, '');

function joinUrl(base: string, path: string) {
  if (!base) return path;
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}
async function http(url: string, options: any = {}) {
  // กัน cache ด้วย ts และส่ง cache:'no-store'
  const withTs = url.includes('?') ? `${url}&ts=${Date.now()}` : `${url}?ts=${Date.now()}`;
  const finalUrl = /^https?:\/\//i.test(url) ? url : joinUrl(API_BASE, withTs);
  const headers = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
  const res = await fetch(finalUrl, {
    cache: 'no-store',
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  if (!res.ok) {
    let msg = 'Request failed';
    const ct = res.headers.get('content-type') || '';
    try {
      if (ct.includes('application/json')) {
        const j = await res.json();
        msg = j.message || j.error || JSON.stringify(j);
      } else {
        msg = await res.text();
      }
    } catch {}
    const err: any = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

/* ===== SweetAlert helpers ===== */
const $swal = Swal.mixin({
  confirmButtonText: 'ตกลง',
  cancelButtonText: 'ยกเลิก',
  confirmButtonColor: '#0369a1',
  cancelButtonColor: '#6b7280',
});
const toast = Swal.mixin({
  toast: true, position: 'top-end', showConfirmButton: false,
  timer: 2000, timerProgressBar: true,
});

/* ===== Types & utils ===== */
type SelectOptions = {
  pname?: string[];
  gender?: string[];
  blood_group?: string[];
  bloodgroup_rh?: string[];
  patients_type?: string[];
  treat_at?: string[];
};
type PatientFormSettings = { selectOptions: SelectOptions };

// คีย์ทั้งหมดที่ตั้งค่าได้
type Key =
  | 'pname'
  | 'gender'
  | 'blood_group'
  | 'bloodgroup_rh'
  | 'patients_type'
  | 'treat_at';

// DEFAULTS
const DEFAULTS: Record<Key, string[]> = {
  pname: ['นาย', 'นาง', 'น.ส.', 'เด็กชาย', 'เด็กหญิง'],
  gender: ['ชาย', 'หญิง', 'ไม่ระบุ'],
  blood_group: ['A', 'B', 'AB', 'O'],
  bloodgroup_rh: ['Rh+', 'Rh-'],
  patients_type: ['ติดสังคม', 'ติดบ้าน', 'ติดเตียง'],
  treat_at: ['โรงพยาบาล', 'บ้าน'],
};

const cloneDefaults = (): Record<Key, string[]> => ({
  pname: [...DEFAULTS.pname],
  gender: [...DEFAULTS.gender],
  blood_group: [...DEFAULTS.blood_group],
  bloodgroup_rh: [...DEFAULTS.bloodgroup_rh],
  patients_type: [...DEFAULTS.patients_type],
  treat_at: [...DEFAULTS.treat_at],
});

const normalize = (arr?: string[]) =>
  (arr || [])
    .map(s => s.trim())
    .filter(Boolean)
    .filter((v, i, a) => a.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i);

const eqList = (a: string[], b: string[]) =>
  a.length === b.length &&
  a.map(x => x.trim()).join('\n').toLowerCase() ===
  b.map(x => x.trim()).join('\n').toLowerCase();

const TABS: Array<{ key: Key; label: string; desc: string }> = [
  { key: 'pname',         label: 'คำนำหน้า',        desc: 'เช่น นาย, นาง, น.ส.' },
  { key: 'gender',        label: 'เพศ',              desc: 'รายการเพศในฟอร์ม' },
  { key: 'blood_group',   label: 'กรุ๊ปเลือด',       desc: 'A, B, AB, O' },
  { key: 'bloodgroup_rh', label: 'Rh factor',        desc: 'Rh+, Rh-' },
  { key: 'patients_type', label: 'ประเภทผู้ป่วย',    desc: 'ติดสังคม, ติดบ้าน, ติดเตียง' },
  { key: 'treat_at',      label: 'สถานที่รักษา',     desc: 'เช่น โรงพยาบาล, บ้าน' },
];

/* ===== Page ===== */
export default function PatientFormSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<Key | null>(null);

  const [orig, setOrig] = useState<Record<Key, string[]>>(cloneDefaults());
  const [draft, setDraft] = useState<Record<Key, string[]>>(cloneDefaults());

  const [tab, setTab] = useState<Key>('pname');
  const [dirty, setDirty] = useState(false); // กัน fetch มาทับระหว่างแก้

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace('#', '') as Key;
    if (hash && (hash in DEFAULTS)) setTab(hash);
  }, []);

  // fetch settings (จะไม่ทับถ้าเริ่มแก้แล้ว)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const js: PatientFormSettings = await http('/api/settings/patient-form');
        const so = js?.selectOptions || {};
        const merged: Record<Key, string[]> = {
          pname: normalize(so.pname).length ? normalize(so.pname) : [...DEFAULTS.pname],
          gender: normalize(so.gender).length ? normalize(so.gender) : [...DEFAULTS.gender],
          blood_group: normalize(so.blood_group).length ? normalize(so.blood_group) : [...DEFAULTS.blood_group],
          bloodgroup_rh: normalize(so.bloodgroup_rh).length ? normalize(so.bloodgroup_rh) : [...DEFAULTS.bloodgroup_rh],
          patients_type: normalize(so.patients_type).length ? normalize(so.patients_type) : [...DEFAULTS.patients_type],
          treat_at: normalize(so.treat_at).length ? normalize(so.treat_at) : [...DEFAULTS.treat_at],
        };
        if (!alive) return;
        if (!dirty) { setOrig(merged); setDraft(merged); }
      } catch {
        if (!alive) return;
        if (!dirty) { setOrig(cloneDefaults()); setDraft(cloneDefaults()); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [dirty]);

  /* ---- generic handlers ---- */
  const update = (key: Key, fn: (prev: string[]) => string[]) => {
    setDirty(true);
    setDraft(prev => ({ ...prev, [key]: fn(prev[key]) }));
  };

  const addItem = (key: Key, val: string) =>
    update(key, (prev) => {
      const v = val.trim();
      if (!v) return prev;
      if (prev.some(x => x.toLowerCase() === v.toLowerCase())) {
        toast.fire({ icon: 'info', title: 'มีรายการนี้อยู่แล้ว' });
        return prev;
      }
      return [...prev, v];
    });

  const editItem = (key: Key, idx: number, val: string) =>
    update(key, (prev) => prev.map((x, i) => (i === idx ? val.trimStart() : x)));

  const blurItem = (key: Key, idx: number) =>
    update(key, (prev) => {
      const v = prev[idx].trim();
      if (!v) return prev.filter((_, i) => i !== idx);
      const dup = prev.findIndex((x, i) => i !== idx && x.toLowerCase() === v.toLowerCase());
      if (dup >= 0) {
        toast.fire({ icon: 'info', title: 'ซ้ำกับรายการอื่น' });
        return prev.filter((_, i) => i !== idx);
      }
      const copy = [...prev];
      copy[idx] = v;
      return copy;
    });

  const removeItem = (key: Key, idx: number) =>
    update(key, (prev) => prev.filter((_, i) => i !== idx));

  const moveUp = (key: Key, idx: number) =>
    update(key, (prev) => {
      if (idx <= 0) return prev;
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });

  const moveDown = (key: Key, idx: number) =>
    update(key, (prev) => {
      if (idx >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });

  const resetOne = async (key: Key) => {
    const isDirty = !eqList(orig[key], draft[key]);
    if (isDirty) {
      const { isConfirmed } = await $swal.fire({
        icon: 'question', title: 'ยกเลิกการแก้ไข?', text: 'จะกลับไปใช้ค่าล่าสุดจากเซิร์ฟเวอร์',
        showCancelButton: true,
      });
      if (!isConfirmed) return;
    }
    setDraft(prev => ({ ...prev, [key]: [...orig[key]] }));
  };

  const saveOne = async (key: Key) => {
    const cleaned = normalize(draft[key]);
    if (cleaned.length === 0) {
      toast.fire({ icon: 'warning', title: 'ต้องมีอย่างน้อย 1 รายการ' });
      return;
    }
    setSavingKey(key);
    try {
      const payload: PatientFormSettings = {
        selectOptions: { ...draft, [key]: cleaned },
      };
      await http('/api/settings/patient-form', { method: 'PUT', body: JSON.stringify(payload) });
      const next = { ...draft, [key]: cleaned } as Record<Key, string[]>;
      setOrig(next);
      setDraft(next);
      setDirty(false);
      toast.fire({ icon: 'success', title: 'บันทึกแล้ว' });
    } catch (e: any) {
      $swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: e?.message || '' });
    } finally {
      setSavingKey(null);
    }
  };

  /* ---- single editor block for current tab ---- */
  const Editor: React.FC<{ k: Key }> = ({ k }) => {
    const list = draft[k];
    const [val, setVal] = useState('');
    const isDirty = !eqList(orig[k], draft[k]);

    return (
      <div className={s.card}>
        <div className={s.cardHeader}>
          <div className={s.cardTitle}>
            {TABS.find(t => t.key === k)?.label} <span className={s.keyTag}>({k})</span>
          </div>
          <div className={s.cardDesc}>{TABS.find(t => t.key === k)?.desc}</div>
          <div className={s.headerActions}>
            <button className={s.secondaryBtn} onClick={() => resetOne(k)} disabled={loading}>
              <RotateCw size={16} /> รีเซ็ต
            </button>
            <button
              className={s.primaryBtn}
              onClick={() => saveOne(k)}
              disabled={loading || savingKey === k || !isDirty}
              title={!isDirty ? 'ไม่มีการเปลี่ยนแปลง' : ''}
            >
              <Save size={16} /> {savingKey === k ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </div>

        <div className={s.body}>
          {loading ? (
            <div className={s.muted}>กำลังโหลดค่า…</div>
          ) : (
            <>
              <div className={s.addRow}>
                <input
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); addItem(k, val); setVal(''); } }}
                  placeholder="เพิ่มรายการใหม่"
                  className={s.input}
                />
                <button className={s.addBtn} onClick={() => { addItem(k, val); setVal(''); }} disabled={!val.trim()}>
                  <Plus size={16} /> เพิ่ม
                </button>
              </div>

              {list.length === 0 ? (
                <div className={s.muted}>ยังไม่มีรายการ</div>
              ) : (
                <ul className={s.list}>
                  {list.map((v, idx) => (
                    <li key={idx} className={s.listItem}>
                      <div className={s.orderBtns}>
                        <button className={s.iconBtn} onClick={() => moveUp(k, idx)} disabled={idx === 0} title="ขึ้น">
                          <ArrowUp size={16} />
                        </button>
                        <button className={s.iconBtn} onClick={() => moveDown(k, idx)} disabled={idx === list.length - 1} title="ลง">
                          <ArrowDown size={16} />
                        </button>
                      </div>

                      <input
                        value={v}
                        onChange={(e) => editItem(k, idx, e.target.value)}
                        onBlur={() => blurItem(k, idx)}
                        className={s.input}
                      />

                      <button className={s.deleteBtn} onClick={() => removeItem(k, idx)} title="ลบ">
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={s.page}>
      {/* Hero */}
      <div className={s.hero}>
        <div className={s.heroInner}>
          <div className={s.heroTitleWrap}>
            <ClipboardList size={22} />
            <h1 className={s.heroTitle}>ตั้งค่า: ฟอร์มผู้ป่วย</h1>
          </div>
          <p className={s.heroSub}>เลือกแท็บด้านล่างเพื่อแก้ไขทีละหมวด</p>
          <div className={s.heroActions}>
            <Link href="/settings/patient" className={s.backBtn}>
              <ArrowLeft size={16} />
              <span>กลับหน้าตั้งค่า: รายชื่อผู้ป่วย</span>
            </Link>
          </div>
        </div>
        

        {/* Tabs */}
        <div className={s.tabs}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={[s.tab, tab === t.key ? s.tabActive : ''].join(' ')}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className={s.container}>
        <Editor k={tab} />
      </div>
    </div>
  );
}
