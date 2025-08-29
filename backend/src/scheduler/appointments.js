const cron = require("node-cron");
const { pool } = require("../config/db");
const { pushText, pushMessage } = require("../utils/line");

function todayISOInTH() {
  // คืนค่าเป็น "YYYY-MM-DD" ตามโซนเวลาไทย
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function formatTime(t) {
    if (!t) return "-";
    return t.toString().slice(0, 5) + " น."; // HH:mm น.
}

function toLocalDate(value) {
    if (!value) return null;

    if (value instanceof Date && !isNaN(value)) return value;

    const s = String(value);

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split("-").map(n => parseInt(n, 10));
        return new Date(y, m - 1, d);
    }

    // YYYY-MM-DDTHH:mm:ss...  -> ตัดเอา 10 ตัวแรก
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
        const [y, m, d] = s.slice(0, 10).split("-").map(n => parseInt(n, 10));
        return new Date(y, m - 1, d);
    }

    // DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const [d, m, y] = s.split("/").map(n => parseInt(n, 10));
        return new Date(y, m - 1, d);
    }

    // ฟอลแบ็ก: ให้ Date พยายาม parse
    const d2 = new Date(s);
    if (!isNaN(d2)) return d2;

    return null;
}

function formatDateTHFull(dateInput) {
    const date = toLocalDate(dateInput);
    if (!date) return "-";

    const daysTH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
    const monthsTH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

    const weekday = daysTH[date.getDay()];
    const day = date.getDate();
    const monthName = monthsTH[date.getMonth()];
    const buddhistYr = date.getFullYear() + 543;

    return `วัน${weekday} ที่ ${day} ${monthName} พ.ศ.${buddhistYr}`;
}



function getOverallTimeRange(rows) {
    if (!rows.length) return null;
    const startTimes = rows.map(r => r.start_time).filter(Boolean).sort();
    const endTimes = rows.map(r => r.end_time).filter(Boolean).sort();
    return {
        earliest: formatTime(startTimes[0]),
        latest: formatTime(endTimes[endTimes.length - 1])
    };
}


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
                        { type: "text", text: `📅 วันที่: ${formatDateTHFull(r.appointment_date)}`, size: "sm" },

                        { type: "text", text: `⏰ เวลา: ${formatTime(r.start_time)} - ${formatTime(r.end_time)}`, size: "sm" },
                        { type: "text", text: `📍 สถานที่: ${r.place ?? "-"}`, size: "sm" },
                        { type: "text", text: `📍 แผนก: ${r.department ?? "-"}`, size: "sm" },
                        { type: "text", text: `📝 หมายเหตุ: ${r.note ?? "-"}`, size: "sm" }
                    ]
                }
            ]
        }
    };
}


function buildAppointmentsFlex(rows, label) {
    return {
        type: "flex",
        altText: `📌 นัดหมายผู้ป่วยประจำ${label} (${rows.length} ราย)`,
        contents: {
            type: "carousel",
            contents: rows.map(buildAppointmentFlex)
        }
    };
}

// 🕕 ทุกวัน 06:00
cron.schedule("0 6 * * *", async () => {
    try {
       const today = todayISOInTH(); 

        const { rows } = await pool.query(
            `SELECT a.appointment_date, a.start_time, a.end_time, a.place, a.note, a.department,
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
            
            const dateLabel = formatDateTHFull(today); // ✅ "วันอังคาร ที่ 27 สิงหาคม พ.ศ.2568"

            const flexMsg = buildAppointmentsFlex(rows, dateLabel);
            await pushMessage(target, flexMsg);

            const range = getOverallTimeRange(rows);
            await pushText(
                target,
                `✅ วันนี้ (${dateLabel}) มีนัดทั้งหมด ${rows.length} ราย\n🕑 ตั้งแต่เวลา ${range.earliest} ถึง ${range.latest}`
            );



        }

        console.log("✅ ส่งแจ้งเตือนนัดหมายเรียบร้อย (Flex + สรุป)");
    } catch (err) {
        console.error("❌ ส่งแจ้งเตือนนัดหมายล้มเหลว:", err);
    }
});
