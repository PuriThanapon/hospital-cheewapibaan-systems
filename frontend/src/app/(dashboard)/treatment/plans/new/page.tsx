'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { CheckCircle, X } from 'lucide-react';
import TreatmentPlanForm, {
  TreatmentPlanFormValue,
  TreatmentPlanFormHandle,
} from '@/app/components/forms/TreatmentPlanForm';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

export default function NewTreatmentPlanPage() {
  const formRef = useRef<TreatmentPlanFormHandle>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const [draft, setDraft] = useState<TreatmentPlanFormValue>({
    patients_id: '',
    title: '',
    care_model: '',
    care_location: '',
    life_support: { icu: false, cpr: false, tracheostomy: false, intubation: false, ventilator: false, advanced_devices: false, note: '' },
    decision_makers: [],
    wishes1_decision_person: '',
    wishes2_preferred_care: '',
    wishes3_comfort_care: '',
    wishes4_home_caregiver: '',
    wishes5_final_goodbye: '',
    directive_files: [],
    note: '',
  });

  const handleSave = async () => {
    if (formRef.current?.validate && !formRef.current.validate()) return;

    const ok = await Swal.fire({ icon: 'question', title: 'ยืนยันสร้างแผนการรักษา?', showCancelButton: true })
      .then(r => r.isConfirmed);
    if (!ok) return;

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('patients_id', draft.patients_id);
      fd.append('title', draft.title || '');
      fd.append('care_model', draft.care_model);
      fd.append('care_location', draft.care_location);
      fd.append('life_support', JSON.stringify(draft.life_support || {}));
      fd.append('decision_makers', JSON.stringify(draft.decision_makers || []));
      fd.append('wishes', JSON.stringify({
        decision_person: draft.wishes1_decision_person || null,
        preferred_care: draft.wishes2_preferred_care || null,
        comfort_care:   draft.wishes3_comfort_care || null,
        home_caregiver: draft.wishes4_home_caregiver || null,
        final_goodbye:  draft.wishes5_final_goodbye || null,
      }));
      (draft.directive_files || []).forEach(f => fd.append('files', f));

      const res = await fetch(`${API_BASE}/api/treatment-plans`, { method: 'POST', body: fd });
      if (!res.ok) {
        let msg = 'Request failed'; try { const j = await res.json(); msg = j?.message || j?.error || msg; } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      const id = data?.plan_id || data?.data?.plan_id || data?.id || data?.data?.id;

      await Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1200, showConfirmButton: false });
      router.push(id ? `/treatment/plans/${encodeURIComponent(id)}` : '/treatment/plans');
    } catch (e: any) {
      await Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: e?.message || '' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-10 bg-[#f7f7fb]">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">สร้างแผนการรักษา</h1>
            <p className="text-gray-600">กรอกความต้องการและเอกสารที่เกี่ยวข้อง</p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2" onClick={() => history.back()} disabled={saving}>
              <X size={16}/> ยกเลิก
            </button>
            <button className="px-5 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2" onClick={handleSave} disabled={saving}>
              <CheckCircle size={16}/> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </div>

        {/* ฟอร์มมีตัวช่วยค้นหาผู้ป่วยภายในแล้ว */}
        <TreatmentPlanForm ref={formRef} value={draft} onChange={setDraft} />
      </div>
    </div>
  );
}
