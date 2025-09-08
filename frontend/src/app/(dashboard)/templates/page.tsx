'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Search, Printer, Download, Upload, X, Eye } from 'lucide-react';
import Swal from 'sweetalert2';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';
const joinUrl = (b: string, p: string) => `${b.replace(/\/$/, '')}${p.startsWith('/') ? '' : '/'}${p}`;

type TemplateDoc = {
  id: number;
  title: string;
  category?: string | null;
  description?: string | null;
  mime?: string | null;
  filename?: string | null;
  created_at?: string;
  updated_at?: string;

  // รองรับหลายแหล่งเก็บไฟล์ (ต้องให้ backend SELECT มาด้วย)
  storage?: 'db' | 'supabase' | 'drive' | null;
  sb_bucket?: string | null;
  sb_path?: string | null;
  drive_file_id?: string | null;
};

// ✔ ใช้เป็นแหล่งข้อมูลของ select
const Template_type = [
  { value: 'แบบฟอร์ม', label: 'แบบฟอร์ม' },
  { value: 'แบบประเมิน', label: 'แบบประเมิน' },
  { value: 'หนังสือ', label: 'หนังสือ' },
  { value: 'ใบรายงาน', label: 'ใบรายงาน' },
];

export function fileUrl(id: number | string, opts?: { download?: boolean }) {
  const u = new URL(`${API_BASE}/api/templates/${id}/file`);
  if (opts?.download) u.searchParams.set('download', '1');
  return u.toString();
}

const http = async (url: string, options: any = {}) => {
  const finalUrl = /^https?:\/\//i.test(url) ? url : joinUrl(API_BASE, url);
  const headers = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
  const res = await fetch(finalUrl, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!res.ok) {
    let msg = 'Request failed';
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  if (res.status === 204) return null;
  if (ct.includes('application/json')) return res.json();
  return res.text();
};

// Badge แสดงแหล่งที่มา
function StorageBadge({ storage }: { storage?: TemplateDoc['storage'] }) {
  const map: Record<string, { label: string; cls: string }> = {
    db:       { label: 'จากฐานข้อมูล',    cls: 'bg-gray-100 text-gray-700' },
    supabase: { label: 'จาก Supabase',     cls: 'bg-emerald-100 text-emerald-700' },
    drive:    { label: 'จาก Google Drive', cls: 'bg-indigo-100 text-indigo-700' },
  };
  const x = storage ? map[storage] : undefined;
  if (!x) return null;
  return <span className={`text-[11px] px-2 py-0.5 rounded ${x.cls}`}>{x.label}</span>;
}

export default function TemplatesPage() {
  // list state
  const [rows, setRows] = useState<TemplateDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(''); // ✔ ใช้กับ select ตัวกรอง

  // upload form state (อัปโหลด “เก็บลง DB” เท่านั้น)
  const [openUpload, setOpenUpload] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(''); // ✔ ใช้กับ select ในโมดัล
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set('query', q.trim());
    if (cat.trim()) sp.set('category', cat.trim());
    return sp.toString();
  }, [q, cat]);

  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await http(`/api/templates${qs ? `?${qs}` : ''}`);
      setRows(data.data || []);
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'โหลดรายการเอกสารไม่สำเร็จ', text: e.message || '' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchList(); }, [qs]);

  const resetUpload = () => { setTitle(''); setCategory(''); setDesc(''); setFile(null); };

  const handleUpload = async () => {
    if (!title.trim()) {
      Swal.fire({ icon: 'warning', title: 'กรุณากรอกชื่อเอกสาร' });
      return;
    }
    if (!file) {
      Swal.fire({ icon: 'warning', title: 'กรุณาเลือกไฟล์' });
      return;
    }
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      if (category.trim()) fd.append('category', category.trim()); // ✔ ค่ามาจาก select
      if (desc.trim()) fd.append('description', desc.trim());
      fd.append('file', file);

      await http('/api/templates', { method: 'POST', body: fd });
      setOpenUpload(false);
      resetUpload();
      fetchList();
      Swal.fire({ icon: 'success', title: 'อัปโหลดสำเร็จ' });
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'อัปโหลดไม่สำเร็จ', text: e.message || '' });
    }
  };

  const handleDelete = async (id: number) => {
    const { isConfirmed } = await Swal.fire({ icon: 'warning', title: 'ลบเอกสารนี้?', showCancelButton: true });
    if (!isConfirmed) return;
    try {
      await http(`/api/templates/${id}`, { method: 'DELETE' });
      fetchList();
      Swal.fire({ icon: 'success', title: 'ลบแล้ว' });
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: e.message || '' });
    }
  };

  return (
    <div className="h-full p-6 w-full mx-auto bg-[#f4f4f4] rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-bold">เอกสารแม่แบบ</h1>
          <p className="text-gray-500 text-sm">เก็บ • เลือก • พรีวิว • พิมพ์ • ดาวน์โหลด</p>
        </div>
        <button
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => setOpenUpload(true)}
        >
          <Upload size={16}/> อัปโหลดเอกสารแม่แบบ
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input
              className="w-full pl-9 pr-3 py-2 border rounded-lg"
              placeholder="ค้นหาจากชื่อเอกสารหรือคำอธิบาย"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* ✔ เปลี่ยนเป็น select สำหรับตัวกรองหมวดหมู่ */}
          <select
            className="w-48 px-3 py-2 border rounded-lg bg-white"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            aria-label="กรองตามหมวดหมู่"
          >
            <option value="">ทุกหมวดหมู่</option>
            {Template_type.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button
            className="px-3 py-2 border rounded-lg hover:bg-gray-50"
            onClick={() => { setQ(''); setCat(''); }}
          >
            ล้าง
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && (
          <div className="col-span-full text-gray-500">กำลังโหลด...</div>
        )}
        {!loading && rows.length === 0 && (
          <div className="col-span-full text-gray-500">ยังไม่มีเอกสารแม่แบบ</div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="p-4 rounded-xl border bg-white flex flex-col">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileText size={18} className="text-blue-600"/>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-semibold">{r.title}</div>
                  <StorageBadge storage={r.storage}/>
                </div>
                <div className="text-xs text-gray-500">
                  {r.category ? `หมวด: ${r.category}` : 'ไม่มีหมวดหมู่'}
                </div>
                {r.description && (
                  <div className="text-sm text-gray-600 mt-1 line-clamp-2">{r.description}</div>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              <a
                href={fileUrl(r.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                title="เปิดดู"
              >
                <Eye size={16}/> เปิดดู
              </a>
              <a
                href={fileUrl(r.id, { download: true })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50"
                title="ดาวน์โหลด"
              >
                <Download size={16}/> ดาวน์โหลด
              </a>

              <button
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => handleDelete(r.id)}
                title="ลบ"
              >
                <X size={16}/> ลบ
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Upload Modal (อัปโหลดเข้า DB เท่านั้น) */}
      {openUpload && (
        <div className="fixed inset-0 z-[12000] bg-black/50 flex items-center justify-center">
          <div className="w-[92vw] max-w-lg bg-white rounded-xl p-5">
            <div className="text-lg font-semibold mb-3">อัปโหลดเอกสารแม่แบบ</div>

            <div className="space-y-3">
              <div>
                <div className="text-sm mb-1">ชื่อเอกสาร *</div>
                <input
                  className="w-full px-3 py-2 border rounded-lg"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="เช่น แบบฟอร์มขอรับบริการ..."
                />
              </div>

              {/* ✔ select สำหรับเลือกหมวดหมู่ */}
              <div>
                <div className="text-sm mb-1">หมวดหมู่</div>
                <select
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  aria-label="เลือกหมวดหมู่"
                >
                  <option value="">— เลือกหมวดหมู่ —</option>
                  {Template_type.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-sm mb-1">คำอธิบาย</div>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="รายละเอียดสั้น ๆ เช่น ใช้กับแผนก... เวอร์ชัน..."
                />
              </div>
              <div>
                <div className="text-sm mb-1">ไฟล์ *</div>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <div className="text-xs text-gray-500 mt-1">
                  แนะนำอัปโหลดเป็น PDF เพื่อให้พิมพ์ได้ตรงแบบ (รูปก็ได้ แต่ .docx จะพิมพ์ผ่านเบราว์เซอร์ไม่ได้)
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button className="px-4 py-2 border rounded-lg" onClick={() => { setOpenUpload(false); resetUpload(); }}>
                ยกเลิก
              </button>
              <button className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={handleUpload}>
                อัปโหลด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
