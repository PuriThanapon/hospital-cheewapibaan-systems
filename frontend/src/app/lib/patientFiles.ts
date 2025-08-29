// utils/patientFiles.ts
export const DOC_OPTIONS = [
  'patient_id_card','house_registration','patient_photo','relative_id_card',
  'assistance_letter','power_of_attorney','homeless_certificate',
  'adl_assessment','clinical_summary',
] as const;

type DocKey = typeof DOC_OPTIONS[number];

export type PatientFormValues = {
  patients_id: string;
  appointment_id?: number | null;
  docFlags?: Record<string, boolean>;
  other_docs?: Array<{ label?: string; file?: File | null }>;
} & Partial<Record<DocKey, File | null>>;

export function collectSelectedDocs(v: PatientFormValues) {
  const items: Array<{ doc_type: string; file: File; label?: string | null }> = [];

  // เอกสารมาตรฐาน
  for (const key of DOC_OPTIONS) {
    const f = (v as any)[key] as File | null | undefined;
    if (v.docFlags?.[key] && f instanceof File) {
      items.push({ doc_type: key, file: f });
    }
  }
  // เอกสารอื่น ๆ
  for (const row of v.other_docs ?? []) {
    if (row?.file instanceof File) {
      items.push({ doc_type: 'other', file: row.file, label: (row.label || '').trim() || null });
    }
  }
  return items;
}
