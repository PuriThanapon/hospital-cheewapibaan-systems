import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';

interface ThaiTimePickerProps {
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

const ThaiTimePicker: React.FC<ThaiTimePickerProps> = ({
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
}) => {
  const sizeClasses = {
    sm: 'px-2 py-1.5 text-sm',
    md: 'px-3 py-2 text-base',
    lg: 'px-4 py-2 text-lg'
  } as const;
  const iconSizes = { sm: 12, md: 14, lg: 16 } as const;

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => {
    const step = Math.max(1, Math.min(30, minuteStep));
    const arr: number[] = [];
    for (let m = 0; m < 60; m += step) arr.push(m);
    // ให้รองรับค่านาทีที่ไม่ลงตัวกับ step
    const { m: curM } = splitHM(value);
    if (Number.isFinite(curM) && !arr.includes(curM)) arr.push(curM);
    return arr.sort((a,b)=>a-b);
  }, [minuteStep, value]);

  const { h, m } = splitHM(value);
  const isEmpty = !/^\d{1,2}:\d{2}$/.test(value || '');

  return (
    <div className={`flex flex-col space-y-1 ${className}`}>
      {/* Label */}
      {label && (
        <label className={`font-medium text-gray-700 ${size === 'sm' ? 'text-sm' : 'text-base'}`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* ------- โหมดดรอปดาวน์ 24 ชม. ------- */}
      {mode === 'select' ? (
        <div className="flex gap-2">
          {/* Hours (มีไอคอนอยู่ในนี้เท่านั้น) */}
          <div className="relative">
            {showIcon && (
              <span
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center"
                aria-hidden="true"
              >
                <Clock size={iconSizes[size]} className="text-gray-400" />
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
                border rounded-lg transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                ${showIcon ? 'pl-10' : 'pl-3'} pr-3
                ${sizeClasses[size]}
                ${error
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50'
                  : 'border-gray-300 hover:border-gray-400'
                }
                ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-400 border-gray-200' : 'bg-white'}
              `}
              aria-invalid={error}
              aria-describedby={helperText ? `${name}-help` : undefined}
              style={{ minWidth: 110 }}
            >
              <option value="" disabled hidden>{placeholder}</option>
              {hours.map((hh) => (
                <option key={hh} value={String(hh)}>{pad2(hh)}</option>
              ))}
            </select>
          </div>

          {/* Divider */}
          <div className="flex items-center px-1 text-gray-400">:</div>

          {/* Minutes */}
          <div className="relative">
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
                border rounded-lg transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                pl-3 pr-3
                ${sizeClasses[size]}
                ${error
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50'
                  : 'border-gray-300 hover:border-gray-400'
                }
                ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-400 border-gray-200' : 'bg-white'}
              `}
              aria-invalid={error}
              aria-describedby={helperText ? `${name}-help` : undefined}
              style={{ minWidth: 110 }}
            >
              <option value="" disabled hidden>{placeholder}</option>
              {minutes.map((mm) => (
                <option key={mm} value={String(mm)}>{pad2(mm)}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        /* ------- โหมด native (type="time" + 24 ชม.) ------- */
        <div className="relative">
          {showIcon && (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center" aria-hidden="true">
              <Clock size={iconSizes[size]} className="text-gray-400" />
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
            step={minuteStep * 60}     // step เป็นวินาที
            lang="th-TH"
            inputMode="numeric"
            pattern="[0-2][0-9]:[0-5][0-9]"
            className={`
              w-full border rounded-lg transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              ${showIcon ? 'pl-10' : 'pl-3'} pr-3
              ${sizeClasses[size]}
              ${error
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50'
                : 'border-gray-300 hover:border-gray-400'
              }
              ${disabled
                ? 'bg-gray-100 cursor-not-allowed text-gray-400 border-gray-200'
                : 'bg-white'
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
          className={`text-xs ${error ? 'text-red-500' : 'text-gray-500'}`}
        >
          {helperText}
        </span>
      )}
    </div>
  );
};

/* Optional: Wrapper */
interface InputFieldProps {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  icon,
  children,
  className = '',
  required = false
}) => {
  return (
    <div className={`flex flex-col space-y-2 ${className}`}>
      <div className="flex items-center gap-2 text-gray-700 font-medium">
        {icon}
        <span>{label}</span>
        {required && <span className="text-red-500">*</span>}
      </div>
      {children}
    </div>
  );
};

export default ThaiTimePicker;
