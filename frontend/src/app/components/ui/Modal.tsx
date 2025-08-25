'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export type ModalProps = {
  open: boolean;
  title?: React.ReactNode;
  onClose?: () => void;
  onConfirm?: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** sm= max-w-md, md= max-w-2xl, lg= max-w-4xl, xl= max-w-6xl */
  size?: ModalSize;
  /** extra class สำหรับ body ของ modal */
  bodyClassName?: string;
  /** querySelector ภายในแผงโมดัล สำหรับโฟกัสครั้งแรก */
  initialFocusSelector?: string;
  /** z-index ของ overlay (ใช้ inline style) */
  zIndex?: number;
  /** คลิกพื้นหลังเพื่อปิด (default: true) */
  closeOnBackdrop?: boolean;
  /** ซ่อนปุ่มปิดมุมขวา (default: false) */
  hideHeaderClose?: boolean;
};

const FOCUS_SELECTOR =
  'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';

export default function Modal({
  open,
  title,
  onClose,
  onConfirm,
  children,
  footer,
  size = 'md',
  bodyClassName,
  initialFocusSelector,
  zIndex = 10000,              // overlay ของเรา
  closeOnBackdrop = true,
  hideHeaderClose = false,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const hasFocused = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  // lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // ESC เพื่อปิด
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  // โฟกัสครั้งแรกเมื่อเปิด
  useEffect(() => {
    if (!open) { hasFocused.current = false; return; }
    if (hasFocused.current) return;
    const root = panelRef.current; if (!root) return;
    const first = initialFocusSelector
      ? (root.querySelector(initialFocusSelector) as HTMLElement | null)
      : (root.querySelector(FOCUS_SELECTOR) as HTMLElement | null);
    requestAnimationFrame(() => { first?.focus?.(); });
    hasFocused.current = true;
  }, [open, initialFocusSelector]);

  // focus trap + Enter = confirm (เว้น input/select/textarea/CE และ data-skip-enter-confirm)
  useEffect(() => {
    if (!open) return;
    const root = panelRef.current; if (!root) return;

    const focusables = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUS_SELECTOR))
        .filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1);

    const onKey = (e: KeyboardEvent) => {
      if ((e as any).isComposing || (e as any).keyCode === 229) return;

      if (e.key === 'Tab') {
        const f = focusables(); if (f.length === 0) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
        }
      }

      if (e.key === 'Enter' && onConfirm) {
        const target = e.target as HTMLElement | null;
        const tag = (target?.tagName || '').toLowerCase();
        const isFormField =
          tag === 'textarea' ||
          tag === 'input' ||
          tag === 'select' ||
          (target && target.isContentEditable) ||
          // ให้ component ภายในบอกว่าอย่า confirm ด้วย Enter
          !!target?.closest?.('[data-skip-enter-confirm]');

        if (!isFormField) {
          e.preventDefault();
          onConfirm();
        }
      }
    };

    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [open, onConfirm]);

  if (!open || !mounted) return null;

  const sizeCls =
    size === 'sm' ? 'max-w-md' :
    size === 'lg' ? 'max-w-4xl' :
    size === 'xl' ? 'max-w-6xl' : 'max-w-2xl';

  const node = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ zIndex }}
      onMouseDown={(e) => {
        if (!closeOnBackdrop) return;
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        className={`bg-white rounded-2xl shadow-2xl ${sizeCls} w-full max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            {title}
          </h2>
          {!hideHeaderClose && (
            <button
              type="button"
              className="p-2 hover:bg-white/80 rounded-full transition-colors duration-200 group"
              onClick={onClose}
              aria-label="ปิด"
            >
              <X size={20} className="text-gray-600 group-hover:text-gray-800" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className={`flex-1 overflow-auto p-6 ${bodyClassName || ''}`}>
          {children}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex items-center justify-between gap-4">
          {footer}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
