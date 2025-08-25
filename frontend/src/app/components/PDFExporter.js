// "use client";

// import jsPDF from "jspdf";
// import autoTable from "jspdf-autotable";

// /**
//  * PDF exporter (Thai ready)
//  * ใช้ได้กับ columns ได้ 2 แบบ
//  * 1) ["HN","ชื่อ-นามสกุล", ...] และ rows เป็น array-of-arrays
//  * 2) [{header:"HN",dataKey:"hn"}, ...] และ rows เป็น array-of-objects
//  */

// let __sarabunLoaded = false;

// function bufToB64(buffer) {
//   let binary = "";
//   const bytes = new Uint8Array(buffer);
//   for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
//   return btoa(binary);
// }

// async function ensureSarabun(doc) {
//   if (__sarabunLoaded) return;

//   // รองรับ path ที่คุณบอก: /public/font/Sarabun/*
//   // และกันกรณีวางไว้ที่ /public/font/ThaiSarabun/*
//   const candidates = [
//     { url: "/font/Sarabun/Sarabun-Regular.ttf", vfs: "Sarabun-Regular.ttf", name: "Sarabun", style: "normal" },
//     { url: "/font/Sarabun/Sarabun-Bold.ttf",    vfs: "Sarabun-Bold.ttf",    name: "Sarabun", style: "bold"   },
//     { url: "/font/ThaiSarabun/subset-Sarabun-Regular.ttf", vfs: "subset-Sarabun-Regular.ttf", name: "Sarabun", style: "normal" },
//     { url: "/font/ThaiSarabun/subset-Sarabun-Bold.ttf",    vfs: "subset-Sarabun-Bold.ttf",    name: "Sarabun", style: "bold"   },
//     { url: "/font/Sarabun/THSarabunNew.ttf",    vfs: "THSarabunNew.ttf",    name: "Sarabun", style: "normal" }, // สำรอง
//     { url: "/font/Sarabun/THSarabunNew-Bold.ttf", vfs: "THSarabunNew-Bold.ttf", name: "Sarabun", style: "bold" },
//   ];

//   let loaded = 0;
//   for (const f of candidates) {
//     try {
//       const res = await fetch(f.url, { cache: "force-cache" });
//       if (!res.ok) continue;
//       const buf = await res.arrayBuffer();
//       doc.addFileToVFS(f.vfs, bufToB64(buf));
//       doc.addFont(f.vfs, f.name, f.style);
//       loaded++;
//     } catch {
//       /* noop */
//     }
//   }

//   if (loaded > 0) {
//     doc.setFont("Sarabun", "normal");
//     __sarabunLoaded = true;
//   } else {
//     console.warn("ไม่พบไฟล์ฟอนต์ที่ /public/font/Sarabun/* หรือ /public/font/ThaiSarabun/* — จะใช้ Helvetica แทน");
//   }
// }

// function normalizeTable(columns, rows) {
//   if (!Array.isArray(columns) || columns.length === 0) return { head: [], body: [] };

//   // กรณี columns เป็น array ของ string
//   if (typeof columns[0] === "string") {
//     const headers = columns;
//     // ถ้า rows เป็น object ให้ map ตามชื่อหัวตาราง
//     let body = rows;
//     if (rows.length && !Array.isArray(rows[0])) {
//       body = rows.map((r) => headers.map((key) => (r?.[key] ?? "")));
//     }
//     return { head: [headers], body };
//   }

//   // กรณี columns เป็น array ของ {header,dataKey}
//   const headers = columns.map((c) => c.header);
//   const keys = columns.map((c) => c.dataKey);
//   let body = rows;

//   if (rows.length) {
//     if (Array.isArray(rows[0])) {
//       // rows เป็น array-of-arrays อยู่แล้ว: ใช้ตามลำดับ
//     } else {
//       body = rows.map((r) => keys.map((k) => (r?.[k] ?? "")));
//     }
//   }
//   return { head: [headers], body };
// }

// export default async function exportPDF({
//   filename = "report.pdf",
//   columns = [],
//   rows = [],
//   title = "รายงาน",
//   subtitle = "",              // เช่น ช่วงวันที่
//   orientation = "p",          // "p" | "l"
//   compress = true,
// } = {}) {
//   const doc = new jsPDF({ unit: "pt", format: "a4", orientation, compress });

//   // โหลดฟอนต์ Sarabun
//   await ensureSarabun(doc);

//   // ส่วนหัว
//   doc.setFont(__sarabunLoaded ? "Sarabun" : "helvetica", "bold");
//   doc.setFontSize(18);
//   doc.text(title, 40, 40);

//   doc.setFont(__sarabunLoaded ? "Sarabun" : "helvetica", "normal");
//   doc.setFontSize(11);
//   const printedAt = new Date().toLocaleString("th-TH");
//   const sub =
//     (subtitle ? `${subtitle}\n` : "") +
//     `ออกรายงาน: ${printedAt}`;
//   const lines = doc.splitTextToSize(sub, doc.internal.pageSize.getWidth() - 80);
//   doc.text(lines, 40, 62);

//   // ตาราง
//   const { head, body } = normalizeTable(columns, rows);

//   if (!head.length) {
//     doc.setFontSize(12);
//     doc.text("ไม่มีข้อมูล", 40, 100);
//     doc.save(filename);
//     return;
//   }

//   autoTable(doc, {
//     head,
//     body,
//     startY: 80,
//     styles: {
//       font: __sarabunLoaded ? "Sarabun" : "helvetica",
//       fontSize: 11,
//       cellPadding: 5,
//       overflow: "linebreak",
//     },
//     headStyles: { fillColor: [2, 120, 110], textColor: 255, valign: "middle" },
//     alternateRowStyles: { fillColor: [245, 247, 250] },
//     margin: { left: 40, right: 40 },
//     didDrawPage: () => {
//       const w = doc.internal.pageSize.getWidth();
//       const h = doc.internal.pageSize.getHeight();
//       const total = doc.internal.getNumberOfPages();
//       // jsPDF v2: ไม่มี API current page ที่ stable ใน callback นี้ ใช้ total เฉย ๆ ก็พอ
//       doc.setFontSize(10);
//       doc.text(`หน้า ${doc.internal.getCurrentPageInfo?.().pageNumber || total}/${total}`, w - 40, h - 12, { align: "right" });
//     },
//   });

//   doc.save(filename);
// }
// components/PDFExporter.js
"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default async function exportPDF({ filename = "report.pdf", columns = [], rows = [] , title = "" }) {
  const doc = new jsPDF();

  // โหลดฟอนต์จาก public
  const [regularBuffer, boldBuffer] = await Promise.all([
    fetch("/font/Sarabun/Sarabun-Regular.ttf").then(res => res.arrayBuffer()),
    fetch("/font/Sarabun/Sarabun-Bold.ttf").then(res => res.arrayBuffer())
  ]);

  const toBase64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));

  doc.addFileToVFS("Sarabun.ttf", toBase64(regularBuffer));
  doc.addFont("Sarabun.ttf", "Sarabun", "normal");

  doc.addFileToVFS("Sarabun-Bold.ttf", toBase64(boldBuffer));
  doc.addFont("Sarabun-Bold.ttf", "Sarabun", "bold");

  doc.setFont("Sarabun", "normal");

  // วาดหัวข้อ
  doc.setFont("Sarabun", "bold");
  doc.setFontSize(12);
  doc.text(title || "รายงาน", 105, 20, { align: "center" });

  autoTable(doc, {
    startY: 28,
    theme: "grid",
    columnStyles: {
      0: { cellWidth: "auto" }, 
      1: { cellWidth: "auto" }, 
      2: { cellWidth: "auto" }, 
      3: { cellWidth: "auto" }, 
      4: { cellWidth: "auto" }, 
      5: { cellWidth: "auto" }, 
      6: { cellWidth: "auto" }, 
      7: { cellWidth: "auto" }, 
      8: { cellWidth: "auto" }, 
      9: { cellWidth: "auto" }, 
      10: { cellWidth: "auto" },  
      11: { cellWidth: "auto" },  
      12: { cellWidth: "auto" },
      13: { cellWidth: "auto" },
      14: { cellWidth: "auto" },
      15: { cellWidth: "auto" },
      16: { cellWidth: "auto" },
    },
    head: [columns],
    body: rows,
    styles: {
      font: "Sarabun",
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak", // ✅ ให้ห่อบรรทัด
    },
    headStyles: {
      font: "Sarabun",
      fontStyle: "bold",
      fillColor: [175, 175, 175],
      textColor: 0,
    },
    margin: { top: 10 },
  });

  doc.save(filename);
}