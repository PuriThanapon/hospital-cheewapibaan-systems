// แปะไว้ไฟล์ไหนก็ได้ที่ใช้ร่วม (เช่น utils/baseline.ts)
export function hasBaselineData(b?: {
  reason_in_dept?: string | null;
  reason_admit?: string | null;
  bedbound_cause?: string | null;
  other_history?: string | null;
}) {
  if (!b) return false;
  return ['reason_in_dept','reason_admit','bedbound_cause','other_history']
    .some(k => (b as any)[k] && String((b as any)[k]).trim() !== '');
}
