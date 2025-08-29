'use client';

import React from 'react';

export type Baseline = {
  patients_id: string;
  reason_in_dept?: string | null;
  reason_admit?: string | null;
  bedbound_cause?: string | null;
  other_history?: string | null;
};

type Props = {
  value: Baseline;
  onChange: (v: Baseline) => void;
  errors?: Partial<Record<keyof Baseline, string>>;
  className?: string;
};

export default function BaselineForm({ value, onChange, errors = {}, className = '' }: Props) {
  const v = value || ({} as Baseline);
  const set = (k: keyof Baseline) => (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    onChange({ ...v, [k]: e.target.value });

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          เหตุผลที่มาอยู่แผนกนี้
        </label>
        <textarea
          className={`w-full border rounded-lg p-3 resize-none focus:ring-2 focus:border-transparent
            ${errors.reason_in_dept ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'}`}
          rows={3}
          placeholder="กรุณาระบุเหตุผล..."
          value={v.reason_in_dept || ''}
          onChange={set('reason_in_dept')}
        />
        {errors.reason_in_dept && <div className="mt-1 text-xs text-red-600">{errors.reason_in_dept}</div>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          สาเหตุที่เข้ามาที่แผนก
        </label>
        <textarea
          className={`w-full border rounded-lg p-3 resize-none focus:ring-2 focus:border-transparent
            ${errors.reason_admit ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'}`}
          rows={3}
          placeholder="กรุณาระบุสาเหตุ..."
          value={v.reason_admit || ''}
          onChange={set('reason_admit')}
        />
        {errors.reason_admit && <div className="mt-1 text-xs text-red-600">{errors.reason_admit}</div>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          สาเหตุที่ติดเตียง
        </label>
        <textarea
          className={`w-full border rounded-lg p-3 resize-none focus:ring-2 focus:border-transparent
            ${errors.bedbound_cause ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'}`}
          rows={3}
          placeholder="กรุณาระบุสาเหตุ..."
          value={v.bedbound_cause || ''}
          onChange={set('bedbound_cause')}
        />
        {errors.bedbound_cause && <div className="mt-1 text-xs text-red-600">{errors.bedbound_cause}</div>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          อื่น ๆ
        </label>
        <textarea
          className={`w-full border rounded-lg p-3 resize-none focus:ring-2 focus:border-transparent
            ${errors.other_history ? 'border-red-300 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'}`}
          rows={4}
          placeholder="ข้อมูลเพิ่มเติม..."
          value={v.other_history || ''}
          onChange={set('other_history')}
        />
        {errors.other_history && <div className="mt-1 text-xs text-red-600">{errors.other_history}</div>}
      </div>
    </div>
  );
}
