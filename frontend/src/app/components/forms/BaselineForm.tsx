'use client';

import React from 'react';

export type Baseline = {
  patients_id: string;
  reason_in_dept?: string | null;
  reason_admit?: string | null;
  bedbound_cause?: string | null;
  other_history?: string | null;
  referral_hospital?: string | null;
  referral_phone?: string | null;
};

type Props = {
  value: Baseline;
  onChange: (v: Baseline) => void;
  errors?: Partial<Record<keyof Baseline, string>>;
  className?: string;
};

export default function BaselineForm({ value, onChange, errors = {}, className = '' }: Props) {
  const v: Baseline = value || ({} as Baseline);

  const setText =
    (k: keyof Baseline) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...v, [k]: e.target.value });

  /* === NEW: ฟังก์ชันจัดรูปแบบเบอร์โทรแบบไทย === */
  const formatThaiPhone = (raw: string) => {
    // เอาเฉพาะตัวเลข และรองรับ +66 -> 0
    let d = raw.replace(/\D/g, '');
    if (d.startsWith('66')) d = '0' + d.slice(2);

    // จำกัดความยาวสูงสุด (มือถือ 10 หลัก / เบอร์บ้านบางแบบ 9 หลัก)
    d = d.slice(0, 10);

    // กรณี 02-xxx-xxxx (กทม. 9 หลัก)
    if (d.startsWith('02')) {
      if (d.length <= 2) return d;
      if (d.length <= 5) return `02-${d.slice(2)}`;
      // เหลือส่วนสุดท้ายยาวเท่าที่มี (สูงสุด 4)
      return `02-${d.slice(2, 5)}-${d.slice(5, 9)}`;
    }

    // กรณีอื่น ๆ
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
    // ถ้ายาว 7–9 => 0xx-xxx-xxx (เบอร์ภูมิภาค 9 หลัก)
    // ถ้ายาว 10 => 0xx-xxx-xxxx (มือถือ)
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  };

  /* === NEW: onChange ที่ “ล็อก” รูปแบบเบอร์โทร === */
  const handlePhoneChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const formatted = formatThaiPhone(e.target.value);
    onChange({ ...v, referral_phone: formatted });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อโรงพยาบาลต้นสังกัด</label>
          <input
            type="text"
            name="referral_hospital"
            value={v.referral_hospital ?? ''}
            onChange={setText('referral_hospital')}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="เช่น รพ.สต.บ้านใหม่"
            autoComplete="organization"
          />
          {errors?.referral_hospital && <p className="mt-1 text-xs text-red-600">{errors.referral_hospital}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรต้นสังกัด</label>
          <input
            type="tel"
            name="referral_phone"
            value={v.referral_phone ?? ''}
            onChange={handlePhoneChange}
            className={[
              'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2',
              errors?.referral_phone ? 'border-red-300 focus:ring-red-500' : 'focus:ring-blue-500',
            ].join(' ')}
            placeholder="0xx-xxx-xxxx หรือ 02-xxx-xxxx"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={12} /* 0xx-xxx-xxxx = 12 ตัวอักษรรวมขีด, 02-xxx-xxxx = 11 */
            /* ตรวจสอบรูปแบบ: 02-xxx-xxxx หรือ 0xx-xxx-xxx/xxxx */
            pattern="^(02-\d{3}-\d{4}|0\d{2}-\d{3}-\d{3,4})$"
            title="รูปแบบที่ยอมรับ: 02-xxx-xxxx, 0xx-xxx-xxx, 0xx-xxx-xxxx"
          />
          {errors?.referral_phone ? (
            <p className="mt-1 text-xs text-red-600">{errors.referral_phone}</p>
          ) : (
            <p className="mt-1 text-xs text-gray-500">ระบบจะจัดรูปแบบอัตโนมัติ เช่น 080-123-4567 หรือ 02-123-4567</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">เหตุผลที่มาอยู่แผนกนี้</label>
        <textarea
          className={`w-full border rounded-lg p-3 resize-none focus:ring-2 focus:border-transparent ${
            errors.reason_in_dept ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'
          }`}
          rows={3}
          placeholder="กรุณาระบุเหตุผล..."
          value={v.reason_in_dept || ''}
          onChange={setText('reason_in_dept')}
        />
        {errors.reason_in_dept && <div className="mt-1 text-xs text-red-600">{errors.reason_in_dept}</div>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">สาเหตุที่เข้ามาที่แผนก</label>
        <textarea
          className={`w-full border rounded-lg p-3 resize-none focus:ring-2 focus:border-transparent ${
            errors.reason_admit ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'
          }`}
          rows={3}
          placeholder="กรุณาระบุสาเหตุ..."
          value={v.reason_admit || ''}
          onChange={setText('reason_admit')}
        />
        {errors.reason_admit && <div className="mt-1 text-xs text-red-600">{errors.reason_admit}</div>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">สาเหตุที่ติดเตียง</label>
        <textarea
          className={`w-full border rounded-lg p-3 resize-none focus:ring-2 focus:border-transparent ${
            errors.bedbound_cause ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'
          }`}
          rows={3}
          placeholder="กรุณาระบุสาเหตุ..."
          value={v.bedbound_cause || ''}
          onChange={setText('bedbound_cause')}
        />
        {errors.bedbound_cause && <div className="mt-1 text-xs text-red-600">{errors.bedbound_cause}</div>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">อื่น ๆ</label>
        <textarea
          className={`w-full border rounded-lg p-3 resize-none focus:ring-2 focus:border-transparent ${
            errors.other_history ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'
          }`}
          rows={4}
          placeholder="ข้อมูลเพิ่มเติม..."
          value={v.other_history || ''}
          onChange={setText('other_history')}
        />
        {errors.other_history && <div className="mt-1 text-xs text-red-600">{errors.other_history}</div>}
      </div>
    </div>
  );
}
