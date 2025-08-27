// src/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
require('./scheduler/appointments');

const errorHandler = require('./middlewares/errorHandler');

const app = express();

// พื้นฐาน
app.disable('x-powered-by');
app.set('trust proxy', 1);

// CORS (จะอ่านจาก .env ถ้าตั้ง CORS_ORIGIN ไว้)
const ALLOW_ORIGIN = process.env.CORS_ORIGIN?.split(',').map(s => s.trim()).filter(Boolean);
app.use(cors(ALLOW_ORIGIN?.length ? { origin: ALLOW_ORIGIN, credentials: true } : {}));

// 1) LINE webhook ต้องมาก่อน parsers
app.use('/api/line', require('./routes/line.routes'));

// 2) parsers ทั่วไป
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// 3) รวม sub-routes ทั้งหมด
app.use('/api', require('./routes'));

// healthcheck
app.get('/healthz', (req, res) => res.status(200).json({ ok: true }));

// 404
app.use((req, res) => res.status(404).json({ message: 'Not Found' }));

// error handler กลาง
app.use(errorHandler);

// start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
