// utils/uploadPatientFiles.ts
const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

export async function uploadPatientFiles(
  patients_id: string,
  docs: Array<{ doc_type: string; file: File; label?: string | null }>,
  appointment_id?: number | null,
) {
  for (const d of docs) {
    const fd = new FormData();
    fd.append('doc_type', d.doc_type);
    if (d.label) fd.append('label', d.label);
    if (appointment_id != null) fd.append('appointment_id', String(appointment_id));
    fd.append('file', d.file, d.file.name);

    const res = await fetch(`${API}/api/patient-files/${encodeURIComponent(patients_id)}`, {
      method: 'POST',
      body: fd,           // ห้ามใส่ headers Content-Type
      cache: 'no-store',
    });
    if (!res.ok) {
      let msg = `อัปโหลดไฟล์ (${d.doc_type}) ไม่สำเร็จ`;
      try { msg = (await res.json()).message || msg; } catch {}
      throw new Error(msg);
    }
  }
}
