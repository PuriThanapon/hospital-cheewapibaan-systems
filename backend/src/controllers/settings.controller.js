const Settings = require('../models/settings.model');

exports.getPatientForm = async (req, res) => {
  const data = await Settings.getPatientForm();
  res.json(data);
};

exports.updatePatientForm = async (req, res) => {
  const saved = await Settings.updatePatientForm(req.body || {});
  res.json({ ok: true, saved });
};
