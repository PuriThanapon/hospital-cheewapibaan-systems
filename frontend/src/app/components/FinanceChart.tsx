"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

// app/lib/api.ts
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

export async function httpGet(path: string) {
  const url = /^https?:\/\//.test(path) ? path : `${API_BASE}${path}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

const joinUrl = (base: string, path: string) => {
  if (!base) return path;
  const b = base.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
};

// แปลง ค.ศ. -> พ.ศ.
const toBE = (yyyy: number) => yyyy + 543;

type Row = {
  year: number;       // ค.ศ.
  chronic: number;    // โรคประจำตัว
  other: number;      // อื่นๆ
};

export default function FinanceChart() {
  // กำหนดช่วง 5 ปีย้อนหลังจนถึงปีนี้
  const now = new Date();
  const toYear = now.getFullYear();
  const fromYear = toYear - 4;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const url = joinUrl(API_BASE, `/api/stats/deaths-by-year?fromYear=${fromYear}&toYear=${toYear}`);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        const data: Row[] = Array.isArray(j?.data) ? j.data : [];
        if (alive) setRows(data);
      } catch (e: any) {
        if (alive) setErr(e?.message || "โหลดสถิติไม่สำเร็จ");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [fromYear, toYear]);

  // map เป็นรูปแบบที่ recharts ใช้ และเติมปีที่ไม่มีให้เป็น 0
  const chartData = useMemo(() => {
    const map = new Map<number, Row>();
    rows.forEach(r => map.set(r.year, r));

    const out: Array<{ name: string; "เสียชีวิตจากสาเหตุอื่นๆ": number; "เสียชีวิตจากโรคประจำตัว": number; }> = [];
    for (let y = fromYear; y <= toYear; y++) {
      const r = map.get(y) || { year: y, chronic: 0, other: 0 };
      out.push({
        name: `พ.ศ.${toBE(y)}`,
        "เสียชีวิตจากสาเหตุอื่นๆ": r.other || 0,
        "เสียชีวิตจากโรคประจำตัว": r.chronic || 0,
      });
    }
    return out;
  }, [rows, fromYear, toYear]);

  return (
    <div className="rounded-2xl bg-white p-4 w-full">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold">อัตราการเสียชีวิตรายปี</h1>
        <div className="flex items-center gap-2">
          {loading ? <span className="text-xs text-gray-500">กำลังโหลด…</span> : null}
          {err ? <span className="text-xs text-red-600" title={err}>โหลดผิดพลาด</span> : null}
          <img src="/moreDark.png" alt="" width={20} height={20} />
        </div>
      </div>

      <div className="mt-3 h-64 sm:h-72 md:h-115">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tick={{ fill: "#6b6d70ff", fontSize: 12 }}
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              tick={{ fill: "#6b6d70ff", fontSize: 12 }}
              tickLine={false}
              tickMargin={8}
              allowDecimals={false}
            />
            <Tooltip />
            <Legend align="center" verticalAlign="top" wrapperStyle={{ paddingTop: 4, paddingBottom: 8 }} />
            <Line type="monotone" dataKey="เสียชีวิตจากสาเหตุอื่นๆ" stroke="#82ca9d" strokeWidth={3} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="เสียชีวิตจากโรคประจำตัว" stroke="#8884d8" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
