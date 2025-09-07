'use client';

import React from 'react';
import Link from 'next/link';
import {
  Wrench, ChevronRight, Users, Stethoscope,
  Calendar, Activity, Bed, FileText, FolderOpen
} from 'lucide-react';
import s from './settings.module.css';

type Section = {
  key: string;
  title: string;
  desc: string;
  href: string;
  icon: React.ReactNode;
};

const sections: Section[] = [
  {
    key: 'patient',
    title: 'รายชื่อผู้ป่วย',
    desc: 'ตั้งค่าตาราง/ฟิลด์/ตัวกรอง และฟอร์มเพิ่มผู้ป่วย',
    href: '/settings/patient',
    icon: <Users size={22} />,
  },
  {
    key: 'treatment',
    title: 'ข้อมูลการรักษา',
    desc: 'แบบฟอร์มรักษา รายการยา Vitals/Assessment และสิทธิ์',
    href: '/settings/treatment',
    icon: <Stethoscope size={22} />,
  },
  {
    key: 'appointments',
    title: 'การนัดหมาย',
    desc: 'เหตุผลการนัด ช่วงเวลา และการแจ้งเตือน',
    href: '/settings/appointments',
    icon: <Calendar size={22} />,
  },
  {
    key: 'daily',
    title: 'กิจวัตรประจำวัน',
    desc: 'กิจกรรม เทมเพลต และผู้รับผิดชอบ',
    href: '/settings/daily',
    icon: <Activity size={22} />,
  },
  {
    key: 'beds',
    title: 'จัดการเตียง',
    desc: 'แผนผัง โซน/ชั้น และสถานะเตียง',
    href: '/settings/beds',
    icon: <Bed size={22} />,
  },
  {
    key: 'reports',
    title: 'ออกรายงาน',
    desc: 'รูปแบบรายงาน ค่าเริ่มต้น และสิทธิ์',
    href: '/settings/reports',
    icon: <FileText size={22} />,
  },
  {
    key: 'documents',
    title: 'เอกสาร',
    desc: 'ประเภทเอกสาร บังคับ/ไม่บังคับ และการอัปโหลด',
    href: '/settings/patient/documents',
    icon: <FolderOpen size={22} />,
  },
];

export default function SettingsHubPage() {
  return (
    <div className={s.page}>
      {/* Hero */}
      <div className={s.hero}>
        <div className={s.heroInner}>
          <div className={s.heroTitleWrap}>
            <Wrench size={26} />
            <h1 className={s.heroTitle}>ตั้งค่า (Settings)</h1>
          </div>
          <p className={s.heroSub}>เลือกหมวดที่ต้องการไปตั้งค่า</p>
        </div>
      </div>

      {/* Content */}
      <div className={s.container}>
        <div className={s.grid}>
          {sections.map((sec) => (
            <section key={sec.key} className={s.card}>
              <div className={s.cardHeader}>
                <div className={s.iconWrap}>{sec.icon}</div>
                <div className={s.cardHeadText}>
                  <div className={s.cardTitle}>{sec.title}</div>
                  <div className={s.cardDesc}>{sec.desc}</div>
                </div>
              </div>

              <div className={s.cardActions}>
                <Link href={sec.href} className={s.primaryBtn}>
                  ไปหน้าตั้งค่าส่วนนี้
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
