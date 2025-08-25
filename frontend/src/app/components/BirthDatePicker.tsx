'use client';

import React, { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Calendar } from "lucide-react";

export default function BirthDatePicker({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [showYearSelect, setShowYearSelect] = useState(false);

  const selectedDate = value ? new Date(value) : undefined;

  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const thaiDays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  const getDaysInMonth = (month, year) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(day);
    return days;
  };

  const handleDateSelect = (day) => {
    if (day) {
      const newDate = new Date(currentYear, currentMonth, day);
      onChange(formatDate(newDate));
      setOpen(false);
    }
  };

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (date) => {
    if (!date) return "";
    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() + 543;
    return `${day} ${month} ${year}`;
  };

  const navigateMonth = (direction) => {
    if (direction === "prev") {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  const isSelected = (day) => {
    if (!selectedDate || !day) return false;
    return (
      day === selectedDate.getDate() &&
      currentMonth === selectedDate.getMonth() &&
      currentYear === selectedDate.getFullYear()
    );
  };

  const days = getDaysInMonth(currentMonth, currentYear);

  // จำกัดช่วงปี (ย้อนหลัง 110 ปี ถึงปีปัจจุบัน)
  const minYear = new Date().getFullYear() - 110;
  const maxYear = new Date().getFullYear();

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}

      <div
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-3 border border-gray-300 rounded-lg bg-white cursor-pointer hover:border-blue-400 flex items-center justify-between"
      >
        <span
          className={`text-sm ${
            selectedDate ? "text-gray-900" : "text-gray-500"
          }`}
        >
          {selectedDate ? formatDisplayDate(selectedDate) : "เลือกวันที่"}
        </span>
        <Calendar size={16} className="text-gray-400" />
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 bg-white shadow-xl border border-gray-200 rounded-lg mt-1 p-3 w-80">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => navigateMonth("prev")}
                className="p-1 hover:bg-gray-100 rounded-md"
              >
                <ChevronLeft size={16} className="text-gray-600" />
              </button>

              <button
                onClick={() => setShowYearSelect(!showYearSelect)}
                className="text-sm font-medium text-gray-700 hover:text-blue-600 flex items-center px-2 py-1 rounded hover:bg-blue-50"
              >
                {thaiMonths[currentMonth]} {currentYear + 543}
                <ChevronDown size={14} className="ml-1" />
              </button>

              <button
                onClick={() => navigateMonth("next")}
                className="p-1 hover:bg-gray-100 rounded-md"
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
                    {Array.from(
                      { length: maxYear - minYear + 1 },
                      (_, i) => maxYear - i
                    ).map((year) => (
                      <option key={year} value={year}>
                        {year + 543}
                      </option>
                    ))}
                  </select>
                  <select
                    value={currentMonth}
                    onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
                    className="text-xs p-1 border rounded"
                  >
                    {thaiMonths.map((month, index) => (
                      <option key={index} value={index}>
                        {month}
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

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 mb-3">
              {thaiDays.map((day) => (
                <div
                  key={day}
                  className="text-xs font-medium text-gray-500 text-center py-2"
                >
                  {day}
                </div>
              ))}

              {days.map((day, index) => (
                <button
                  key={index}
                  onClick={() => handleDateSelect(day)}
                  disabled={!day}
                  className={`
                    h-8 w-8 text-xs rounded-md flex items-center justify-center
                    ${!day ? "invisible" : ""}
                    ${
                      isSelected(day)
                        ? "bg-blue-500 text-white font-medium"
                        : "hover:bg-gray-100 text-gray-700"
                    }
                  `}
                >
                  {day}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
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
