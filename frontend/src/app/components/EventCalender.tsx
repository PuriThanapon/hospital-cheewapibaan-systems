"use client";
import React, { useEffect, useMemo, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import dynamic from "next/dynamic";

const Select = dynamic(() => import("react-select"), { ssr: false });

// ====== CONFIG ======
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

async function httpJson(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const joinUrl = (base: string, path: string) => {
  if (!base) return path;
  const b = base.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
};

// ====== TYPES & HELPERS ======
type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

type EventItem = {
  id: string;
  title: string;
  description?: string;
  date: string;  // YYYY-MM-DD
  start: string; // HH:mm
  end?: string;  // HH:mm
  place?: string;
  status?: string;
};

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseYMD(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function ymdRangeOfMonth(d: Date) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = endOfMonth(d);
  return { first, last, from: toYMD(first), to: toYMD(last) };
}
function diffDays(a: Date, b: Date) {
  const ms = 24 * 60 * 60 * 1000;
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((db - da) / ms);
}
function* eachDay(from: Date, to: Date) {
  const cur = new Date(from);
  while (cur <= to) {
    yield new Date(cur);
    cur.setDate(cur.getDate() + 1);
  }
}
function timeRange(start: string, end?: string) {
  return end ? `${start} น. - ${end} น.` : `${start} น.`;
}

// ---- coercers ให้ date/time เป็นฟอร์แมตที่เราต้องการ ----
function coerceYMD(v: any): string {
  if (!v) return "";
  if (v instanceof Date) return toYMD(v);
  const s = String(v);

  // กรณีเป็น ISO มี 'T' (เช่น 2025-08-25T17:00:00.000Z หรือมี +07:00)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);                 // แปลงเป็นเวลาท้องถิ่นของ browser (ไทย)
    return isNaN(d.getTime()) ? s.slice(0,10) : toYMD(d);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;  // already Y-M-D

  // เผื่อฟอร์แมตอื่น
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : toYMD(d);
}
function coerceHM(v: any): string {
  const s = String(v || "");
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?/.exec(s);
  if (!m) return "";
  const hh = m[1].padStart(2, "0");
  return `${hh}:${m[2]}`;
}

function hmToMinutes(hm: string) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hm || "");
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
}
// ---- รองรับผลลัพธ์หลายรูปแบบจาก backend ----
function normalizeAppointments(raw: any): EventItem[] {
  const arr: any[] = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
  return arr
    .map((r: any, idx: number) => {
      const date = coerceYMD(
        r.date ??
          r.appointment_date ??
          r.date_ymd ??
          (r.start_at ? String(r.start_at).slice(0, 10) : null),
      );
      const start = coerceHM(
        r.time ?? r.start ?? r.appointment_time ?? r.start_time ?? (r.start_at ? String(r.start_at).slice(11, 16) : null),
      );
      const end = coerceHM(r.time_end ?? r.end ?? r.end_time ?? (r.end_at ? String(r.end_at).slice(11, 16) : null));
      const title =
        r.title ||
        r.patient ||
        [r.pname ?? "", r.first_name ?? "", r.last_name ?? ""].join(" ").replace(/\s+/g, " ").trim() ||
        r.hn ||
        "นัดหมาย";
      const id = String(r.id ?? r.appointment_id ?? `${date}-${start}-${idx}`);

      return {
        id,
        title,
        description: r.description ?? r.note ?? "",
        date,
        start: start || "00:00",
        end: end || undefined,
        place: r.place ?? r.hospital_address ?? "",
        status: r.status ?? r.appointment_status ?? "",
      } as EventItem;
    })
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date)); // เฉพาะวันที่ถูกต้อง
}

// ====== ดึงนัดหมาย “ใช้ /dashboard/appointments?days= ” เป็นหลัก ======
async function fetchEventsForMonth(activeMonth: Date): Promise<EventItem[]> {
  const { first, last } = ymdRangeOfMonth(activeMonth);
  const today = new Date();

  let events: EventItem[] = [];

  // 1) ครอบ “วันนี้ → สิ้นเดือนที่แสดง” ด้วย ?days=...
  if (last >= today) {
    const daysAhead = Math.max(0, diffDays(today, last));        // 0..(สิ้นเดือน)
    const url = joinUrl(API_BASE, `/api/dashboard/appointments?days=${daysAhead || 1}`);
    const j = await httpJson(url);
    events = normalizeAppointments(j);

    // กรองเหลือเฉพาะวันที่ในเดือนที่แสดง
    const { from, to } = ymdRangeOfMonth(activeMonth);
    events = events.filter((e) => e.date >= from && e.date <= to);
  }

  // 2) ถ้าเดือนมีช่วง "อดีต" (ก่อนวันนี้) ที่ยังไม่ครอบ → เติมด้วยยิงรายวันเฉพาะช่วงนี้
  if (first < today) {
    const pastTo = new Date(Math.min(today.getTime() - 86400000, last.getTime())); // เมื่อวานหรือสิ้นเดือน
    const dailyPromises: Promise<any>[] = [];
    for (const d of eachDay(first, pastTo)) {
      const u = joinUrl(API_BASE, `/api/dashboard/appointments?date=${toYMD(d)}`);
      dailyPromises.push(fetch(u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)));
    }
    const daily = await Promise.allSettled(dailyPromises);
    const extra: EventItem[] = [];
    for (const r of daily) {
      if (r.status === "fulfilled" && r.value) {
        extra.push(...normalizeAppointments(r.value));
      }
    }
    // รวม + กันซ้ำ
    const dedup = new Map<string, EventItem>();
    for (const ev of [...events, ...extra]) {
      const key = `${ev.date}|${ev.start}|${ev.title}`;
      if (!dedup.has(key)) dedup.set(key, ev);
    }
    events = Array.from(dedup.values());
  }

  return events;
}

// ====== COMPONENT ======
function EventCalendarInner() {
  const [value, onChange] = useState<Value>(new Date());
  const [activeMonth, setActiveMonth] = useState<Date>(new Date());

  const [monthEvents, setMonthEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const selectedDate = useMemo<Date>(() => {
    if (Array.isArray(value)) return (value[0] as Date) ?? new Date();
    return (value as Date) ?? new Date();
  }, [value]);
  const selectedKey = useMemo(() => toYMD(selectedDate), [selectedDate]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const events = await fetchEventsForMonth(activeMonth);
        if (alive) setMonthEvents(events);
      } catch (e: any) {
        if (alive) {
          setErr(e?.message || "โหลดข้อมูลนัดหมายไม่สำเร็จ");
          setMonthEvents([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeMonth]);

  const dateHasEvents = useMemo(() => {
    const m = new Map<string, number>();
    for (const ev of monthEvents) {
      m.set(ev.date, (m.get(ev.date) || 0) + 1);
    }
    return m;
  }, [monthEvents]);

  const top3Events = useMemo(() => {
    const list = monthEvents
      .filter((e) => e.date === selectedKey)
      .sort((a, b) => a.start.localeCompare(b.start));

    const todayKey = toYMD(new Date());
    if (selectedKey === todayKey) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const upcoming = list.filter((e) => hmToMinutes(e.start) >= nowMin).slice(0, 3);
      // ถ้าไม่มีนัดที่ยังไม่ถึงเวลา → แสดง 3 รายการแรกของวันนี้แทน
      return upcoming.length ? upcoming : list.slice(0, 3);
    }
    return list.slice(0, 3);
  }, [monthEvents, selectedKey]);

  return (
    <div className="bg-white rounded-md p-4">
      <Calendar
        onChange={onChange}
        value={value}
        onActiveStartDateChange={({ activeStartDate }) => {
          if (activeStartDate) setActiveMonth(activeStartDate);
        }}
        tileContent={({ date, view }) =>
          view === "month" && dateHasEvents.has(toYMD(date)) ? (
            <div className="flex justify-center mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
            </div>
          ) : null
        }
      />

      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold my-4">
          {selectedKey === toYMD(new Date()) ? "3 รายการใกล้ถึงวันนี้" : "การนัดหมาย (แสดง 3 รายการแรก)"}{" "}
          •{" "}
          {selectedDate.toLocaleDateString("th-TH", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </h1>
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="text-xs text-gray-500">กำลังโหลด…</span>
          ) : err ? (
            <span className="text-xs text-red-600" title={err}>
              โหลดผิดพลาด
            </span>
          ) : null}
          <img src="/moreDark.png" alt="" width={20} height={20} />
        </div>
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
              key={`${event.id}-${event.start}`}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-700">
                  {event.title}
                  {event.place ? (
                    <span className="text-xs text-gray-500 ml-2">({event.place})</span>
                  ) : null}
                </h2>
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
}

// ✅ กัน hydration mismatch สำหรับปฏิทิน/วันที่
export default dynamic(() => Promise.resolve(EventCalendarInner), { ssr: false });
