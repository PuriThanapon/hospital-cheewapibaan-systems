'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { Filter, ArrowLeft, RotateCw, Save, ArrowUp, ArrowDown, Eye, EyeOff, CheckSquare, Square, Settings2 } from 'lucide-react';
import {
  PatientListFilterSettings,
  PatientListFilterDef,
  getPatientListFilterSettings,
  savePatientListFilterSettings,
} from '@/app/lib/settings';

const $swal = Swal.mixin({
  confirmButtonText: 'ตกลง',
  cancelButtonText: 'ยกเลิก',
  confirmButtonColor: '#0369a1',
  cancelButtonColor: '#64748b',
});
const toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 1800,
  timerProgressBar: true,
});

type SelectOptions = {
  pname?: string[];
  gender?: string[];
  blood_group?: string[];
  bloodgroup_rh?: string[];
  patients_type?: string[];
  treat_at?: string[];
};

// ดึง selectOptions จาก patient-form settings (อ่านอย่างเดียว)
async function fetchSelectOptions(): Promise<SelectOptions> {
  const API_BASE = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');
  const join = (p: string) => (API_BASE ? `${API_BASE}${p}` : p);
  const res = await fetch(join('/api/settings/patient-form?__ts=' + Date.now()), { cache: 'no-store' });
  if (!res.ok) return {};
  const js = await res.json();
  return js?.selectOptions || {};
}

export default function PatientListFiltersSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [dirty, setDirty]     = useState(false);

  const [orig, setOrig] = useState<PatientListFilterSettings | null>(null);
  const [cfg,  setCfg]  = useState<PatientListFilterSettings | null>(null);

  const [so, setSo] = useState<SelectOptions>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [cur, options] = await Promise.all([
          getPatientListFilterSettings(),
          fetchSelectOptions(),
        ]);
        setOrig(cur);
        setCfg(cur);
        setSo(options);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const byKey = useMemo(() => {
    const m = new Map<string, PatientListFilterDef>();
    (cfg?.defs || []).forEach(d => m.set(d.key, d));
    return m;
  }, [cfg?.defs]);

  function moveUp(key: string) {
    if (!cfg) return;
    const idx = cfg.enabled.indexOf(key);
    if (idx <= 0) return;
    const next = cfg.enabled.slice();
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setCfg({ ...cfg, enabled: next }); setDirty(true);
  }
  function moveDown(key: string) {
    if (!cfg) return;
    const idx = cfg.enabled.indexOf(key);
    if (idx < 0 || idx >= cfg.enabled.length - 1) return;
    const next = cfg.enabled.slice();
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    setCfg({ ...cfg, enabled: next }); setDirty(true);
  }
  function toggleVisible(key: string) {
    if (!cfg) return;
    let enabled = cfg.enabled.slice();
    let hidden  = new Set(cfg.hidden);
    if (enabled.includes(key)) {
      enabled = enabled.filter(k => k !== key);
      hidden.add(key);
    } else {
      enabled.push(key);
      hidden.delete(key);
    }
    setCfg({ ...cfg, enabled, hidden: Array.from(hidden) }); setDirty(true);
  }

  // ตัวเลือก (สำหรับ select) — เอาจาก source/ options ของ def
  function optionsFor(def: PatientListFilterDef): string[] {
    if (def.options?.length) return def.options;
    if (def.source && (so as any)[def.source]) return (so as any)[def.source] || [];
    return [];
  }

  // อัปเดต defaults ต่อประเภท
  function setDefault(key: string, val: any) {
    if (!cfg) return;
    setCfg({ ...cfg, defaults: { ...(cfg.defaults || {}), [key]: val } });
    setDirty(true);
  }

  async function resetAll() {
    const { isConfirmed } = await $swal.fire({
      icon: 'question', title: 'ยกเลิกการแก้ไขทั้งหมด?', text: 'จะกลับไปใช้ค่าล่าสุดจากเซิร์ฟเวอร์', showCancelButton: true,
    });
    if (!isConfirmed) return;
    setCfg(orig); setDirty(false);
  }

  async function saveAll() {
    if (!cfg) return;
    if (!dirty) { toast.fire({ icon: 'info', title: 'ไม่มีการเปลี่ยนแปลง' }); return; }
    setSaving(true);
    try {
      await savePatientListFilterSettings(cfg);
      toast.fire({ icon: 'success', title: 'บันทึกแล้ว' });
      setOrig(cfg);
      setDirty(false);
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: e?.message || '' });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !cfg) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
          <div className="px-6 py-4 flex items-center gap-3">
            <Filter className="text-sky-700" />
            <h1 className="font-bold text-slate-900 text-xl">ตั้งค่า: ตัวกรองรายชื่อผู้ป่วย</h1>
          </div>
        </div>
        <div className="px-6 py-6 text-slate-500">กำลังโหลด…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="px-6 py-4 flex items-center gap-3">
          <Filter className="text-sky-700" />
          <h1 className="font-bold text-slate-900 text-xl">ตั้งค่า: ตัวกรองรายชื่อผู้ป่วย</h1>
          <div className="ml-auto flex items-center gap-2">
            {dirty && <span className="text-xs text-amber-600">มีการแก้ไขที่ยังไม่บันทึก</span>}
            <Link href="/settings/patient" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
              <ArrowLeft size={16} /> กลับหน้าผู้ป่วย
            </Link>
            <button onClick={resetAll} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
              <RotateCw size={16} /> รีเซ็ต
            </button>
            <button onClick={saveAll} disabled={saving || !dirty} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">
              <Save size={16} /> {saving ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 grid gap-6 lg:grid-cols-3">
        {/* ลิสต์ตัวกรอง + ลำดับ */}
        <div className="lg:col-span-1 rounded-xl border border-slate-200 bg-white p-4">
          <div className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Settings2 size={18} /> จัดลำดับ/แสดงผล
          </div>
          <ul className="space-y-2">
            {cfg.enabled.map((key, idx) => {
              const def = byKey.get(key)!;
              return (
                <li key={key} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200">
                  <button className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50" onClick={() => moveUp(key)} disabled={idx===0}><ArrowUp size={14}/></button>
                  <button className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50" onClick={() => moveDown(key)} disabled={idx===cfg.enabled.length-1}><ArrowDown size={14}/></button>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{def.label}</div>
                    <div className="text-xs text-slate-500">key: <span className="font-mono">{def.key}</span> • type: {def.type}</div>
                  </div>
                  <button
                    className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
                    onClick={() => toggleVisible(key)}
                    title="ซ่อนตัวกรองนี้"
                  >
                    <EyeOff size={16}/>
                  </button>
                </li>
              );
            })}
            {cfg.hidden.map((key) => {
              const def = byKey.get(key);
              if (!def) return null;
              return (
                <li key={key} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="px-2 py-1 rounded border border-slate-200 text-slate-400"><ArrowUp size={14}/></div>
                  <div className="px-2 py-1 rounded border border-slate-200 text-slate-400"><ArrowDown size={14}/></div>
                  <div className="flex-1 opacity-70">
                    <div className="text-sm font-medium">{def.label}</div>
                    <div className="text-xs text-slate-500">key: <span className="font-mono">{def.key}</span> • type: {def.type}</div>
                  </div>
                  <button
                    className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
                    onClick={() => toggleVisible(key)}
                    title="แสดงตัวกรองนี้"
                  >
                    <Eye size={16}/>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 text-xs text-slate-500">
            * เลื่อนขึ้น-ลง เพื่อจัดลำดับ, คลิกไอคอนตาเพื่อซ่อน/แสดง
          </div>
        </div>

        {/* ตั้งค่า default ต่อ field */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div className="font-semibold text-slate-800">ค่าเริ่มต้นของตัวกรอง</div>

          {cfg.enabled.map((key) => {
            const def = byKey.get(key)!;
            const val = (cfg.defaults || {})[key];

            // Render ต่อ type
            if (def.type === 'select') {
              const opts = optionsFor(def);
              const arrVal: string[] = Array.isArray(val) ? val : (val ? [val] : []);
              const isChecked = (o: string) => arrVal.includes(o);
              const toggle = (o: string) => {
                if (def.multi) {
                  const set = new Set(arrVal);
                  if (set.has(o)) set.delete(o); else set.add(o);
                  setDefault(key, Array.from(set));
                } else {
                  setDefault(key, o);
                }
              };
              return (
                <div key={key} className="p-3 rounded-lg border border-slate-200">
                  <div className="text-sm font-medium mb-2">{def.label}</div>
                  {opts.length === 0 ? (
                    <div className="text-xs text-slate-500">ไม่มีตัวเลือก (อาจยังไม่ได้กำหนดในหน้า “ตั้งค่า: ฟอร์มผู้ป่วย”)</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {opts.map(o => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => toggle(o)}
                          className={`px-3 py-1.5 border rounded-lg text-sm ${
                            isChecked(o) ? 'bg-sky-50 border-sky-300 text-sky-800' : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          {isChecked(o) ? <CheckSquare size={14} className="inline mr-1" /> : <Square size={14} className="inline mr-1" />}
                          {o}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-slate-500">{def.multi ? 'เลือกหลายค่าได้' : 'เลือกได้ค่าเดียว'}</div>
                </div>
              );
            }

            if (def.type === 'boolean') {
              const v = val === true ? true : val === false ? false : null;
              return (
                <div key={key} className="p-3 rounded-lg border border-slate-200">
                  <div className="text-sm font-medium mb-2">{def.label}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDefault(key, true)}
                      className={`px-3 py-1.5 border rounded-lg text-sm ${v===true ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white border-slate-200 text-slate-700'}`}
                    >ใช่</button>
                    <button
                      onClick={() => setDefault(key, false)}
                      className={`px-3 py-1.5 border rounded-lg text-sm ${v===false ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-white border-slate-200 text-slate-700'}`}
                    >ไม่ใช่</button>
                    <button
                      onClick={() => setDefault(key, null)}
                      className={`px-3 py-1.5 border rounded-lg text-sm ${v===null ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-white border-slate-200 text-slate-700'}`}
                    >ไม่กำหนด</button>
                  </div>
                </div>
              );
            }

            if (def.type === 'daterange') {
              const from = (val?.from || '') as string;
              const to   = (val?.to || '') as string;
              return (
                <div key={key} className="p-3 rounded-lg border border-slate-200">
                  <div className="text-sm font-medium mb-2">{def.label}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input type="date" className="px-3 py-2 border rounded-lg" value={from} onChange={(e) => setDefault(key, { from: e.target.value, to })} />
                    <input type="date" className="px-3 py-2 border rounded-lg" value={to}   onChange={(e) => setDefault(key, { from, to: e.target.value })} />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">ปล่อยว่าง = ไม่กำหนดช่วง</div>
                </div>
              );
            }

            if (def.type === 'numberrange') {
              const min = (val?.min ?? '') as string|number;
              const max = (val?.max ?? '') as string|number;
              return (
                <div key={key} className="p-3 rounded-lg border border-slate-200">
                  <div className="text-sm font-medium mb-2">{def.label}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input type="number" className="px-3 py-2 border rounded-lg" value={min} onChange={(e) => setDefault(key, { min: e.target.value, max })} placeholder="ขั้นต่ำ" />
                    <input type="number" className="px-3 py-2 border rounded-lg" value={max} onChange={(e) => setDefault(key, { min, max: e.target.value })} placeholder="ขั้นสูง" />
                  </div>
                </div>
              );
            }

            // text
            return (
              <div key={key} className="p-3 rounded-lg border border-slate-200">
                <div className="text-sm font-medium mb-2">{def.label}</div>
                <input
                  className="w-full px-3 py-2 border rounded-lg"
                  value={val || ''}
                  onChange={(e) => setDefault(key, e.target.value)}
                  placeholder="ข้อความเริ่มต้นของช่องค้นหา"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
