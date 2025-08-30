'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from 'next/dynamic';
import {
  House,
  Users,
  Stethoscope,
  CalendarDays,
  FileText,
  User,
  Settings,
  LogOut,
  Archive,
  FolderClosed,
  Pill,
  Bed
} from "lucide-react";
const Select = dynamic(() => import('react-select'), { ssr: false });
const menuItems = [
  {
    title: "เมนูหลัก",
    items: [
      { icon: <House size={20} />, label: "หน้าแรก", href: "/" },
      { icon: <Users size={20} />, label: "รายชื่อผู้ป่วย", href: "/patient" },
      { icon: <Stethoscope size={20} />, label: "ข้อมูลการรักษา", href: "/treatment" },
      { icon: <CalendarDays size={20} />, label: "การนัดหมาย", href: "/appointments" },
      { icon: <Bed size={20} />, label: "จัดการเตียง", href: "/bed-stays"},
      { icon: <FileText size={20} />, label: "ออกรายงาน", href: "/report" },
      { icon: <FolderClosed size={20} />, label: "เอกสาร", href: "/templates"},
    ],
  },
  {
    title: "อื่นๆ",
    items: [
      { icon: <User size={20} />, label: "โปร์ไฟล์", href: "/profile" },
      { icon: <Settings size={20} />, label: "ตั้งค่า", href: "/settings" },
      { icon: <LogOut size={20} />, label: "ออกจากระบบ", href: "/logout" },
    ],
  },
];

export default function Menu({ isCollapsed }: { isCollapsed: boolean }) {
  const pathname = usePathname();

  return (
    <div className="text-sm font-bold">
      {menuItems.map((section) => (
        <div className="flex flex-col gap-2" key={section.title}>
          {!isCollapsed && (
            <span className="text-gray-600 font-light my-4">{section.title}</span>
          )}

          {section.items.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                href={item.href}
                key={item.label}
                className={`group flex items-center ${
                  isCollapsed ? "justify-center" : "gap-3"
                } py-3 px-4 rounded-md transition-all duration-200 ${
                  isActive
                    ? "bg-[#005a50] text-white"
                    : "text-gray-600 hover:bg-gray-400 hover:text-white"
                }`}
              >
                <div className="w-5 h-5 min-w-[20px] flex items-center justify-center">
                  {item.icon}
                </div>
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
