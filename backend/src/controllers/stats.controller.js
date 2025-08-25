// controllers/stats.controller.js
const { pool } = require('../config/db');

// GET /api/dashboard/deaths-by-year
exports.deathsByYear = async (req, res, next) => {
  try {
    // default: 5 ปีย้อนหลัง
    const endYear = new Date().getFullYear();
    const startYear = endYear - 4;

    const sql = `
      WITH d AS (
        SELECT
          EXTRACT(YEAR FROM death_date)::int AS y,
          lower(COALESCE(death_cause, '')) AS cause
        FROM patients
        WHERE status='เสียชีวิต' AND death_date IS NOT NULL
          AND EXTRACT(YEAR FROM death_date) BETWEEN $1 AND $2
      ),
      bucketed AS (
        SELECT
          y,
          CASE
            WHEN cause ~ '(โรค|chronic|ca|cancer|dm|ht|copd|ckd|stroke|mi|ckd|asthma)'
              THEN 'โรคประจำตัว'
            ELSE 'สาเหตุอื่นๆ'
          END AS bucket,
          COUNT(*) AS c
        FROM d
        GROUP BY 1,2
      )
      SELECT
        y AS year,
        COALESCE(SUM(c) FILTER (WHERE bucket='โรคประจำตัว'), 0) AS chronic,
        COALESCE(SUM(c) FILTER (WHERE bucket='สาเหตุอื่นๆ'), 0)  AS other,
        COALESCE(SUM(c), 0) AS total
      FROM bucketed
      GROUP BY y
      ORDER BY y;
    `;
    const { rows } = await pool.query(sql, [startYear, endYear]);
    res.json({ startYear, endYear, data: rows });
  } catch (e) { next(e); }
};
