// backend/src/utils/helper.js
function toPatientsId(v) {
  const digits = String(v ?? '')
    .toUpperCase()
    .trim()
    .replace(/^HN[-–—]?/i, '')
    .replace(/\D/g, '');
  if (!digits) return null;
  return 'HN-' + digits.padStart(8, '0');
}

function normalizePatientsIdFromQuery(q) {
  if (!q) return '';
  const digits = String(q)
    .toUpperCase()
    .replace(/^HN[-–—]?/, '')
    .replace(/\D/g, '');
  if (!digits) return '';
  return `HN-${digits.padStart(8, '0')}`;
}

function normalizePatientsId(id) {
  if (!id) return null;
  id = String(id).trim();
  if (/^\d+$/.test(id)) return 'HN-' + id.padStart(8, '0');
  const digits = id.toUpperCase().replace(/^HN[\s\-–—]?/, '').replace(/\D/g, '');
  if (!digits) return null;
  return 'HN-' + digits.padStart(8, '0');
}

module.exports = { toPatientsId, normalizePatientsIdFromQuery, normalizePatientsId };
