const express = require("express");
const router = express.Router();
const { pushText, verifyLineSignature } = require("../utils/line");

// ต้องใช้ raw body สำหรับ webhook นี้เท่านั้น
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const raw = req.body.toString("utf8");
    const sig = req.get("x-line-signature");
    if (!verifyLineSignature(sig, raw)) return res.status(401).send("invalid signature");

    const body = JSON.parse(raw);

    for (const ev of body.events || []) {
      // 🟢 log userId ออกมาเพื่อเอาไปใช้
      console.log("LINE event:", ev.type, "source:", ev.source);

      // พิมพ์ "groupid" ในกลุ่มเพื่อให้บอทตอบ Group ID
      if (ev.type === "message" && ev.source?.type === "group" && ev.message?.type === "text") {
        if (ev.message.text.trim().toLowerCase() === "groupid") {
          await pushText(ev.source.groupId, `Group ID: ${ev.source.groupId}`);
        }
      }

      // ทักผู้ใช้ที่เพิ่มเพื่อนบอท
      if (ev.type === "follow" && ev.source?.type === "user") {
        console.log("👤 New follower userId:", ev.source.userId); // 🟢 log ตรงนี้ด้วย
        await pushText(ev.source.userId, "✅ บอทแจ้งเตือนพร้อมใช้งานแล้ว");
      }

      // ถ้าอยาก log ตอนมีข้อความส่วนตัว
      if (ev.type === "message" && ev.source?.type === "user") {
        console.log("📩 Message from userId:", ev.source.userId);
        console.log("ข้อความ:", ev.message.text);
      }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});
exports = module.exports = router;