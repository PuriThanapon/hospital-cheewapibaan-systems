"use client";
import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
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

type RawItem = Record<string, any>;
type ChartItem = { name: string; "จำนวนกลุ่มเป้าหมาย": number };

/** แปลงข้อมูลจาก API ให้เข้ารูป Recharts อัตโนมัติ */
function normalize(items: RawItem[]): ChartItem[] {
  return (items || []).map((it, idx) => ({
    name: it.name ?? it.group ?? it.label ?? `กลุ่ม ${idx + 1}`,
    "จำนวนกลุ่มเป้าหมาย": Number(
      it["จำนวนกลุ่มเป้าหมาย"] ?? it.count ?? it.total ?? it.value ?? 0
    ),
  }));
}

export default function AttendanceChart({
  /** เปลี่ยนปลายทางได้ตามต้องการ เช่น "/api/dashboard/target-groups" */
  src = "/api/dashboard/target-groups",
}: {
  src?: string;
}) {
  const [rows, setRows] = useState<ChartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [rev, setRev] = useState(0); // สำหรับกดรีเฟรช

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const url = /^https?:\/\//.test(src) ? src : joinUrl(API_BASE, src);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();

        // รองรับทั้ง { data: [...] } หรือ [...]
        const arr: RawItem[] = Array.isArray(j) ? j : j.data ?? [];
        const out = normalize(arr);
        if (alive) setRows(out);
      } catch (e: any) {
        if (alive) setErr(e?.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [src, rev]);

  return (
    <div className="rounded-2xl bg-white p-4 h-full">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-semibold">กลุ่มเป้าหมาย</h1>
        <button
          onClick={() => setRev((n) => n + 1)}
          className="text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50"
          title="รีเฟรช"
        >
          รีเฟรช
        </button>
      </div>

      {loading ? (
        <div className="h-[320px] flex items-center justify-center text-gray-500">
          กำลังโหลด…
        </div>
      ) : err ? (
        <div className="h-[320px] flex items-center justify-center text-red-600">
          {err}
        </div>
      ) : rows.length === 0 ? (
        <div className="h-[320px] flex items-center justify-center text-gray-500">
          ไม่มีข้อมูล
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={rows} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ddd" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tick={{ fill: "#6b6d70ff" }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tick={{ fill: "#6b6d70ff" }}
              tickLine={false}
            />
            <Tooltip contentStyle={{ borderRadius: "10px", borderColor: "light" }} />
            <Legend
              align="left"
              verticalAlign="top"
              wrapperStyle={{ paddingTop: "10px", paddingBottom: "10px" }}
            />
            <Bar
              dataKey="จำนวนกลุ่มเป้าหมาย"
              fill="#02786e"
              legendType="circle"
              radius={[10, 10, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
