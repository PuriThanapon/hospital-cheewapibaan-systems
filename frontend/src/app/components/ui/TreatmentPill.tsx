'use client';
import React from 'react';
import { CheckCircle, Clock } from 'lucide-react';

export default function TreatmentStatusPill({ completed }: { completed: boolean }) {
  const cls = completed
    ? 'bg-green-100 text-green-800 border border-green-200'
    : 'bg-blue-100 text-blue-800 border border-blue-200';

  return (
    <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-normal border ${cls}`}>
      {completed ? <CheckCircle size={14}/> : <Clock size={14}/>}
      {completed ? 'เสร็จสิ้น' : 'กำลังดำเนินการ'}
    </span>
  );
}
