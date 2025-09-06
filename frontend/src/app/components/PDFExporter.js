"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * โรงพยาบาล – แผนกชีวาภิบาล: PDF Exporter (มาตรฐาน)
 *
 * ใช้แบบเดิมได้: exportPDF({ filename, columns, rows, title })
 * และเพิ่ม option ได้ เช่น โลโก้, แนวกระดาษ, margins, ลายเซ็น, คำเตือนความลับ ฯลฯ
 */
export default async function exportPDF({
  filename = "report.pdf",
  // ตาราง: array-of-strings (หัว) + array-of-arrays (แถว)
  columns = [],
  rows = [],
  // ส่วนหัวรายงาน
  title = "รายงาน",
  subtitle = "",                            // เช่น "ช่วงวันที่: …"
  // อัตลักษณ์โรงพยาบาล
  hospitalName = "โรงพยาบาลของท่าน",
  department = "แผนกชีวาภิบาล",
  address = "553 11 ตำบล บ้านดู่ อำเภอเมืองเชียงราย เชียงราย 57100",                             // ทางเลือก
  logoUrl ,                                  // เช่น "/logo.png"
  docCode,                                  // รหัสเอกสาร (ถ้ามี) เช่น "PC-REP-01"
  version,                                  // เวอร์ชันรายงาน (ถ้ามี)
  printedBy = "",                           // ผู้พิมพ์/จัดทำ
  printAt = new Date(),                     // วันเวลาพิมพ์

  // การจัดหน้า
  orientation,                              // "portrait" | "landscape" (ไม่ส่ง = auto)
  format = "a4",
  margins = { top: 16, right: 14, bottom: 18, left: 14 },
  autoLandscape = true,                     // หมุนแนวนอนอัตโนมัติเมื่อคอลัมน์เยอะ

  // ตาราง
  columnWidths = [],                        // (number | "auto")[]
  columnAligns = [],                        // ("left" | "center" | "right")[]
  zebra = true,                             // สลับสีแถว
  headFill = [230, 230, 230],               // สีหัวคอลัมน์ (พิมพ์ขาวดำได้ดี)

  // ความปลอดภัย/พิธีการ
  showConfidential = true,                  // แสดงคำเตือนความลับ
  watermarkText = "",                       // เช่น "CONFIDENTIAL"
  signatures = null,                        // { preparer?: string, reviewer?: string, approver?: string }
  // หมายเหตุท้ายตาราง (ถ้ามี)
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

  // ---- สไตล์คอลัมน์ (ความกว้าง/จัดวาง) ----
  const columnStyles = {};
  columnWidths.forEach((w, i) => (columnStyles[i] = { ...(columnStyles[i] || {}), cellWidth: w }));
  columnAligns.forEach((a, i) => (columnStyles[i] = { ...(columnStyles[i] || {}), halign: a }));

  // ---- Hook วาดหัว/ท้าย + ลายน้ำต่อหน้า ----
  const drawPageFrame = () => {
    const topY = margins.top;
    const centerX = pageW / 2;

    // ลายน้ำ (เบามาก)
    if (watermarkText) {
      doc.saveGraphicsState?.();
      doc.setTextColor(210);
      doc.setFontSize(48);
      doc.text(watermarkText, pageW / 2, pageH / 2, {
        angle: 30,
        align: "center",
      });
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

    // รายละเอียดมุมขวา (รหัส/เวอร์ชัน)
    doc.setFontSize(8);
    let rightTop = topY - 4;
    if (docCode) {
      doc.text(`รหัส: ${docCode}`, pageW - margins.right, rightTop, { align: "right" });
      rightTop += 4;
    }
    if (version) {
      doc.text(`เวอร์ชัน: ${version}`, pageW - margins.right, rightTop, { align: "right" });
    }

    // เส้นคั่น
    doc.setDrawColor(170).setLineWidth(0.3);
    doc.line(margins.left, topY + 18, pageW - margins.right, topY + 18);

    // ชื่อรายงาน + ช่วงวันที่ (subtitle)
    doc.setFont("Sarabun", "bold").setFontSize(12);
    doc.text(title, centerX, topY + 24, { align: "center" });
    if (subtitle) {
      doc.setFont("Sarabun", "normal").setFontSize(10);
      doc.text(subtitle, centerX, topY + 30, { align: "center" });
    }

    // Footer
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
    margin: {
      top: margins.top,
      right: margins.right,
      bottom: margins.bottom + footerH,
      left: margins.left,
    },
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
    headStyles: {
      font: "Sarabun",
      fontStyle: "bold",
      fillColor: headFill,
      textColor: 0,
    },
    bodyStyles: { valign: "top" },
    alternateRowStyles: zebra ? { fillColor: [247, 247, 247] } : undefined,
    columnStyles,

    didDrawPage: drawPageFrame,
  });

  // ---- หมายเหตุท้ายตาราง + บล็อกลายเซ็น (เฉพาะหน้าสุดท้าย) ----
  let y = (doc.lastAutoTable?.finalY || margins.top + headerH) + 6;
  const maxY = pageH - margins.bottom - footerH - 4;

  const needSpace = (note ? 12 : 0) + (signatures ? 34 : 0);

  if (y + needSpace > maxY) {
    doc.addPage();
    drawPageFrame();
    y = margins.top + headerH + 6;
  }

  // หมายเหตุ
  if (note) {
    doc.setFont("Sarabun", "bold").setFontSize(10).text("หมายเหตุ:", margins.left, y);
    doc.setFont("Sarabun", "normal").setFontSize(9);
    const textWidth = pageW - margins.left - margins.right;
    const lines = doc.splitTextToSize(note, textWidth);
    doc.text(lines, margins.left + 16, y);
    y += 6 + (lines.length - 1) * 4.8;
  }

  // ลายเซ็น
  if (signatures) {
    const colW = (pageW - margins.left - margins.right - 20) / 3;
    const baseY = y + 6;

    const drawSign = (x, label, name) => {
      doc.setDrawColor(130).setLineWidth(0.2);
      doc.line(x, baseY + 12, x + colW, baseY + 12);
      doc.setFont("Sarabun", "normal").setFontSize(9);
      doc.text(`(${name || " "})`, x + colW / 2, baseY + 18, { align: "center" });
      doc.text(label, x + colW / 2, baseY + 24, { align: "center" });
    };

    drawSign(margins.left, "ผู้จัดทำ", signatures.preparer || "");
    drawSign(margins.left + colW + 10, "ผู้ทบทวน", signatures.reviewer || "");
    drawSign(margins.left + 2 * (colW + 10), "ผู้อนุมัติ", signatures.approver || "");
  }

  // รวมจำนวนหน้าจริง
  if (typeof doc.putTotalPages === "function") {
    doc.putTotalPages(totalPagesExp);
  }

  doc.save(filename);
}
