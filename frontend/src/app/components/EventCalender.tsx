"use client";
import React, { useMemo, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

type EventItem = {
  id: number;
  title: string;
  description?: string;
  date: string;  // YYYY-MM-DD
  start: string; // HH:mm
  end?: string;  // HH:mm
};

const events: EventItem[] = [
  { id: 1, title: "นายธนพล ยะใหม่วงค์", date: "2025-08-17", start: "00:00", end: "01:00", description: "ตรวจสุขภาพประจำปี" },
  { id: 2, title: "นายเป็นหนึ่ง สายทรัพย์", date: "2025-08-16", start: "21:00", end: "22:00", description: "ตรวจสุขภาพประจำปี และฉีดวัคซีน" },
  { id: 3, title: "นายนฤพนธ์ วงศ์ชัย", date: "2025-08-16", start: "22:30", end: "23:00", description: "ผ่าตัดเล็ก" },
  { id: 4, title: "นัด A", date: "2025-08-15", start: "09:30", end: "10:00", description: "ตัวอย่าง" },
  { id: 5, title: "นัด B", date: "2025-08-15", start: "14:00", end: "14:30", description: "ตัวอย่าง" },
];

// --- Helpers ---
function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function timeRange(start: string, end?: string) {
  return end ? `${start} น. - ${end} น.` : `${start} น.`;
}
function hmToMinutes(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

const EventCalendar = () => {
  const [value, onChange] = useState<Value>(new Date());

  // วันที่ที่เลือก (กรณีเลือกช่วง จะใช้วันแรก)
  const selectedDate = useMemo<Date>(() => {
    if (Array.isArray(value)) return (value[0] as Date) ?? new Date();
    return (value as Date) ?? new Date();
  }, [value]);

  const selectedKey = useMemo(() => toYMD(selectedDate), [selectedDate]);

  // ✅ ดึง 3 รายการที่ "ใกล้ถึง" ที่สุดของวันนั้น
  const top3Events = useMemo(() => {
    const list = events
      .filter((e) => e.date === selectedKey)
      .sort((a, b) => a.start.localeCompare(b.start));

    // ถ้าเป็น "วันนี้" ให้เทียบกับเวลาปัจจุบัน แล้วเอาเฉพาะที่ยังไม่ถึง
    const todayKey = toYMD(new Date());
    if (selectedKey === todayKey) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const upcoming = list.filter((e) => hmToMinutes(e.start) >= nowMin);
      return upcoming.slice(0, 3);
    }

    // ถ้าไม่ใช่วันนี้ เอา 3 รายการแรกของวันนั้น
    return list.slice(0, 3);
  }, [selectedKey]);

  return (
    <div className="bg-white rounded-md p-4">
      <Calendar
        onChange={onChange}
        value={value}
        tileContent={({ date, view }) =>
          view === "month" && events.some((e) => e.date === toYMD(date)) ? (
            <div className="flex justify-center mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
            </div>
          ) : null
        }
      />

      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold my-4">
          {selectedKey === toYMD(new Date()) ? "3 รายการใกล้ถึงวันนี้" : "การนัดหมาย (แสดง 3 รายการแรก)"}
          {" • "}
          {selectedDate.toLocaleDateString("th-TH", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </h1>
        <img src="/moreDark.png" alt="" width={20} height={20} />
      </div>

      <div className="flex flex-col gap-4">
        {top3Events.length === 0 ? (
          <div className="p-5 rounded-md border-2 border-gray-100 text-gray-500">
            ไม่มีการนัดหมายที่จะแสดง
          </div>
        ) : (
          top3Events.map((event) => (
            <div
              className="p-5 rounded-md border-2 border-gray-100 border-t-4 odd:border-t-blue-500 even:border-t-yellow-500"
              key={event.id}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-700">{event.title}</h2>
                <span className="text-gray-500 text-xs">
                  {timeRange(event.start, event.end)}
                </span>
              </div>
              {event.description && (
                <p className="mt-2 text-gray-500 text-sm">{event.description}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EventCalendar;