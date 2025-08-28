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

/* ---------- Master data ---------- */
const FALLBACK_DRUGS = [
  'PARACETAMOL','IBUPROFEN','AMOXICILLIN','CLARITHROMYCIN','METRONIDAZOLE',
  'PENICILLIN V','ASPIRIN','TRIMETHOPRIM/SULFAMETHOXAZOLE','CLINDAMYCIN',
  'AZITHROMYCIN','CIPROFLOXACIN','LEVOFLOXACIN','CEPHALEXIN','CEFTRIAXONE',
  'DOXYCYCLINE','ERYTHROMYCIN','NAPROXEN','DICLOFENAC','MORPHINE','CODEINE',
  'PREDNISOLONE','OMEPRAZOLE','RANITIDINE','METFORMIN','INSULIN REGULAR','อื่น ๆ',
];

const SEVERITY_OPTIONS = [
  { value: 'mild' as Severity,      label: 'ไม่ร้ายแรง' },
  { value: 'moderate' as Severity,  label: 'ปานกลาง' },
  { value: 'severe' as Severity,    label: 'รุนแรง' },
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

const CAUSALITY_OPTIONS = [
  { value: 'certain' as Causality,      label: 'Certain (แน่นอน)' },
  { value: 'probable' as Causality,     label: 'Probable (น่าจะใช่)' },
  { value: 'possible' as Causality,     label: 'Possible (เป็นไปได้)' },
  { value: 'unlikely' as Causality,     label: 'Unlikely (ไม่น่าจะใช่)' },
  { value: 'unclassified' as Causality, label: 'Unclassified (จำแนกไม่ได้)' },
];

const OUTCOME_OPTIONS = [
  { value: 'recovered' as Outcome,  label: 'หายเป็นปกติ' },
  { value: 'improving' as Outcome,  label: 'อาการดีขึ้น' },
  { value: 'unchanged' as Outcome,  label: 'ทรงตัว' },
  { value: 'worsened' as Outcome,   label: 'แย่ลง' },
  { value: 'death' as Outcome,      label: 'เสียชีวิต' },
];

const PATIENT_TYPES = [
  { value: 'OPD' as PatientType,     label: 'OPD (ผู้ป่วยนอก)' },
  { value: 'IPD' as PatientType,     label: 'IPD (ผู้ป่วยใน)' },
  { value: 'ER' as PatientType,      label: 'ER (ฉุกเฉิน)' },
  { value: 'HOME' as PatientType,    label: 'ดูแลที่บ้าน/ชุมชน' },
  { value: 'UNKNOWN' as PatientType, label: 'ไม่ทราบ' },
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
        msg = (j as any).message || (j as any).error || msg;
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

/* ---------- Date helper ---------- */
const fmtDate = (v?: string | null) => {
  if (!v) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

/* ---------- Label / Escape helpers ---------- */
const toLabel = <T extends string>(arr: { value: T; label: string }[], v?: T | string | null) =>
  arr.find(o => o.value === v)?.label || (v as string) || '-';
const esc = (s?: any) =>
  String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[m]);

/* ---------- Required helpers ---------- */
const req = (s?: string | null) => !!(s && s.toString().trim());

/* ======================================================================= */

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

  // drug list for auto-fill
  const [drugOptions, setDrugOptions] = useState<string[]>([]);
  const [drugLoading, setDrugLoading] = useState<boolean>(true);
  const nameMapRef = useRef<Map<string, DrugCode[]>>(new Map());

  // drug info lookup cache for list
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

  /* ---------- Load items ---------- */
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

  /* ---------- Load drug options + name map ---------- */
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
        const mp = new Map<string, DrugCode[]>();
        for (const d of list) {
          const k = (d.generic_name || '').trim().toUpperCase();
          if (!k) continue;
          if (!mp.has(k)) mp.set(k, []);
          mp.get(k)!.push(d);
        }
        if (!alive) return;
        nameMapRef.current = mp;
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

  function onSubstanceChange(val: string) {
    setForm(prev => {
      const next = { ...prev, substance: val };
      if (val === 'อื่น ๆ') return { ...next, custom_substance: '', thai24_code: '' };
      const arr = nameMapRef.current.get(val.toUpperCase()) || [];
      const chosen = arr.find(x => !!x.code_24) || arr[0];
      return {
        ...next,
        custom_substance: '',
        thai24_code: chosen?.code_24 ? onlyDigits24(chosen.code_24) : ''
      };
    });
  }

  /* ---------- Validate ---------- */
  function validate(f: AllergyForm) {
    const e: Partial<Record<keyof AllergyForm, string>> = {};

    if (!req(f.report_date))      e.report_date = 'กรุณาเลือกวันที่มีรายงาน';
    if (!req(f.onset_date))       e.onset_date = 'กรุณาเลือกวันที่มีอาการ';
    if (!req(f.substance))        e.substance = 'กรุณาเลือกยาที่แพ้';
    if (f.substance === 'อื่น ๆ' && !req(f.custom_substance))
                                  e.custom_substance = 'ระบุชื่อสามัญของยา';
    if (!req(f.reaction))         e.reaction = 'ระบุอาการที่แพ้';
    if (!req(f.severity))         e.severity = 'เลือกความร้ายแรง';
    if (!req(f.system_affected))  e.system_affected = 'เลือกระบบอวัยวะที่ได้รับผล';
    if (!req(f.causality))        e.causality = 'เลือกระดับความสัมพันธ์';
    if (!req(f.outcome))          e.outcome = 'เลือกผลที่เกิดขึ้นภายหลัง';
    if (!req(f.patient_type))     e.patient_type = 'เลือกประเภทผู้ป่วย';

    const digits = onlyDigits24(f.thai24_code);
    if (digits.length !== 24)     e.thai24_code = 'กรอกรหัสมาตรฐาน 24 หลักให้ครบ';

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

    // Clean values before validate/send
    const cleaned: AllergyForm = {
      ...form,
      report_date: (form.report_date || '').trim(),
      onset_date:  (form.onset_date  || '').trim(),
      substance:   (form.substance   || '').trim(),
      custom_substance: form.substance === 'อื่น ๆ' ? (form.custom_substance || '').trim() : '',
      reaction:    (form.reaction    || '').trim(),
      system_affected: (form.system_affected || '').trim(),
      thai24_code: onlyDigits24(form.thai24_code),
      note:        (form.note || '').trim(),
    };

    const err = validate(cleaned);
    setErrors(err);
    if (Object.keys(err).length) {
      const firstMsg = Object.values(err)[0] as string;
      await Swal.fire({ icon: 'warning', title: 'กรอกข้อมูลไม่ครบ', text: firstMsg || '' });
      return;
    }

    const normalizedSubstance =
      cleaned.substance === 'อื่น ๆ' ? cleaned.custom_substance! : cleaned.substance;

    const body = {
      ...cleaned,
      substance: normalizedSubstance,
      thai24_code: onlyDigits24(cleaned.thai24_code),
      onset_date: cleaned.onset_date,
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
      report_date: item.report_date ? fmtDate(item.report_date) : todayISO(),
      onset_date: item.onset_date ? fmtDate(item.onset_date) : '',
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

  /* ---------- Thai24 auto-fill on typing ---------- */
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

  /* ---------- Lookup drug info for list ---------- */
  useEffect(() => {
    let alive = true;
    const codes = Array.from(new Set(items.map(it => onlyDigits24(it.thai24_code || '')).filter(c => c.length === 24)));
    const toFetch = codes.filter(c => !(c in drugByCode));
    if (!toFetch.length) return;

    setDrugLookupLoading(true);
    (async () => {
      try {
        const results = await Promise.all(
          toFetch.map(async (code) => {
            try {
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

  /* ---------- SEARCH MODAL ---------- */
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
      const res = await withLoading('กำลังค้นหา...', () =>
        api<{ data: DrugCode[] }>(`/api/drug_codes?q=${encodeURIComponent(q.trim())}`)
      );
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
    await Swal.fire({
      icon: 'success',
      title: 'เลือกแล้ว',
      html: `
        <div style="text-align:left">
          <div><b>ชื่อสามัญ:</b> ${esc(picked.generic_name)}</div>
          <div><b>รหัส 24 หลัก:</b> ${esc(picked.code_24 || '-')}</div>
          <div><b>ATC:</b> ${esc(picked.atc_code || '-')}</div>
          <div><b>ชื่อพ้อง:</b> ${esc((picked.synonyms || []).join(', ') || '-')}</div>
        </div>
      `,
      confirmButtonText: 'ปิด',
    });
  }

  /* ---------- Detail modal ---------- */
  async function viewDetails(it: AllergyRow) {
    const code = onlyDigits24(it.thai24_code || '');
    let info: DrugCode | null | undefined = code ? drugByCode[code] : undefined;

    if (code && (info === undefined || info === null)) {
      try {
        const res = await withLoading('กำลังดึงรายละเอียดรหัส...', () =>
          api<{ data: DrugCode[] }>(`/api/drug_codes?code_24=${code}&limit=1`)
        );
        info = res?.data?.[0] || null;
        setDrugByCode(prev => ({ ...prev, [code]: info || null }));
      } catch {
        info = null;
      }
    }

    const sevLabel = toLabel(SEVERITY_OPTIONS, it.severity);
    const cauLabel = toLabel(CAUSALITY_OPTIONS, it.causality);
    const outLabel = toLabel(OUTCOME_OPTIONS, it.outcome);
    const ptypeLabel = toLabel(PATIENT_TYPES, it.patient_type);

    const tagSev =
      it.severity === 'severe' ? '<span style="color:#b91c1c;font-weight:700">รุนแรง</span>' :
      it.severity === 'moderate' ? '<span style="color:#92400e;font-weight:600">ปานกลาง</span>' :
      it.severity === 'mild' ? '<span style="color:#065f46;font-weight:600">ไม่ร้ายแรง</span>' : esc(sevLabel);

    const html = `
    <div style="text-align:left;display:grid;grid-template-columns:1fr 1fr;gap:10px;line-height:1.35">
      <div><b>วันที่มีรายงาน:</b> ${esc(fmtDate(it.report_date))}</div>
      <div><b>วันที่มีอาการ:</b> ${esc(fmtDate(it.onset_date))}</div>

      <div style="grid-column:1/-1"><b>ยา (ชื่อสามัญ):</b> ${esc(it.substance)}</div>
      <div><b>ประเภทผู้ป่วย:</b> ${esc(ptypeLabel)}</div>

      <div><b>ความร้ายแรง:</b> ${tagSev}</div>
      <div><b>ความสัมพันธ์:</b> ${esc(cauLabel)}</div>

      <div style="grid-column:1/-1"><b>ระบบอวัยวะที่ได้รับผล:</b> ${esc(it.system_affected || '-')}</div>

      <div style="grid-column:1/-1"><b>อาการที่แพ้:</b><div style="white-space:pre-wrap">${esc(it.reaction || '-')}</div></div>

      <div><b>ผลที่เกิดขึ้นภายหลัง:</b> ${esc(outLabel)}</div>
      <div><b>อัปเดตล่าสุด:</b> ${esc(fmtDate(it.updated_at))}</div>

      <div style="grid-column:1/-1"><b>หมายเหตุ:</b><div style="white-space:pre-wrap">${esc(it.note || '-')}</div></div>

      <hr style="grid-column:1/-1;border:none;border-top:1px solid #e5e7eb;margin:4px 0" />

      <div style="grid-column:1/-1"><b>ข้อมูลจากฐานรหัสยา</b></div>
      <div><b>DB ชื่อสามัญ:</b> ${esc(info?.generic_name || '-')}</div>
      <div><b>ATC:</b> ${esc(info?.atc_code || '-')}</div>
      ${info?.synonyms?.length ? `<div style="grid-column:1/-1"><b>ชื่อพ้อง:</b> ${esc(info.synonyms.join(', '))}</div>` : ''}
    </div>`;

    await Swal.fire({ icon: 'info', title: 'รายละเอียดการแพ้ยา', html, width: 700, confirmButtonText: 'ปิด' });
  }

  /* ---------- UI ---------- */
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>💊 หน้าเก็บการแพ้ยา</div>
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
          {/* ---- FORM ---- */}
          <form onSubmit={onSubmit} className={styles.grid}>
            <div className={styles.field}>
              <label>วันที่มีรายงาน</label>
              <input
                type="date"
                required
                value={form.report_date}
                onChange={(e) => setForm({ ...form, report_date: e.target.value })}
              />
              {errors.report_date && <small className={styles.error}>{errors.report_date}</small>}
            </div>

            <div className={styles.field}>
              <label>วันที่มีอาการ</label>
              <input
                type="date"
                required
                value={form.onset_date}
                onChange={(e) => setForm({ ...form, onset_date: e.target.value })}
              />
              {errors.onset_date && <small className={styles.error}>{errors.onset_date}</small>}
            </div>

            <div className={styles.field}>
              <label>ยาที่แพ้ (ชื่อสามัญ)</label>
              <div className={styles.withPrefix}>
                <span className={styles.pillIcon} aria-hidden>💊</span>
                <select
                  required
                  value={form.substance}
                  onChange={(e) => onSubstanceChange(e.target.value)}
                  disabled={drugLoading}
                  title={drugLoading ? 'กำลังโหลดรายการยา...' : ''}
                >
                  <option value="">{drugLoading ? '— กำลังโหลด —' : '— เลือกยา —'}</option>
                  {drugOptions.map((d) => (<option key={d} value={d}>{d}</option>))}
                </select>
              </div>
              {form.substance === 'อื่น ๆ' && (
                <input
                  className={styles.mt8}
                  placeholder="ระบุชื่อสามัญ"
                  required
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
              <input
                required
                placeholder="เช่น ผื่น คัน หายใจลำบาก ช็อก ฯลฯ"
                value={form.reaction}
                onChange={(e) => setForm({ ...form, reaction: e.target.value })}
              />
              {errors.reaction && <small className={styles.error}>{errors.reaction}</small>}
            </div>

            <div className={styles.field}>
              <label>ความร้ายแรง</label>
              <select required value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })}>
                <option value="">— เลือกความร้ายแรง —</option>
                {SEVERITY_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
              {errors.severity && <small className={styles.error}>{errors.severity}</small>}
            </div>

            <div className={styles.field}>
              <label>สาเหตุการเกิด (ระบบที่ได้รับผล)</label>
              <select required value={form.system_affected} onChange={(e) => setForm({ ...form, system_affected: e.target.value })}>
                <option value="">— เลือกระบบ —</option>
                {SYSTEM_AFFECTED_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
              </select>
              {errors.system_affected && <small className={styles.error}>{errors.system_affected}</small>}
            </div>

            <div className={styles.field}>
              <label>ระดับความสัมพันธ์</label>
              <select required value={form.causality} onChange={(e) => setForm({ ...form, causality: e.target.value as Causality })}>
                <option value="">— เลือกความสัมพันธ์ —</option>
                {CAUSALITY_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
              {errors.causality && <small className={styles.error}>{errors.causality}</small>}
            </div>

            <div className={styles.field}>
              <label>ผลที่เกิดขึ้นภายหลัง</label>
              <select required value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value as Outcome })}>
                <option value="">— เลือกผล —</option>
                {OUTCOME_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
              {errors.outcome && <small className={styles.error}>{errors.outcome}</small>}
            </div>

            <div className={styles.field}>
              <label>ประเภทผู้ป่วย</label>
              <select required value={form.patient_type} onChange={(e) => setForm({ ...form, patient_type: e.target.value as PatientType })}>
                {PATIENT_TYPES.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
              {errors.patient_type && <small className={styles.error}>{errors.patient_type}</small>}
            </div>

            {/* Thai24 + Search button */}
            <div className={styles.field}>
              <label>รหัสมาตรฐาน (24 หลัก) ของยาที่แพ้</label>
              <div className={styles.row}>
                <input
                  required
                  placeholder="เช่น 0000 0000 0000 0000 0000 0000"
                  value={thai24Display}
                  onChange={(e) => onThai24Change(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                />
                <button type="button" className={`${styles.btn}`} onClick={openThai24Search} title="ค้นหารหัส/ชื่อยา">ค้นหา</button>
              </div>
              <div className={styles.hintRow}>
                <progress max={24} value={thai24Len} />
                <span className={thai24OK ? styles.ok : thai24Len ? styles.warn : styles.muted}>
                  {thai24Len}/24 หลัก {thai24OK ? '✓ ครบ' : thai24Len > 0 ? '(ยังไม่ครบ)' : ''}
                </span>
              </div>
              {errors.thai24_code && <small className={styles.error}>{errors.thai24_code}</small>}
            </div>

            <div className={`${styles.field} ${styles.colSpan2}`}>
              <label>หมายเหตุ</label>
              <textarea
                rows={3}
                placeholder="บันทึกเพิ่มเติม เช่น แพทย์ผู้รายงาน สถานที่ ฯลฯ"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
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
          {/* ---- LIST ---- */}
          {items.length === 0 ? (
            <div className={styles.empty}>ยังไม่มีการบันทึกแพ้ยา</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>วันที่</th>
                    <th style={{ width: 220 }}>ยา</th>
                    <th>อาการที่แพ้</th>
                    <th>ความร้ายแรง</th>
                    <th>ผลที่เกิดขึ้นภายหลัง</th>
                    <th style={{ width: 260 }}>จัดการ</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((it) => {
                    const code = onlyDigits24(it.thai24_code || '');
                    const info = code ? drugByCode[code] : undefined;

                    const outcomeLabel =
                      OUTCOME_OPTIONS.find(s => s.value === it.outcome)?.label || it.outcome || '-';

                    const outcomeClass =
                      it.outcome === 'recovered' ? styles.sevMild :
                      it.outcome === 'improving' ? styles.sevModerate :
                      it.outcome === 'worsened' || it.outcome === 'death' ? styles.sevSevere :
                      styles.sevUnknown;

                    const drugCell = (
                      <div className={styles.drugCell} title={it.system_affected || ''}>
                        <div className={styles.drugMain}>
                          <span className={styles.pillIcon} aria-hidden>💊</span>
                          <span className={styles.drugName}>{it.substance}</span>
                          {info?.atc_code ? <span className={styles.atcTag}>{info.atc_code}</span> : null}
                        </div>
                        {info?.generic_name && info.generic_name !== it.substance ? (
                          <div className={styles.drugSub}>DB: {info.generic_name}</div>
                        ) : null}
                      </div>
                    );

                    return (
                      <tr key={it.allergy_id}>
                        <td className={styles.dateStack} suppressHydrationWarning>
                          <div className={styles.dateMain}>{fmtDate(it.report_date)}</div>
                          <div className={styles.dateSub}>อาการ: {fmtDate(it.onset_date)}</div>
                        </td>

                        <td>{drugCell}</td>

                        <td className={styles.ellipsis} title={it.reaction || ''}>
                          {it.reaction || '-'}
                        </td>

                        <td>
                          <span
                            className={`${styles.sev} ${
                              it.severity === 'mild' ? styles.sevMild
                              : it.severity === 'moderate' ? styles.sevModerate
                              : it.severity === 'severe' ? styles.sevSevere
                              : styles.sevUnknown
                            }`}
                          >
                            {SEVERITY_OPTIONS.find(s => s.value === it.severity)?.label || '-'}
                          </span>
                        </td>

                        <td>
                          <span className={`${styles.sev} ${outcomeClass}`}>
                            {outcomeLabel}
                          </span>
                        </td>

                        <td className={styles.cellActions} style={{ flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnSmall} ${styles.btnInfo}`}
                            onClick={() => viewDetails(it)}
                            style={{ whiteSpace: 'normal' }}
                          >
                            ตรวจสอบรายละเอียด
                          </button>
                          <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => onEdit(it)}>แก้ไข</button>
                          <button type="button" className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`} onClick={() => onDelete(it.allergy_id)}>ลบ</button>
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
