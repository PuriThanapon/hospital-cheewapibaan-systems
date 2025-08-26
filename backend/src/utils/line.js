const crypto = require("crypto");

// ถ้า Node < 18 ให้ลง: npm i node-fetch แล้ว uncomment สองบรรทัดนี้
// const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

async function pushText(to, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN");

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
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

function verifyLineSignature(signature, rawBody) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const mac = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  return signature === mac;
}

module.exports = { pushText, verifyLineSignature };
