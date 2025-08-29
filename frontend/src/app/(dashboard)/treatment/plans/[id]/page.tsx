'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FileText } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

type PlanDetail = {
  plan_id: string;
  patients_id: string;
  title?: string | null;
  care_model?: string | null;
  care_location?: 'home' | 'hospital' | 'mixed' | null | string;
  life_support?: any;
  decision_makers?: any;
  wishes?: any;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
  files?: Array<{
    file_id?: string | number;
    id?: string | number;
    filename: string;
    mimetype?: string;
    mime_type?: string;
    size?: number;
  }>;
};

type PatientLite = {
  patients_id: string;
  pname?: string;
  first_name?: string;
  last_name?: string;
};

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

export default function PlanDetailPage() {
  // ✅ ดึงไอดีแผนจาก URL (client component)
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [data, setData] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [patient, setPatient] = useState<PatientLite | null>(null);
  const patientName = useMemo(() => {
    if (!patient) return '';
    return `${patient.pname ?? ''}${patient.first_name ?? ''} ${patient.last_name ?? ''}`
      .replace(/\s+/g, ' ')
      .trim();
  }, [patient]);

  useEffect(() => {
    if (!id) return;
    let alive = true;

    (async () => {
      setLoading(true);
      setErr('');
      try {
        const res = await fetch(`${API_BASE}/api/treatment-plans/${encodeURIComponent(id)}`, { cache: 'no-store' });
        if (!res.ok) {
          let msg = 'load failed';
          try {
            const j = await res.json();
            msg = (j as any).message || msg;
          } catch {}
          throw new Error(msg);
        }
        const j = await res.json();
        const plan = (j?.data || j) as PlanDetail;

        // แปลง string -> JSON ถ้าจำเป็น
        const safeParse = (v: any) => {
          if (v == null) return v;
          if (typeof v === 'string') {
            try { return JSON.parse(v); } catch { return v; }
          }
          return v;
        };
        plan.life_support = safeParse(plan.life_support);
        plan.decision_makers = safeParse(plan.decision_makers);
        plan.wishes = safeParse(plan.wishes);

        if (alive) setData(plan);
      } catch (e: any) {
        if (alive) setErr(e?.message || 'โหลดรายละเอียดไม่สำเร็จ');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [id]);

  // ดึงชื่อผู้ป่วยจาก HN ของแผน (ให้ธีมตรงกับหน้า list และโชว์ชื่อด้านหัว)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const hn = normalizePatientsId(data?.patients_id || '');
      if (!hn) return;
      const hits = [
        `${API_BASE}/api/patients/${encodeURIComponent(hn)}`,
        `${API_BASE}/api/patients/${encodeURIComponent(toNumeric(hn))}`,
      ];
      for (const u of hits) {
        try {
          const r = await fetch(u, { cache: 'no-store' });
          if (!r.ok) continue;
          const j = await r.json();
          const p = (j?.data ?? j) as PatientLite;
          if (!cancelled && p?.patients_id) {
            setPatient({
              patients_id: p.patients_id,
              pname: p.pname,
              first_name: p.first_name,
              last_name: p.last_name,
            });
            break;
          }
        } catch {}
      }
    };
    run();
    return () => { cancelled = true; };
  }, [data?.patients_id]);

  function LifeSupportBlock({ ls }: { ls: any }) {
    const items = [
      { key: 'icu',              label: 'เข้ารักษาในห้อง ICU',            icon: '🏥' },
      { key: 'cpr',              label: 'กระตุ้นหัวใจ (CPR)',             icon: '💓' },
      { key: 'tracheostomy',     label: 'เจาะคอใส่ท่อหายใจ',              icon: '🫁' },
      { key: 'intubation',       label: 'ใส่ท่อช่วยหายใจ (Intubation)',    icon: '🔧' },
      { key: 'ventilator',       label: 'เครื่องช่วยหายใจ',                icon: '⚕️' },
      { key: 'advanced_devices', label: 'ใช้อุปกรณ์แพทย์ขั้นสูงอื่น ๆ',   icon: '🔬' },
    ];
    const selected = items.filter(i => !!ls?.[i.key]);

    return (
      <div className="space-y-4">
        {selected.length === 0 ? (
          <div className="flex items-center justify-center p-8 bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl border-2 border-emerald-200">
            <div className="text-center">
              <div className="text-4xl mb-2">✅</div>
              <div className="text-emerald-800 font-semibold">ไม่เลือกใช้เทคโนโลยียื้อชีวิต</div>
              <div className="text-emerald-600 text-sm mt-1">เลือกการดูแลแบบประคับประคอง</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selected.map(i => (
              <div key={i.key} className="flex items-center p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-200">
                <div className="text-2xl mr-3">{i.icon}</div>
                <div className="text-slate-800 font-medium">{i.label}</div>
              </div>
            ))}
          </div>
        )}

        {ls?.note?.trim?.() && (
          <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-200">
            <div className="flex items-start">
              <div className="text-xl mr-2">📝</div>
              <div>
                <div className="text-amber-800 font-medium mb-1">หมายเหตุ</div>
                <div className="text-amber-700">{ls.note}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function DecisionMakersBlock({ list }: { list: any[] }) {
    const arr = Array.isArray(list) ? list : [];
    return (
      <div>
        {arr.length === 0 ? (
          <div className="flex items-center justify-center p-8 bg-gradient-to-r from-slate-50 to-gray-50 rounded-2xl border-2 border-slate-200">
            <div className="text-center">
              <div className="text-4xl mb-2">👥</div>
              <div className="text-slate-600 font-medium">ไม่ได้ระบุผู้ตัดสินใจแทน</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {arr.map((person, i) => (
              <div key={i} className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-200 shadow-sm">
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-purple-600 font-bold text-lg">{i + 1}</span>
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm font-medium text-purple-600 mb-1">ชื่อ-นามสกุล</div>
                      <div className="text-slate-800 font-semibold">{person?.name || '—'}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-purple-600 mb-1">ความสัมพันธ์</div>
                      <div className="text-slate-700">{person?.relation || '—'}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-purple-600 mb-1">เบอร์ติดต่อ</div>
                      <div className="text-slate-700 font-mono">{person?.phone || '—'}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function WishesBlock({ w }: { w: any }) {
    const wishes = w || {};
    const rows = [
      { label: 'ผู้ตัดสินใจแทน',            value: wishes.decision_person,  icon: '👤', color: 'from-blue-50 to-cyan-50 border-blue-200' },
      { label: 'วิธีดูแลที่ต้องการ',         value: wishes.preferred_care,   icon: '🤲', color: 'from-emerald-50 to-green-50 border-emerald-200' },
      { label: 'การดูแลเพื่อความสบายกาย-ใจ', value: wishes.comfort_care,     icon: '💆‍♀️', color: 'from-purple-50 to-pink-50 border-purple-200' },
      { label: 'ผู้ดูแลเมื่ออยู่บ้าน',         value: wishes.home_caregiver,   icon: '🏠', color: 'from-orange-50 to-amber-50 border-orange-200' },
      { label: 'ผู้ที่อยากพบเป็นครั้งสุดท้าย', value: wishes.final_goodbye,   icon: '🤗', color: 'from-rose-50 to-pink-50 border-rose-200' },
    ];
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {rows.map((r, i) => (
          <div key={i} className={`p-6 bg-gradient-to-r ${r.color} rounded-2xl border shadow-sm`}>
            <div className="flex items-start">
              <div className="text-2xl mr-3">{r.icon}</div>
              <div className="flex-1">
                <div className="font-semibold text-slate-700 mb-2">{r.label}</div>
                <div className="text-slate-600 leading-relaxed">
                  {r.value?.toString?.().trim() || <span className="text-slate-400 italic">ไม่ได้ระบุ</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#f7f7fb] rounded-2xl">
      <div className="w-full px-3 sm:px-6 lg:px-8 py-6">
        {/* Header: สไตล์เดียวกับหน้ารายการ */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center gap-4 w-full">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">รายละเอียดแผนการรักษา</h1>
              <div className="text-sm text-gray-600 flex flex-wrap items-center gap-2">
                <span>
                  รหัสแผน:&nbsp;
                  <span className="font-mono bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">{id}</span>
                </span>
                {data?.patients_id && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span>HN:&nbsp;<span className="font-mono">{normalizePatientsId(data.patients_id)}</span></span>
                    {patientName && <span className="text-gray-700">— {patientName}</span>}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="md:ml-auto">
            <Link
              href="/treatment/plans"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50"
            >
              ← กลับหน้ารายการ
            </Link>
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
            <span className="inline-block w-4 h-4 rounded-full border-2 border-blue-300 border-top-transparent animate-spin" />
            กำลังโหลดรายละเอียด...
          </div>
        )}

        {/* Content */}
        {!loading && !err && data && (
          <div className="space-y-8">
            {/* Overview */}
            <section className="p-6 rounded-2xl border bg-white shadow-sm w-full">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">ข้อมูลพื้นฐาน</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border bg-gradient-to-r from-gray-50 to-slate-50">
                  <div className="text-xs text-gray-500 mb-1">HN</div>
                  <div className="font-mono text-lg font-bold text-slate-800">
                    {normalizePatientsId(data.patients_id)}
                  </div>
                  {patientName && <div className="text-sm text-gray-600 mt-1">{patientName}</div>}
                </div>
                <div className="p-4 rounded-xl border bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                  <div className="text-xs text-blue-700 mb-1">หัวเรื่อง</div>
                  <div className="text-slate-800 font-semibold">{data.title || 'ไม่มีหัวเรื่อง'}</div>
                </div>
                <div className="p-4 rounded-xl border bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200">
                  <div className="text-xs text-emerald-700 mb-1">รูปแบบการดูแล</div>
                  <div className="text-slate-800 font-semibold">{data.care_model || 'ไม่ระบุ'}</div>
                </div>
                <div className="p-4 rounded-xl border bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                  <div className="text-xs text-purple-700 mb-1">สถานที่ดูแล</div>
                  <div className="text-slate-800 font-semibold">
                    {data.care_location === 'home' ? '🏠 บ้าน' :
                     data.care_location === 'hospital' ? '🏥 โรงพยาบาล' :
                     data.care_location === 'mixed' ? '🔄 ผสมผสาน' : 'ไม่ระบุ'}
                  </div>
                </div>
              </div>

              {data.note && (
                <div className="mt-4 p-4 rounded-xl border bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
                  <div className="text-amber-800 font-semibold mb-1">หมายเหตุทั่วไป</div>
                  <div className="text-amber-700 leading-relaxed">{data.note}</div>
                </div>
              )}
            </section>

            {/* Life support */}
            <section className="p-6 rounded-2xl border bg-white shadow-sm w-full">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">เทคโนโลยียื้อชีวิต</h2>
              <LifeSupportBlock ls={data.life_support} />
            </section>

            {/* Decision makers */}
            <section className="p-6 rounded-2xl border bg-white shadow-sm w-full">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">ผู้ตัดสินใจแทน</h2>
              <DecisionMakersBlock list={data.decision_makers} />
            </section>

            {/* Wishes */}
            <section className="p-6 rounded-2xl border bg-white shadow-sm w-full">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">ความปรารถนา</h2>
              <WishesBlock w={data.wishes} />
            </section>

            {/* Files */}
            <section className="p-6 rounded-2xl border bg-white shadow-sm w-full">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">ไฟล์แนบ</h2>
              {Array.isArray(data.files) && data.files.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.files.map((f, i) => {
                    const fileId = (f as any).file_id ?? (f as any).id;
                    const mime = (f as any).mimetype ?? (f as any).mime_type ?? '';
                    const sizeFormatted = f.size ? `${(f.size / 1024).toFixed(1)} KB` : '';
                    return (
                      <a
                        key={`${fileId}-${i}`}
                        className="p-5 rounded-2xl border bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200 hover:shadow-lg transition-all duration-200 hover:scale-[1.01] group"
                        href={`${API_BASE}/api/treatment-plans/${encodeURIComponent(id!)}/files/${encodeURIComponent(String(fileId))}`}
                        target="_blank"
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">📄</div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-800 truncate group-hover:text-indigo-700">
                              {f.filename}
                            </div>
                            {mime && <div className="text-xs text-slate-500 mt-0.5">{mime}</div>}
                            {sizeFormatted && <div className="text-xs text-slate-400 mt-0.5">{sizeFormatted}</div>}
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center p-8 bg-gradient-to-r from-slate-50 to-gray-50 rounded-2xl border-2 border-slate-200 text-slate-600">
                  ไม่มีไฟล์แนบ
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
