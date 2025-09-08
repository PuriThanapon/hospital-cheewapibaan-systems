'use client';

import React from 'react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import styles from './columns.module.css';
import {
  Save, RotateCw, ArrowLeft, Eye, EyeOff,
  ChevronUp, ChevronDown, GripVertical
} from 'lucide-react';

/* ---------------- HTTP helpers (เหมือนหน้าที่ใช้ได้ปกติ) ---------------- */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');
const joinUrl = (b: string, p: string) => (b ? `${b.replace(/\/$/, '')}${p.startsWith('/') ? p : `/${p}`}` : p);
async function http(url: string, options: any = {}) {
  let finalUrl = /^https?:\/\//i.test(url) ? url : joinUrl(API_BASE, url);
  const isGet = !options.method || options.method.toUpperCase() === 'GET';
  if (isGet) finalUrl += (finalUrl.includes('?') ? '&' : '?') + '__ts=' + Date.now();

  const headers = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
  const res = await fetch(finalUrl, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    cache: isGet ? 'no-store' : 'default',
  });

  if (!res.ok) {
    let msg = 'Request failed';
    try {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await res.json(); msg = j.message || j.error || JSON.stringify(j);
      } else {
        msg = await res.text();
      }
    } catch {}
    const e: any = new Error(msg);
    e.status = res.status;
    throw e;
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

/* ---------------- Types & constants ---------------- */
type VisibleKey =
  | 'hn' | 'name' | 'gender' | 'age' | 'blood' | 'type' | 'treat_at' | 'status'
  | 'verify' | 'edit' | 'add_appt' | 'history' | 'allergies' | 'diagnosis' | 'deceased' | 'delete';

const ALL_KEYS: VisibleKey[] = [
  'hn','name','gender','age','blood','type','treat_at','status',
  'verify','edit','add_appt','history','allergies','diagnosis','deceased','delete'
];

const LABELS: Record<VisibleKey, string> = {
  hn: 'HN',
  name: 'ชื่อ-นามสกุล',
  gender: 'เพศ',
  age: 'อายุ',
  blood: 'กรุ๊ปเลือด',
  type: 'ประเภทผู้ป่วย',
  treat_at: 'สถานที่รักษา',
  status: 'สถานะ',
  verify: 'ตรวจสอบ',
  edit: 'แก้ไข',
  add_appt: 'เพิ่มนัด',
  history: 'ประวัติ',
  allergies: 'แพ้ยา',
  diagnosis: 'โรคประจำตัว',
  deceased: 'เสียชีวิต',
  delete: 'ลบ',
};

type TableSettings = {
  columns: {
    order: VisibleKey[];
    visible: Record<VisibleKey, boolean>;
  };
  pageSize: number;
};

const DEFAULT_VISIBLE: Record<VisibleKey, boolean> =
  ALL_KEYS.reduce((a, k) => (a[k] = true, a), {} as Record<VisibleKey, boolean>);

const DEFAULTS: TableSettings = {
  columns: { order: [...ALL_KEYS], visible: { ...DEFAULT_VISIBLE } },
  pageSize: 20,
};

/* ---------------- helpers ---------------- */
const normalizeOrder = (order?: string[]): VisibleKey[] => {
  const out: VisibleKey[] = [];
  const seen = new Set<string>();
  (order || []).forEach(k => {
    if ((ALL_KEYS as string[]).includes(k) && !seen.has(k)) {
      out.push(k as VisibleKey); seen.add(k);
    }
  });
  ALL_KEYS.forEach(k => { if (!seen.has(k)) out.push(k); });
  return out;
};

const mergeSettings = (j?: Partial<TableSettings>): TableSettings => {
  if (!j) return DEFAULTS;
  const order = normalizeOrder(j.columns?.order as any);
  const visible = { ...DEFAULT_VISIBLE, ...(j.columns?.visible || {}) } as Record<VisibleKey, boolean>;
  ALL_KEYS.forEach(k => { if (typeof visible[k] !== 'boolean') visible[k] = true; });
  const pageSize = Number(j.pageSize || DEFAULTS.pageSize) || 20;
  return { pageSize, columns: { order, visible } };
};

/* ---------------- main page ---------------- */
export default function PatientTableColumnsPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving]   = React.useState(false);
  const [dirty,  setDirty]    = React.useState(false);

  const [serverRaw, setServerRaw] = React.useState<any>(null);       // เก็บ raw เผื่อแบ็กเอนด์มี field อื่น
  const [cfg, setCfg]             = React.useState<TableSettings>(DEFAULTS);

  const fetchSettings = React.useCallback(async () => {
    setLoading(true);
    try {
      const js = await http('/api/settings/patient-table'); // ⬅️ ต้องมีจริง
      setServerRaw(js);
      setCfg(mergeSettings(js));
      setDirty(false);
    } catch (e: any) {
      await Swal.fire({ icon: 'error', title: 'โหลดการตั้งค่าไม่สำเร็จ', text: e?.message || '' });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchSettings(); }, [fetchSettings]);

  /* ----- actions ----- */
  const move = (key: VisibleKey, dir: -1 | 1) => {
    setDirty(true);
    setCfg(prev => {
      const arr = [...prev.columns.order];
      const i = arr.indexOf(key);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...prev, columns: { ...prev.columns, order: arr } };
    });
  };

  const toggle = (key: VisibleKey) => {
    setDirty(true);
    setCfg(prev => ({
      ...prev,
      columns: { ...prev.columns, visible: { ...prev.columns.visible, [key]: !prev.columns.visible[key] } }
    }));
  };

  const selectAll = () => {
    setDirty(true);
    setCfg(prev => ({
      ...prev,
      columns: { ...prev.columns, visible: { ...DEFAULT_VISIBLE } }
    }));
  };
  const selectNone = () => {
    setDirty(true);
    const none = ALL_KEYS.reduce((a, k) => (a[k] = false, a), {} as Record<VisibleKey, boolean>);
    setCfg(prev => ({ ...prev, columns: { ...prev.columns, visible: none } }));
  };

  const resetFromServer = () => { setCfg(mergeSettings(serverRaw)); setDirty(false); };

  const saveAll = async () => {
    if (!dirty) { await Swal.fire({ icon: 'info', title: 'ไม่มีการเปลี่ยนแปลง' }); return; }
    setSaving(true);
    try {
      // เก็บ field อื่นๆ ของแบ็กเอนด์ไว้ด้วย
      const payload = { ...(serverRaw || {}), columns: cfg.columns, pageSize: cfg.pageSize };
      await http('/api/settings/patient-table', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      await fetchSettings(); // รีเฟรชจากของจริง
      await Swal.fire({ icon: 'success', title: 'บันทึกแล้ว' });
    } catch (e: any) {
      await Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: e?.message || '' });
    } finally {
      setSaving(false);
    }
  };

  const setPageSize = (n: number) => {
    setDirty(true);
    setCfg(prev => ({ ...prev, pageSize: Math.max(5, Math.min(200, Math.floor(n || 0))) }));
  };

  return (
    <div className={styles.wrapper}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.title}>ตั้งค่าการแสดงผล “ตารางผู้ป่วย”</div>
          <div className={styles.subtitle}>จัดลำดับคอลัมน์ • ซ่อน/แสดง • กำหนดจำนวนต่อหน้า</div>
        </div>
        <div className={styles.actions}>
          {dirty && <span className={styles.dirtyFlag}>มีการแก้ไขยังไม่บันทึก</span>}
          <Link href="/settings/patient" className={`${styles.btn} ${styles.btnGhost}`}>
            <ArrowLeft size={16} /> กลับ
          </Link>
          <button className={`${styles.btn}`} onClick={resetFromServer} disabled={loading}>
            <RotateCw size={16} /> ย้อนค่าล่าสุด
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveAll} disabled={saving || !dirty}>
            <Save size={16} /> {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={styles.body}>
        {loading ? (
          <div className={styles.bannerInfo}>กำลังโหลด…</div>
        ) : (
          <>
            {/* Page size */}
            <div className={styles.card}>
              <div className={styles.cardTitle}>จำนวนแถวต่อหน้า</div>
              <div className={styles.pageSizeRow}>
                <input
                  type="number"
                  min={5}
                  max={200}
                  value={cfg.pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className={styles.input}
                />
                <span className={styles.hint}>ช่วงที่แนะนำ: 10–100</span>
              </div>
            </div>

            {/* Column manager */}
            <div className={styles.card}>
              <div className={styles.cardTitle}>คอลัมน์ในตาราง</div>

              <div className={styles.toolbar}>
                <button className={styles.btnSm} onClick={selectAll}><Eye size={14} /> แสดงทั้งหมด</button>
                <button className={styles.btnSm} onClick={selectNone}><EyeOff size={14} /> ซ่อนทั้งหมด</button>
              </div>

              <div className={styles.list}>
                {cfg.columns.order.map((k) => {
                  const onTop = cfg.columns.order[0] === k;
                  const onBottom = cfg.columns.order[cfg.columns.order.length - 1] === k;
                  const on = !!cfg.columns.visible[k];
                  return (
                    <div key={k} className={styles.item}>
                      <div className={styles.dragIcon}><GripVertical size={16} /></div>
                      <div className={styles.itemLabel}>{LABELS[k]}</div>
                      <div className={styles.itemActions}>
                        <button className={styles.iconBtn} disabled={onTop} onClick={() => move(k, -1)} title="ขึ้น">
                          <ChevronUp size={16} />
                        </button>
                        <button className={styles.iconBtn} disabled={onBottom} onClick={() => move(k, +1)} title="ลง">
                          <ChevronDown size={16} />
                        </button>
                        <button
                          className={`${styles.toggleBtn} ${on ? styles.on : styles.off}`}
                          onClick={() => toggle(k)}
                          title={on ? 'คลิกเพื่อซ่อน' : 'คลิกเพื่อแสดง'}
                        >
                          {on ? <Eye size={14} /> : <EyeOff size={14} />}
                          <span>{on ? 'แสดง' : 'ซ่อน'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
