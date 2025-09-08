// src/controllers/settings.controller.js
const Settings = require('../models/settings.model');

// -------- patient-form --------
exports.getPatientForm = async (req, res) => {
  const data = await Settings.getPatientForm();
  res.json(data);
};
exports.updatePatientForm = async (req, res) => {
  const saved = await Settings.updatePatientForm(req.body || {});
  res.json({ ok: true, saved });
};

// -------- patient-table (columns) --------
exports.getPatientTable = async (req, res) => {
  const data = await Settings.getPatientTable();
  res.json(data);
};
exports.updatePatientTable = async (req, res) => {
  const saved = await Settings.updatePatientTable(req.body || {});
  res.json({ ok: true, saved });
};
