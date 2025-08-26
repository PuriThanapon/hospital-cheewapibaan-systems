require('dotenv').config();
const express = require('express');
const cors = require('cors');
require("./scheduler/appointments");

const app = express();
app.use(cors());

// 1) ⬅️ ต้อง mount LINE webhook ก่อน parsers ทุกตัว
app.use('/api/line', require('./routes/line.routes')); // ใช้ express.raw() ภายในไฟล์นี้แล้ว

// 2) parsers สำหรับ route อื่น ๆ
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3) รวมทุก route อื่นไว้ใต้ /api (ยกเว้น /api/line/webhook ที่แยกไว้แล้ว)
app.use('/api', require('./routes'));

// 404
app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: err?.message || 'Internal Server Error' });
});

// start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
