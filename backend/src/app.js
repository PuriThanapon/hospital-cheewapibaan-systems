require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRouter = require('./routes');

const app = express();
app.use(cors());
app.use(express.json());

// รวมทุก route ไว้ใต้ /api
app.use('/api', apiRouter);

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
