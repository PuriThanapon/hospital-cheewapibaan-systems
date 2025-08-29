// app/patient/[hn]/encounters/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Modal from '@/app/components/ui/Modal';
import DatePickerField from '@/app/components/DatePicker';
import { ClipboardList, Edit3, Plus, Save, User, X, Calendar, Pill, FileText, Activity, ArrowLeft, Stethoscope, Heart } from 'lucide-react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import BaselineForm from '@/app/components/forms/BaselineForm';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';
const join = (p: string) => (p.startsWith('http') ? p : `${API_BASE}${p}`);

const toast = Swal.mixin({
  toast: true, position: 'top-end', timer: 2200, showConfirmButton: false,
  didOpen: (t) => { t.onmouseenter = Swal.stopTimer; t.onmouseleave = Swal.resumeTimer; },
});

type Baseline = {
  patients_id: string;
  reason_in_dept?: string | null;
  reason_admit?: string | null;
  bedbound_cause?: string | null;
  other_history?: string | null;
};

type Treatment = {
  treatment_id: number;
  patients_id: string;
  symptom: string;
  severity: 'mild' | 'moderate' | 'severe';
  symptom_date: string;        // YYYY-MM-DD
  medication?: string | null;
  note?: string | null;
  created_at?: string;
};

type PatientName = {
  pname?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(join(url), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const ct = r.headers.get('content-type') || '';
  const data: any = ct.includes('json') ? await r.json() : await r.text();
  if (!r.ok) throw new Error(data?.error || data?.message || `HTTP ${r.status}`);
  return data as T;
}

const todayYMD = (tz = 'Asia/Bangkok') =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

function SevBadge({ s }: { s: 'mild'|'moderate'|'severe' }) {
  const map = {
    mild:     'bg-emerald-100 text-emerald-800 border-emerald-200',
    moderate: 'bg-amber-100 text-amber-800 border-amber-200',
    severe:   'bg-red-100 text-red-800 border-red-200',
  } as const;
  const th = s === 'mild' ? 'เบา' : s === 'moderate' ? 'ปานกลาง' : 'รุนแรง';
  return (
    <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${map[s]}`}>
      {th}
    </span>
  );
}

export default function EncountersPage() {
  // อ่าน hn จาก useParams ฝั่ง client
  const params = useParams<{ hn?: string }>();
  const raw = params?.hn;
  const hn = decodeURIComponent(Array.isArray(raw) ? raw[0] : (raw ?? ''));

  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState('');

  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [treatments, setTreatments] = useState<Treatment[]>([]);

  // ===== Patient name state
  const [pname, setPname] = useState<PatientName | null>(null);

  // ===== Baseline modal state
  const [blOpen, setBlOpen]     = useState(false);
  const [blSaving, setBlSaving] = useState(false);
  const [bl, setBl]             = useState<Baseline>({
    patients_id: hn || '',
    reason_in_dept: '',
    reason_admit: '',
    bedbound_cause: '',
    other_history: '',
  });

  // ===== Treatment modal state
  const [trOpen, setTrOpen]     = useState(false);
  const [trSaving, setTrSaving] = useState(false);
  const [tr, setTr]             = useState({
    patients_id: hn || '',
    symptom: '',
    severity: 'mild' as 'mild'|'moderate'|'severe',
    symptom_date: todayYMD(),
    medication: '',
    note: '',
  });

  // ให้ patients_id อัปเดตตาม hn เสมอ
  useEffect(() => {
    setBl(s => ({ ...s, patients_id: hn || '' }));
    setTr(s => ({ ...s, patients_id: hn || '' }));
  }, [hn]);

  // โหลดชื่อผู้ป่วยจากตาราง patients
  async function loadPatientName() {
    if (!hn) return;
    try {
      // คาดหวังให้มีเอ็นด์พอยต์นี้: GET /api/patients/:hn → { data: { pname, first_name, last_name, ... } } หรือ object ตรง ๆ
      const res = await http<any>(`/api/patients/${encodeURIComponent(hn)}`);
      const obj = res?.data ?? res ?? {};
      setPname({
        pname: obj.pname ?? null,
        first_name: obj.first_name ?? null,
        last_name: obj.last_name ?? null,
      });
    } catch {
      // ถ้าไม่มีเอ็นด์พอยต์ดังกล่าว ก็ปล่อยว่างไว้ (แสดงเฉพาะ HN)
      setPname(null);
    }
  }

  async function loadAll() {
    if (!hn) return;
    setLoading(true); setErr('');
    try {
      const res = await http<{ data: { baseline: Baseline | null; treatments: Treatment[] } }>(
        `/api/patients/${encodeURIComponent(hn)}/encounters/summary`
      );
      const b = res?.data?.baseline || null;
      setBaseline(b);
      setBl(prev => ({ ...prev, patients_id: hn, ...(b || {}) }));
      setTreatments(res?.data?.treatments || []);
      if (!b) setBlOpen(true);
    } catch (e: any) {
      setErr(e.message || 'โหลดไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    loadPatientName();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hn]);

  async function saveBaseline() {
    setBlSaving(true);
    try {
      await http(`/api/patients/${encodeURIComponent(hn)}/encounters/baseline`, {
        method: 'POST',
        body: JSON.stringify(bl),
      });
      toast.fire({ icon: 'success', title: 'บันทึกประวัติเบื้องต้นแล้ว' });
      setBlOpen(false);
      loadAll();
    } catch (e: any) {
      toast.fire({ icon: 'error', title: e.message || 'บันทึกไม่สำเร็จ' });
    } finally {
      setBlSaving(false);
    }
  }

  async function addTreatment() {
    if (!tr.symptom.trim()) {
      toast.fire({ icon: 'warning', title: 'กรอก "อาการที่เป็น"' });
      return;
    }
    setTrSaving(true);
    try {
      await http(`/api/patients/${encodeURIComponent(hn)}/encounters/treatments`, {
        method: 'POST',
        body: JSON.stringify(tr),
      });
      toast.fire({ icon: 'success', title: 'เพิ่มบันทึกการรักษาแล้ว' });
      setTrOpen(false);
      setTr({ patients_id: hn, symptom: '', severity: 'mild', symptom_date: todayYMD(), medication: '', note: '' });
      loadAll();
    } catch (e: any) {
      toast.fire({ icon: 'error', title: e.message || 'บันทึกไม่สำเร็จ' });
    } finally {
      setTrSaving(false);
    }
  }

  const fullName = useMemo(() => {
    if (!pname) return '';
    const s = `${pname.pname ?? ''}${pname.first_name ?? ''} ${pname.last_name ?? ''}`;
    return s.replace(/\s+/g, ' ').trim();
  }, [pname]);

  if (!hn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-sm border">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">ไม่พบข้อมูล HN</h2>
          <p className="text-gray-600 text-sm">กรุณาระบุรหัส HN ในพาธ เช่น /patient/HN-00000001/encounters</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-sm border">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{backgroundColor: 'rgba(0, 90, 80, 0.1)'}}>
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{borderColor: '#005A50', borderTopColor: 'transparent'}}></div>
          </div>
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-sm border">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-red-800 mb-2">เกิดข้อผิดพลาด</h2>
          <p className="text-red-600 text-sm">{err}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen rounded-2xl">
      {/* ===== HEADER ===== */}
      <header className="bg-white border-b border-gray-200 rounded-2xl mb-5">
        <div className="w-full px-6 py-6">
          <div className="flex items-center gap-4 mb-6">
            <Link 
              href={`/patient`} 
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            
            <div className="p-3 rounded-lg text-white" style={{backgroundColor: '#005A50'}}>
              <Stethoscope className="w-6 h-6" />
            </div>
            
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">ประวัติผู้ป่วย</h1>
              <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                <span className="px-3 py-1 rounded-md text-white font-mono font-medium" style={{backgroundColor: '#005A50'}}>
                  {hn}
                </span>
                {fullName && <span className="font-medium">{fullName}</span>}
              </div>
            </div>

            <button
              className="px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 hover:opacity-90"
              style={{backgroundColor: '#005A50'}}
              onClick={() => setBlOpen(true)}
            >
              <Edit3 className="w-4 h-4" /> แก้ไขประวัติ
            </button>
          </div>

          {/* BASELINE INFO */}
          {!baseline ? (
            <div className="p-4 rounded-lg border border-amber-200 bg-amber-50">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800">ยังไม่มีประวัติเบื้องต้น</p>
                  <p className="text-amber-700 text-sm">กรุณากรอกข้อมูลเบื้องต้นของผู้ป่วย</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4" style={{color: '#005A50'}} />
                  <h3 className="text-sm font-medium text-gray-700">เหตุผลที่อยู่แผนก</h3>
                </div>
                <p className="text-sm text-gray-900 leading-relaxed">
                  {baseline.reason_in_dept || <span className="text-gray-400">ไม่ระบุ</span>}
                </p>
              </div>

              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList className="w-4 h-4 text-green-600" />
                  <h3 className="text-sm font-medium text-gray-700">สาเหตุที่เข้าแผนก</h3>
                </div>
                <p className="text-sm text-gray-900 leading-relaxed">
                  {baseline.reason_admit || <span className="text-gray-400">ไม่ระบุ</span>}
                </p>
              </div>

              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-medium text-gray-700">สาเหตุติดเตียง</h3>
                </div>
                <p className="text-sm text-gray-900 leading-relaxed">
                  {baseline.bedbound_cause || <span className="text-gray-400">ไม่ระบุ</span>}
                </p>
              </div>

              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-orange-600" />
                  <h3 className="text-sm font-medium text-gray-700">อื่น ๆ</h3>
                </div>
                <p className="text-sm text-gray-900 leading-relaxed max-h-16 overflow-y-auto">
                  {baseline.other_history || <span className="text-gray-400">ไม่ระบุ</span>}
                </p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className="bg-[#f7f7fb] w-full px-6 py-8 space-y-6 rounded-2xl">
        {/* ADD NEW TREATMENT */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{backgroundColor: 'rgba(0, 90, 80, 0.1)'}}>
                <Plus className="w-5 h-5" style={{color: '#005A50'}} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">เพิ่มบันทึกการรักษา</h2>
                <p className="text-sm text-gray-600">บันทึกอาการและการรักษาใหม่</p>
              </div>
            </div>
            
            <button
              className="px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 hover:opacity-90"
              style={{backgroundColor: '#005A50'}}
              onClick={() => setTrOpen(true)}
            >
              <Plus className="w-4 h-4" />
              เพิ่มรายการ
            </button>
          </div>

          {treatments.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="font-medium">ยังไม่มีบันทึกการรักษา</p>
              <p className="text-sm">เริ่มต้นด้วยการเพิ่มรายการแรก</p>
            </div>
          )}
        </section>

        {/* TREATMENT HISTORY */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg" style={{backgroundColor: 'rgba(0, 90, 80, 0.1)'}}>
              <Heart className="w-5 h-5" style={{color: '#005A50'}} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">ประวัติการรักษา</h2>
              <p className="text-sm text-gray-600">รายการการรักษาที่ผ่านมาทั้งหมด</p>
            </div>
          </div>
          
          {treatments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="font-medium text-gray-600 mb-2">ไม่มีประวัติการรักษา</h3>
              <p className="text-sm">เมื่อเพิ่มบันทึกการรักษาแล้ว จะแสดงผลที่นี่</p>
            </div>
          ) : (
            <div className="space-y-4">
              {treatments.map((t) => (
                <div key={t.treatment_id} className="p-5 bg-gray-50 rounded-lg border">
                  <h3 className="font-medium text-gray-900 mb-3">{t.symptom}</h3>
                  
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{t.symptom_date}</span>
                    </div>
                    
                    <SevBadge s={t.severity} />
                    
                    {t.medication && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Pill className="w-4 h-4" />
                        <span>{t.medication}</span>
                      </div>
                    )}
                  </div>
                  
                  {t.note && (
                    <div className="p-3 bg-white rounded-lg border-l-4" style={{borderColor: '#005A50'}}>
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">หมายเหตุ</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{t.note}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
        <BaselineForm value={bl} onChange={setBl} />
      </main>

      {/* ===== BASELINE MODAL ===== */}
      {blOpen && (
        <Modal
          open
          size="lg"
          onClose={() => setBlOpen(false)}
          onConfirm={saveBaseline}
          title="บันทึกประวัติเบื้องต้น"
          footer={
            <div className="flex justify-end gap-3">
              <button 
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2" 
                onClick={() => setBlOpen(false)}
              >
                <X className="w-4 h-4" /> ยกเลิก
              </button>
              <button
                className="px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 hover:opacity-90"
                style={{backgroundColor: '#005A50'}}
                onClick={saveBaseline}
                disabled={blSaving}
              >
                <Save className="w-4 h-4" /> บันทึก
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">เหตุผลที่มาอยู่แผนกนี้</label>
              <textarea 
                className="w-full border border-gray-300 rounded-lg p-3 resize-none" 
                style={{'--tw-ring-color': '#005A50'}}
                onFocus={(e) => e.target.style.borderColor = '#005A50'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'} 
                rows={3}
                placeholder="กรุณาระบุเหตุผล..."
                value={bl.reason_in_dept || ''} 
                onChange={e => setBl(s => ({...s, reason_in_dept:e.target.value}))}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">สาเหตุที่เข้ามาที่แผนก</label>
              <textarea 
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" 
                rows={3}
                placeholder="กรุณาระบุสาเหตุ..."
                value={bl.reason_admit || ''} 
                onChange={e => setBl(s => ({...s, reason_admit:e.target.value}))}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">สาเหตุที่ติดเตียง</label>
              <textarea 
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" 
                rows={3}
                placeholder="กรุณาระบุสาเหตุ..."
                value={bl.bedbound_cause || ''} 
                onChange={e => setBl(s => ({...s, bedbound_cause:e.target.value}))}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">อื่น ๆ</label>
              <textarea 
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" 
                rows={4}
                placeholder="ข้อมูลเพิ่มเติม..."
                value={bl.other_history || ''} 
                onChange={e => setBl(s => ({...s, other_history:e.target.value}))}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* ===== TREATMENT MODAL ===== */}
      {trOpen && (
        <Modal
          open
          size="lg"
          onClose={() => setTrOpen(false)}
          onConfirm={addTreatment}
          title="เพิ่มบันทึกการรักษาตามอาการ"
          footer={
            <div className="flex justify-end gap-3">
              <button 
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2" 
                onClick={() => setTrOpen(false)}
              >
                <X className="w-4 h-4" /> ยกเลิก
              </button>
              <button
                className="px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 hover:opacity-90"
                style={{backgroundColor: '#005A50'}}
                onClick={addTreatment}
                disabled={trSaving}
              >
                <Save className="w-4 h-4" /> บันทึก
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <span className="text-red-500">*</span> อาการที่เป็น
              </label>
              <textarea 
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" 
                rows={3}
                placeholder="อธิบายอาการที่เป็น..."
                value={tr.symptom} 
                onChange={e => setTr(s => ({...s, symptom:e.target.value}))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ระดับความรุนแรง</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={tr.severity} 
                  onChange={e => setTr(s => ({...s, severity: e.target.value as any}))}
                >
                  <option value="mild">เบา</option>
                  <option value="moderate">ปานกลาง</option>
                  <option value="severe">รุนแรง</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">วันที่เกิดอาการ</label>
                <DatePickerField 
                  value={tr.symptom_date} 
                  onChange={(v) => setTr(s => ({...s, symptom_date: v}))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ยา/วิธีการรักษา</label>
              <input 
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="ระบุยาหรือวิธีการรักษา..."
                value={tr.medication || ''} 
                onChange={e => setTr(s => ({...s, medication:e.target.value}))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">หมายเหตุเพิ่มเติม</label>
              <textarea 
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" 
                rows={3}
                placeholder="หมายเหตุหรือข้อมูลเพิ่มเติม..."
                value={tr.note || ''} 
                onChange={e => setTr(s => ({...s, note:e.target.value}))}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}