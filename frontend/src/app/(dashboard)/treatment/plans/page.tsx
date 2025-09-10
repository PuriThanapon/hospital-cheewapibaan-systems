'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, Search, User, FileText, Eye } from 'lucide-react';
import PatientLookupModal from '@/app/components/modals/PatientLookupModal';

type Plan = {
  plan_id: string;
  patients_id: string;
  title?: string | null;
  care_model?: string | null;
  care_location?: 'home' | 'hospital' | 'mixed' | null;
  created_at?: string;
  updated_at?: string;
};

type PatientLite = {
  patients_id: string;
  pname?: string;
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

  // filters
  const [lookupOpen, setLookupOpen] = useState(false);
  const [hnInput, setHnInput] = useState('');
  const [filterHN, setFilterHN] = useState('');
  const [filterName, setFilterName] = useState<string>('');

  // patient cache
  const [patientByHN, setPatientByHN] = useState<Record<string, PatientLite>>({});

  // load plans
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

  // warm patient names cache
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const need = Array.from(new Set(rows.map(r => normalizePatientsId(r.patients_id))))
        .filter(hn => hn && !patientByHN[hn]);

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
        for (const [hn, p] of results) if (p) next[hn] = p;
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
    <div className="min-h-screen w-full bg-[#f7f7fb] rounded-2xl">
      {/* ใช้ padding แบบเต็มกว้าง ไม่มี max-width */}
      <div className="w-full px-3 sm:px-6 lg:px-10 py-8">

        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center gap-4 w-full">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">แผนการรักษา (Treatment Plans)</h1>
              <div className="text-sm text-gray-500">{subtitle}</div>
            </div>
          </div>
          <div className="md:ml-auto">
            <Link
              href="/treatment/plans/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow hover:from-indigo-700 hover:to-purple-700 transition-colors"
            >
              <Plus size={16} /> สร้างแผนใหม่
            </Link>
          </div>
        </div>

        {/* Filters / Search */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm mb-6 w-full">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
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
            <div className="flex gap-2">
              <button
                className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50"
                onClick={() => setLookupOpen(true)}
                type="button"
              >
                <User className="w-4 h-4 inline mr-1" /> ลืมรหัส (ค้นหา)
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                onClick={() => {
                  const hn = normalizePatientsId(hnInput);
                  setFilterHN(hn);
                  setFilterName('');
                }}
              >
                ดูเฉพาะคนนี้
              </button>
              <button
                className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50"
                onClick={() => { setFilterHN(''); setFilterName(''); setHnInput(''); }}
              >
                <RefreshCw className="w-4 h-4 inline mr-1" /> ล้างตัวกรอง
              </button>
            </div>
          </div>
        </div>

        {/* Banners */}
        {err && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 w-full">
            {err}
          </div>
        )}
        {!err && loading && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 px-4 py-3 flex items-center gap-2 w-full">
            <span className="inline-block w-4 h-4 rounded-full border-2 border-blue-300 border-t-transparent animate-spin" />
            กำลังโหลด...
          </div>
        )}

        {/* Empty */}
        {!loading && !err && rows.length === 0 && (
          <div className="rounded-2xl border bg-white p-8 text-center text-gray-600 shadow-sm w-full">
            ไม่พบแผนการรักษา — ลองค้นหาด้วย HN อื่น หรือสร้างแผนใหม่
          </div>
        )}

        {/* Table */}
        {!loading && !err && rows.length > 0 && (
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden w-full">
            <div className="overflow-x-auto max-w-[100vw]">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">รหัสแผน</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">HN / ชื่อผู้ป่วย</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">หัวเรื่อง</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">รูปแบบ</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">สถานที่รักษา</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">การทำงาน</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => {
                    const hn = normalizePatientsId(r.patients_id);
                    const p = patientByHN[hn];
                    const name = p
                      ? `${p.pname ?? ''}${p.first_name ?? ''} ${p.last_name ?? ''}`.replace(/\s+/g, ' ').trim()
                      : '';

                    const locationBadge =
                      r.care_location === 'home' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      r.care_location === 'hospital' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      r.care_location === 'mixed' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      'bg-gray-50 text-gray-600 border-gray-200';

                    const locationText =
                      r.care_location === 'home' ? 'บ้าน' :
                      r.care_location === 'hospital' ? 'โรงพยาบาล' :
                      r.care_location === 'mixed' ? 'ผสมผสาน' : '—';

                    return (
                      <tr key={r.plan_id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-3 align-top">
                          <span className="font-mono text-sm px-2 py-1 rounded border bg-gray-50 text-gray-800">
                            {r.plan_id}
                          </span>
                        </td>
                        <td className="px-6 py-3 align-top">
                          <div className="font-mono text-sm text-gray-900">{hn}</div>
                          <div className="text-sm text-gray-600">{name || '—'}</div>
                        </td>
                        <td className="px-6 py-3 align-top">
                          <div className="text-sm text-gray-900">
                            {r.title || <span className="text-gray-400">ไม่มีหัวเรื่อง</span>}
                          </div>
                        </td>
                        <td className="px-6 py-3 align-top">
                          <div className="text-sm text-gray-700">{r.care_model || <span className="text-gray-400">—</span>}</div>
                        </td>
                        <td className="px-6 py-3 align-top">
                          <span className={`inline-block text-xs px-2 py-1 rounded-full border ${locationBadge}`}>{locationText}</span>
                        </td>
                        <td className="px-6 py-3 align-top">
                          <Link
                            href={`/treatment/plans/${encodeURIComponent(r.plan_id)}`}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm hover:from-indigo-700 hover:to-purple-700"
                          >
                            <Eye size={14} /> รายละเอียด
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

        {/* Patient lookup modal */}
        <PatientLookupModal
          open={lookupOpen}
          onClose={() => setLookupOpen(false)}
          onSelect={(p) => {
            const hn = normalizePatientsId(p.patients_id);
            const name = `${p.pname ?? ''}${p.first_name ?? ''} ${p.last_name ?? ''}`.replace(/\s+/g, ' ').trim();
            setFilterHN(hn);
            setFilterName(name || '');
            setHnInput(hn);
            setPatientByHN(prev => ({ ...prev, [hn]: { patients_id: hn, pname: p.pname, first_name: p.first_name, last_name: p.last_name } }));
            setLookupOpen(false);
          }}
        />
      </div>
    </div>
  );
}
