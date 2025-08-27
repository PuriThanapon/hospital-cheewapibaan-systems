'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

type PlanDetail = {
  plan_id: string;
  patients_id: string;
  title?: string | null;
  care_model?: string | null;
  care_location?: string | null;
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

export default function PlanDetailPage() {
  // ✅ ดึงพารามิเตอร์จาก URL แบบ client component
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [data, setData] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    let alive = true;

    (async () => {
      setLoading(true);
      setErr('');
      try {
        const res = await fetch(
          `${API_BASE}/api/treatment-plans/${encodeURIComponent(id)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          let msg = 'load failed';
          try {
            const j = await res.json();
            msg = (j as any).message || msg;
          } catch {}
          throw new Error(msg);
        }
        const j = await res.json();
        const plan = j?.data || j;

        // แปลง string -> JSON ถ้าจำเป็น
        const safeParse = (v: any) => {
          if (v == null) return v;
          if (typeof v === 'string') {
            try {
              return JSON.parse(v);
            } catch {
              return v;
            }
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

    return () => {
      alive = false;
    };
  }, [id]);

  function LifeSupportBlock({ ls }: { ls: any }) {
    const items = [
        { key: 'icu',             label: 'เข้ารักษาในห้อง ICU', icon: '🏥' },
        { key: 'cpr',             label: 'กระตุ้นหัวใจ (CPR)', icon: '💓' },
        { key: 'tracheostomy',    label: 'เจาะคอใส่ท่อหายใจ', icon: '🫁' },
        { key: 'intubation',      label: 'ใส่ท่อช่วยหายใจ (Intubation)', icon: '🔧' },
        { key: 'ventilator',      label: 'เครื่องช่วยหายใจ', icon: '⚕️' },
        { key: 'advanced_devices',label: 'ใช้อุปกรณ์แพทย์ขั้นสูงอื่น ๆ', icon: '🔬' },
    ];

    const selected = items.filter(i => !!ls?.[i.key]);

    return (
        <div className="space-y-4">
          {selected.length === 0 ? (
            <div className="flex items-center justify-center p-8 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200">
              <div className="text-center">
                <div className="text-4xl mb-2">✅</div>
                <div className="text-green-700 font-semibold">ไม่เลือกใช้เทคโนโลยียื้อชีวิต</div>
                <div className="text-green-600 text-sm mt-1">เลือกการดูแลแบบประคับประคอง</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selected.map(i => (
                <div key={i.key} className="flex items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
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
              <div className="text-slate-600 font-medium">ไม่ได้ระบุผู้ตัดสينใจแทน</div>
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
      { 
        label: 'ผู้ตัดสินใจแทน', 
        value: wishes.decision_person,
        icon: '👤',
        color: 'from-blue-50 to-cyan-50 border-blue-200'
      },
      { 
        label: 'วิธีดูแลที่ต้องการ', 
        value: wishes.preferred_care,
        icon: '🤲',
        color: 'from-green-50 to-emerald-50 border-green-200'
      },
      { 
        label: 'การดูแลเพื่อความสบายกาย-ใจ', 
        value: wishes.comfort_care,
        icon: '💆‍♀️',
        color: 'from-purple-50 to-pink-50 border-purple-200'
      },
      { 
        label: 'ผู้ดูแลเมื่ออยู่บ้าน', 
        value: wishes.home_caregiver,
        icon: '🏠',
        color: 'from-orange-50 to-amber-50 border-orange-200'
      },
      { 
        label: 'ผู้ที่อยากพบเป็นครั้งสุดท้าย', 
        value: wishes.final_goodbye,
        icon: '🤗',
        color: 'from-rose-50 to-pink-50 border-rose-200'
      },
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
                  {r.value?.toString?.().trim() || (
                    <span className="text-slate-400 italic">ไม่ได้ระบุ</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 lg:p-10 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="mx-auto max-w-6xl">
        {/* Enhanced Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 p-6 bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20">
          <div className="mb-4 lg:mb-0">
            <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-2">
              รายละเอียดแผนการรักษา
            </h1>
            <div className="flex items-center text-slate-600">
              <span className="mr-2">รหัสแผน:</span>
              <span className="font-mono text-lg font-semibold bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg">
                {id}
              </span>
            </div>
          </div>
          <Link
            href="/treatment/plans"
            className="inline-flex items-center px-6 py-3 rounded-2xl bg-white text-slate-700 border-2 border-slate-200 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 hover:scale-105 shadow-md"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            กลับหน้ารายการ
          </Link>
        </div>

        {/* Enhanced Status Messages */}
        {err && (
          <div className="p-6 rounded-2xl bg-gradient-to-r from-red-50 to-pink-50 text-red-700 border border-red-200/50 mb-6 shadow-sm">
            <div className="flex items-center">
              <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold">{err}</span>
            </div>
          </div>
        )}

        {!err && loading && (
          <div className="p-8 rounded-3xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 shadow-sm">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mr-4"></div>
              <span className="text-blue-700 font-semibold text-lg">กำลังโหลดรายละเอียด...</span>
            </div>
          </div>
        )}

        {!loading && !err && data && (
          <div className="space-y-8">
            {/* Enhanced Overview Card */}
            <div className="p-8 bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/30">
              <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                ข้อมูลพื้นฐาน
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-4 bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl border border-slate-200">
                  <div className="text-sm font-medium text-slate-500 mb-2">HN</div>
                  <div className="font-mono text-lg font-bold text-slate-800">{data.patients_id}</div>
                </div>
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                  <div className="text-sm font-medium text-blue-600 mb-2">หัวเรื่อง</div>
                  <div className="text-slate-800 font-semibold">{data.title || 'ไม่มีหัวเรื่อง'}</div>
                </div>
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                  <div className="text-sm font-medium text-green-600 mb-2">รูปแบบการดูแล</div>
                  <div className="text-slate-800 font-semibold">{data.care_model || 'ไม่ระบุ'}</div>
                </div>
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                  <div className="text-sm font-medium text-purple-600 mb-2">สถานที่ดูแล</div>
                  <div className="flex items-center text-slate-800 font-semibold">
                    {data.care_location === 'home' && <>🏠 บ้าน</>}
                    {data.care_location === 'hospital' && <>🏥 โรงพยาบาล</>}
                    {data.care_location === 'mixed' && <>🔄 ผสมผสาน</>}
                    {!data.care_location && 'ไม่ระบุ'}
                  </div>
                </div>
              </div>

              {data.note && (
                <div className="mt-6 p-6 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl border border-amber-200">
                  <div className="flex items-start">
                    <div className="text-2xl mr-3">📄</div>
                    <div>
                      <div className="text-amber-800 font-semibold mb-2">หมายเหตุทั่วไป</div>
                      <div className="text-amber-700 leading-relaxed">{data.note}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Enhanced Life Support Section */}
            <div className="p-8 bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/30">
              <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                  </svg>
                </div>
                เทคโนโลยียื้อชีวิต
              </h2>
              <LifeSupportBlock ls={data.life_support} />
            </div>

            {/* Enhanced Decision Makers Section */}
            <div className="p-8 bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/30">
              <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                  </svg>
                </div>
                ผู้ตัดสินใจแทน
              </h2>
              <DecisionMakersBlock list={data.decision_makers} />
            </div>

            {/* Enhanced Wishes Section */}
            <div className="p-8 bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/30">
              <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
                <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-pink-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                </div>
                ความปรารถนา
              </h2>
              <WishesBlock w={data.wishes} />
            </div>

            {/* Enhanced Files Section */}
            <div className="p-8 bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/30">
              <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                ไฟล์แนบ
              </h2>
              
              {Array.isArray(data.files) && data.files.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.files.map((f, i) => {
                    const fileId = (f as any).file_id ?? (f as any).id;
                    const mime = (f as any).mimetype ?? (f as any).mime_type ?? '';
                    const sizeFormatted = f.size ? `${(f.size / 1024).toFixed(1)} KB` : '';
                    
                    return (
                      <a
                        key={`${fileId}-${i}`}
                        className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 hover:shadow-lg transition-all duration-200 hover:scale-105 group"
                        href={`${API_BASE}/api/treatment-plans/${encodeURIComponent(
                          id!
                        )}/files/${encodeURIComponent(String(fileId))}`}
                        target="_blank"
                      >
                        <div className="flex items-start">
                          <div className="text-2xl mr-3">📄</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                              {f.filename}
                            </div>
                            {mime && (
                              <div className="text-sm text-slate-500 mt-1">
                                {mime}
                              </div>
                            )}
                            {sizeFormatted && (
                              <div className="text-xs text-slate-400 mt-1">
                                {sizeFormatted}
                              </div>
                            )}
                          </div>
                          <svg className="w-5 h-5 text-blue-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center p-8 bg-gradient-to-r from-slate-50 to-gray-50 rounded-2xl border-2 border-slate-200">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📁</div>
                    <div className="text-slate-600 font-medium">ไม่มีไฟล์แนบ</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}