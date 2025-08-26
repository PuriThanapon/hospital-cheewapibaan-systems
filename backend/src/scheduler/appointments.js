const cron = require("node-cron");
const { pool } = require("../config/db");
const { pushText, pushMessage } = require("../utils/line");

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

// 🕕 ทุกวัน 06:00
cron.schedule("* 6 * * *", async () => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const { rows } = await pool.query(
      `SELECT a.appointment_date, a.start_time, a.end_time, a.place, a.note,
              p.patients_id, p.first_name, p.last_name
       FROM appointment a
       JOIN patients p ON a.patients_id = p.patients_id
       WHERE a.appointment_date = $1
       ORDER BY a.start_time ASC`,
      [today]
    );

    const targets = [process.env.LINE_USER_ID, process.env.LINE_GROUP_ID].filter(Boolean);

    for (const target of targets) {
      if (!rows.length) {
        await pushText(target, "📭 วันนี้ไม่มีนัดหมายผู้ป่วย");
        continue;
      }

      const flexMsg = buildAppointmentsFlex(rows, today);
      await pushMessage(target, flexMsg);

      await pushText(target, `✅ วันนี้มีนัดทั้งหมด ${rows.length} ราย`);
    }

    console.log("✅ ส่งแจ้งเตือนนัดหมายเรียบร้อย (Flex + สรุป)");
  } catch (err) {
    console.error("❌ ส่งแจ้งเตือนนัดหมายล้มเหลว:", err);
  }
});
