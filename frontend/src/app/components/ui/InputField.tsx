'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';

export type InputFieldProps = {
  /** ข้อความหัวข้อของฟิลด์ */
  label?: React.ReactNode;
  /** แสดง * ถ้าบังคับกรอก */
  required?: boolean;
  /** ไอคอนด้านหน้าหัวข้อ */
  icon?: React.ReactNode;
  /** คำอธิบายสั้นใต้หัวข้อ */
  description?: React.ReactNode;
  /** ข้อความ error (จะแสดงใต้ input) */
  error?: React.ReactNode;
  /** เนื้อหา input ที่จะครอบไว้ */
  children: React.ReactNode;
  /** เติมคลาสเพิ่มเติมภายนอก */
  className?: string;
};

export default function InputField({
  label,
  required = false,
  icon,
  description,
  children,
  error,
  className = '',
}: InputFieldProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
          {icon ? <span className="text-blue-500">{icon}</span> : null}
          <span>{label}</span>
          {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {description ? (
        <p className="text-xs text-gray-500 -mt-1">{description}</p>
      ) : null}

      {children}

      {error ? (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <AlertCircle size={14} />
          {error}
        </p>
      ) : null}
    </div>
  );
}
