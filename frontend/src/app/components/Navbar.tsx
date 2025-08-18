'use client';
import React, { useEffect, useRef, useState } from 'react';

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // ปิดเมื่อคลิกนอก/กด Esc
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!menuRef.current || !triggerRef.current) return;
      const t = e.target as Node;
      if (!menuRef.current.contains(t) && !triggerRef.current.contains(t)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const handleSignOut = () => {
    // TODO: วาง logic ออกจากระบบที่นี่
    console.log('sign out');
  };

  return (
    <div
      style={{ backgroundColor: '#005a50ff' }}
      className="flex items-center justify-between p-4 gap-4 shadow-md"
    >
      {/* CENTER - SEARCH BAR */}
      <div className="hidden md:flex items-center gap-4 bg-white text-xs rounded-full px-2 shadow-md ring-[1.5px] ring-gray-300 max-w-[700px] w-full mx-auto">
        <img src="/search.png" alt="" width={14} height={14} />
        <input
          type="text"
          className="flex-1 p-2 bg-transparent outline-none"
          placeholder="ค้นหา..."
        />
      </div>

      {/* RIGHT - ICONS + USER */}
      <div className="relative flex items-center gap-4 flex-shrink-0 ml-auto">

        <div className="bg-white rounded-full h-7 w-7 flex items-center justify-center cursor-pointer relative">
          <img src="/announcement.png" alt="" width={20} height={20} />
          <div className="absolute -top-3 -right-3 w-5 h-5 flex items-center justify-center bg-purple-500 text-white rounded-full text-xs">
            1
          </div>
        </div>

        <div className="flex flex-col text-right">
          <span className="text-xs leading-3 font-medium text-[#ffd700]">
            Phuthanet Sitthiwichai
          </span>
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
              src="https://scontent.fbkk12-3.fna.fbcdn.net/v/t39.30808-1/462507050_4069822256579766_3251004265784467628_n.jpg?stp=dst-jpg_s200x200_tt6&_nc_cat=102&ccb=1-7&_nc_sid=e99d92&_nc_ohc=ErJqVZMN420Q7kNvwHQ7ESj&_nc_oc=AdkJr_Y9WBSl5BSR7Mn4mh9vfvCWtCuhWF141ATN0QkZeZG-q-t1r_dj7_-hQrO9-v7IKD_AamaWX5SD5YBvqBDh&_nc_zt=24&_nc_ht=scontent.fbkk12-3.fna&_nc_gid=AotkxksVEWFUWH-xe---DA&oh=00_AfXdXPJgV3NfUEaV7ya_-clke_7xm4zVjTOBXDjUlCIEig&oe=68A4349A"
              alt="User Avatar"
              className="w-full h-full object-cover"
            />
          </span>
          {/* ลูกศรบอกว่าคลิกได้ */}
          <svg
            className={`w-4 h-4 text-white transition-transform ${
              open ? 'rotate-180' : 'rotate-0'
            }`}
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
            {/* ส่วนหัวโปรไฟล์ */}
            <div className="flex items-center gap-3 p-2">
              <div className="w-10 h-10 rounded-full overflow-hidden">
                <img
                  src="https://scontent.fbkk12-3.fna.fbcdn.net/v/t39.30808-1/462507050_4069822256579766_3251004265784467628_n.jpg?stp=dst-jpg_s200x200_tt6&_nc_cat=102&ccb=1-7&_nc_sid=e99d92&_nc_ohc=ErJqVZMN420Q7kNvwHQ7ESj&_nc_oc=AdkJr_Y9WBSl5BSR7Mn4mh9vfvCWtCuhWF141ATN0QkZeZG-q-t1r_dj7_-hQrO9-v7IKD_AamaWX5SD5YBvqBDh&_nc_zt=24&_nc_ht=scontent.fbkk12-3.fna&_nc_gid=AotkxksVEWFUWH-xe---DA&oh=00_AfXdXPJgV3NfUEaV7ya_-clke_7xm4zVjTOBXDjUlCIEig&oe=68A4349A"
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  Phuthanet Sitthiwichai
                </p>
                <p className="text-xs text-gray-500 truncate">
                  admin@example.com
                </p>
              </div>
            </div>

            <div className="my-2 h-px bg-gray-200" />

            {/* เมนูรายการ */}
            <nav className="flex flex-col">
              <a
                href="/profile"
                className="rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                ข้อมูลส่วนตัว
              </a>
              <a
                href="/settings"
                className="rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                ตั้งค่า
              </a>
              <a
                href="/change-password"
                className="rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                เปลี่ยนรหัสผ่าน
              </a>
              <button
                className="mt-1 rounded-xl px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                role="menuitem"
                onClick={handleSignOut}
              >
                ออกจากระบบ
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* keyframes เล็ก ๆ สำหรับ fade-in (ใช้ได้ถ้าตั้งใน globals.css) */}
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.98) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default Navbar;