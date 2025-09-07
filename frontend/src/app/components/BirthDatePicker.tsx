'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

type BirthDatePickerProps = {
  value?: string | Date | null;
  onChange: (val: string | null) => void;
  label?: string;
  name?: string;
  disabled?: boolean;
  /** ค่าเริ่มต้น: ปัจจุบัน-110 ปี */
  minYear?: number;
  /** ค่าเริ่มต้น: ปีปัจจุบัน */
  maxYear?: number;
};

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];
const THAI_DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

/** แปลงค่า value ให้เป็น Date แบบไม่พึ่งตัวแปลง timezone ของ new Date(string) */
function parseToDate(val?: string | Date | null): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return new Date(val.getFullYear(), val.getMonth(), val.getDate());
  }
  if (typeof val === 'string') {
    const m = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return undefined;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(y, mo, d);
    if (!isNaN(dt.getTime())) return dt;
  }
  return undefined;
}

function fmtYYYYMMDD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function fmtThai(date?: Date) {
  if (!date) return '';
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
}

export default function BirthDatePicker({
  value,
  onChange,
  label,
  name,
  disabled = false,
  minYear,
  maxYear,
}: BirthDatePickerProps) {
  const selectedDate = parseToDate(value);
  const today = useMemo(() => new Date(), []);
  const curYear = today.getFullYear();

  const realMinYear = minYear ?? curYear - 110;
  const realMaxYear = maxYear ?? curYear;

  // state เดือน/ปีที่กำลังแสดง
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<number>((selectedDate ?? today).getMonth());
  const [year, setYear] = useState<number>((selectedDate ?? today).getFullYear());
  const [showYearSelect, setShowYearSelect] = useState(false);

  // เมื่อเปิดปฏิทิน ให้เลื่อนไปเดือน/ปีของค่าวันที่ที่เลือกไว้
  useEffect(() => {
    if (!open) return;
    const base = selectedDate ?? today;
    setMonth(base.getMonth());
    setYear(base.getFullYear());
  }, [open, selectedDate, today]);

  // ปิดด้วย Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const pad = first.getDay(); // 0=Sun
    const arr: Array<number | null> = Array.from({ length: pad }, () => null);
    for (let d = 1; d <= last.getDate(); d++) arr.push(d);
    return arr;
  }, [month, year]);

  const navigateMonth = (dir: 'prev' | 'next') => {
    if (dir === 'prev') {
      if (month === 0) {
        setMonth(11);
        setYear(y => Math.max(realMinYear, y - 1));
      } else {
        setMonth(m => m - 1);
      }
    } else {
      if (month === 11) {
        setMonth(0);
        setYear(y => Math.min(realMaxYear, y + 1));
      } else {
        setMonth(m => m + 1);
      }
    }
  };

  const isSelected = (d?: number | null) =>
    !!d &&
    selectedDate &&
    d === selectedDate.getDate() &&
    month === selectedDate.getMonth() &&
    year === selectedDate.getFullYear();

  const isToday = (d?: number | null) =>
    !!d &&
    d === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  const pick = (d?: number | null) => {
    if (!d) return;
    const dt = new Date(year, month, d);
    onChange(fmtYYYYMMDD(dt));
    setOpen(false);
  };

  return (
    <div className="relative">
      {label && <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>}

      {/* ซ่อนค่าไว้สำหรับ form submit ถ้าต้องการ */}
      {name && <input type="hidden" name={name} value={selectedDate ? fmtYYYYMMDD(selectedDate) : ''} />}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`w-full px-3 py-3 border rounded-lg bg-white flex items-center justify-between
          ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-blue-400'}
          border-gray-300`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={`text-sm ${selectedDate ? 'text-gray-900' : 'text-gray-500'}`}>
          {selectedDate ? fmtThai(selectedDate) : 'เลือกวันที่'}
        </span>
        <Calendar size={16} className="text-gray-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 bg-white shadow-xl border border-gray-200 rounded-lg mt-1 p-3 w-80">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => navigateMonth('prev')} className="p-1 hover:bg-gray-100 rounded-md" aria-label="เดือนก่อนหน้า">
                <ChevronLeft size={16} className="text-gray-600" />
              </button>

              <button
                onClick={() => setShowYearSelect(s => !s)}
                className="text-sm font-medium text-gray-700 hover:text-blue-600 flex items-center px-2 py-1 rounded hover:bg-blue-50"
                aria-haspopup="listbox"
                aria-expanded={showYearSelect}
              >
                {THAI_MONTHS[month]} {year + 543}
                <ChevronDown size={14} className="ml-1" />
              </button>

              <button onClick={() => navigateMonth('next')} className="p-1 hover:bg-gray-100 rounded-md" aria-label="เดือนถัดไป">
                <ChevronRight size={16} className="text-gray-600" />
              </button>
            </div>

            {/* Year / Month selector */}
            {showYearSelect && (
              <div className="mb-3 p-2 border border-gray-200 rounded-lg bg-gray-50">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select
                    value={year}
                    onChange={e => setYear(parseInt(e.target.value, 10))}
                    className="text-xs p-1 border rounded"
                  >
                    {Array.from({ length: realMaxYear - realMinYear + 1 }, (_, i) => realMaxYear - i).map(y => (
                      <option key={y} value={y}>
                        {y + 543}
                      </option>
                    ))}
                  </select>
                  <select
                    value={month}
                    onChange={e => setMonth(parseInt(e.target.value, 10))}
                    className="text-xs p-1 border rounded"
                  >
                    {THAI_MONTHS.map((m, i) => (
                      <option key={i} value={i}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setShowYearSelect(false)}
                  className="w-full text-xs py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  ตกลง
                </button>
              </div>
            )}

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1 mb-3">
              {THAI_DAYS.map(d => (
                <div key={d} className="text-xs font-medium text-gray-500 text-center py-2">
                  {d}
                </div>
              ))}

              {days.map((d, i) => (
                <button
                  key={i}
                  onClick={() => pick(d)}
                  disabled={!d}
                  className={[
                    'h-8 w-8 text-xs rounded-md flex items-center justify-center',
                    !d ? 'invisible' : '',
                    isSelected(d) ? 'bg-blue-500 text-white font-medium' : 'hover:bg-gray-100 text-gray-700',
                    isToday(d) && !isSelected(d) ? 'ring-1 ring-blue-300' : ''
                  ].join(' ')}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { onChange(null); }}
                className="text-xs px-3 py-1 text-red-600 hover:bg-red-50 rounded-md"
              >
                ล้างค่า
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
