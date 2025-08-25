'use client';

import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function Pill({ alive }) {
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
      alive
        ? 'bg-green-100 text-green-800 border border-green-200'
        : 'bg-red-100 text-red-800 border border-red-200'
    }`}>
      {alive ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
      {alive ? 'มีชีวิต' : 'เสียชีวิต'}
    </span>
  );
}
