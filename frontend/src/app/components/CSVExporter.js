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