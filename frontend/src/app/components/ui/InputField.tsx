'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function InputField({ label, children, error, required = false, icon, description }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
        {icon && <span className="text-blue-500">{icon}</span>}
        {label}{required && <span className="text-red-500">*</span>}
      </label>
      {description && <p className="text-xs text-gray-500 -mt-1">{description}</p>}
      {children}
      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <AlertCircle size={14}/>
          {error}
        </p>
      )}
    </div>
  );
}
