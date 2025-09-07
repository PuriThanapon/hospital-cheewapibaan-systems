'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

type Props = {
  value?: string | null;               // รูปแบบ YYYY-MM-DD
  onChange: (val: string | null) => void;
  label?: string;
  name?: string;                       // ✅ รองรับ name
  disabled?: boolean;
  minYear?: number;                    // จำกัดช่วงปี (เช่น ปกติย้อนหลัง 110 ปี)
  maxYear?: number;                    // ปกติ = ปีปัจจุบัน
};

export default function DatePickerField({
  value,
  onChange,
  label,
  name,
  disabled = false,
  minYear,
  maxYear,
}: Props) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const selectedDate = value ? new Date(value) : undefined;

  // ปีขั้นต่ำ/สูงสุด (ดีฟอลต์ย้อนหลัง 110 ปี ถึงปีปัจจุบัน)
  const minY = minYear ?? today.getFullYear() - 110;
  const maxY = maxYear ?? today.getFullYear();

  // สถานะเดือน/ปีที่กำลังแสดง
  const [currentMonth, setCurrentMonth] = useState<number>(
    selectedDate ? selectedDate.getMonth() : today.getMonth()
  );
  const [currentYear, setCurrentYear] = useState<number>(
    selectedDate ? selectedDate.getFullYear() : today.getFullYear()
  );
  const [showYearSelect, setShowYearSelect] = useState(false);

  // เปิดปฏิทินแล้วให้ซิงก์เดือน/ปีไปยังค่าปัจจุบัน/ค่าที่เลือกไว้
  useEffect(() => {
    if (!open) return;
    const base = selectedDate ?? today;
    setCurrentMonth(base.getMonth());
    setCurrentYear(base.getFullYear());
  }, [open, selectedDate, today]);

  // ===== utilities =====
  const thaiMonths = [
    'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
    'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
  ];
  const thaiDays = ['อา','จ','อ','พ','พฤ','ศ','ส'];

  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const formatDisplayDate = (date?: Date) =>
    date ? `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}` : '';

  const getDaysInMonth = (month: number, year: number) => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const len = last.getDate();
    const startDOW = first.getDay();
    const arr: (number | null)[] = [];
    for (let i = 0; i < startDOW; i++) arr.push(null);
    for (let d = 1; d <= len; d++) arr.push(d);
    return arr;
  };

  const days = getDaysInMonth(currentMonth, currentYear);

  const navigateMonth = (dir: 'prev' | 'next') => {
    if (dir === 'prev') {
      if (currentMonth === 0) {
        if (currentYear > minY) {
          setCurrentMonth(11);
          setCurrentYear(currentYear - 1);
        }
      } else setCurrentMonth(currentMonth - 1);
    } else {
      if (currentMonth === 11) {
        if (currentYear < maxY) {
          setCurrentMonth(0);
          setCurrentYear(currentYear + 1);
        }
      } else setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDateSelect = (day?: number | null) => {
    if (!day) return;
    const newDate = new Date(currentYear, currentMonth, day);
    onChange(formatDate(newDate));
    setOpen(false);
  };

  const goToToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    onChange(formatDate(today));
    setOpen(false);
  };

  const isToday = (day?: number | null) =>
    !!day &&
    day === today.getDate() &&
    currentMonth === today.getMonth() &&
    currentYear === today.getFullYear();

  const isSelected = (day?: number | null) =>
    !!day &&
    selectedDate &&
    day === selectedDate.getDate() &&
    currentMonth === selectedDate.getMonth() &&
    currentYear === selectedDate.getFullYear();

  // ===== render =====
  return (
    <div className="relative">
      {label && <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>}

      {/* ✅ ส่งค่าไปกับฟอร์มได้ถ้ามี name */}
      {name && <input type="hidden" name={name} value={value ?? ''} />}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((s) => !s)}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg bg-white hover:border-[#005A50] focus:border-[#005A50] focus:ring-4 focus:ring-[#005A50]/10 transition-all flex items-center justify-between ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
        }`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={`text-sm ${value ? 'text-gray-900' : 'text-gray-500'}`}>
          {value ? formatDisplayDate(selectedDate) : 'เลือกวันที่'}
        </span>
        <Calendar size={16} className="text-gray-400" />
      </button>

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 bg-white shadow-xl border border-gray-200 rounded-lg mt-1 p-3 w-80">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => navigateMonth('prev')}
                className="p-1 hover:bg-gray-100 rounded-md"
                aria-label="Previous month"
              >
                <ChevronLeft size={16} className="text-gray-600" />
              </button>

              <button
                type="button"
                onClick={() => setShowYearSelect((s) => !s)}
                className="text-sm font-medium text-gray-700 hover:text-[#005A50] flex items-center px-2 py-1 rounded hover:bg-[#005A50]/10"
              >
                {thaiMonths[currentMonth]} {currentYear + 543}
                <ChevronDown size={14} className="ml-1" />
              </button>

              <button
                type="button"
                onClick={() => navigateMonth('next')}
                className="p-1 hover:bg-gray-100 rounded-md"
                aria-label="Next month"
              >
                <ChevronRight size={16} className="text-gray-600" />
              </button>
            </div>

            {/* Year/Month Selector */}
            {showYearSelect && (
              <div className="mb-3 p-2 border border-gray-200 rounded-lg bg-gray-50">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select
                    value={currentYear}
                    onChange={(e) => setCurrentYear(parseInt(e.target.value))}
                    className="text-xs p-1 border rounded"
                  >
                    {Array.from({ length: maxY - minY + 1 }, (_, i) => maxY - i).map((y) => (
                      <option key={y} value={y}>
                        {y + 543}
                      </option>
                    ))}
                  </select>
                  <select
                    value={currentMonth}
                    onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
                    className="text-xs p-1 border rounded"
                  >
                    {thaiMonths.map((m, i) => (
                      <option key={m} value={i}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setShowYearSelect(false)}
                  className="w-full text-xs py-1 bg-[#005A50] text-white rounded hover:bg-[#004a43]"
                >
                  ตกลง
                </button>
              </div>
            )}

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 mb-3">
              {thaiDays.map((d) => (
                <div key={d} className="text-xs font-medium text-gray-500 text-center py-2">
                  {d}
                </div>
              ))}

              {days.map((day, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleDateSelect(day)}
                  disabled={!day}
                  className={`h-8 w-8 text-xs rounded-md flex items-center justify-center transition-colors ${
                    !day ? 'invisible' : ''
                  } ${
                    isSelected(day)
                      ? 'bg-[#005A50] text-white font-medium'
                      : isToday(day)
                      ? 'bg-[#005A50]/10 text-[#005A50] font-medium'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="flex justify-between pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={goToToday}
                className="text-xs px-3 py-1 text-[#005A50] hover:bg-[#005A50]/10 rounded-md font-medium"
              >
                วันนี้
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs px-3 py-1 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                ปิด
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
