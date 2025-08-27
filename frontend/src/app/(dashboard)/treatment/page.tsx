'use client';

import Link from 'next/link';
import { Stethoscope, ClipboardList, ArrowRight, CalendarCheck2 } from 'lucide-react';

export default function TreatmentHubPage() {
  return (
    <div className="min-h-screen p-6 md:p-10 bg-[#f7f7fb] rounded-2xl">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">ข้อมูลการรักษา</h1>
            <p className="text-gray-600 mt-1">เลือกเมนูที่ต้องการเข้าใช้งาน</p>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* การรักษา ประจำ/ฉุกเฉิน */}
          <div className="group rounded-3xl border border-gray-200 bg-white shadow hover:shadow-lg transition-all">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-emerald-100">
                  <Stethoscope className="w-5 h-5 text-emerald-700" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800">
                  บันทึกการรักษา (ประจำ/ฉุกเฉิน)
                </h2>
              </div>
              <p className="text-gray-600">
                จัดการรายการรักษาแบบประจำ และทำครั้งเดียว (เคสฉุกเฉิน) — ค้นหา ดูรายละเอียด เพิ่ม/แก้ไข ทำเครื่องหมายเสร็จสิ้น
              </p>
              <div className="mt-5">
                <Link
                  href="/treatment/records"
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  เปิดหน้ารายการรักษา <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* แผนการรักษา */}
          <div className="group rounded-3xl border border-gray-200 bg-white shadow hover:shadow-lg transition-all">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-indigo-100">
                  <CalendarCheck2 className="w-5 h-5 text-indigo-700" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800">แผนการรักษา</h2>
              </div>
              <p className="text-gray-600">
                วางแผนการรักษาระยะสั้น/ยาว กำหนดกิจกรรม ติดตามความคืบหน้า และประเมินผล
              </p>
              <div className="mt-5 flex gap-3">
                <Link
                  href="/treatment/plans"
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  ไปที่หน้าแผนการรักษา <ArrowRight className="w-4 h-4" />
                </Link>
                {/* (ทางเลือก) ปุ่มสร้างใหม่ */}
                <Link
                  href="/treatment/plans/new"
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors"
                >
                  สร้างแผนใหม่
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}