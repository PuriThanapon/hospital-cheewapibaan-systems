'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Clock, MapPin, Calendar, User, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import styles from "./notifications.module.css";
import dynamic from 'next/dynamic';

const Select = dynamic(() => import('react-select'), { ssr: false });

type Appointment = {
  appointment_id: string;
  pname?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  date?: string | null;     // "YYYY-MM-DD"
  start?: string | null;    // "HH:MM"
  end?: string | null;      // "HH:MM"
  place?: string | null;
  status?: string | null;   // 'done' | 'pending' | ...
  type?: string | null;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

const joinUrl = (base: string, path: string) => {
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
};

// คืน "YYYY-MM-DD" ตามโซนเวลาเอเชีย/กรุงเทพฯ (กันเหลื่อมวัน)
function todayYMD_TZ(tz = 'Asia/Bangkok') {
  // sv-SE ให้รูปแบบ 2025-08-25 พอดี
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default function NotificationsPage() {
  const [list, setList] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const today = useMemo(() => todayYMD_TZ('Asia/Bangkok'), []);
  
  // โหลด "นัดวันนี้" จาก timeline (from=to=today)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const url = joinUrl(
          API_BASE,
          `/api/notification/timeline?from=${encodeURIComponent(today)}&to=${encodeURIComponent(today)}`
        );
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const j = await res.json();
        if (alive) setList(Array.isArray(j?.data) ? j.data : []);
      } catch (e: any) {
        if (alive) setErr(e?.message || 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [today]);

  // เรียงตามเวลาเริ่ม (null ไปท้าย)
  const sorted = useMemo(() => {
    return [...list].sort((a, b) => {
      const as = a.start ?? '';
      const bs = b.start ?? '';
      if (as && bs) return as.localeCompare(bs);
      if (as && !bs) return -1;
      if (!as && bs) return 1;
      return 0;
    });
  }, [list]);

  // เดิม
// const getStatusConfig = (status: string) => {
//   const statusLower = status.toLowerCase();
//   switch (statusLower) { ... }
// }
function normalizeStatus(raw?: string | null) {
  const s = (raw ?? '').trim().toLowerCase();
  if (!s) return 'unknown';

  // pending
  if (
    s.includes('pending') ||
    s.includes('รอ') ||            // ครอบคลุม "รอดำเนินการ", "รอคิว", ฯลฯ
    s === 'นัดหมาย'
  ) return 'pending';

  // done / completed
  if (
    s.includes('done') ||
    s.includes('complete') ||
    s.includes('completed') ||
    s.includes('เสร็จ') ||        // ครอบคลุม "เสร็จสิ้น", "สำเร็จ"
    s.includes('สำเร็จ')
  ) return 'done';

  // cancelled
  if (
    s.includes('cancel') ||
    s.includes('ยกเลิก')
  ) return 'cancelled';

  return 'other';
}
// ใหม่
const getStatusConfig = (raw?: string | null) => {
  const key = normalizeStatus(raw);
  switch (key) {
    case 'done':
      return {
        icon: CheckCircle,
        className: 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200',
        dotColor: 'bg-green-500',
        text: 'เสร็จสิ้น',
      };
    case 'pending':
      return {
        icon: AlertCircle,
        className: 'bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border border-amber-200',
        dotColor: 'bg-amber-500',
        text: 'รอดำเนินการ',
      };
    case 'cancelled':
      return {
        icon: AlertCircle,
        className: 'bg-gradient-to-r from-rose-50 to-red-50 text-red-700 border border-rose-200',
        dotColor: 'bg-red-500',
        text: 'ยกเลิก',
      };
    default:
      return {
        icon: Clock,
        className: 'bg-gradient-to-r from-gray-50 to-slate-50 text-gray-600 border border-gray-200',
        dotColor: 'bg-gray-400',
        text: raw || 'ไม่ระบุ',
      };
  }
};


  const formatThaiDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('th-TH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };
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
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        {sorted.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mb-6">
              <Bell className="w-12 h-12 text-indigo-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">ไม่มีนัดหมายวันนี้</h3>
            <p className="text-gray-500">วันนี้คุณไม่มีการนัดหมายใดๆ</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* สถิติย่อ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white/70 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-indigo-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">ทั้งหมด</p>
                    <p className="text-2xl font-bold text-indigo-600">{sorted.length}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-indigo-400" />
                </div>
              </div>
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
            </div>

            {/* Timeline */}
            <div className="relative">
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-200 via-purple-200 to-cyan-200"></div>
              
              <div className="space-y-6">
                  {sorted.map((appointment, index) => {
                    const fullName = `${appointment.pname ?? ''}${appointment.first_name ?? ''} ${appointment.last_name ?? ''}`.trim() || 'ไม่ระบุชื่อ';
                    const statusConfig = getStatusConfig(appointment.status ?? '');
                    const StatusIcon = statusConfig.icon;

                    return (
                      <div 
                        key={`${appointment.appointment_id}-${appointment.start ?? ''}`} 
                        className="relative group"
                        style={{ 
                          animation: `slideInUp 0.6s ease-out ${index * 0.1}s both` 
                        }}
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
                                <p className="text-sm text-gray-500">{appointment.type ?? 'ไม่ระบุประเภท'}</p>
                              </div>
                            </div>
                            
                            <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig.className}`}>
                              <StatusIcon className="w-4 h-4 mr-1.5" />
                              {statusConfig.text}
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
                              <span>{appointment.place ?? 'ไม่ระบุสถานที่'}</span>
                            </div>
                          </div>

                          {/* Hover effect overlay */}
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