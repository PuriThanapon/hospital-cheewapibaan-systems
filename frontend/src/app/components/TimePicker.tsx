import React, { useMemo } from 'react';
import { Clock, Activity } from 'lucide-react';

interface MedicalThaiTimePickerProps {
  value: string;                          // "HH:mm"
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  name?: string;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  mode?: 'select' | 'native';
  minuteStep?: number;
  medicalContext?: 'appointment' | 'medication' | 'vital-signs' | 'surgery' | 'general';
}

function pad2(n: number) { return String(n).padStart(2, '0'); }
function splitHM(v?: string): { h: number; m: number } {
  if (!v) return { h: NaN as any, m: NaN as any };
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return { h: NaN as any, m: NaN as any };
  const hh = Math.max(0, Math.min(23, Number(m[1] || 0)));
  const mm = Math.max(0, Math.min(59, Number(m[2] || 0)));
  return { h: hh, m: mm };
}

const MedicalThaiTimePicker: React.FC<MedicalThaiTimePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'เลือกเวลา',
  disabled = false,
  required = false,
  error = false,
  helperText = '',
  name,
  className = '',
  showIcon = true,
  size = 'sm',
  mode = 'select',
  minuteStep = 1,
  medicalContext = 'general',
}) => {
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-5 py-3 text-lg'
  } as const;
  
  const iconSizes = { sm: 14, md: 16, lg: 18 } as const;

  // กำหนดสีตามบริบททางการแพทย์
  const contextColors = {
    appointment: {
      focus: 'focus:ring-teal-500 focus:border-teal-500',
      error: 'border-red-400 focus:ring-red-400 focus:border-red-400 bg-red-50',
      normal: 'border-slate-300 hover:border-teal-400',
      icon: 'text-teal-500'
    },
    medication: {
      focus: 'focus:ring-emerald-500 focus:border-emerald-500',
      error: 'border-red-400 focus:ring-red-400 focus:border-red-400 bg-red-50',
      normal: 'border-slate-300 hover:border-emerald-400',
      icon: 'text-emerald-500'
    },
    'vital-signs': {
      focus: 'focus:ring-blue-500 focus:border-blue-500',
      error: 'border-red-400 focus:ring-red-400 focus:border-red-400 bg-red-50',
      normal: 'border-slate-300 hover:border-blue-400',
      icon: 'text-blue-500'
    },
    surgery: {
      focus: 'focus:ring-red-500 focus:border-red-500',
      error: 'border-red-400 focus:ring-red-400 focus:border-red-400 bg-red-50',
      normal: 'border-slate-300 hover:border-red-400',
      icon: 'text-red-500'
    },
    general: {
      focus: 'focus:ring-indigo-500 focus:border-indigo-500',
      error: 'border-red-400 focus:ring-red-400 focus:border-red-400 bg-red-50',
      normal: 'border-slate-300 hover:border-indigo-400',
      icon: 'text-indigo-500'
    }
  };

  const colors = contextColors[medicalContext];

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => {
    const step = Math.max(1, Math.min(30, minuteStep));
    const arr: number[] = [];
    for (let m = 0; m < 60; m += step) arr.push(m);
    // รองรับค่านาทีที่ไม่ลงตัวกับ step
    const { m: curM } = splitHM(value);
    if (Number.isFinite(curM) && !arr.includes(curM)) arr.push(curM);
    return arr.sort((a,b)=>a-b);
  }, [minuteStep, value]);

  const { h, m } = splitHM(value);
  const isEmpty = !/^\d{1,2}:\d{2}$/.test(value || '');

  // เลือกไอคอนตาม context
  const IconComponent = medicalContext === 'vital-signs' ? Activity : Clock;

  return (
    <div className={`flex flex-col space-y-1.5 ${className}`}>
      {/* Label */}
      {label && (
        <label className={`font-semibold text-slate-700 ${size === 'sm' ? 'text-sm' : size === 'md' ? 'text-base' : 'text-lg'}`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* ------- โหมดดรอปดาวน์ 24 ชม. ------- */}
      {mode === 'select' ? (
        <div className="flex gap-3">
          {/* Hours */}
          <div className="relative flex-1">
            {showIcon && (
              <span
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center"
                aria-hidden="true"
              >
                <IconComponent size={iconSizes[size]} className={colors.icon} />
              </span>
            )}
            <select
              name={name ? `${name}-hour` : undefined}
              value={isEmpty ? '' : String(h)}
              disabled={disabled}
              required={required}
              onChange={(e) => {
                const hh = Number(e.target.value);
                onChange(`${pad2(hh)}:${pad2(Number.isFinite(m) ? m : 0)}`);
              }}
              className={`
                w-full border rounded-xl transition-all duration-200 font-medium
                focus:outline-none focus:ring-2 shadow-sm
                ${showIcon ? 'pl-10' : 'pl-3'} pr-8
                ${sizeClasses[size]}
                ${error
                  ? colors.error
                  : `${colors.normal} ${colors.focus}`
                }
                ${disabled 
                  ? 'bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200' 
                  : 'bg-white hover:shadow-md'
                }
              `}
              aria-invalid={error}
              aria-describedby={helperText ? `${name}-help` : undefined}
            >
              <option value="" disabled hidden className="text-slate-400">
                ชั่วโมง
              </option>
              {hours.map((hh) => (
                <option key={hh} value={String(hh)} className="text-slate-700">
                  {pad2(hh)} น.
                </option>
              ))}
            </select>
          </div>

          {/* Divider */}
          <div className="flex items-center px-2">
            <span className="text-slate-400 font-bold text-lg">:</span>
          </div>

          {/* Minutes */}
          <div className="relative flex-1">
            <select
              name={name ? `${name}-minute` : undefined}
              value={isEmpty ? '' : String(m)}
              disabled={disabled}
              required={required}
              onChange={(e) => {
                const mm = Number(e.target.value);
                onChange(`${pad2(Number.isFinite(h) ? h : 0)}:${pad2(mm)}`);
              }}
              className={`
                w-full border rounded-xl transition-all duration-200 font-medium
                focus:outline-none focus:ring-2 shadow-sm
                pl-3 pr-8
                ${sizeClasses[size]}
                ${error
                  ? colors.error
                  : `${colors.normal} ${colors.focus}`
                }
                ${disabled 
                  ? 'bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200' 
                  : 'bg-white hover:shadow-md'
                }
              `}
              aria-invalid={error}
              aria-describedby={helperText ? `${name}-help` : undefined}
            >
              <option value="" disabled hidden className="text-slate-400">
                นาที
              </option>
              {minutes.map((mm) => (
                <option key={mm} value={String(mm)} className="text-slate-700">
                  {pad2(mm)} น.
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        /* ------- โหมด native (type="time" + 24 ชม.) ------- */
        <div className="relative">
          {showIcon && (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center" aria-hidden="true">
              <IconComponent size={iconSizes[size]} className={colors.icon} />
            </span>
          )}
          <input
            type="time"
            name={name}
            value={value || ''}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            required={required}
            min="00:00"
            max="23:59"
            step={minuteStep * 60}
            lang="th-TH"
            inputMode="numeric"
            pattern="[0-2][0-9]:[0-5][0-9]"
            className={`
              w-full border rounded-xl transition-all duration-200 font-medium shadow-sm
              focus:outline-none focus:ring-2
              ${showIcon ? 'pl-10' : 'pl-3'} pr-3
              ${sizeClasses[size]}
              ${error
                ? colors.error
                : `${colors.normal} ${colors.focus}`
              }
              ${disabled
                ? 'bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200'
                : 'bg-white hover:shadow-md'
              }
            `}
            aria-invalid={error}
            aria-describedby={helperText ? `${name}-help` : undefined}
          />
        </div>
      )}

      {/* Helper Text / Error Message */}
      {helperText && (
        <span
          id={`${name}-help`}
          className={`text-xs font-medium ${error ? 'text-red-500' : 'text-slate-600'}`}
        >
          {helperText}
        </span>
      )}
    </div>
  );
};

export default MedicalThaiTimePicker;