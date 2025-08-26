const cron = require("node-cron");
const { pool } = require("../config/db");
const { pushText, pushMessage } = require("../utils/line");

/** สร้าง Flex Card ของแต่ละนัด */
function buildAppointmentFlex(r) {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: `${r.first_name ?? ""} ${r.last_name ?? ""}`, weight: "bold", size: "lg" },
        { type: "text", text: `HN: ${r.patients_id}`, size: "sm", color: "#888888" },
        { type: "separator", margin: "md" },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            { type: "text", text: `📅 วันที่: ${r.appointment_date}`, size: "sm" },
            { type: "text", text: `⏰ เวลา: ${r.start_time} - ${r.end_time}`, size: "sm" },
            { type: "text", text: `📍 สถานที่: ${r.place ?? "-"}`, size: "sm" },
            { type: "text", text: `📝 หมายเหตุ: ${r.note ?? "-"}`, size: "sm" }
          ]
        }
      ]
    }
  };
}

/** Flex Message แบบ carousel */
function buildAppointmentsFlex(rows, today) {
  return {
    type: "flex",
    altText: `📌 นัดหมายผู้ป่วยประจำวันที่ ${today} (${rows.length} ราย)`,
    contents: {
      type: "carousel",
      contents: rows.map(buildAppointmentFlex)
    }
  };
}

// 🕕 ตั้งเวลาให้รันทุกวัน 06:00 น.
cron.schedule("*/1 * * * *", async () => {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const { rows } = await pool.query(
      `SELECT a.appointment_date, a.start_time, a.end_time, a.place, a.note,
              p.patients_id, p.first_name, p.last_name
       FROM appointment a
       JOIN patients p ON a.patients_id = p.patients_id
       WHERE a.appointment_date = $1
       ORDER BY a.start_time ASC`,
      [today]
    );

    if (!rows.length) {
      await pushText(process.env.LINE_USER_ID, "📭 วันนี้ไม่มีนัดหมายผู้ป่วย");
      return;
    }

    // ส่ง Flex Message (carousel)
    const flexMsg = buildAppointmentsFlex(rows, today);
    await pushMessage(process.env.LINE_USER_ID, flexMsg);

    // ส่งสรุปจำนวนต่อท้าย
    await pushText(process.env.LINE_USER_ID, `✅ วันนี้มีนัดทั้งหมด ${rows.length} ราย`);

    console.log("✅ ส่งแจ้งเตือนนัดหมาย (Flex) เรียบร้อย");
  } catch (err) {
    console.error("❌ ส่งแจ้งเตือนนัดหมายล้มเหลว:", err);
  }
});
