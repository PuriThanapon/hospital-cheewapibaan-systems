'use client';

import React from 'react';
import InputField from '@/app/components/ui/InputField';
import { AlertCircle, Building, Calendar, Clock, FileText, Skull } from 'lucide-react';
import DatePickerField from '../DatePicker';
import ThaiTimePicker from '../TimePicker';

export default function DeceasedForm({ value, onChange, errors = {} }) {
  const v = value || {};
  const set = (k) => (e) => onChange({ ...v, [k]: e.target.value });

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-xl border-2 border-gray-300">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <Skull size={20} className="text-red-600"/>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">ข้อมูลการเสียชีวิต</h3>
            <p className="text-sm text-gray-600">โปรดกรอกข้อมูลให้ครบถ้วนและถูกต้อง</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField label="วันที่เสียชีวิต" required error={errors.death_date} icon={<Calendar size={16}/>}>
            <DatePickerField
              value={v.death_date}
              onChange={(val) => onChange({ ...v, death_date: val })}
              name="death_date"
            />
          </InputField>

          <InputField label="เวลาเสียชีวิต" icon={<Clock size={16}/>}>
            <ThaiTimePicker
              value={v.death_time || ''}
              onChange={(val) => onChange({ ...v, death_time: val || '' })}
              mode="select" minuteStep={1}
            />
          </InputField>
        </div>

        <div className="mt-6">
          <InputField label="สาเหตุการเสียชีวิต" required error={errors.death_cause} icon={<FileText size={16}/>}>
            <input
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all duration-200"
              value={v.death_cause || ''}
              onChange={set('death_cause')}
              placeholder="เช่น ภาวะหัวใจหยุดเต้น, ภาวะหายใจล้มเหลว"
            />
          </InputField>
        </div>

        <div className="mt-6">
          <InputField label="การจัดการศพ" icon={<Building size={16}/>} description="วิธีการจัดการหลังเสียชีวิต">
            <select
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all duration-200"
              value={v.management || ''}
              onChange={set('management')}
            >
              <option value="">-- เลือกการจัดการ --</option>
              <option value="ส่งกลับบ้าน">ส่งกลับบ้าน</option>
              <option value="ฌาปนกิจ">ฌาปนกิจ</option>
              <option value="บริจาคร่างกาย">บริจาคร่างกาย</option>
              <option value="อื่น ๆ">อื่น ๆ</option>
            </select>
          </InputField>
        </div>
      </div>

      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5"/>
          <div>
            <h4 className="font-semibold text-red-800">ข้อสำคัญ</h4>
            <p className="text-sm text-red-700 mt-1">
              การเปลี่ยนสถานะเป็น "เสียชีวิต" ไม่สามารถย้อนกลับได้ โปรดตรวจสอบข้อมูลให้ถูกต้องก่อนยืนยัน
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
