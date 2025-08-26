const crypto = require("crypto");
// ใช้ fetch ของ Node 18+ ได้เลย
// ถ้า Node < 18 ให้ลง: npm i node-fetch แล้ว import มาใช้แทน
const fetch = global.fetch || ((...args) => import("node-fetch").then(({ default: f }) => f(...args)));

const LINE_API = "https://api.line.me/v2/bot/message/push";

/** ส่งข้อความธรรมดา */
async function pushText(to, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN");

  const res = await fetch(LINE_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text }],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LINE push ${res.status}: ${t}`);
  }
}

/** ส่งข้อความแบบ Flex หรือ message อื่น ๆ */
async function pushMessage(to, message) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN");

  const res = await fetch(LINE_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      messages: [message], // 🟢 รองรับ flex message, image, sticker, ฯลฯ
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LINE push ${res.status}: ${t}`);
  }
}

/** verify signature จาก LINE */
function verifyLineSignature(signature, rawBody) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const mac = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  return signature === mac;
}

module.exports = { pushText, pushMessage, verifyLineSignature };
