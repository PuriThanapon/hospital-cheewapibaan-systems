'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Clock, MapPin, Calendar, User, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

// -------------------- ENV & URL --------------------
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://localhost:5000';

const joinUrl = (base: string, path: string) => {
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
};

// -------------------- Types --------------------
type Appointment = {
  appointment_id: string;
  pname?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  date?: string | null;     // "YYYY-MM-DD"
  start?: string | null;    // "HH:MM"
  end?: string | null;      // "HH:MM"
  hospital_address?: string | null;
  department?: string | null;
  place?: string | null;
  status?: string | null;   // 'done' | 'pending' | ...
  type?: string | null;     // 'hospital' | 'home' | ...
  days_overdue?: number | null; // มีค่าเมื่อโหมดค้างเกินกำหนด
};

// -------------------- Utils --------------------
function todayYMD_TZ(tz = 'Asia/Bangkok') {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}
function onlyHHmm(s?: string | null) {
  if (!s) return null;
  const str = String(s);
  const m = str.match(/^(\d{2}:\d{2})/);
  return m ? m[1] : str.slice(0, 5);
}

function TYPE_VALUE_FROM_LABEL(label?: string | null) {
  const s = (label ?? '').toString().trim().toLowerCase();
  if (!s) return '';
  if (s === 'hospital' || s.includes('โรงพยาบาล') || s.includes('รพ')) return 'hospital';
  if (s === 'home' || s.includes('บ้าน')) return 'home';
  return s;
}
function TYPE_LABEL_TH(type?: string | null) {
  const t = TYPE_VALUE_FROM_LABEL(type);
  if (t === 'hospital') return 'โรงพยาบาล';
  if (t === 'home') return 'บ้านผู้ป่วย';
  return type || 'ไม่ระบุประเภท';
}
function inferType(r: any): string {
  const raw = r.appointment_type ?? r.type ?? r.appointmentType ?? '';
  const norm = TYPE_VALUE_FROM_LABEL(raw);
  if (norm) return norm;

  const hospitalAddress = r.hospital_address ?? r.hospital ?? r.hospital_name ?? '';
  const dept = r.department ?? r.dept ?? r.department_name ?? '';
  const displayPlace = r.display_place ?? '';
  if (String(hospitalAddress || dept || '').trim()) return 'hospital';
  if (String(displayPlace).match(/โรงพยาบาล|^รพ\.?|Hospital/i)) return 'hospital';

  const place = r.place ?? r.home_address ?? r.address ?? '';
  if (String(place).match(/บ้าน|บ้านผู้ป่วย/i)) return 'home';
  return '';
}
function mapRow(r: any): Appointment {
  return {
    appointment_id: String(r.appointment_id ?? r.id ?? r.appointment_code ?? ''),
    pname: r.pname ?? null,
    first_name: r.first_name ?? null,
    last_name: r.last_name ?? null,
    date: r.date ?? r.appointment_date ?? null,
    start: onlyHHmm(r.start ?? r.start_time ?? null),
    end: onlyHHmm(r.end ?? r.end_time ?? null),
    hospital_address: r.hospital_address ?? r.hospital ?? r.hospital_name ?? null,
    department: r.department ?? r.dept ?? r.department_name ?? null,
    place: r.display_place ?? r.place ?? r.home_address ?? r.address ?? null,
    status: r.status ?? null,
    type: inferType(r),
    days_overdue: r.days_overdue != null ? Number(r.days_overdue) : null,
  };
}
function getLocationText(a: Appointment) {
  const t = TYPE_VALUE_FROM_LABEL(a.type);
  const addr = (a.hospital_address || '').trim();
  const dept = (a.department || '').trim();
  const place = (a.place || '').trim();

  if (t === 'hospital') {
    if (addr || dept) return [addr || 'โรงพยาบาล', dept].filter(Boolean).join(' · ');
    if (place && place !== 'บ้านผู้ป่วย') return place;
    return 'โรงพยาบาล';
  }
  if (t === 'home') {
    return place || 'บ้านผู้ป่วย';
  }
  return place || addr || 'ไม่ระบุสถานที่';
}
function normalizeStatus(raw?: string | null) {
  const s = (raw ?? '').trim().toLowerCase();
  if (!s) return 'unknown';
  if (s.includes('pending') || s.includes('รอ') || s === 'นัดหมาย') return 'pending';
  if (s.includes('done') || s.includes('complete') || s.includes('completed') || s.includes('เสร็จ') || s.includes('สำเร็จ')) return 'done';
  if (s.includes('cancel') || s.includes('ยกเลิก')) return 'cancelled';
  return 'other';
}
const getStatusConfig = (raw?: string | null) => {
  const key = normalizeStatus(raw);
  switch (key) {
    case 'done':
      return { icon: CheckCircle, className: 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200', dotColor: 'bg-green-500', text: 'เสร็จสิ้น' };
    case 'pending':
      return { icon: AlertCircle, className: 'bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border border-amber-200', dotColor: 'bg-amber-500', text: 'รอดำเนินการ' };
    case 'cancelled':
      return { icon: AlertCircle, className: 'bg-gradient-to-r from-rose-50 to-red-50 text-red-700 border border-rose-200', dotColor: 'bg-red-500', text: 'ยกเลิก' };
    default:
      return { icon: Clock, className: 'bg-gradient-to-r from-gray-50 to-slate-50 text-gray-600 border border-gray-200', dotColor: 'bg-gray-400', text: raw || 'ไม่ระบุ' };
  }
};
const formatThaiDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(date);
};

// -------------------- Page --------------------
type ViewMode = 'today' | 'overdue';

export default function NotificationsPage() {
  const [list, setList] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [view, setView] = useState<ViewMode>('today');

  const today = useMemo(() => todayYMD_TZ('Asia/Bangkok'), []);

  async function fetchList(mode: ViewMode, dateYmd: string) {
    const path =
      mode === 'overdue'
        ? '/api/notification/overdue'
        : `/api/notification/timeline?from=${encodeURIComponent(dateYmd)}&to=${encodeURIComponent(dateYmd)}`;
    const res = await fetch(joinUrl(API_BASE, path), { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const j = await res.json();
    const raw = Array.isArray(j?.data) ? j.data : [];
    return raw.map(mapRow);
  }

  async function autoCancelDryRun() {
    const res = await fetch(joinUrl(API_BASE, '/api/notification/auto-cancel-overdue?dry=1'), { method: 'POST' });
    const j = await res.json();
    window.alert(`รายการที่จะถูกยกเลิก (เกิน 7 วัน & ยังรอ): ${j?.would_update ?? 0} รายการ`);
  }

  async function autoCancelConfirm() {
    const ok = window.confirm('ยืนยันยกเลิกนัดที่ค้างเกิน 7 วันทั้งหมด?');
    if (!ok) return;
    const res = await fetch(joinUrl(API_BASE, '/api/notification/auto-cancel-overdue'), { method: 'POST' });
    const j = await res.json();
    window.alert(`ยกเลิกแล้ว: ${j?.updated ?? 0} รายการ`);
    const mapped = await fetchList('overdue', today);
    setList(mapped);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const mapped = await fetchList(view, today);
        if (alive) setList(mapped);
      } catch (e: any) {
        if (alive) setErr(e?.message || 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [today, view]);

  const sorted = useMemo(() => {
    if (view === 'overdue') {
      return [...list].sort((a, b) => {
        const da = a.days_overdue ?? 0, db = b.days_overdue ?? 0;
        if (db !== da) return db - da;               // ค้างมากก่อน
        const as = a.start ?? '', bs = b.start ?? '';
        return as.localeCompare(bs);
      });
    }
    return [...list].sort((a, b) => {
      const as = a.start ?? '', bs = b.start ?? '';
      if (as && bs) return as.localeCompare(bs);
      if (as && !bs) return -1;
      if (!as && bs) return 1;
      return 0;
    });
  }, [list, view]);

  const stats = useMemo(() => ({
    total: sorted.length,
    done: sorted.filter(a => normalizeStatus(a.status) === 'done').length,
    pending: sorted.filter(a => normalizeStatus(a.status) === 'pending').length,
    cancelled: sorted.filter(a => normalizeStatus(a.status) === 'cancelled').length,
  }), [sorted]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="relative">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            <div className="absolute inset-0 w-12 h-12 border-2 border-indigo-200 rounded-full animate-pulse"></div>
          </div>
          <p className="mt-4 text-gray-600 animate-pulse">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 max-w-md">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">เกิดข้อผิดพลาด</h3>
            <p className="text-red-600">{err}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-indigo-100 flex-shrink-0">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            {/* Left: title */}
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  การแจ้งเตือนนัดหมาย
                </h1>
                <p className="text-gray-500 flex items-center mt-1">
                  <Calendar className="w-4 h-4 mr-2" />
                  {formatThaiDate(today)}
                </p>
              </div>
            </div>

            {/* Right: toolbar */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('today')}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  view==='today'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                วันนี้
              </button>
              <button
                onClick={() => setView('overdue')}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  view==='overdue'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                ค้างเกินกำหนด
              </button>
              
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        {sorted.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mb-6">
              <Bell className="w-12 h-12 text-indigo-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีนัดหมาย{view==='overdue' ? 'ค้างเกินกำหนด' : 'วันนี้'}</h3>
            <p className="text-gray-500">{view==='overdue' ? 'ไม่มีนัดหมายที่ค้างเกิน 7 วันในสถานะรอดำเนินการ' : 'วันนี้คุณไม่มีการนัดหมายใดๆ'}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white/70 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-indigo-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">ทั้งหมด</p>
                    <p className="text-2xl font-bold text-indigo-600">{sorted.length}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-indigo-400" />
                </div>
              </div>

              {view !== 'overdue' && (
                <>
                  <div className="bg-white/70 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-green-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">เสร็จสิ้น</p>
                        <p className="text-2xl font-bold text-green-600">{stats.done}</p>
                      </div>
                      <CheckCircle className="w-8 h-8 text-green-400" />
                    </div>
                  </div>
                  <div className="bg-white/70 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-amber-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">รอดำเนินการ</p>
                        <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                      </div>
                      <Clock className="w-8 h-8 text-amber-400" />
                    </div>
                  </div>
                  <div className="bg-white/70 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-red-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">ยกเลิก</p>
                        <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
                      </div>
                      <Clock className="w-8 h-8 text-red-400" />
                    </div>
                  </div>
                </>
              )}

              {view === 'overdue' && (
                <div className="bg-white/70 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-rose-100 md:col-span-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">ค้างเกินกำหนด (ยังรอดำเนินการ)</p>
                      <p className="text-2xl font-bold text-rose-600">{sorted.length}</p>
                    </div>
                    <Bell className="w-8 h-8 text-rose-400" />
                  </div>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="relative">
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-200 via-purple-200 to-cyan-200"></div>

              <div className="space-y-6">
                {sorted.map((appointment, index) => {
                  const fullName =
                    `${appointment.pname ?? ''}${appointment.first_name ?? ''} ${appointment.last_name ?? ''}`
                      .trim() || 'ไม่ระบุชื่อ';
                  const statusConfig = getStatusConfig(appointment.status ?? '');
                  const StatusIcon = statusConfig.icon;
                  const locationText = getLocationText(appointment);

                  return (
                    <div
                      key={`${appointment.appointment_id}-${appointment.start ?? ''}`}
                      className="relative group"
                      style={{ animation: `slideInUp 0.6s ease-out ${index * 0.1}s both` }}
                    >
                      {/* Timeline dot */}
                      <div className={`absolute left-6 w-4 h-4 ${statusConfig.dotColor} rounded-full border-4 border-white shadow-lg group-hover:scale-110 transition-transform duration-200`}></div>

                      {/* Card */}
                      <div className="ml-16 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 p-6 group-hover:shadow-xl group-hover:bg-white/90 transition-all duration-300">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-xl">
                              <User className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{fullName}</h3>
                              <p className="text-sm text-gray-500">{TYPE_LABEL_TH(appointment.type)}</p>
                            </div>
                          </div>

                          <div className="flex items-center">
                            <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig.className}`}>
                              <StatusIcon className="w-4 h-4 mr-1.5" />
                              {statusConfig.text}
                            </div>
                            {view==='overdue' && typeof appointment.days_overdue === 'number' && (
                              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                ค้าง {appointment.days_overdue} วัน
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center text-gray-600">
                            <Clock className="w-4 h-4 mr-2 text-indigo-400" />
                            <span>
                              {appointment.start ?? '—'}{appointment.end ? ` - ${appointment.end}` : ''} น.
                            </span>
                          </div>

                          <div className="flex items-center text-gray-600">
                            <MapPin className="w-4 h-4 mr-2 text-purple-400" />
                            <span>{locationText}</span>
                          </div>
                        </div>

                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* แนะนำ: เพิ่ม keyframes ต่อไปนี้ใน notifications.module.css ของคุณ (ถ้ายังไม่มี)
@keyframes slideInUp {
  from { opacity: 0; transform: translate3d(0, 12px, 0); }
  to   { opacity: 1; transform: translate3d(0, 0, 0); }
}
*/
