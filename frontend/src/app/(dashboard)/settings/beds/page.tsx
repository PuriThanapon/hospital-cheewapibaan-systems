'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { BedDouble, Plus, Save, RotateCw, Trash2, ArrowLeft } from 'lucide-react';

/* ===== HTTP helpers ===== */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');
const joinUrl = (b: string, p: string) => (b ? `${b.replace(/\/$/, '')}${p.startsWith('/') ? p : `/${p}`}` : p);

async function http<T = any>(url: string, options: RequestInit = {}) {
  let finalUrl = /^https?:\/\//i.test(url) ? url : joinUrl(API_BASE, url);
  const isGet = !options.method || options.method.toUpperCase() === 'GET';
  if (isGet) finalUrl += (finalUrl.includes('?') ? '&' : '?') + '__ts=' + Date.now();
  const headers = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
  const res = await fetch(finalUrl, { ...options, headers: { ...headers, ...(options.headers || {}) }, cache: isGet ? 'no-store' : 'default' });
  let data: any = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) data = await res.json().catch(() => null);
  else data = await res.text().catch(() => null);
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Request failed (${res.status})`;
    const e: any = new Error(msg);
    e.status = res.status;
    throw e;
  }
  return data as T;
}

/* ===== SweetAlert & toast ===== */
const $swal = Swal.mixin({ confirmButtonText: 'ตกลง', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#2563eb', cancelButtonColor: '#6b7280' });
const toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1800, timerProgressBar: true });

/* ===== Types (UI model) ===== */
type ServiceType = { key: string; label: string; code_prefix?: string; order?: number };
type BedSettingsUI = {
  service_types: ServiceType[];
  targets: Record<string, number>;  // เป้าหมายจำนวนเตียงต่อประเภท (จะใช้ reconcile)
};

type BedTypeSummary = {
  type: { code: string; name_th: string; prefix: string; color?: string | null; sort_order?: number | null };
  counts: { active: number; busy: number; free: number; retired: number };
};

/* ===== Utils ===== */
const normKey = (s: string) => s.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 16);
const uniqByKey = (list: ServiceType[]) => {
  const seen = new Set<string>(); const out: ServiceType[] = [];
  for (const t of list) { const k = t.key; if (!k || seen.has(k)) continue; seen.add(k); out.push(t); }
  return out;
};

/* ===== Page ===== */
export default function BedSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [reconciling, setReconciling] = useState<Record<string, boolean>>({}); // รายประเภท

  // summary ปัจจุบันจาก DB (ใช้โชว์ Active/Busy/Free และเทียบหาว่ามีอะไรเปลี่ยน)
  const [summary, setSummary] = useState<BedTypeSummary[]>([]);

  // ค่าที่แก้ไขในฟอร์ม (ประเภท + เป้าหมายจำนวนเตียง)
  const [cfg,  setCfg]  = useState<BedSettingsUI>({ service_types: [], targets: {} });

  // ฟอร์มเพิ่มประเภทใหม่
  const [newKey,   setNewKey]   = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newPrefix,setNewPrefix]= useState('');

  /* ---- load from /api/bed-settings/summary ---- */
  const fetchSummary = async () => {
    setLoading(true);
    try {
      const js = await http<{ ok: boolean; summary: BedTypeSummary[] }>('/api/bed-settings/summary');
      const list = Array.isArray(js?.summary) ? js.summary : [];

      // map -> UI model
      const service_types: ServiceType[] = list
        .map((s, i) => ({
          key: normKey(s.type.code),
          label: s.type.name_th || s.type.code,
          code_prefix: s.type.prefix || s.type.code,
          order: Number.isFinite(s.type.sort_order as any) ? Number(s.type.sort_order) : i
        }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      const targets: Record<string, number> = {};
      list.forEach(s => { targets[normKey(s.type.code)] = s.counts.active; });

      setSummary(list);
      setCfg({ service_types: uniqByKey(service_types), targets });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSummary(); }, []);

  /* ---- helpers ---- */
  const markDirtyCount = (key: string, val: string) => {
    const n = Math.max(0, parseInt(String(val).replace(/\D/g, '') || '0', 10));
    setCfg(prev => ({ ...prev, targets: { ...prev.targets, [key]: n } }));
  };
  const stepTarget = (key: string, delta: number) => {
    const cur = cfg.targets[key] ?? 0;
    markDirtyCount(key, String(Math.max(0, cur + delta)));
  };

  const updateType = (key: string, patch: Partial<ServiceType>) => {
    setCfg(prev => {
      const list = prev.service_types.map(t => (t.key === key ? { ...t, ...patch } : t));
      return { ...prev, service_types: list };
    });
  };
  const moveType = (key: string, dir: -1|1) => {
    setCfg(prev => {
      const list = [...prev.service_types].sort((a,b)=>(a.order??0)-(b.order??0));
      const idx = list.findIndex(t => t.key === key);
      if (idx < 0) return prev;
      const j = idx + dir;
      if (j < 0 || j >= list.length) return prev;
      [list[idx].order, list[j].order] = [list[j].order ?? idx, list[idx].order ?? j];
      return { ...prev, service_types: list.sort((a,b)=>(a.order??0)-(b.order??0)) };
    });
  };

  const currentActiveMap = useMemo(() => Object.fromEntries(summary.map(s => [normKey(s.type.code), s.counts.active])), [summary]);
  const currentBusyMap   = useMemo(() => Object.fromEntries(summary.map(s => [normKey(s.type.code), s.counts.busy])), [summary]);

  const hasInvalidTargets = useMemo(() => {
    // เป้าต้อง >= busy (เพราะ retire ได้เฉพาะเตียงว่าง)
    return cfg.service_types.some(t => {
      const key = t.key;
      const target = cfg.targets[key] ?? currentActiveMap[key] ?? 0;
      const busy = currentBusyMap[key] ?? 0;
      return target < busy;
    });
  }, [cfg, currentActiveMap, currentBusyMap]);

  /* ---- add / delete type (เรียก API จริง) ---- */
  const addType = async () => {
    const code = normKey(newKey || newLabel);
    const name_th = (newLabel || newKey || '').trim();
    if (!code || !name_th) { toast.fire({ icon: 'info', title: 'กรอก Key และชื่อให้ครบ' }); return; }

    const code_prefix = (newPrefix || code).toUpperCase();
    try {
      await http('/api/bed-settings/types', {
        method: 'POST',
        body: JSON.stringify({ code, name_th, code_prefix, sort_order: (cfg.service_types.length || 0) })
      });
      toast.fire({ icon: 'success', title: 'เพิ่ม/แก้ประเภทเตียงแล้ว' });
      setNewKey(''); setNewLabel(''); setNewPrefix('');
      await fetchSummary();
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'เพิ่มไม่สำเร็จ', text: e?.message || '' });
    }
  };

  const removeType = async (key: string) => {
    const t = cfg.service_types.find(x => x.key === key); if (!t) return;
    const s = summary.find(x => normKey(x.type.code) === key);
    if (s && s.counts.active > 0) {
      toast.fire({ icon: 'info', title: 'ยังมีเตียง active อยู่ กรุณาลดเหลือ 0 ก่อนลบประเภท' });
      return;
    }
    const { isConfirmed } = await $swal.fire({ icon: 'warning', title: 'ลบประเภทฝั่งเตียงนี้?', text: `${t.label} (${t.key})`, showCancelButton: true });
    if (!isConfirmed) return;
    try {
      await http(`/api/bed-settings/types/${encodeURIComponent(key)}`, { method: 'DELETE' });
      toast.fire({ icon: 'success', title: `ลบประเภท ${key} แล้ว` });
      await fetchSummary();
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: e?.message || '' });
    }
  };

  /* ---- reconcile รายประเภท ---- */
  const reconcileOne = async (key: string) => {
    const target = cfg.targets[key] ?? (currentActiveMap[key] ?? 0);
    const busy = currentBusyMap[key] ?? 0;
    if (target < busy) {
      toast.fire({ icon: 'warning', title: `เป้าต้องไม่ต่ำกว่า Busy (${busy})` });
      return;
    }
    setReconciling(prev => ({ ...prev, [key]: true }));
    try {
      await http(`/api/bed-settings/types/${encodeURIComponent(key)}/reconcile`, {
        method: 'POST',
        body: JSON.stringify({ target })
      });
      toast.fire({ icon: 'success', title: `ปรับจำนวน ${key} เรียบร้อย` });
      await fetchSummary();
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'ปรับไม่สำเร็จ', text: e?.message || '' });
    } finally {
      setReconciling(prev => ({ ...prev, [key]: false }));
    }
  };

  /* ---- saveAll = upsert ทุกประเภท + reconcile เป้าหมาย ---- */
  const saveAll = async () => {
    if (hasInvalidTargets) {
      toast.fire({ icon: 'warning', title: 'มีเป้าหมายที่ต่ำกว่า Busy – แก้ไขก่อนบันทึก' });
      return;
    }
    setSaving(true);
    try {
      // 1) upsert ประเภททั้งหมด (ชื่อไทย, prefix, sort_order)
      for (let i = 0; i < cfg.service_types.length; i++) {
        const t = cfg.service_types[i];
        await http('/api/bed-settings/types', {
          method: 'POST',
          body: JSON.stringify({
            code: normKey(t.key),
            name_th: t.label || t.key,
            code_prefix: (t.code_prefix || t.key).toUpperCase(),
            sort_order: i
          })
        });
      }

      // 2) สร้างรายการ target ที่ "ต่าง" จากจำนวน active ปัจจุบัน เพื่อลดการทำงานเกินจำเป็น
      const currentActiveMapLocal = Object.fromEntries(summary.map(s => [normKey(s.type.code), s.counts.active]));
      const targets = Object.entries(cfg.targets)
        .map(([code, target]) => ({ code: normKey(code), target: Math.max(0, Number(target) || 0) }))
        .filter(x => currentActiveMapLocal[x.code] !== x.target);

      if (targets.length === 0) {
        toast.fire({ icon: 'info', title: 'ไม่มีการเปลี่ยนจำนวนเตียง' });
      } else {
        // 3) reconcile หลายประเภทพร้อมกัน
        await http('/api/bed-settings/reconcile', {
          method: 'POST',
          body: JSON.stringify({ targets })
        });
        toast.fire({ icon: 'success', title: 'ปรับจำนวนเตียงเรียบร้อย' });
      }

      await fetchSummary();
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: e?.message || '' });
    } finally {
      setSaving(false);
    }
  };

  /* ---- รีเซ็ตเป้าหมายกลับเป็นค่าปัจจุบัน ---- */
  const resetTargets = () => {
    const next: Record<string, number> = {};
    summary.forEach(s => { next[normKey(s.type.code)] = s.counts.active; });
    setCfg(prev => ({ ...prev, targets: next }));
    toast.fire({ icon: 'info', title: 'รีเซ็ตเป้าหมายเป็นค่าปัจจุบันแล้ว' });
  };

  const dirty = useMemo(() => {
    // dirty ถ้า: ชื่อ/prefix/ลำดับ เปลี่ยน หรือ targets ต่างจาก active
    const bySummary = Object.fromEntries(summary.map(s => [normKey(s.type.code), s]));
    const typeChanged = cfg.service_types.some((t, i) => {
      const s = bySummary[normKey(t.key)];
      if (!s) return true;
      if ((t.label || t.key) !== (s.type.name_th || s.type.code)) return true;
      if ((t.code_prefix || t.key) !== (s.type.prefix || s.type.code)) return true;
      const order = Number.isFinite(t.order as any) ? Number(t.order) : i;
      const sOrder = Number.isFinite(s.type.sort_order as any) ? Number(s.type.sort_order) : i;
      return order !== sOrder;
    });
    const countChanged = summary.some(s => (cfg.targets[normKey(s.type.code)] ?? s.counts.active) !== s.counts.active);
    return typeChanged || countChanged;
  }, [summary, cfg]);

  const byKey = useMemo(() => Object.fromEntries(cfg.service_types.map(t => [t.key, t])), [cfg.service_types]);

  return (
    <div className="min-h-[calc(100vh-2rem)] rounded-[15px] overflow-clip bg-slate-50 ring-1 ring-slate-200 shadow-sm">
      {/* Hero */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="px-8 py-6 flex items-center gap-3">
          <BedDouble className="text-purple-700" />
          <h1 className="font-bold text-slate-900 text-xl">ตั้งค่า: เตียง (เชื่อม DB จริง)</h1>
          <div className="ml-auto flex items-center gap-2">
            {dirty && <span className="text-xs text-amber-600">มีการแก้ไขที่ยังไม่บันทึก</span>}
            <Link href="/settings" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
              <ArrowLeft size={16} /> กลับหน้า “จัดการเตียง”
            </Link>
            <button onClick={fetchSummary} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
              <RotateCw size={16} /> รีเฟรช
            </button>
            <button onClick={resetTargets} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
              รีเซ็ตเป้าหมาย
            </button>
            <button
              onClick={saveAll}
              disabled={saving || !dirty || hasInvalidTargets}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 ${hasInvalidTargets ? 'cursor-not-allowed' : ''}`}
              title={hasInvalidTargets ? 'มีเป้าที่ต่ำกว่า Busy' : ''}
            >
              <Save size={16} /> {saving ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-6">
        {/* Add type */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="font-semibold text-slate-800 mb-3">เพิ่มประเภทฝั่งเตียง</div>
          <div className="grid gap-3 md:grid-cols-3">
            <input value={newKey} onChange={(e) => setNewKey(normKey(e.target.value))} placeholder="KEY (เช่น LTC, PC)" className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-200" />
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="ชื่อที่แสดง (เช่น ฝั่ง LTC)" className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-200" />
            <div className="flex gap-2">
              <input value={newPrefix} onChange={(e) => setNewPrefix(normKey(e.target.value))} placeholder="Prefix รหัส (เช่น LTC)" className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-200" />
              <button onClick={addType} className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-2">
                <Plus size={16} /> เพิ่ม
              </button>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">* KEY/Prefix ใช้ A-Z, 0-9, ขีดล่าง/ขีดกลาง</div>
        </div>

        {/* Types list */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="font-semibold text-slate-800 mb-3">ประเภทฝั่งเตียง</div>
          {loading ? (
            <div className="text-slate-500">กำลังโหลด…</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cfg.service_types.map((t) => (
                <div key={t.key} className="rounded-xl border border-slate-200 p-4 bg-slate-50 flex flex-col gap-3">
                  <div className="text-sm text-slate-600">Key: <span className="font-mono font-semibold">{t.key}</span></div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-600">ชื่อที่แสดง</label>
                    <input value={t.label} onChange={(e)=>updateType(t.key, { label: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-200" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-600">Prefix รหัสเตียง (ใช้สร้างโค้ด เช่น {t.code_prefix || t.key}-01)</label>
                    <input value={t.code_prefix || ''} onChange={(e)=>updateType(t.key, { code_prefix: normKey(e.target.value) })} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-200" />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={()=>moveType(t.key,-1)} className="px-2 py-2 rounded-lg border bg-white text-slate-700">ขึ้น</button>
                    <button onClick={()=>moveType(t.key, 1)} className="px-2 py-2 rounded-lg border bg-white text-slate-700">ลง</button>
                    <button onClick={()=>removeType(t.key)} className="px-2 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                      <Trash2 size={16}/> ลบ
                    </button>
                  </div>

                  {/* แสดงสรุปปัจจุบันของประเภทนี้ (Active/Busy/Free/Retired) */}
                  <div className="pt-2 border-t border-slate-200 text-xs text-slate-600">
                    {(() => {
                      const s = summary.find(x => normKey(x.type.code) === t.key);
                      if (!s) return <span className="text-slate-400">ยังไม่มีข้อมูล</span>;
                      return (
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">Active <b>{s.counts.active}</b></span>
                          <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700">Busy <b>{s.counts.busy}</b></span>
                          <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Free <b>{s.counts.free}</b></span>
                          <span className="px-2 py-1 rounded-full bg-gray-200 text-gray-700">Retired <b>{s.counts.retired}</b></span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Targets (จำนวนเตียงที่ต้องการ) */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="font-semibold text-slate-800 mb-3">จำนวนเตียง (เป้าหมาย) ต่อฝั่ง</div>
          {cfg.service_types.length === 0 ? (
            <div className="text-slate-500">ยังไม่มีประเภทฝั่งเตียง</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cfg.service_types.map((t) => {
                const s = summary.find(x => normKey(x.type.code) === t.key);
                const busy = s?.counts.busy ?? 0;
                const current = s?.counts.active ?? 0;
                const target = cfg.targets[t.key] ?? current;
                const changed = target !== current;
                const invalid = target < busy;

                return (
                  <div key={t.key} className="rounded-xl border border-slate-200 p-4 bg-slate-50 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-800">
                        {t.label} <span className="text-xs text-slate-500 ml-1">({t.key})</span>
                      </div>
                      <button
                        onClick={() => reconcileOne(t.key)}
                        disabled={reconciling[t.key] || !changed || invalid}
                        className={`text-xs px-3 py-1 rounded-lg ${reconciling[t.key] || !changed || invalid ? 'bg-slate-200 text-slate-500' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                        title={invalid ? `เป้าต้อง ≥ Busy (${busy})` : (changed ? 'ปรับเฉพาะประเภทนี้' : 'ไม่มีการเปลี่ยน')}
                      >
                        {reconciling[t.key] ? 'กำลังปรับ…' : 'ปรับประเภทนี้'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={()=>stepTarget(t.key, -1)} className="px-2 py-2 rounded-lg border bg-white">−</button>
                      <input
                        value={target}
                        onChange={(e)=>markDirtyCount(t.key, e.target.value)}
                        inputMode="numeric"
                        className={`w-28 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-200 text-right ${invalid ? 'border-red-400 bg-red-50' : (changed ? 'border-amber-400 bg-amber-50' : '')}`}
                        title={invalid ? `เป้าต้องไม่ต่ำกว่า Busy (${busy})` : ''}
                      />
                      <button onClick={()=>stepTarget(t.key, +1)} className="px-2 py-2 rounded-lg border bg-white">＋</button>
                      <span className="text-sm text-slate-600">เตียง</span>
                    </div>

                    <div className="text-xs text-slate-500">
                      ปัจจุบัน Active: {current}
                      {invalid && <span className="ml-2 text-red-600">ต้อง ≥ Busy ({busy})</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 text-xs text-slate-500">
            เมื่อกด “บันทึก” ระบบจะ:
            <ol className="list-decimal ml-5">
              <li>Upsert ประเภทเตียงทั้งหมดไปที่ <code>/api/bed-settings/types</code> (ชื่อไทย, prefix, ลำดับ)</li>
              <li>เรียก <code>/api/bed-settings/reconcile</code> เพื่อปรับจำนวนเตียงจริงให้เท่ากับเป้าหมาย (สร้างเพิ่ม/retire เฉพาะเตียงว่าง)</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
