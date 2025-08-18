import Link from "next/link";

const menuItems = [
  {
    title: "เมนูหลัก",
    items: [
      {
        icon: "/home.png",
        label: "หน้าแรก",
        href: "/",
        // visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/student.png",
        label: "รายชื่อผู้ป่วย",
        href: "/patient",
        // visible: ["admin", "teacher"],
      },

      {
        icon: "/lesson.png",
        label: "ข้อมูลการรักษา",
        href: "/treatment",
        // visible: ["admin", "teacher"],
      },
      {
        icon: "/exam.png",
        label: "ออกรายงาน",
        href: "/list/exams",
        // visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/calendar.png",
        label: "การนัดหมาย",
        href: "/appointments",
        // visible: ["admin", "teacher", "student", "parent"],
      },
    ],
  },
  {
    title: "อื่นๆ",
    items: [
      {
        icon: "/profile.png",
        label: "โปร์ไฟล์",
        href: "/profile",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/setting.png",
        label: "ตั้งค่า",
        href: "/settings",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/logout.png",
        label: "ออกจากระบบ",
        href: "/logout",
        visible: ["admin", "teacher", "student", "parent"],
      },
    ],
  },
];
import React from 'react'

const Menu = ({ isCollapsed }: { isCollapsed: boolean }) => {
  return (
    <div className='text-sm' >
      {menuItems.map(i => (
        <div className='flex flex-col gap-2' key={i.title}>
          {!isCollapsed && (
            <span className="text-gray-600 font-light my-4">{i.title}</span>
          )}
          {i.items.map(item => (
          <Link
            href={item.href}
            key={item.label}
            className={`group flex items-center ${
              isCollapsed ? "justify-center" : "gap-4"
            } text-gray-600 py-4 px-4 rounded-md transition-all duration-200`}
            style={{
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = "#02786e";
              e.currentTarget.style.color = "white";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#4B5563"; // tailwind text-gray-600
            }}
          >
            <img
              src={item.icon}
              alt={item.label}
              width={20}
              height={20}
              className="w-5 h-5 min-w-[20px] group-hover:brightness-0 group-hover:invert"
            />
            {!isCollapsed && <span>{item.label}</span>}
          </Link>
          ))}
        </div>
      ))}
    </div>
  );
};

export default Menu