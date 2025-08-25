'use client';
import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';

type Appointment = {
  appointment_id: string;
  pname?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  date?: string | null;   // YYYY-MM-DD
  start?: string | null;  // HH:mm
  end?: string | null;    // HH:mm
  place?: string | null;
  status?: string | null; // pending / done / cancelled / ...
  type?: string | null;
};

// ===== Config / utils =====
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';
const joinUrl = (base: string, path: string) => {
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
};
const todayYMD_TZ = (tz = 'Asia/Bangkok') =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date());

const normalizeStatus = (raw?: string | null) => {
  const s = (raw ?? '').trim().toLowerCase();
  if (!s) return 'unknown';
  if (s.includes('pending') || s.includes('รอ')) return 'pending';
  if (s.includes('done') || s.includes('complete') || s.includes('completed') || s.includes('เสร็จ') || s.includes('สำเร็จ')) return 'done';
  if (s.includes('cancel') || s.includes('ยกเลิก')) return 'cancelled';
  return 'other';
};

export default function AppointmentsToastSweet({ limit = 3 }: { limit?: number }) {
  const today = useMemo(() => todayYMD_TZ('Asia/Bangkok'), []);

  useEffect(() => {
    let alive = true;

    // ถ้าเคยกดซ่อนของวันนี้ไว้ ก็ไม่ต้องเด้ง
    try {
      if (localStorage.getItem(`sw_toast_hide:${today}`) === '1') return;
    } catch {}

    (async () => {
      try {
        // โหลด Swal แบบ client-only
        const [{ default: Swal }] = await Promise.all([
          import('sweetalert2'),
          import('sweetalert2/dist/sweetalert2.min.css'), // โหลดสไตล์
        ]);

        // ดึงนัดหมายวันนี้
        const url = joinUrl(API_BASE, `/api/notification/timeline?from=${today}&to=${today}`);
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        const data: Appointment[] = Array.isArray(j?.data) ? j.data : [];

        // เลือกเฉพาะ pending + เรียงเวลา
        const list = data
          .filter(a => normalizeStatus(a.status) === 'pending')
          .sort((a, b) => (a.start || '').localeCompare(b.start || ''))
          .slice(0, limit);

        if (!alive || list.length === 0) return;

        // สร้าง Swal instance แบบ toast
        const Toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          showCloseButton: true,
          timer: 5000,
          timerProgressBar: true,
          didOpen: (el) => {
            el.addEventListener('mouseenter', Swal.stopTimer);
            el.addEventListener('mouseleave', Swal.resumeTimer);
          },
        });

        // เด้งที่ละใบ (รอใบก่อนปิด/หมดเวลา ค่อยเด้งใบถัดไป)
        for (const a of list) {
          if (!alive) break;
          const fullName = `${a.pname ?? ''}${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || 'ไม่ระบุชื่อ';

          await Toast.fire({
            icon: 'info',
            title: 'นัดหมายวันนี้',
            html: `
              <div style="margin-top:4px; text-align:left; font-size:13px; line-height:1.35;">
                <div><b>${fullName}</b></div>
                <div>${a.type ?? 'ไม่ระบุประเภท'}</div>
                <div>เวลา ${a.start ?? '—'}${a.end ? `–${a.end}` : ''} น. • ${a.place ?? 'ไม่ระบุสถานที่'}</div>
                <div style="margin-top:6px; display:flex; gap:10px;">
                  <a href="/notifications" style="color:#4f46e5; text-decoration:underline;">ดูทั้งหมด</a>
                  <a href="#" id="sw-hide-today" style="color:#6b7280;">ซ่อนวันนี้</a>
                </div>
              </div>
            `,
            didOpen: (el) => {
              // คลิก "ซ่อนวันนี้" แล้วไม่เด้งซ้ำทั้งวัน
              const hide = el.querySelector('#sw-hide-today') as HTMLAnchorElement | null;
              if (hide) {
                hide.addEventListener('click', (ev) => {
                  ev.preventDefault();
                  try { localStorage.setItem(`sw_toast_hide:${today}`, '1'); } catch {}
                  Swal.close(); // ปิดใบปัจจุบัน
                });
              }
            },
          });
        }
      } catch {
        // เงียบ ๆ ไม่รบกวน UI
      }
    })();

    return () => { alive = false; };
  }, [today, limit]);

  return null;
}
