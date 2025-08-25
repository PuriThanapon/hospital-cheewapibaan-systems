// "use client";

// /**
//  * CSV Exporter (UTF-8 + BOM, Excel-friendly)
//  *
//  * รองรับ columns 2 รูปแบบ:
//  * 1) ["HN","name", ...]  -> ใช้เป็นทั้งหัวตารางและ key (ถ้า rows เป็น object)
//  * 2) [{ header: "HN", dataKey: "hn" }, ...]
//  *    -> ใช้ header แสดงในไฟล์ และ map ค่าใน rows ด้วย dataKey
//  *
//  * rows รองรับทั้ง array-of-arrays และ array-of-objects
//  */

// export default function exportCSV({
//   filename = "report.csv",
//   columns = [],
//   rows = [],
//   delimiter = ",",
//   includeHeader = true,
//   bom = true, // ใส่ BOM เพื่อให้ Excel อ่านภาษาไทยถูกต้อง
// } = {}) {
//   const { headers, body } = normalize(columns, rows);

//   const lines = [];
//   if (includeHeader && headers.length) {
//     lines.push(headers.map((v) => escapeCSV(v, delimiter)).join(delimiter));
//   }
//   for (const r of body) {
//     lines.push(r.map((v) => escapeCSV(v, delimiter)).join(delimiter));
//   }

//   const csvString = (bom ? "\uFEFF" : "") + lines.join("\r\n");

//   const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement("a");
//   a.href = url;
//   a.download = safeFilename(filename);
//   a.style.display = "none";
//   document.body.appendChild(a);
//   a.click();
//   document.body.removeChild(a);
//   URL.revokeObjectURL(url);
// }

// /**************** helpers ****************/
// function normalize(columns, rows) {
//   let headers = [];
//   let keys = [];

//   if (!Array.isArray(columns) || columns.length === 0) {
//     // เดา key จากแถวแรกถ้า rows เป็น object
//     if (rows && rows.length && !Array.isArray(rows[0])) {
//       keys = Object.keys(rows[0]);
//       headers = [...keys];
//       const body = rows.map((r) => keys.map((k) => formatValue(r?.[k])));
//       return { headers, body };
//     }
//     // rows เป็น array-of-arrays แต่ไม่มี columns -> ไม่ใส่ header
//     return { headers: [], body: rows || [] };
//   }

//   // columns เป็น array ของ string -> ใช้เป็นทั้ง header และ key
//   if (typeof columns[0] === "string") {
//     headers = [...columns];
//     keys = [...columns];
//     if (rows && rows.length && !Array.isArray(rows[0])) {
//       const body = rows.map((r) => keys.map((k) => formatValue(r?.[k])));
//       return { headers, body };
//     }
//     // rows เป็น array-of-arrays แล้ว
//     return { headers, body: rows || [] };
//   }

//   // columns เป็น array ของ {header, dataKey}
//   headers = columns.map((c) => c.header);
//   keys = columns.map((c) => c.dataKey);
//   if (rows && rows.length && !Array.isArray(rows[0])) {
//     const body = rows.map((r) => keys.map((k) => formatValue(r?.[k])));
//     return { headers, body };
//   }
//   return { headers, body: rows || [] };
// }

// function escapeCSV(value, delimiter) {
//   const v = formatValue(value);
//   // ถ้ามี ", \n, \r หรือ delimiter -> ใส่เครื่องหมายคำพูดและ escape " เป็น ""
//   if (v == null) return "";
//   const s = String(v);
//   if (s.includes("\"") || s.includes("\n") || s.includes("\r") || s.includes(delimiter)) {
//     return '"' + s.replace(/\"/g, '""') + '"';
//   }
//   return s;
// }

// function formatValue(v) {
//   if (v == null) return "";
//   if (v instanceof Date) return v.toISOString();
//   if (typeof v === "number" && !isFinite(v)) return "";
//   return String(v);
// }

// function safeFilename(name) {
//   return (name || "report.csv").replace(/[\\/:*?"<>|]/g, "_");
// }
"use client";

// แก้ไขฟังก์ชัน exportCSV ให้จัดการกับ columns และ rows ที่ส่งเข้ามาอย่างถูกต้อง
export default function exportCSV({ filename = "report.csv", columns = [], rows = [] }) {
  // ✅ 1. แก้ไข: แปลง Array ของ Object ใน columns ให้เป็น Array ของ String สำหรับหัวตาราง
  const headerRow = columns.map(c => c.header).join(",");

  // ✅ 2. แก้ไข: แปลง rows ให้เป็น Array ของ String
  const bodyRows = rows.map(row => {
    // row เป็น Array อยู่แล้ว (จากการ map ใน handleExportCSV)
    // ใช้เมธอด .map() กับ row และห่อค่าด้วย Double Quotes
    const rowValues = row.map(field => `"${field ?? ''}"`);
    console.log("roeValues: ",rowValues)
    return rowValues.join(",");
  });

  const csvContent = [headerRow, ...bodyRows].join("\n");

  // เพิ่ม BOM (เพื่อให้ Excel แสดงภาษาไทยถูกต้อง)
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });

  // สร้างลิงก์ดาวน์โหลด
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link); // เพิ่ม link เข้าไปใน DOM
  link.click();
  document.body.removeChild(link); // ลบ link ออกจาก DOM
}