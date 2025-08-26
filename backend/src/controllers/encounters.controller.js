// backend/src/controllers/encounters.controller.js
const { pool } = require('../config/db')

// CREATE
exports.createEncounter = async (req, res) => {
  try {
    const { patients_id, encounter_date, encounter_type, provider, place, note, status } = req.body
    if (!patients_id || !encounter_date || !encounter_type) {
      return res.status(400).json({ error: 'patients_id, encounter_date และ encounter_type จำเป็น' })
    }
    const q = `
      INSERT INTO encounters (patients_id, encounter_date, encounter_type, provider, place, note, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`
    const r = await pool.query(q, [patients_id, encounter_date, encounter_type, provider, place, note, status || 'open'])
    res.json(r.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// READ (list by patient)
exports.listEncounters = async (req, res) => {
  const { patients_id } = req.query
  if (!patients_id) return res.status(400).json({ error: 'ต้องส่ง patients_id' })
  const r = await pool.query(
    `SELECT * FROM encounters WHERE patients_id=$1 ORDER BY encounter_date DESC, created_at DESC`,
    [patients_id]
  )
  res.json(r.rows)
}

// UPDATE
exports.updateEncounter = async (req, res) => {
  try {
    const { encounter_id } = req.params
    const { encounter_date, encounter_type, provider, place, note, status } = req.body
    const q = `
      UPDATE encounters
      SET encounter_date=$1, encounter_type=$2, provider=$3, place=$4, note=$5, status=$6, updated_at=now()
      WHERE encounter_id=$7
      RETURNING *`
    const r = await pool.query(q, [encounter_date, encounter_type, provider, place, note, status, encounter_id])
    if (!r.rows[0]) return res.status(404).json({ error: 'ไม่พบ Encounter' })
    res.json(r.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// DELETE
exports.deleteEncounter = async (req, res) => {
  const { encounter_id } = req.params
  const r = await pool.query('DELETE FROM encounters WHERE encounter_id=$1', [encounter_id])
  if (r.rowCount === 0) return res.status(404).json({ error: 'ไม่พบ Encounter' })
  res.status(204).end()
}
