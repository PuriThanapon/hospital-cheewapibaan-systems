'use client';

import React from 'react';
import Link from 'next/link';
import { Users, ClipboardList, Table, Filter, ChevronRight } from 'lucide-react';
import s from './patient-settings.module.css';

type Item = {
  title: string;
  desc: string;
  href: string;
  icon: React.ReactNode;
};

const items: Item[] = [
  {
    title: 'ฟอร์มผู้ป่วย',
    desc: 'ตั้งค่าฟิลด์/ตัวเลือกของฟอร์มผู้ป่วย (เช่น สถานที่รักษา ฯลฯ)',
    href: '/settings/patient/patient-form',
    icon: <ClipboardList size={22} />,
  },
  {
    title: 'คอลัมน์ตารางผู้ป่วย',
    desc: 'เลือกคอลัมน์ที่จะแสดง/ลำดับ/ความกว้าง (กำหนดในหน้าถัดไป)',
    href: '/settings/patient/columns',
    icon: <Table size={22} />,
  },
];

export default function PatientSettingsPage() {
  return (
    <div className={s.page}>
      {/* Hero */}
      <div className={s.hero}>
        <div className={s.heroInner}>
          <div className={s.heroTitleWrap}>
            <Users size={26} />
            <h1 className={s.heroTitle}>ตั้งค่า: รายชื่อผู้ป่วย</h1>
          </div>
          <p className={s.heroSub}>เลือกหัวข้อที่ต้องการไปตั้งค่าในหน้าถัดไป</p>
        </div>
      </div>

      {/* Content */}
      <div className={s.container}>
        <div className={s.grid}>
          {items.map((it) => (
            <section key={it.href} className={s.card}>
              <div className={s.cardHeader}>
                <div className={s.iconWrap}>{it.icon}</div>
                <div className={s.cardHeadText}>
                  <div className={s.cardTitle}>{it.title}</div>
                  <div className={s.cardDesc}>{it.desc}</div>
                </div>
              </div>
              <div className={s.cardActions}>
                <Link href={it.href} className={s.primaryBtn}>
                  ไปหน้าตั้งค่า
                  <ChevronRight size={16} />
                </Link>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
