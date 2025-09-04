const routines = require('../models/routines.model');

// HH:MM
const TIME_RX = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const isoDow = (d = new Date()) => (d.getDay() === 0 ? 7 : d.getDay());

function parseDayParam(q) {
  if (!q) return null;
  if (typeof q.day === 'string' && q.day.toLowerCase() === 'today') return isoDow();
  const day = Number(q.day);
  if (!Number.isInteger(day) || day < 1 || day > 7) return null;
  return day;
}

function parseIdParam(param) {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function list(req, res) {
  try {
    const day = parseDayParam(req.query);
    const rows = day ? await routines.listByDay(day) : await routines.listAll();
    res.set('Cache-Control', 'no-store');
    res.json(rows);
  } catch (err) {
    console.error('[routines.list]', err);
    res.status(500).json({ error: 'LIST_FAILED' });
  }
}

async function getOne(req, res) {
  try {
    const id = parseIdParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID_INVALID' });

    const row = await routines.getById(id);
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(row);
  } catch (err) {
    console.error('[routines.getOne]', err);
    res.status(500).json({ error: 'GET_FAILED' });
  }
}

async function create(req, res) {
  try {
    const { title, time } = req.body || {};
    const _title = typeof title === 'string' ? title.trim() : title;
    if (!_title || typeof _title !== 'string') return res.status(400).json({ error: 'TITLE_REQUIRED' });
    if (!time || !TIME_RX.test(time)) return res.status(400).json({ error: 'TIME_INVALID' });

    const row = await routines.create({ ...req.body, title: _title });
    res.status(201).json(row);
  } catch (err) {
    console.error('[routines.create]', err);
    const code = String(err.message || '');
    if (code === 'INVALID_TIME') return res.status(400).json({ error: 'TIME_INVALID' });
    if (code === 'INVALID_DAYS') return res.status(400).json({ error: 'DAYS_INVALID' });
    res.status(500).json({ error: 'CREATE_FAILED' });
  }
}

async function update(req, res) {
  try {
    const id = parseIdParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID_INVALID' });

    if (typeof req.body?.time === 'string' && !TIME_RX.test(req.body.time)) {
      return res.status(400).json({ error: 'TIME_INVALID' });
    }
    const payload =
      typeof req.body?.title === 'string'
        ? { ...req.body, title: req.body.title.trim() }
        : (req.body || {});

    const row = await routines.update(id, payload);
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(row);
  } catch (err) {
    console.error('[routines.update]', err);
    const code = String(err.message || '');
    if (code === 'INVALID_TIME') return res.status(400).json({ error: 'TIME_INVALID' });
    if (code === 'INVALID_DAYS') return res.status(400).json({ error: 'DAYS_INVALID' });
    res.status(500).json({ error: 'UPDATE_FAILED' });
  }
}

async function remove(req, res) {
  try {
    const id = parseIdParam(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID_INVALID' });

    const ok = await routines.remove(id);
    if (!ok) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[routines.remove]', err);
    res.status(500).json({ error: 'DELETE_FAILED' });
  }
}

module.exports = { list, getOne, create, update, remove };
