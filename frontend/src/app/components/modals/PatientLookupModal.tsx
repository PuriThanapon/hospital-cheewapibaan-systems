// components/modals/PatientLookupModal.tsx
'use client';
import React, { useEffect, useState } from 'react';
import DatePickerField from '../DatePicker';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';
const joinUrl = (b:string,p:string)=>`${b.replace(/\/$/,'')}${p.startsWith('/')?p:`/${p}`}`;

type Patient = {
  patients_id: string;
  pname?: string; first_name?: string; last_name?: string;
  birthdate?: string; gender?: string; phone_number?: string;
  department?: string; last_visit?: string;
  score?: number;
};

function toISODate(d?: string | Date | null) {
  if (!d) return undefined;
  const obj = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(obj.getTime())) return undefined;
  const y = obj.getFullYear();
  const m = String(obj.getMonth() + 1).padStart(2, '0');
  const dd = String(obj.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export default function PatientLookupModal({
  open, onClose, onSelect
}:{ open:boolean; onClose:()=>void; onSelect:(p:Patient)=>void }) {
  const [mode, setMode] = useState<'fuzzy'|'recent'>('fuzzy');
  const [q, setQ] = useState('');
  const [dob, setDob] = useState<string>('');       // เก็บเป็น 'YYYY-MM-DD' เสมอ
  const [dept, setDept] = useState<string>('');
  const [rows, setRows] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');

  useEffect(()=>{ if(open){ setRows([]); setLoading(false); setErr(''); } },[open]);

  async function search() {
    setLoading(true);
    setErr('');
    try {
      let url: string;
      if (mode === 'recent') {
        url = joinUrl(API_BASE, `/api/patients/recent?limit=50`);
      } else {
        // กันส่งคำขอว่างเปล่า (บางแบ็กเอนด์จะ 400)
        const hasAny = q.trim() || dob || dept.trim();
        if (!hasAny) {
          setRows([]);
          setErr('กรุณากรอกคำค้นหา หรือระบุอย่างน้อย 1 ตัวกรอง');
          return;
        }
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (dob) params.set('dob', dob);          // ถูกฟอร์แมตแล้ว
        if (dept.trim()) params.set('dept', dept.trim());
        params.set('limit', '20');
        url = joinUrl(API_BASE, `/api/patients/search?${params.toString()}`);
      }

      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      // แสดงข้อความ error ที่ฝั่งแบ็กเอนด์ส่งมาให้ชัด
      if (!res.ok) {
        let msg = `ค้นหาไม่สำเร็จ (HTTP ${res.status})`;
        try {
          const j = await res.json();
          msg = (j as any).message || (j as any).error || msg;
        } catch {}
        throw new Error(msg);
      }

      const json = await res.json();
      setRows(json.data || []);
    } catch (e: any) {
      setRows([]);
      setErr(e?.message || 'ค้นหาไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  // เปิด recent แล้วดึงทันที
  useEffect(()=>{ if(open && mode==='recent'){ void search(); } },[open,mode]);

  if(!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-[12000] flex items-center justify-center">
      <div className="bg-white rounded-2xl w-full max-w-3xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">ค้นหาผู้ป่วย</h3>
          <button onClick={onClose} className="px-2 py-1 rounded bg-gray-100">ปิด</button>
        </div>

        <div className="flex gap-2 mb-3">
          <button
            className={`px-3 py-1 rounded ${mode==='fuzzy'?'bg-blue-600 text-white':'bg-gray-100'}`}
            onClick={()=>{ setMode('fuzzy'); setErr(''); }}
          >
            จำได้คร่าวๆ
          </button>
          <button
            className={`px-3 py-1 rounded ${mode==='recent'?'bg-blue-600 text-white':'bg-gray-100'}`}
            onClick={()=>{ setMode('recent'); setErr(''); }}
          >
            ลืมทั้งหมด
          </button>
        </div>

        {mode==='fuzzy' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <input
              className="border rounded px-3 py-2 md:col-span-3"
              placeholder="พิมพ์: ชื่อ/เศษ HN/เลขบัตร/เบอร์โทร/คำใบ้"
              value={q}
              onChange={e=>setQ(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') search(); }}
            />
            <DatePickerField
              value={dob ? new Date(`${dob}T00:00:00`) : null}
              onChange={(val: string | null) => setDob(val || '')}
              placeholder="วันเกิด (ตัวกรอง)"
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="แผนก (ตัวกรอง)"
              value={dept}
              onChange={e=>setDept(e.target.value)}
            />
            <div className="md:col-span-3">
              <button onClick={search} className="px-4 py-2 rounded bg-blue-600 text-white">ค้นหา</button>
            </div>
          </div>
        )}

        {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">ชื่อ-นามสกุล</th>
                <th className="p-2">HN</th>
                <th className="p-2">วันเกิด</th>
                <th className="p-2">เบอร์</th>
                <th className="p-2">แผนกล่าสุด</th>
                <th className="p-2">เลือก</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-4 text-center">กำลังค้นหา…</td></tr>
              ) : rows.length===0 ? (
                <tr><td colSpan={6} className="p-4 text-center">ไม่พบข้อมูล</td></tr>
              ) : rows.map((r)=>(
                <tr key={r.patients_id} className="border-t">
                  <td className="p-2">{[r.pname,r.first_name,r.last_name].filter(Boolean).join(' ')}</td>
                  <td className="p-2">{r.patients_id}</td>
                  <td className="p-2">{r.birthdate || '-'}</td>
                  <td className="p-2">{r.phone_number ? r.phone_number.replace(/(\d{4})\d+(\d{3,4})/, '$1xxxx$2') : '-'}</td>
                  <td className="p-2">{r.department || '-'}</td>
                  <td className="p-2">
                    <button
                      className="px-3 py-1 rounded bg-emerald-600 text-white"
                      onClick={()=>{ onSelect(r); onClose(); }}
                    >เลือก</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
