'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import styles from './allergies.module.css';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

/* ---------- Types ---------- */
type Severity = 'mild' | 'moderate' | 'severe';
type Causality = 'certain' | 'probable' | 'possible' | 'unlikely' | 'unclassified';
type Outcome = 'recovered' | 'improving' | 'unchanged' | 'worsened' | 'death';
type PatientType = 'OPD' | 'IPD' | 'ER' | 'HOME' | 'UNKNOWN';

type AllergyForm = {
  report_date: string;
  onset_date: string;
  substance: string;
  custom_substance?: string;
  reaction: string;
  severity: Severity | '';
  system_affected: string;
  causality: Causality | '';
  outcome: Outcome | '';
  patient_type: PatientType | '';
  thai24_code: string;
  note: string;
};

type AllergyRow = {
  allergy_id: number;
  patients_id: string;
  report_date: string;
  onset_date?: string | null;
  substance: string;
  reaction?: string | null;
  severity: Severity;
  system_affected: string;
  causality: Causality;
  outcome: Outcome;
  patient_type: PatientType;
  thai24_code?: string | null;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
};

type DrugCode = {
  drug_id: number;
  code_24: string | null;
  generic_name: string;
  synonyms?: string[] | null;
  atc_code?: string | null;
  note?: string | null;
};

/* ---------- Fallback drug names (ใช้เมื่อโหลดจาก DB ไม่สำเร็จ) ---------- */
const FALLBACK_DRUGS = [
  'PARACETAMOL','IBUPROFEN','AMOXICILLIN','CLARITHROMYCIN','METRONIDAZOLE',
  'PENICILLIN V','ASPIRIN','TRIMETHOPRIM/SULFAMETHOXAZOLE','CLINDAMYCIN',
  'AZITHROMYCIN','CIPROFLOXACIN','LEVOFLOXACIN','CEPHALEXIN','CEFTRIAXONE',
  'DOXYCYCLINE','ERYTHROMYCIN','NAPROXEN','DICLOFENAC','MORPHINE','CODEINE',
  'PREDNISOLONE','OMEPRAZOLE','RANITIDINE','METFORMIN','INSULIN REGULAR',
  'อื่น ๆ',
];

const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: 'mild', label: 'ไม่ร้ายแรง' },
  { value: 'moderate', label: 'ปานกลาง' },
  { value: 'severe', label: 'รุนแรง' },
];

const SYSTEM_AFFECTED_OPTIONS = [
  'Blood and lymphatic system disorders',
  'Cardiovascular disorders',
  'Respiratory, thoracic and mediastinal disorders',
  'Gastrointestinal disorders',
  'Hepatobiliary disorders',
  'Skin and subcutaneous tissue disorders',
  'Immune system disorders',
  'Nervous system disorders',
  'Psychiatric disorders',
  'Endocrine disorders',
  'Musculoskeletal and connective tissue disorders',
  'Renal and urinary disorders',
  'General disorders and administration site conditions',
  'อื่น ๆ',
];

const CAUSALITY_OPTIONS: { value: Causality; label: string }[] = [
  { value: 'certain', label: 'Certain (แน่นอน)' },
  { value: 'probable', label: 'Probable (น่าจะใช่)' },
  { value: 'possible', label: 'Possible (เป็นไปได้)' },
  { value: 'unlikely', label: 'Unlikely (ไม่น่าจะใช่)' },
  { value: 'unclassified', label: 'Unclassified (จำแนกไม่ได้)' },
];

const OUTCOME_OPTIONS: { value: Outcome; label: string }[] = [
  { value: 'recovered', label: 'หายเป็นปกติ' },
  { value: 'improving', label: 'อาการดีขึ้น' },
  { value: 'unchanged', label: 'ทรงตัว' },
  { value: 'worsened', label: 'แย่ลง' },
  { value: 'death', label: 'เสียชีวิต' },
];

const PATIENT_TYPES: { value: PatientType; label: string }[] = [
  { value: 'OPD', label: 'OPD (ผู้ป่วยนอก)' },
  { value: 'IPD', label: 'IPD (ผู้ป่วยใน)' },
  { value: 'ER', label: 'ER (ฉุกเฉิน)' },
  { value: 'HOME', label: 'ดูแลที่บ้าน/ชุมชน' },
  { value: 'UNKNOWN', label: 'ไม่ทราบ' },
];

/* ---------- Helpers ---------- */
const todayISO = () => new Date().toISOString().slice(0, 10);
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const join = (p: string) => (API_BASE ? `${API_BASE}${p}` : p);

async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(join(path), {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    cache: 'no-store',
  });

  const ct = res.headers.get('content-type') || '';
  const isJson = ct.includes('application/json');

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      if (isJson) {
        const j = await res.json();
        msg = j.message || j.error || msg;
      } else {
        const t = await res.text();
        if (t) msg = t;
      }
    } catch {}
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;
  if (!isJson) return (await res.text()) as unknown as T;
  try { return (await res.json()) as T; } catch { return undefined as T; }
}

/** SweetAlert2 */
const toast = Swal.mixin({
  toast: true, position: 'top-end', showConfirmButton: false, timer: 1800, timerProgressBar: true,
});
async function withLoading<T>(label: string, fn: () => Promise<T>): Promise<T> {
  Swal.fire({ title: label, allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
  try { const r = await fn(); Swal.close(); return r; } catch (e) { Swal.close(); throw e; }
}

/* ---------- Thai24 helpers ---------- */
const onlyDigits24 = (s: string) => (s || '').replace(/\D/g, '').slice(0, 24);
const format24Groups = (digits: string) => (digits || '').replace(/(\d{4})(?=\d)/g, '$1 ').trim();

/* ---------- Page ---------- */
export default function AllergyPage() {
  const { hn } = useParams<{ hn: string }>();
  const search = useSearchParams();
  const patients_id = useMemo(() => (hn || 'HN-00000001').toUpperCase(), [hn]);
  const patient_name = useMemo(() => search.get('name') || 'ไม่ระบุชื่อ', [search]);

  const [activeTab, setActiveTab] = useState<'form' | 'list'>('form');
  const [items, setItems] = useState<AllergyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState<string>('');

  // รายการยาจากฐานข้อมูล เพื่อใส่ใน <select>
  const [drugOptions, setDrugOptions] = useState<string[]>([]);
  const [drugLoading, setDrugLoading] = useState<boolean>(true);

  // ⬇️ แผนที่ code24 -> รายละเอียดยา (ไว้โชว์ในหน้ารายการ)
  const [drugByCode, setDrugByCode] = useState<Record<string, DrugCode | null>>({});
  const [drugLookupLoading, setDrugLookupLoading] = useState(false);

  const [form, setForm] = useState<AllergyForm>({
    report_date: todayISO(),
    onset_date: '',
    substance: '',
    custom_substance: '',
    reaction: '',
    severity: '',
    system_affected: '',
    causality: '',
    outcome: '',
    patient_type: 'OPD',
    thai24_code: '',
    note: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof AllergyForm, string>>>({});

  /* ---------- โหลดรายการแพ้ยาของผู้ป่วย ---------- */
  useEffect(() => {
    let alive = true;
    setErrMsg('');
    (async () => {
      try {
        const data = await api<{ data: AllergyRow[] }>(`/api/patients/${encodeURIComponent(patients_id)}/allergies`);
        if (!alive) return;
        setItems(data?.data || []);
      } catch (e: any) {
        if (!alive) return;
        setErrMsg(e?.message || 'โหลดรายการไม่สำเร็จ');
        setItems([]);
        Swal.fire({ icon: 'error', title: 'โหลดรายการไม่สำเร็จ', text: e?.message || '' });
      }
    })();
    return () => { alive = false; };
  }, [patients_id]);

  /* ---------- โหลดตัวเลือกยาจาก DB ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      setDrugLoading(true);
      try {
        let res = await api<{ data: DrugCode[] }>(`/api/drug_codes?q=&limit=1000`);
        let list = res?.data || [];
        if (!list.length) {
          res = await api<{ data: DrugCode[] }>(`/api/drug_codes?q=*&limit=1000`);
          list = res?.data || [];
        }
        const names = Array.from(new Set(list.map(d => (d.generic_name || '').trim()).filter(Boolean))).sort();
        if (!alive) return;
        setDrugOptions([...names, 'อื่น ๆ']);
      } catch {
        if (!alive) return;
        setDrugOptions(FALLBACK_DRUGS);
      } finally {
        if (alive) setDrugLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  function ensureDrugInOptions(name: string) {
    if (!name) return;
    setDrugOptions(prev => {
      if (prev.includes(name)) return prev;
      const withoutOther = prev.filter(v => v !== 'อื่น ๆ');
      return [...withoutOther, name].sort().concat('อื่น ๆ');
    });
  }

  /* ---------- Validate ---------- */
  function validate(f: AllergyForm) {
    const e: Partial<Record<keyof AllergyForm, string>> = {};
    if (!f.report_date) e.report_date = 'กรุณาเลือกวันที่มีรายงาน';
    if (!f.substance) e.substance = 'กรุณาเลือกยาที่แพ้';
    if (f.substance === 'อื่น ๆ' && !f.custom_substance?.trim()) e.custom_substance = 'ระบุชื่อสามัญของยา';
    if (!f.severity) e.severity = 'เลือกความร้ายแรง';
    if (!f.system_affected) e.system_affected = 'เลือกระบบอวัยวะที่ได้รับผล';
    if (!f.causality) e.causality = 'เลือกระดับความสัมพันธ์';
    if (!f.outcome) e.outcome = 'เลือกผลที่เกิดขึ้นภายหลัง';
    if (!f.patient_type) e.patient_type = 'เลือกประเภทผู้ป่วย';
    if (f.thai24_code) {
      const digits = onlyDigits24(f.thai24_code);
      if (digits.length !== 24) e.thai24_code = 'ต้องเป็นตัวเลข 24 หลัก';
    }
    return e;
  }

  /* ---------- Actions ---------- */
  function resetForm() {
    setForm({
      report_date: todayISO(),
      onset_date: '',
      substance: '',
      custom_substance: '',
      reaction: '',
      severity: '',
      system_affected: '',
      causality: '',
      outcome: '',
      patient_type: 'OPD',
      thai24_code: '',
      note: '',
    });
    setEditingId(null);
    setErrors({});
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate(form);
    setErrors(err);
    if (Object.keys(err).length) {
      const firstMsg = Object.values(err)[0] as string;
      await Swal.fire({ icon: 'warning', title: 'กรอกข้อมูลไม่ครบ', text: firstMsg || '' });
      return;
    }

    const normalizedSubstance = form.substance === 'อื่น ๆ' ? (form.custom_substance || '').trim() : form.substance;

    const body = {
      ...form,
      substance: normalizedSubstance,
      thai24_code: onlyDigits24(form.thai24_code) || null,
    };

    setLoading(true);
    try {
      const ask = await Swal.fire({
        icon: 'question',
        title: editingId ? 'ยืนยันการอัปเดต?' : 'ยืนยันการบันทึก?',
        showCancelButton: true,
        confirmButtonText: editingId ? 'อัปเดต' : 'บันทึก',
        cancelButtonText: 'ยกเลิก',
      });
      if (!ask.isConfirmed) return;

      if (editingId) {
        const updated = await withLoading('กำลังอัปเดตรายการ...', () =>
          api<AllergyRow>(`/api/allergies/${encodeURIComponent(editingId)}`, { method: 'PUT', body: JSON.stringify(body) })
        );
        setItems(prev => prev.map(i => i.allergy_id === editingId ? updated : i));
        toast.fire({ icon: 'success', title: 'อัปเดตสำเร็จ' });
      } else {
        const created = await withLoading('กำลังบันทึกรายการ...', () =>
          api<AllergyRow>(`/api/patients/${encodeURIComponent(patients_id)}/allergies`, { method: 'POST', body: JSON.stringify(body) })
        );
        setItems(prev => [created, ...prev]);
        toast.fire({ icon: 'success', title: 'บันทึกสำเร็จ' });
      }

      setActiveTab('list');
      resetForm();
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: e?.message || '' });
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id?: number) {
    const target = id ?? editingId!;
    if (!target) return;

    const ask = await Swal.fire({
      icon: 'warning',
      title: 'ยืนยันการลบ?',
      text: 'รายการนี้จะถูกลบถาวร',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#d33',
    });
    if (!ask.isConfirmed) return;

    try {
      await withLoading('กำลังลบ...', () => api(`/api/allergies/${encodeURIComponent(target)}`, { method: 'DELETE' }));
      setItems(prev => prev.filter(i => i.allergy_id !== target));
      if (!id) resetForm();
      toast.fire({ icon: 'success', title: 'ลบสำเร็จ' });
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: e?.message || '' });
    }
  }

  function onEdit(item: AllergyRow) {
    ensureDrugInOptions(item.substance);
    const inList = drugOptions.includes(item.substance);
    setEditingId(item.allergy_id);
    setForm({
      report_date: item.report_date || todayISO(),
      onset_date: item.onset_date || '',
      substance: inList ? item.substance : 'อื่น ๆ',
      custom_substance: inList ? '' : item.substance,
      reaction: item.reaction || '',
      severity: item.severity || '',
      system_affected: item.system_affected || '',
      causality: item.causality || '',
      outcome: item.outcome || '',
      patient_type: item.patient_type || 'OPD',
      thai24_code: item.thai24_code || '',
      note: item.note || '',
    });
    setActiveTab('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- Thai24 auto-fill (debounce + cache + abort) ---------- */
  const thai24Digits = onlyDigits24(form.thai24_code);
  const thai24Display = format24Groups(thai24Digits);
  const thai24Len = thai24Digits.length;
  const thai24OK = thai24Len === 24;

  const onThai24Change = (val: string) => setForm({ ...form, thai24_code: onlyDigits24(val) });

  function autoFillFrom(item: DrugCode, silent = false) {
    ensureDrugInOptions(item.generic_name);
    setForm(prev => ({
      ...prev,
      substance: item.generic_name || prev.substance,
      custom_substance: '',
      thai24_code: onlyDigits24(item.code_24 || prev.thai24_code),
    }));
    if (!silent) toast.fire({ icon: 'success', title: 'เติมข้อมูลจากรหัสสำเร็จ' });
  }

  const lastQueryRef = useRef<string>('');
  const cacheRef = useRef<Map<string, DrugCode[]>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!thai24OK) return;
    if (thai24Digits === lastQueryRef.current) return;
    lastQueryRef.current = thai24Digits;

    const cached = cacheRef.current.get(thai24Digits);
    if (cached && cached.length) {
      autoFillFrom(cached[0], true);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const t = setTimeout(async () => {
      try {
        const res = await api<{ data: DrugCode[] }>(`/api/drug_codes?q=${thai24Digits}`, { signal: controller.signal as any });
        const list = res?.data || [];
        cacheRef.current.set(thai24Digits, list);
        if (list.length) autoFillFrom(list[0], true);
      } catch {}
    }, 450);

    return () => { controller.abort(); clearTimeout(t); };
  }, [thai24OK, thai24Digits]);

  /* ---------- ดึงรายละเอียดรหัส 24 สำหรับ "หน้ารายการ" ---------- */
  useEffect(() => {
    let alive = true;
    const codes = Array.from(
      new Set(
        items
          .map(it => onlyDigits24(it.thai24_code || ''))
          .filter(c => c.length === 24)
      )
    );

    const toFetch = codes.filter(c => !(c in drugByCode));
    if (!toFetch.length) return;

    setDrugLookupLoading(true);
    (async () => {
      try {
        const results = await Promise.all(
          toFetch.map(async (code) => {
            try {
              // ใช้พารามิเตอร์ code_24 ให้ค้นหาแบบเป๊ะ
              const res = await api<{ data: DrugCode[] }>(`/api/drug_codes?code_24=${code}&limit=1`);
              const item = res?.data?.[0] || null;
              return [code, item] as const;
            } catch {
              return [code, null] as const;
            }
          })
        );
        if (!alive) return;
        setDrugByCode(prev => {
          const next = { ...prev };
          results.forEach(([code, info]) => { next[code] = info; });
          return next;
        });
      } finally {
        if (alive) setDrugLookupLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [items, drugByCode]);

  /* ---------- Manual Search Button ---------- */
  async function openThai24Search() {
    abortRef.current?.abort();

    const { value: q, isConfirmed: ok1 } = await Swal.fire({
      title: 'ค้นหารหัส/ชื่อยา',
      input: 'text',
      inputValue: thai24Digits || form.substance || '',
      inputPlaceholder: 'พิมพ์รหัส 24 หลัก หรือชื่อสามัญ',
      showCancelButton: true,
      confirmButtonText: 'ค้นหา',
      cancelButtonText: 'ยกเลิก',
      inputAttributes: { 'aria-label': 'query' },
    });
    if (!ok1 || !q?.trim()) return;

    let list: DrugCode[] = [];
    try {
      const res = await withLoading('กำลังค้นหา...', () => api<{ data: DrugCode[] }>(`/api/drug_codes?q=${encodeURIComponent(q.trim())}`));
      list = res?.data || [];
    } catch (e: any) {
      await Swal.fire({ icon: 'error', title: 'ค้นหาไม่สำเร็จ', text: e?.message || '' });
      return;
    }

    if (!list.length) {
      await Swal.fire({ icon: 'info', title: 'ไม่พบผลลัพธ์', text: 'กรุณาลองคำค้นอื่น' });
      return;
    }

    const options: Record<string, string> = {};
    for (const d of list) {
      options[String(d.drug_id)] = `${d.generic_name}${d.atc_code ? ` (${d.atc_code})` : ''} — ${d.code_24 || '-'}`;
    }
    const { value: chosenId, isConfirmed: ok2 } = await Swal.fire({
      title: 'เลือกยา',
      input: 'select',
      inputOptions: options,
      inputPlaceholder: 'เลือกรายการ',
      showCancelButton: true,
      confirmButtonText: 'ตกลง',
      cancelButtonText: 'ยกเลิก',
      width: 600,
    });
    if (!ok2 || !chosenId) return;

    const picked = list.find((d) => String(d.drug_id) === String(chosenId));
    if (!picked) return;

    autoFillFrom(picked);
    Swal.fire({
      icon: 'success',
      title: 'เลือกแล้ว',
      html: `
        <div style="text-align:left">
          <div><b>ชื่อสามัญ:</b> ${picked.generic_name}</div>
          <div><b>รหัส 24 หลัก:</b> ${picked.code_24 || '-'}</div>
          <div><b>ATC:</b> ${picked.atc_code || '-'}</div>
          <div><b>ชื่อพ้อง:</b> ${(picked.synonyms?.join(', ') || '-')}</div>
        </div>
      `,
      confirmButtonText: 'ปิด',
    });
  }

  /* ---------- UI ---------- */
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>หน้าเก็บการแพ้ยา</div>
          <div className={styles.subtitle}>
            HN: <b>{patients_id}</b> • ผู้ป่วย: <b>{patient_name}</b>
          </div>
        </div>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${activeTab === 'form' ? styles.tabActive : ''}`} onClick={() => setActiveTab('form')}>บันทึกข้อมูลแพ้ยา</button>
          <button className={`${styles.tab} ${activeTab === 'list' ? styles.tabActive : ''}`} onClick={() => setActiveTab('list')}>รายการแพ้ยา ({items.length})</button>
        </div>
      </header>

      {errMsg && <div className={styles.bannerError}>{errMsg}</div>}

      {activeTab === 'form' ? (
        <section className={styles.card}>
          <form onSubmit={onSubmit} className={styles.grid}>
            <div className={styles.field}>
              <label>วันที่มีรายงาน</label>
              <input type="date" value={form.report_date} onChange={(e) => setForm({ ...form, report_date: e.target.value })} />
              {errors.report_date && <small className={styles.error}>{errors.report_date}</small>}
            </div>

            <div className={styles.field}>
              <label>วันที่มีอาการ</label>
              <input type="date" value={form.onset_date} onChange={(e) => setForm({ ...form, onset_date: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label>ยาที่แพ้ (ชื่อสามัญ)</label>
              <select
                value={form.substance}
                onChange={(e) => setForm({ ...form, substance: e.target.value })}
                disabled={drugLoading}
                title={drugLoading ? 'กำลังโหลดรายการยา...' : ''}
              >
                <option value="">{drugLoading ? '— กำลังโหลด —' : '— เลือกยา —'}</option>
                {drugOptions.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
              {form.substance === 'อื่น ๆ' && (
                <input
                  className={styles.mt8}
                  placeholder="ระบุชื่อสามัญ"
                  value={form.custom_substance}
                  onChange={(e) => setForm({ ...form, custom_substance: e.target.value })}
                />
              )}
              {(errors.substance || errors.custom_substance) && (
                <small className={styles.error}>{errors.substance || errors.custom_substance}</small>
              )}
            </div>

            <div className={styles.field}>
              <label>อาการที่แพ้</label>
              <input placeholder="เช่น ผื่น คัน หายใจลำบาก ช็อก ฯลฯ" value={form.reaction} onChange={(e) => setForm({ ...form, reaction: e.target.value })} />
            </div>

            <div className={styles.field}>
              <label>ความร้ายแรง</label>
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })}>
                <option value="">— เลือกความร้ายแรง —</option>
                {SEVERITY_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
              {errors.severity && <small className={styles.error}>{errors.severity}</small>}
            </div>

            <div className={styles.field}>
              <label>สาเหตุการเกิด (ระบบที่ได้รับผล)</label>
              <select value={form.system_affected} onChange={(e) => setForm({ ...form, system_affected: e.target.value })}>
                <option value="">— เลือกระบบ —</option>
                {SYSTEM_AFFECTED_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
              </select>
              {errors.system_affected && <small className={styles.error}>{errors.system_affected}</small>}
            </div>

            <div className={styles.field}>
              <label>ระดับความสัมพันธ์</label>
              <select value={form.causality} onChange={(e) => setForm({ ...form, causality: e.target.value as Causality })}>
                <option value="">— เลือกความสัมพันธ์ —</option>
                {CAUSALITY_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
              {errors.causality && <small className={styles.error}>{errors.causality}</small>}
            </div>

            <div className={styles.field}>
              <label>ผลที่เกิดขึ้นภายหลัง</label>
              <select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value as Outcome })}>
                <option value="">— เลือกผล —</option>
                {OUTCOME_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
              {errors.outcome && <small className={styles.error}>{errors.outcome}</small>}
            </div>

            <div className={styles.field}>
              <label>ประเภทผู้ป่วย</label>
              <select value={form.patient_type} onChange={(e) => setForm({ ...form, patient_type: e.target.value as PatientType })}>
                {PATIENT_TYPES.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
              {errors.patient_type && <small className={styles.error}>{errors.patient_type}</small>}
            </div>

            {/* Thai24 + Search button */}
            <div className={styles.field}>
              <label>รหัสมาตรฐาน (24 หลัก) ของยาที่แพ้</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  placeholder="เช่น 0000 0000 0000 0000 0000 0000"
                  value={thai24Display}
                  onChange={(e) => onThai24Change(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  style={{ flex: 1 }}
                />
                <button type="button" className={`${styles.btn}`} onClick={openThai24Search} title="ค้นหารหัส/ชื่อยา">
                  ค้นหา
                </button>
              </div>
              <div id="thai24-hint" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <progress max={24} value={thai24Len} style={{ width: 140, height: 8 }} />
                <span style={{ fontSize: 12, color: thai24Len === 0 ? '#666' : thai24OK ? '#0b8b4b' : '#b54747', fontWeight: 600 }}>
                  {thai24Len}/24 หลัก {thai24OK ? '✓ ครบ' : thai24Len > 0 ? '(ยังไม่ครบ)' : ''}
                </span>
              </div>
              {errors.thai24_code && <small className={styles.error}>{errors.thai24_code}</small>}
            </div>

            <div className={`${styles.field} ${styles.colSpan2}`}>
              <label>หมายเหตุ</label>
              <textarea rows={3} placeholder="บันทึกเพิ่มเติม เช่น แพทย์ผู้รายงาน สถานที่ ฯลฯ" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>

            <div className={`${styles.actions} ${styles.colSpan2}`}>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={loading}>
                {editingId ? 'อัปเดตรายการ' : 'บันทึกรายการ'}
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => (editingId ? onDelete() : resetForm())}>
                {editingId ? 'ลบรายการ' : 'ล้างฟอร์ม'}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className={styles.card}>
          {items.length === 0 ? (
            <div className={styles.empty}>ยังไม่มีการบันทึกแพ้ยา</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>วันที่รายงาน</th>
                    <th>ยา (ชื่อสามัญ)</th>
                    <th>อาการที่แพ้</th>
                    <th>ความร้ายแรง</th>
                    <th>สาเหตุการเกิด</th>
                    <th>ความสัมพันธ์</th>
                    <th>ผลหลังเหตุการณ์</th>
                    <th>ประเภทผู้ป่วย</th>
                    <th>รหัส 24 หลัก</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const code = onlyDigits24(it.thai24_code || '');
                    const info = code ? drugByCode[code] : undefined;
                    return (
                      <tr key={it.allergy_id}>
                        <td>{it.report_date || '-'}</td>
                        <td>{it.substance}</td>
                        <td title={it.reaction || ''}>{it.reaction || '-'}</td>
                        <td>{SEVERITY_OPTIONS.find(s => s.value === it.severity)?.label || '-'}</td>
                        <td>{it.system_affected || '-'}</td>
                        <td>{CAUSALITY_OPTIONS.find(s => s.value === it.causality)?.label || '-'}</td>
                        <td>{OUTCOME_OPTIONS.find(s => s.value === it.outcome)?.label || '-'}</td>
                        <td>{PATIENT_TYPES.find(p => p.value === it.patient_type)?.label || '-'}</td>
                        <td>
                          {code ? (
                            <div>
                              <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                                {format24Groups(code)}
                              </div>
                              <div style={{ fontSize: 12, color: '#57606a', marginTop: 2, lineHeight: 1.3 }}>
                                {info === undefined && code && drugLookupLoading ? 'กำลังดึงข้อมูล...' : null}
                                {info === null && 'ไม่พบในฐานรหัส'}
                                {info && (
                                  <>
                                    <div><b>DB:</b> {info.generic_name}</div>
                                    {info.atc_code ? <div><b>ATC:</b> {info.atc_code}</div> : null}
                                    {info.synonyms?.length ? (
                                      <div>
                                        <b>พ้อง:</b> {info.synonyms.slice(0, 4).join(', ')}{info.synonyms.length > 4 ? '…' : ''}
                                      </div>
                                    ) : null}
                                  </>
                                )}
                              </div>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className={styles.cellActions}>
                          <button className={`${styles.btn} ${styles.btnSmall}`} onClick={() => onEdit(it)}>แก้ไข</button>
                          <button className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`} onClick={() => onDelete(it.allergy_id)}>ลบ</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
