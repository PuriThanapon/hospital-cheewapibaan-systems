'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { FileText, Plus, Save, RotateCw, Trash2, ArrowLeft } from 'lucide-react';

/* ---------------- HTTP helpers ---------------- */
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
        const j = await res.json();
        msg = j.message || j.error || JSON.stringify(j);
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

/* ---------------- SweetAlert helpers ---------------- */
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

/* ---------------- Types & defaults ---------------- */
type DocType = { key: string; label: string; accept?: string; protected?: boolean };
type DocsCfg  = { types: DocType[]; required: string[]; optional: string[]; hidden: string[] };
type Settings = { documents?: DocsCfg; [k: string]: any };

const DEFAULT_TYPES: DocType[] = [
  { key: 'patient_id_card',    label: 'สำเนาบัตรประชาชนผู้ป่วย',                 accept: 'image/*,.pdf', protected: true },
  { key: 'house_registration', label: 'สำเนาทะเบียนบ้านผู้ป่วย/ญาติ',             accept: 'image/*,.pdf', protected: true },
  { key: 'patient_photo',      label: 'รูปถ่ายผู้ป่วย (สภาพปัจจุบัน)',             accept: 'image/*' },
  { key: 'relative_id_card',   label: 'สำเนาบัตรประชาชนญาติ/ผู้ขอความอนุเคราะห์', accept: 'image/*,.pdf' },
  { key: 'assistance_letter',  label: 'หนังสือขอความอนุเคราะห์',                  accept: 'image/*,.pdf' },
  { key: 'power_of_attorney',  label: 'หนังสือมอบอำนาจ / หนังสือรับรองบุคคลไร้ญาติ', accept: 'image/*,.pdf' },
  { key: 'homeless_certificate', label: 'หนังสือรับรองบุคคลไร้ที่พึ่ง',            accept: 'image/*,.pdf' },
  { key: 'adl_assessment',     label: 'แบบประเมิน ADL',                             accept: 'image/*,.pdf' },
  { key: 'clinical_summary',   label: 'ประวัติการรักษา (Clinical Summary)',         accept: 'image/*,.pdf' },
];

const DEFAULT_DOCS: DocsCfg = {
  types: DEFAULT_TYPES,
  required: ['patient_id_card', 'house_registration'],
  optional: [
    'patient_photo', 'relative_id_card', 'assistance_letter',
    'power_of_attorney', 'homeless_certificate', 'adl_assessment', 'clinical_summary'
  ],
  hidden: [],
};

/* ---------------- Utils ---------------- */
const slug = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/^_+|_+$/g, '');

const uniq = (arr: string[]) => Array.from(new Set(arr));

const disjoint = (required: string[] = [], optional: string[] = [], hidden: string[] = []) => {
  const R = new Set(required), O = new Set(optional), H = new Set(hidden);
  for (const k of Array.from(O)) if (R.has(k) || H.has(k)) O.delete(k);
  for (const k of Array.from(H)) if (R.has(k) || O.has(k)) H.delete(k);
  return { required: Array.from(R), optional: Array.from(O), hidden: Array.from(H) };
};

/* ---------------- Page ---------------- */
export default function PatientDocsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [dirty,   setDirty]   = useState(false);

  const [orig, setOrig] = useState<DocsCfg>(DEFAULT_DOCS);
  const [docs, setDocs] = useState<DocsCfg>(DEFAULT_DOCS);

  const [newLabel, setNewLabel]   = useState('');
  const [newAccept, setNewAccept] = useState('image/*,.pdf');
  const [newKey, setNewKey]       = useState('');

  const byKey = useMemo(() => Object.fromEntries(docs.types.map(t => [t.key, t])), [docs.types]);

  const stateOf = (key: string): 'required'|'optional'|'hidden' => {
    if (docs.required.includes(key)) return 'required';
    if (docs.hidden.includes(key))   return 'hidden';
    return 'optional';
  };

  /* ---------- fetch settings (no-cache) ---------- */
const fetchSettings = async () => {
  setLoading(true);
  try {
    const js: Settings = await http('/api/settings/patient-form');

    // ใช้ documents จาก server แม้จะไม่มี types มาก็ตาม
    const incomingDocs = (js && js.documents) ? js.documents : ({} as Partial<DocsCfg>);

    // 1) types: ถ้า server ไม่มี ให้ใช้ DEFAULT_TYPES แทน (เฉพาะ types)
    const serverTypes: DocType[] =
      Array.isArray(incomingDocs.types) && incomingDocs.types.length > 0
        ? incomingDocs.types
        : DEFAULT_TYPES;

    // 2) สถานะ required/optional/hidden: เคารพค่าจาก server แม้เป็น []
    const required = Array.isArray(incomingDocs.required) ? incomingDocs.required : DEFAULT_DOCS.required;
    const optional = Array.isArray(incomingDocs.optional) ? incomingDocs.optional : DEFAULT_DOCS.optional;
    const hidden   = Array.isArray(incomingDocs.hidden)   ? incomingDocs.hidden   : [];

    // 3) merge types ตาม key (ถ้า server ไม่มี type ใด ให้เติมจาก default)
    const defaultMap = new Map(DEFAULT_TYPES.map(t => [t.key, t] as const));
    const mergedKeys = uniq([...serverTypes.map(t => t.key), ...DEFAULT_TYPES.map(t => t.key)]);
    const mergedTypes = mergedKeys.map(k => serverTypes.find(t => t.key === k) || defaultMap.get(k)!);

    // 4) ทำให้ required/optional/hidden ไม่ซ้อนกัน
    const clean = disjoint(uniq(required), uniq(optional), uniq(hidden));

    const merged: DocsCfg = { types: mergedTypes, ...clean };

    setOrig(merged);
    setDocs(merged);
    setDirty(false);
  } catch {
    setOrig(DEFAULT_DOCS);
    setDocs(DEFAULT_DOCS);
    setDirty(false);
  } finally {
    setLoading(false);
  }
};


  useEffect(() => { fetchSettings(); }, []);

  /* ---------- actions (ไม่ autosave) ---------- */
  const setStateSafe = (key: string, next: 'required'|'optional'|'hidden') => {
    setDirty(true);
    setDocs(prev => {
      const req = prev.required.filter(k => k !== key);
      const opt = prev.optional.filter(k => k !== key);
      const hid = prev.hidden.filter(k => k !== key);
      if (next === 'required') req.push(key);
      else if (next === 'optional') opt.push(key);
      else hid.push(key);
      const clean = disjoint(uniq(req), uniq(opt), uniq(hid));
      return { ...prev, ...clean };
    });
  };

  const addType = () => {
    const label = newLabel.trim(); if (!label) return;
    const key = (newKey || slug(label)); if (!key) return toast.fire({ icon: 'info', title: 'กรุณากรอก key ภาษาอังกฤษ' });
    if (byKey[key]) return toast.fire({ icon: 'warning', title: 'key นี้มีอยู่แล้ว' });

    setDirty(true);
    const next: DocType = { key, label, accept: (newAccept || 'image/*,.pdf') };
    setDocs(prev => {
      const draft = {
        ...prev,
        types: [...prev.types, next],
        optional: uniq([...prev.optional, key]),
        required: prev.required.filter(k => k !== key),
        hidden:   prev.hidden.filter(k => k !== key),
      };
      const clean = disjoint(draft.required, draft.optional, draft.hidden);
      return { ...draft, ...clean };
    });
    setNewLabel(''); setNewAccept('image/*,.pdf'); setNewKey('');
  };

  const removeType = async (key: string) => {
    const meta = byKey[key];
    if (!meta || meta.protected) return; // ป้องกันลบชนิดที่ล็อกไว้
    const { isConfirmed } = await $swal.fire({ icon: 'warning', title: 'ลบชนิดเอกสารนี้?', text: meta.label, showCancelButton: true });
    if (!isConfirmed) return;

    setDirty(true);
    setDocs(prev => {
      const nd: DocsCfg = {
        types: prev.types.filter(t => t.key !== key),
        required: prev.required.filter(k => k !== key),
        optional: prev.optional.filter(k => k !== key),
        hidden:   prev.hidden.filter(k => k !== key),
      };
      const clean = disjoint(nd.required, nd.optional, nd.hidden);
      return { ...nd, ...clean };
    });
  };

  const updateLabel  = (key: string, label: string) => { setDirty(true); setDocs(prev => ({ ...prev, types: prev.types.map(t => (t.key === key ? { ...t, label } : t)) })); };
  const updateAccept = (key: string, accept: string) => { setDirty(true); setDocs(prev => ({ ...prev, types: prev.types.map(t => (t.key === key ? { ...t, accept } : t)) })); };

  const resetAll = async () => {
    const { isConfirmed } = await $swal.fire({
      icon: 'question', title: 'ยกเลิกการแก้ไขทั้งหมด?', text: 'จะกลับไปใช้ค่าล่าสุดจากเซิร์ฟเวอร์', showCancelButton: true,
    });
    if (!isConfirmed) return;
    setDocs(orig);
    setDirty(false);
  };

  const saveAll = async () => {
    if (!dirty) { toast.fire({ icon: 'info', title: 'ไม่มีการเปลี่ยนแปลง' }); return; }
    setSaving(true);
    try {
      await http('/api/settings/patient-form', { method: 'PUT', body: JSON.stringify({ documents: docs }) });
      // ดึงค่าจากเซิร์ฟเวอร์กลับมาอีกครั้งให้ UI ตรงกับที่ persisted
      await fetchSettings();
      toast.fire({ icon: 'success', title: 'บันทึกแล้ว' });
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: e?.message || '' });
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="px-6 py-4 flex items-center gap-3">
          <FileText className="text-sky-700" />
          <h1 className="font-bold text-slate-900 text-xl">ตั้งค่า: เอกสารผู้ป่วย</h1>
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
      <div className="px-6 py-6 space-y-6">
        {/* Add new */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="font-semibold text-slate-800 mb-3">เพิ่มชนิดเอกสาร</div>
          <div className="grid gap-3 md:grid-cols-3">
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="ชื่อเอกสาร เช่น หนังสือรับรองฯ" className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-sky-200" />
            <input value={newKey} onChange={(e) => setNewKey(slug(e.target.value))} placeholder="key (a-z0-9_)" className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-sky-200" />
            <div className="flex gap-2">
              <input value={newAccept} onChange={(e) => setNewAccept(e.target.value)} placeholder="accept เช่น image/*,.pdf" className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-sky-200" />
              <button onClick={addType} disabled={!newLabel.trim()} className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-2">
                <Plus size={16} /> เพิ่ม
              </button>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">* key ต้องไม่ซ้ำ และเป็นภาษาอังกฤษ/ตัวเลข/ขีดล่าง</div>
        </div>

        {/* List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="text-slate-500">กำลังโหลด…</div>
          ) : (
            docs.types.map((t) => {
              const cur = stateOf(t.key);
              return (
                <div key={t.key} className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
                  <div className="text-sm font-semibold text-slate-800">{t.label}</div>
                  <div className="text-xs text-slate-500 -mt-2">key: <span className="font-mono">{t.key}</span>{t.protected && ' • ป้องกันการลบ'}</div>

                  <div className="space-y-2">
                    <label className="text-xs text-slate-600">ชื่อที่แสดง</label>
                    <input
                      value={t.label}
                      onChange={(e) => updateLabel(t.key, e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-600">ชนิดไฟล์ (accept)</label>
                    <input
                      value={t.accept || ''}
                      onChange={(e) => updateAccept(t.key, e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>

                  {/* Segment buttons */}
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <button
                      onClick={() => setStateSafe(t.key, 'required')}
                      className={`px-2 py-2 rounded-lg border ${cur==='required' ? 'bg-rose-100 border-rose-200 text-rose-800 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    >
                      บังคับ
                    </button>
                    <button
                      onClick={() => setStateSafe(t.key, 'optional')}
                      className={`px-2 py-2 rounded-lg border ${cur==='optional' ? 'bg-cyan-50 border-cyan-200 text-cyan-800 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    >
                      ไม่บังคับ
                    </button>
                    <button
                      onClick={() => setStateSafe(t.key, 'hidden')}
                      className={`px-2 py-2 rounded-lg border ${cur==='hidden' ? 'bg-slate-100 border-slate-300 text-slate-800 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    >
                      ซ่อน
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => removeType(t.key)}
                      disabled={!!t.protected}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 size={16} /> ลบ
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
