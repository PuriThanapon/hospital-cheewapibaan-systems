// app/lib/treatmentPlans.ts (หรือ src/lib/treatmentPlans.ts)
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000/';


export async function createPlan(payload: {
  patients_id: string;
  title?: string;
  care_model?: string;
  care_location?: string;
  life_support?: string[];
  decision_makers?: Array<{ name: string; relation?: string; phone?: string }>;
  wishes?: Record<string, any>;
}, files: File[]) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(payload)) {
    fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''));
  }
  for (const f of files) fd.append('files', f);

  const res = await fetch(`${API_BASE}/api/treatment-plans`, {
    method: 'POST',
    body: fd, 
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}