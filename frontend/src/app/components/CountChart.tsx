"use client";
import React, { useEffect, useState } from "react";
import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";

// app/lib/api.ts
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

export async function httpGet(path: string) {
  const url = /^https?:\/\//.test(path) ? path : `${API_BASE}${path}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

const joinUrl = (base: string, path: string) => {
  if (!base) return path;
  const b = base.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
};

type Counts = { total: number; male: number; female: number };

/** ✅ รองรับรูปแบบ:
 *  - { total, male, female }
 *  - { data: { total, male, female } }
 *  - [{ gender|sex|label, count }]
 *  - { data: [{ gender|sex|label, count }] }
 */
function normalizeGenderCounts(j: any): Counts {
  // กรณีเป็น object ที่มี total/male/female (ตรงๆ หรืออยู่ใน data)
  const maybeObj = !Array.isArray(j) ? (j?.data ?? j) : null;
  if (
    maybeObj &&
    !Array.isArray(maybeObj) &&
    (maybeObj.total !== undefined ||
      (maybeObj.male !== undefined && maybeObj.female !== undefined))
  ) {
    const male = Number(maybeObj.male ?? 0) || 0;
    const female = Number(maybeObj.female ?? 0) || 0;
    const total = Number(maybeObj.total ?? male + female) || 0;
    return {
      total: Math.max(0, total),
      male: Math.max(0, male),
      female: Math.max(0, female),
    };
  }

  // กรณีเป็น array (ทั้ง j และ j.data)
  const arr = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : null;
  if (arr) {
    let male = 0,
      female = 0,
      other = 0;
    for (const it of arr) {
      const g = String(
        it?.gender ?? it?.sex ?? it?.label ?? ""
      )
        .toLowerCase()
        .trim();
      const c = Number(it?.count ?? it?.total ?? it?.value ?? 0) || 0;
      if (["ชาย", "male", "m", "man", "men"].includes(g)) male += c;
      else if (["หญิง", "female", "f", "woman", "women"].includes(g))
        female += c;
      else other += c;
    }
    const total = male + female; // ถ้าต้องรวม other เปลี่ยนเป็น male + female + other
    return {
      total: Math.max(0, total),
      male: Math.max(0, male),
      female: Math.max(0, female),
    };
  }

  return { total: 0, male: 0, female: 0 };
}

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n * 1000) / d) / 10; // 1 ตำแหน่งทศนิยม
}

export default function CountChart({
  /** เปลี่ยน endpoint ได้ เช่น "/api/dashboard/patients-gender" */
  src = "/api/dashboard/patients-gender",
}: {
  src?: string;
}) {
  const [counts, setCounts] = useState<Counts>({
    total: 0,
    male: 0,
    female: 0,
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rev, setRev] = useState(0); // ปุ่มรีเฟรช

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const url = /^https?:\/\//.test(src) ? src : joinUrl(API_BASE, src);
        const j = await httpGet(url);
        const c = normalizeGenderCounts(j);
        const total = Math.max(c.total, c.male + c.female); // กัน total < sum
        if (alive) setCounts({ ...c, total });
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

  const chartData = [
    { name: "Total", count: counts.total, fill: "white" },
    { name: "Womens", count: counts.female, fill: "#ffd700" },
    { name: "Mens", count: counts.male, fill: "#02786e" },
  ];

  return (
    <div className="rounded-2xl bg-white p-4 w-full h-full">
      {/* TITLE */}
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold">จำนวนผู้ป่วย</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRev((n) => n + 1)}
            className="text-xs px-2 py-1 rounded-lg border hover:bg-gray-50"
            title="รีเฟรช"
          >
            รีเฟรช
          </button>
          <img src="/moreDark.png" alt="" width={20} height={20} />
        </div>
      </div>

      {/* CHART / STATES */}
      <div className="relative w-full h-64 md:h-72"> {/* ✅ กำหนดความสูงจริง */}
        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            กำลังโหลด…
          </div>
        ) : err ? (
          <div className="w-full h-full flex items-center justify-center text-red-600">
            {err}
          </div>
        ) : counts.total === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            ไม่มีข้อมูลเพศที่แสดงผลได้
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="40%"
                outerRadius="100%"
                barSize={32}
                data={chartData}
              >
                <RadialBar background dataKey="count" />
              </RadialBarChart>
            </ResponsiveContainer>

            <img
              src="/older.jpg"
              alt=""
              width={100}
              height={100}
              className="pointer-events-none select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            />
          </>
        )}
      </div>

      {/* BOTTOM */}
      {!loading && !err && counts.total > 0 && (
        <div className="flex justify-center gap-16">
          <div className="flex flex-col gap-1 items-center">
            <div
              style={{ backgroundColor: "#02786e" }}
              className="w-5 h-5 rounded-full"
            />
            <h1 className="font-bold">{counts.male}</h1>
            <h2 className="text-xs text-gray-600">
              ผู้ชาย ({pct(counts.male, counts.total)}%)
            </h2>
          </div>
          <div className="flex flex-col gap-1 items-center">
            <div
              style={{ backgroundColor: "#ffd700" }}
              className="w-5 h-5 rounded-full"
            />
            <h1 className="font-bold">{counts.female}</h1>
            <h2 className="text-xs text-gray-600">
              ผู้หญิง ({pct(counts.female, counts.total)}%)
            </h2>
          </div>
        </div>
      )}
    </div>
  );
}
