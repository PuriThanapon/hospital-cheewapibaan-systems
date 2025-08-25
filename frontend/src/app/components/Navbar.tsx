'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const Select = dynamic(() => import('react-select'), { ssr: false }); // (ถ้าไม่ใช้ ลบได้)

// ===== helpers & config =====
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

const joinUrl = (base: string, path: string) => {
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
};

function todayYMD_TZ(tz = 'Asia/Bangkok') {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function normalizeStatus(raw?: string | null) {
  const s = (raw ?? '').trim().toLowerCase();
  if (!s) return 'unknown';
  if (s.includes('pending') || s.includes('รอ')) return 'pending';
  if (s.includes('done') || s.includes('complete') || s.includes('เสร็จ') || s.includes('สำเร็จ')) return 'done';
  if (s.includes('cancel') || s.includes('ยกเลิก')) return 'cancelled';
  return 'other';
}

// ✅ ยิง event ให้ทุกแท็บ/หน้ารู้ว่าให้รีเฟรช badge
export function notifyBadgeInvalidate() {
  try { window.dispatchEvent(new Event('badge:invalidate')); } catch {}
  try { const bc = new BroadcastChannel('badge'); bc.postMessage('invalidate'); bc.close(); } catch {}
  try { localStorage.setItem('badge:ping', String(Date.now())); } catch {}
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // badge state (today)
  const [badge, setBadge] = useState<{ total: number; pending: number }>({ total: 0, pending: 0 });

  // ปิดเมนูเมื่อคลิกนอก/กด Esc
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!menuRef.current || !triggerRef.current) return;
      const t = e.target as Node;
      if (!menuRef.current.contains(t) && !triggerRef.current.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // ====== ดึงตัวเลข badge ======
  const fetchBadge = useCallback(async () => {
    try {
      const ymd = todayYMD_TZ('Asia/Bangkok');

      // 1) endpoint เบา /badge
      const url = joinUrl(API_BASE, `/api/notification/badge?date=${encodeURIComponent(ymd)}`);
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();

      let total = Number(j?.total ?? 0);
      let pending = Number(j?.pending ?? 0);

      // 2) ถ้าค่ามาเพี้ยน → fallback /timeline (คำนวณเอง)
      if (!Number.isFinite(total) || !Number.isFinite(pending)) {
        const tUrl = joinUrl(API_BASE, `/api/notification/timeline?from=${ymd}&to=${ymd}`);
        const tr = await fetch(tUrl, { cache: 'no-store' });
        if (tr.ok) {
          const tj = await tr.json();
          const data: any[] = Array.isArray(tj?.data) ? tj.data : [];
          total = data.length;
          pending = data.filter(x => normalizeStatus(x?.status) === 'pending').length;
        } else {
          total = 0; pending = 0;
        }
      }

      setBadge({ total, pending });
    } catch (err) {
      console.warn('badge fetch failed', err);
    }
  }, []);

  // เก็บฟังก์ชันไว้ใน ref เพื่อเรียกจาก event listeners
  const fetchBadgeRef = useRef<() => void>(() => {});
  useEffect(() => { fetchBadgeRef.current = fetchBadge; }, [fetchBadge]);

  // เรียกครั้งแรก + ตั้ง interval + refresh ตอนกลับมาโฟกัสแท็บ
  useEffect(() => {
    fetchBadge(); // ← โหลดทันทีตอน mount

    const id = setInterval(fetchBadge, 60_000);
    const onVis = () => { if (document.visibilityState === 'visible') fetchBadge(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [fetchBadge]);

  // ฟัง invalidation events (จากหน้าอื่นหลังเปลี่ยนสถานะนัด)
  useEffect(() => {
    const onInvalidate = () => fetchBadgeRef.current();
    const onStorage = (e: StorageEvent) => { if (e.key === 'badge:ping') fetchBadgeRef.current(); };

    window.addEventListener('badge:invalidate', onInvalidate);
    window.addEventListener('storage', onStorage);

    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('badge') : null;
    bc?.addEventListener('message', (ev) => { if (ev.data === 'invalidate') fetchBadgeRef.current(); });

    return () => {
      window.removeEventListener('badge:invalidate', onInvalidate);
      window.removeEventListener('storage', onStorage);
      bc?.close();
    };
  }, []);

  const handleSignOut = () => {
    console.log('sign out');
  };

  return (
    <div className="flex items-center justify-between p-4 gap-4 shadow-md bg-[#005a50]">
      {/* LEFT - LOGO + TITLE */}
      <div className="flex items-center gap-2 ml-2">
        <img
          src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTu7nMhqiZLkgWSeS8Y1-Mbs0ILsrgt1S0HRA&s"
          alt="Logo"
          className="w-12 h-12 rounded-[15] object-cover"
        />
        <span className="text-xl font-semibold text-white">แผนกชีวาภิบาล</span>
      </div>

      {/* RIGHT - ICONS + USER */}
      <div className="relative flex items-center gap-4 flex-shrink-0 ml-auto">
        {/* Notification bell with dynamic badge */}
        <Link
          href="/notifications"
          className="relative bg-white rounded-full h-7 w-7 flex items-center justify-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ffd700]"
          aria-label={`ดูการแจ้งเตือนวันนี้: รอดำเนินการ ${badge.pending} / ทั้งหมด ${badge.total}`}
          title={`การแจ้งเตือนวันนี้ • รอดำเนินการ ${badge.pending} / ทั้งหมด ${badge.total}`}
        >
          <img src="/bell.png" alt="การแจ้งเตือน" width={20} height={20} />
          {badge.pending > 0 && (
            <span className="absolute -top-3 -right-3 w-5 h-5 mr-1 mt-1 flex items-center justify-center bg-red-500 text-white rounded-full text-xs">
              {badge.pending > 99 ? '99+' : badge.pending}
            </span>
          )}
        </Link>

        <div className="flex flex-col text-right">
          <span className="text-xs leading-3 font-medium text-[#ffd700]">ADMIN NAJA</span>
          <span className="text-[10px] text-white">ผู้ดูแลระบบ</span>
        </div>

        {/* PROFILE BUTTON + ARROW */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-1 rounded-full pl-1 pr-2 py-1 cursor-pointer ring-2 ring-transparent focus:ring-white/70 focus:outline-none hover:bg-white/10 transition"
        >
          <span className="w-8 h-8 rounded-full overflow-hidden block">
            <img
              src="https://png.pngtree.com/png-vector/20191110/ourmid/pngtree-avatar-icon-profile-icon-member-login-vector-isolated-png-image_1978396.jpg"
              alt="User Avatar"
              className="w-full h-full object-cover"
            />
          </span>
          <svg
            className={`w-4 h-4 text-white transition-transform ${open ? 'rotate-180' : 'rotate-0'}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.24 4.38a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* DROPDOWN */}
        {open && (
          <div
            ref={menuRef}
            role="menu"
            className="absolute right-0 top-14 z-50 w-64 origin-top-right rounded-2xl bg-white shadow-xl ring-1 ring-black/5 p-3 animate-[fadeIn_.12s_ease-out]"
          >
            <div className="flex items-center gap-3 p-2">
              <div className="w-10 h-10 rounded-full overflow-hidden">
                <img
                  src="https://png.pngtree.com/png-vector/20191110/ourmid/pngtree-avatar-icon-profile-icon-member-login-vector-isolated-png-image_1978396.jpg"
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">ADMIN NAJA</p>
                <p className="text-xs text-gray-500 truncate">admin@example.com</p>
              </div>
            </div>
            <div className="my-2 h-px bg-gray-200" />
            <nav className="flex flex-col">
              <a href="/profile" className="rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">ข้อมูลส่วนตัว</a>
              <a href="/settings" className="rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">ตั้งค่า</a>
              <a href="/change-password" className="rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">เปลี่ยนรหัสผ่าน</a>
              <button className="mt-1 rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50" onClick={handleSignOut}>ออกจากระบบ</button>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}
