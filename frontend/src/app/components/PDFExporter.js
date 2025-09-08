// app/components/PDFExporter.js
"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * โรงพยาบาล – แผนกชีวาภิบาล: PDF Exporter (วางทับได้เลย)
 * อัปเดต: วาง "หมายเหตุ" ชิดมุมซ้ายล่าง เหนือเส้นคั่นท้ายหน้าเสมอ
 */
export default async function exportPDF({
  filename = "report.pdf",
  // ตาราง
  columns = [],
  rows = [],
  // ส่วนหัวรายงาน
  title = "รายงาน",
  subtitle = "",
  // อัตลักษณ์โรงพยาบาล
  hospitalName = "โรงพยาบาลของท่าน",
  department = "แผนกชีวาภิบาล",
  address = "553 11 ตำบล บ้านดู่ อำเภอเมืองเชียงราย เชียงราย 57100",
  logoUrl,
  docCode,
  version,
  printedBy = "",
  printAt = new Date(),

  // การจัดหน้า
  orientation,
  format = "a4",
  margins = { top: 16, right: 14, bottom: 18, left: 14 },
  autoLandscape = true,

  // ตาราง
  columnWidths = [],
  columnAligns = [],
  zebra = true,
  headFill = [230, 230, 230],

  // ความปลอดภัย/พิธีการ
  showConfidential = true,
  watermarkText = "",
  signatures = null, // { preparer?: string, reviewer?: string, approver?: string }

  // ✅ หมายเหตุ (จะแสดงชิดซ้ายล่างเหนือเส้นคั่น)
  note = "",

  // คุณสมบัติไฟล์
  pdfAuthor = "",
  pdfSubject = "",
  pdfKeywords = "",
} = {}) {
  // แนวกระดาษอัตโนมัติ (>=7 คอลัมน์ ⇒ landscape)
  const pageOrientation =
    orientation || (autoLandscape && columns.length >= 7 ? "landscape" : "portrait");

  const doc = new jsPDF({ unit: "mm", orientation: pageOrientation, format });

  // คุณสมบัติไฟล์
  try {
    doc.setProperties({
      title,
      subject: pdfSubject || `${department} – ${title}`,
      author: pdfAuthor || printedBy || hospitalName,
      keywords: pdfKeywords || "hospital,palliative,report,thai",
      creator: hospitalName,
    });
  } catch {}

  // ---- ฟอนต์ไทย (TH Sarabun) ----
  const [regularBuffer, boldBuffer] = await Promise.all([
    fetch("/font/Sarabun/Sarabun-Regular.ttf").then((r) => r.arrayBuffer()),
    fetch("/font/Sarabun/Sarabun-Bold.ttf").then((r) => r.arrayBuffer()),
  ]);
  const toBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  doc.addFileToVFS("Sarabun.ttf", toBase64(regularBuffer));
  doc.addFont("Sarabun.ttf", "Sarabun", "normal");
  doc.addFileToVFS("Sarabun-Bold.ttf", toBase64(boldBuffer));
  doc.addFont("Sarabun-Bold.ttf", "Sarabun", "bold");
  doc.setFont("Sarabun", "normal");

  // ---- โลโก้ (ถ้ามี) ----
  let logoDataUrl;
  if (logoUrl) {
    const blob = await fetch(logoUrl).then((r) => r.blob());
    const reader = new FileReader();
    logoDataUrl = await new Promise((resolve) => {
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const headerH = 36;
  const footerH = 18;
  const totalPagesExp = "{total_pages_count_string}";

  // ---- สไตล์คอลัมน์ ----
  const columnStyles = {};
  columnWidths.forEach((w, i) => (columnStyles[i] = { ...(columnStyles[i] || {}), cellWidth: w }));
  columnAligns.forEach((a, i) => (columnStyles[i] = { ...(columnStyles[i] || {}), halign: a }));

  // ---- วาดหัว/ท้าย + ลายน้ำ ----
  const drawPageFrame = () => {
    const topY = margins.top;
    const centerX = pageW / 2;

    // ลายน้ำ
    if (watermarkText) {
      doc.saveGraphicsState?.();
      doc.setTextColor(210);
      doc.setFontSize(48);
      doc.text(watermarkText, pageW / 2, pageH / 2, { angle: 30, align: "center" });
      doc.restoreGraphicsState?.();
    }

    // Header
    if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", margins.left, topY - 2, 14, 14);
    doc.setFont("Sarabun", "bold").setFontSize(13);
    doc.text(hospitalName, centerX, topY + 2, { align: "center", baseline: "top" });
    doc.setFont("Sarabun", "normal").setFontSize(11);
    doc.text(department, centerX, topY + 8, { align: "center", baseline: "top" });
    if (address) {
      doc.setFontSize(9);
      doc.text(address, centerX, topY + 14, { align: "center", baseline: "top" });
    }

    // รายละเอียดมุมขวา
    doc.setFontSize(8);
    let rightTop = topY - 4;
    if (docCode) {
      doc.text(`รหัส: ${docCode}`, pageW - margins.right, rightTop, { align: "right" });
      rightTop += 4;
    }
    if (version) {
      doc.text(`เวอร์ชัน: ${version}`, pageW - margins.right, rightTop, { align: "right" });
    }

    // เส้นคั่นหัว/ชื่อรายงาน
    doc.setDrawColor(170).setLineWidth(0.3);
    doc.line(margins.left, topY + 18, pageW - margins.right, topY + 18);

    doc.setFont("Sarabun", "bold").setFontSize(12);
    doc.text(title, centerX, topY + 24, { align: "center" });
    if (subtitle) {
      doc.setFont("Sarabun", "normal").setFontSize(10);
      doc.text(subtitle, centerX, topY + 30, { align: "center" });
    }

    // Footer (เส้นคั่น + ข้อมูล)
    const bottomY = pageH - margins.bottom;
    doc.setDrawColor(200).setLineWidth(0.2);
    doc.line(margins.left, bottomY - 8, pageW - margins.right, bottomY - 8);

    doc.setFont("Sarabun", "normal").setFontSize(9);
    const dateStr = (printAt instanceof Date ? printAt : new Date(printAt)).toLocaleString("th-TH", {
      dateStyle: "long",
      timeStyle: "short",
    });
    const leftFooter = showConfidential
      ? `จัดทำเมื่อ: ${dateStr}  โดย: ${printedBy || "-"}  •  เอกสารมีข้อมูลส่วนบุคคล โปรดรักษาความลับ`
      : `จัดทำเมื่อ: ${dateStr}  โดย: ${printedBy || "-"}`;
    doc.text(leftFooter, margins.left, bottomY - 3);

    const pageStr = `หน้า ${doc.internal.getNumberOfPages()} / ${totalPagesExp}`;
    doc.text(pageStr, pageW - margins.right, bottomY - 3, { align: "right" });
  };

  // ---- วาดตาราง ----
  autoTable(doc, {
    startY: margins.top + headerH,
    margin: { top: margins.top, right: margins.right, bottom: margins.bottom + footerH, left: margins.left },
    theme: "grid",
    head: [columns],
    body: rows,
    styles: {
      font: "Sarabun",
      fontSize: 9,
      cellPadding: 2.2,
      overflow: "linebreak",
      lineWidth: 0.2,
    },
    headStyles: { font: "Sarabun", fontStyle: "bold", fillColor: headFill, textColor: 0 },
    bodyStyles: { valign: "top" },
    alternateRowStyles: zebra ? { fillColor: [247, 247, 247] } : undefined,
    columnStyles,
    didDrawPage: drawPageFrame,
  });

  // ------------------------------------------------------------------
  // ✅ หมายเหตุ + ลายเซ็น "ยึดตำแหน่งชิดซ้ายล่าง" ของหน้าสุดท้าย
  // ------------------------------------------------------------------
  const lastPage = doc.internal.getNumberOfPages();
  doc.setPage(lastPage);

  const bottomY = pageH - margins.bottom;      // ขอบล่าง
  const footerLineY = bottomY - 8;             // เส้นคั่นท้ายหน้า
  const textWidth = pageW - margins.left - margins.right;

  // เตรียมบรรทัดหมายเหตุ
  let noteLines = [];
  if (note) {
    doc.setFont("Sarabun", "normal").setFontSize(9);
    noteLines = doc.splitTextToSize(note, textWidth - 16);
  }
  const noteHeadingH = note ? 5 : 0;           // "หมายเหตุ:"
  const noteLinesH = note ? noteLines.length * 4.8 : 0;
  const noteBlockH = note ? (noteHeadingH + 2 + noteLinesH) : 0;

  // ความสูงบล็อกลายเซ็น
  const hasSign = !!signatures;
  const signBlockH = hasSign ? 34 : 0;         // ประมาณการความสูงลายเซ็น
  const vGap = (note && hasSign) ? 6 : 0;      // เว้นช่วงระหว่างลายเซ็นกับหมายเหตุ

  // ยอดรวมความสูงที่จะวาง "ชิดล่าง"
  const totalBottomBlocksH = signBlockH + vGap + noteBlockH;

  // top ของบล็อกจากเส้นคั่นขึ้นไป
  const blocksTop = footerLineY - 4 - totalBottomBlocksH; // เว้น 4mm เหนือเส้นคั่น

  // ถ้าพื้นที่ไม่พอ (ชนตาราง) ⇒ เปิดหน้าใหม่แล้ววางชิดล่างหน้าใหม่แทน
  const tableFinalY = (doc.lastAutoTable?.finalY || margins.top + headerH);
  const minimalGap = 6; // ช่องว่างขั้นต่ำเหนือบล็อก
  if (blocksTop - minimalGap < tableFinalY) {
    doc.addPage();
    drawPageFrame();
    // ปรับ context หน้าใหม่
    const newBottomY = pageH - margins.bottom;
    const newFooterLineY = newBottomY - 8;
    const newBlocksTop = newFooterLineY - 4 - totalBottomBlocksH;
    // ลายเซ็น (ถ้ามี)
    if (hasSign) {
      drawSignatures(doc, signatures, margins.left, newBlocksTop, pageW, margins);
    }
    // หมายเหตุ (ถ้ามี)
    if (note) {
      drawNote(doc, margins.left, hasSign ? (newBlocksTop + signBlockH + vGap) : newBlocksTop, noteLines);
    }
  } else {
    // วางบนหน้าสุดท้ายได้เลย
    if (hasSign) {
      drawSignatures(doc, signatures, margins.left, blocksTop, pageW, margins);
    }
    if (note) {
      const noteTop = hasSign ? (blocksTop + signBlockH + vGap) : blocksTop;
      drawNote(doc, margins.left, noteTop, noteLines);
    }
  }

  // รวมจำนวนหน้าจริง
  if (typeof doc.putTotalPages === "function") {
    doc.putTotalPages(totalPagesExp);
  }

  doc.save(filename);

  // ---------- helpers ----------
  function drawNote(doc, x, topY, noteLines) {
    // หัวข้อ "หมายเหตุ:" + เนื้อหา ชิดซ้ายล่าง
    doc.setFont("Sarabun", "bold").setFontSize(10);
    doc.text("หมายเหตุ:", x, topY + 4);
    doc.setFont("Sarabun", "normal").setFontSize(9);
    doc.text(noteLines, x + 16, topY + 4);
  }

  function drawSignatures(doc, sig, xLeft, topY, pageW, margins) {
    const colW = (pageW - margins.left - margins.right - 20) / 3;
    const baseY = topY + 6;

    const drawSign = (x, label, name) => {
      doc.setDrawColor(130).setLineWidth(0.2);
      doc.line(x, baseY + 12, x + colW, baseY + 12);
      doc.setFont("Sarabun", "normal").setFontSize(9);
      doc.text(`(${name || " "})`, x + colW / 2, baseY + 18, { align: "center" });
      doc.text(label, x + colW / 2, baseY + 24, { align: "center" });
    };

    drawSign(margins.left, "ผู้จัดทำ", sig.preparer || "");
    drawSign(margins.left + colW + 10, "ผู้ทบทวน", sig.reviewer || "");
    drawSign(margins.left + 2 * (colW + 10), "ผู้อนุมัติ", sig.approver || "");
  }
}
