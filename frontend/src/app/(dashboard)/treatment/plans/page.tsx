'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PatientLookupModal from '@/app/components/modals/PatientLookupModal';

type Plan = {
  plan_id: string;
  patients_id: string;
  title?: string | null;
  care_model?: string | null;
  care_location?: string | null;
  created_at?: string;
  updated_at?: string;
};

type PatientLite = {
  patients_id: string;
  pname?: string;         // คำนำหน้า เช่น นาย/นาง/น.ส.
  first_name?: string;
  last_name?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

function normalizePatientsId(id: string) {
  if (!id) return '';
  const t = String(id).trim();
  if (/^\d+$/.test(t)) return 'HN-' + t.padStart(8, '0');
  return t.toUpperCase();
}
function toNumeric(id: string) {
  const m = String(id).match(/\d+/g);
  return m ? String(parseInt(m.join(''), 10)) : '';
}

export default function TreatmentPlansListPage() {
  const [rows, setRows] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // filter by patient
  const [lookupOpen, setLookupOpen] = useState(false);
  const [hnInput, setHnInput] = useState('');
  const [filterHN, setFilterHN] = useState('');
  const [filterName, setFilterName] = useState<string>('');

  // patient cache: HN -> PatientLite
  const [patientByHN, setPatientByHN] = useState<Record<string, PatientLite>>({});

  // โหลดรายการแผน
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr('');
      try {
        const p = new URLSearchParams();
        if (filterHN) { p.set('patient_id', filterHN); p.set('patients_id', filterHN); }
        const url = `${API_BASE}/api/treatment-plans${p.toString() ? `?${p}` : ''}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error((await res.json()).message || 'load failed');
        const data = await res.json();
        const list: Plan[] = Array.isArray(data?.data) ? data.data : [];
        const finalRows = filterHN
          ? list.filter(r => String(r.patients_id).toUpperCase() === filterHN)
          : list;
        if (!alive) return;
        setRows(finalRows);
      } catch (e: any) {
        if (alive) setErr(e?.message || 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [filterHN]);

  // ดึงชื่อผู้ป่วยของ HN ที่ยังไม่มีในแคช
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const need = Array.from(
        new Set(rows.map(r => normalizePatientsId(r.patients_id)))
      ).filter(hn => hn && !patientByHN[hn]);

      if (need.length === 0) return;

      const fetchOne = async (hn: string): Promise<[string, PatientLite | null]> => {
        const hits = [
          `${API_BASE}/api/patients/${encodeURIComponent(hn)}`,
          `${API_BASE}/api/patients/${encodeURIComponent(toNumeric(hn))}`,
        ];
        for (const u of hits) {
          try {
            const res = await fetch(u, { cache: 'no-store' });
            if (!res.ok) continue;
            const j = await res.json();
            const p = (j?.data ?? j) as PatientLite;
            if (p && p.patients_id) return [hn, p];
          } catch {}
        }
        return [hn, null];
      };

      const results = await Promise.all(need.map(fetchOne));
      if (cancelled) return;

      setPatientByHN(prev => {
        const next = { ...prev };
        for (const [hn, p] of results) {
          if (p) next[hn] = p;
        }
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [rows, patientByHN]);

  const subtitle = useMemo(() => {
    if (!filterHN) return 'รายการแผนทั้งหมด';
    return `แสดงเฉพาะของผู้ป่วย: ${filterHN}${filterName ? ` — ${filterName}` : ''}`;
  }, [filterHN, filterName]);

  return (
    <div className="min-h-screen p-4 bg-[#f7f7fb] rounded-2xl">
      <div className="mx-auto max-w-7xl">
        {/* Header with enhanced styling */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 p-6 bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20">
          <div className="mb-4 lg:mb-0">
            <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-2">
              แผนการรักษา
            </h1>
            <p className="text-slate-600 text-lg font-medium">{subtitle}</p>
          </div>
          <Link
            href="/treatment/plans/new"
            className="inline-flex items-center px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:scale-105 transition-all duration-300 ease-out"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            สร้างแผนใหม่
          </Link>
        </div>

        {/* Enhanced search bar */}
        <div className="mb-8 p-6 bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg border border-white/30">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  className="w-full pl-10 pr-4 py-3 border-0 rounded-2xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 text-slate-700 placeholder-slate-400"
                  placeholder="พิมพ์ HN (เช่น HN-00000001 หรือ 1)"
                  value={hnInput}
                  onChange={e => setHnInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const hn = normalizePatientsId(hnInput);
                      setFilterHN(hn);
                      setFilterName('');
                    }
                  }}
                />
              </div>
              <button
                className="px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-200 hover:border-slate-300 transition-all duration-200 hover:scale-105"
                onClick={() => setLookupOpen(true)}
                type="button"
              >
                <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ลืมรหัส (ค้นหา)
              </button>
            </div>
            <div className="flex gap-3">
              <button
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-105 transition-all duration-300"
                onClick={() => {
                  const hn = normalizePatientsId(hnInput);
                  setFilterHN(hn);
                  setFilterName('');
                }}
              >
                ดูเฉพาะคนนี้
              </button>
              <button
                className="px-6 py-3 rounded-2xl bg-white text-slate-700 font-medium border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200 hover:scale-105"
                onClick={() => { setFilterHN(''); setFilterName(''); setHnInput(''); }}
              >
                ล้างตัวกรอง
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced status messages */}
        {err && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-red-50 to-pink-50 text-red-700 border border-red-200/50 mb-6 shadow-sm">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {err}
            </div>
          </div>
        )}

        {!err && loading && (
          <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200/50 shadow-sm">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-700 mr-3"></div>
              <span className="font-medium">กำลังโหลด...</span>
            </div>
          </div>
        )}

        {!loading && !err && rows.length === 0 && (
          <div className="p-8 rounded-3xl bg-white/70 backdrop-blur-sm border border-slate-200/50 text-center shadow-lg">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">ไม่พบแผนการรักษา</h3>
              <p className="text-slate-500">ลองปรับเปลี่ยนเงื่อนไขการค้นหาหรือสร้างแผนใหม่</p>
            </div>
          </div>
        )}

        {!loading && !err && rows.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">รหัสแผน</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">HN / ชื่อผู้ป่วย</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">หัวเรื่อง</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">รูปแบบ</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">สถานที่รักษา</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider">การทำงาน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, index) => {
                    const hn = normalizePatientsId(r.patients_id);
                    const p = patientByHN[hn];
                    const name = p
                      ? `${p.pname ?? ''}${p.first_name ?? ''} ${p.last_name ?? ''}`.replace(/\s+/g, ' ').trim()
                      : '';
                    return (
                      <tr 
                        key={r.plan_id} 
                        className="hover:bg-slate-50/50 transition-colors duration-200 group"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <td className="px-6 py-4">
                          <div className="font-mono text-sm font-semibold text-indigo-600 bg-indigo-50 rounded-lg px-3 py-1 inline-block">
                            {r.plan_id}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-mono text-sm font-bold text-slate-800">{hn}</div>
                          <div className="text-sm text-slate-500 font-medium mt-1">
                            {name || '—'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-800">
                            {r.title || <span className="text-slate-400">ไม่มีหัวเรื่อง</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-600">
                            {r.care_model || <span className="text-slate-400">—</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            r.care_location === 'home' 
                              ? 'bg-green-100 text-green-800' 
                              : r.care_location === 'hospital' 
                              ? 'bg-blue-100 text-blue-800'
                              : r.care_location === 'mixed'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {r.care_location === 'home' ? '🏠 บ้าน'
                              : r.care_location === 'hospital' ? '🏥 โรงพยาบาล'
                              : r.care_location === 'mixed' ? '🔄 ผสมผสาน'
                              : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/treatment/plans/${encodeURIComponent(r.plan_id)}`}
                            className="inline-flex items-center px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium text-sm shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 group-hover:from-indigo-600 group-hover:to-purple-700"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            รายละเอียด
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: ค้นหาผู้ป่วย */}
        <PatientLookupModal
          open={lookupOpen}
          onClose={() => setLookupOpen(false)}
          onSelect={(p) => {
            const hn = normalizePatientsId(p.patients_id);
            const name = `${p.pname ?? ''}${p.first_name ?? ''} ${p.last_name ?? ''}`.replace(/\s+/g, ' ').trim();
            setFilterHN(hn);
            setFilterName(name || '');
            setHnInput(hn);
            // ใส่ลง cache เพื่อแสดงชื่อทันที
            setPatientByHN(prev => ({ ...prev, [hn]: { patients_id: hn, pname: p.pname, first_name: p.first_name, last_name: p.last_name } }));
            setLookupOpen(false);
          }}
        />
      </div>
    </div>
  );
}