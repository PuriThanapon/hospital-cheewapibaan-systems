'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Search, Printer, Download, Upload, X, Eye, FolderOpen, Plus, Filter } from 'lucide-react';
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

// ใช้เป็นแหล่งข้อมูลของ select
const Template_type = [
  { value: 'แบบฟอร์ม', label: 'แบบฟอร์ม', icon: '📄', color: 'bg-blue-100 text-blue-700' },
  { value: 'แบบประเมิน', label: 'แบบประเมิน', icon: '✅', color: 'bg-green-100 text-green-700' },
  { value: 'หนังสือ', label: 'หนังสือ', icon: '📜', color: 'bg-purple-100 text-purple-700' },
  { value: 'ใบรายงาน', label: 'ใบรายงาน', icon: '📊', color: 'bg-orange-100 text-orange-700' },
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
  const map: Record<string, { label: string; cls: string; icon: string }> = {
    db:       { label: 'Database', cls: 'bg-gray-100 text-gray-700', icon: '💾' },
    supabase: { label: 'Supabase', cls: 'bg-emerald-100 text-emerald-700', icon: '☁️' },
    drive:    { label: 'G-Drive', cls: 'bg-indigo-100 text-indigo-700', icon: '📁' },
  };
  const x = storage ? map[storage] : undefined;
  if (!x) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${x.cls}`}>
      <span>{x.icon}</span>
      {x.label}
    </span>
  );
}

// Badge แสดงหมวดหมู่
function CategoryBadge({ category }: { category?: string | null }) {
  if (!category) return null;
  const typeInfo = Template_type.find(t => t.value === category);
  const icon = typeInfo?.icon || '📄';
  const colorClass = typeInfo?.color || 'bg-gray-100 text-gray-700';
  
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${colorClass}`}>
      <span>{icon}</span>
      {category}
    </span>
  );
}

export default function TemplatesPage() {
  // list state
  const [rows, setRows] = useState<TemplateDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');

  // upload form state (อัปโหลด "เก็บลง DB" เท่านั้น)
  const [openUpload, setOpenUpload] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
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
      if (category.trim()) fd.append('category', category.trim());
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
    const { isConfirmed } = await Swal.fire({ 
      icon: 'warning', 
      title: 'ลบเอกสารนี้?', 
      text: 'การดำเนินการนี้ไม่สามารถย้อนกลับได้',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444'
    });
    if (!isConfirmed) return;
    try {
      await http(`/api/templates/${id}`, { method: 'DELETE' });
      fetchList();
      Swal.fire({ icon: 'success', title: 'ลบเรียบร้อยแล้ว' });
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: e.message || '' });
    }
  };

  // สถิติแสดงใน header
  const stats = useMemo(() => {
    const total = rows.length;
    const byCategory = Template_type.reduce((acc, type) => {
      acc[type.value] = rows.filter(r => r.category === type.value).length;
      return acc;
    }, {} as Record<string, number>);
    return { total, byCategory };
  }, [rows]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 lg:p-8 rounded-2xl">
      <div className="max-w-full mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-lg border-0 p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#005A50] rounded-lg">
                  <FolderOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">เอกสารแม่แบบ</h1>
                  <p className="text-sm text-gray-500">จัดเก็บและจัดการเอกสารแม่แบบสำหรับองค์กร</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">📁 {stats.total} เอกสาร</span>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full">🔍 Search & Filter</span>
              </div>
            </div>
            
            <button
              className="px-4 py-2 bg-gradient-to-r from-[#005A50] to-[#004A40] text-white rounded-lg hover:from-[#004A40] hover:to-[#003A30] shadow-md transition-all duration-200 flex items-center justify-center gap-2 min-w-[200px]"
              onClick={() => setOpenUpload(true)}
            >
              <Plus className="w-4 h-4" />
              อัปโหลดเอกสารแม่แบบ
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Template_type.map((type) => (
            <div key={type.value} className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{type.label}</p>
                  <p className="text-2xl font-bold text-gray-800">{stats.byCategory[type.value] || 0}</p>
                </div>
                <div className="text-2xl">{type.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Search & Filter Section */}
        <div className="bg-white rounded-2xl shadow-lg border-0 p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Filter className="w-5 h-5 text-[#005A50]" />
              ค้นหาและกรองเอกสาร
            </h3>
            
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005A50] focus:border-[#005A50] transition-colors"
                  placeholder="ค้นหาจากชื่อเอกสารหรือคำอธิบาย..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <select
                className="w-full md:w-48 px-3 py-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#005A50] focus:border-[#005A50] transition-colors"
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                aria-label="กรองตามหมวดหมู่"
              >
                <option value="">ทุกหมวดหมู่</option>
                {Template_type.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                ))}
              </select>

              <button
                className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                onClick={() => { setQ(''); setCat(''); }}
              >
                <X className="w-4 h-4" />
                ล้างตัวกรอง
              </button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="bg-white rounded-2xl shadow-lg border-0 overflow-hidden">
          {/* Results Header */}
          <div className="bg-gradient-to-r from-[#005A50] to-[#004A40] px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-white">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  รายการเอกสารแม่แบบ
                </h3>
                <p className="text-emerald-100 text-sm mt-1">
                  {cat ? `หมวดหมู่: ${Template_type.find(t => t.value === cat)?.label || cat}` : 'ทุกหมวดหมู่'}
                  {q && ` • ค้นหา: "${q}"`}
                </p>
              </div>
              <div className="flex items-center gap-4 text-white">
                <div className="text-center">
                  <div className="text-2xl font-bold">{rows.length}</div>
                  <div className="text-xs text-emerald-100">เอกสาร</div>
                </div>
                {loading && (
                  <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span className="text-sm">กำลังโหลด...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Documents Grid */}
          <div className="p-6">
            {loading && (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-[#005A50] border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-500">กำลังโหลดเอกสาร...</p>
              </div>
            )}
            
            {!loading && rows.length === 0 && (
              <div className="text-center py-12">
                <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-600 mb-2">ไม่มีเอกสารแม่แบบ</h4>
                <p className="text-gray-500 mb-6">
                  {q || cat ? 'ไม่พบเอกสารที่ตรงกับเงื่อนไขการค้นหา' : 'ยังไม่มีเอกสารแม่แบบในระบบ'}
                </p>
                {!q && !cat && (
                  <button
                    className="px-4 py-2 bg-[#005A50] text-white rounded-lg hover:bg-[#004A40] transition-colors"
                    onClick={() => setOpenUpload(true)}
                  >
                    อัปโหลดเอกสารแรก
                  </button>
                )}
              </div>
            )}
            
            {!loading && rows.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rows.map((r) => (
                  <div key={r.id} className="group bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-[#005A50]/20 transition-all duration-200">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#005A50] to-[#004A40] flex items-center justify-center flex-shrink-0">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-800 truncate group-hover:text-[#005A50] transition-colors">
                          {r.title}
                        </h4>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <CategoryBadge category={r.category} />
                          <StorageBadge storage={r.storage} />
                        </div>
                        {r.description && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2 leading-relaxed">
                            {r.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <a
                        href={fileUrl(r.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
                        title="เปิดดู"
                      >
                        <Eye className="w-4 h-4" />
                        เปิดดู
                      </a>
                      <a
                        href={fileUrl(r.id, { download: true })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium"
                        title="ดาวน์โหลด"
                      >
                        <Download className="w-4 h-4" />
                        ดาวน์โหลด
                      </a>
                      <button
                        className="flex items-center justify-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
                        onClick={() => handleDelete(r.id)}
                        title="ลบ"
                      >
                        <X className="w-4 h-4" />
                        ลบ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {openUpload && (
        <div className="fixed inset-0 z-[12000] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-[#005A50]" />
                  อัปโหลดเอกสารแม่แบบ
                </h3>
                <button 
                  onClick={() => { setOpenUpload(false); resetUpload(); }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อเอกสาร <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005A50] focus:border-[#005A50] transition-colors"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="เช่น แบบฟอร์มขอรับบริการ..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">หมวดหมู่</label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#005A50] focus:border-[#005A50] transition-colors"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">— เลือกหมวดหมู่ —</option>
                  {Template_type.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">คำอธิบาย</label>
                <textarea
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005A50] focus:border-[#005A50] transition-colors resize-none"
                  rows={3}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="รายละเอียดสั้น ๆ เช่น ใช้กับแผนก... เวอร์ชัน..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ไฟล์เอกสาร <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="w-full px-4 py-3 border-2 border-dashed border-[#005A50]/30 rounded-lg focus:border-[#005A50] transition-colors bg-[#005A50]/5 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#005A50] file:text-white hover:file:bg-[#004A40] file:transition-colors"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-gray-500 mt-2 flex items-start gap-1">
                  <span>💡</span>
                  <span>แนะนำอัปโหลดเป็น PDF เพื่อให้พิมพ์ได้ตรงแบบ (รูปก็ได้ แต่ .docx จะพิมพ์ผ่านเบราว์เซอร์ไม่ได้)</span>
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button 
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => { setOpenUpload(false); resetUpload(); }}
              >
                ยกเลิก
              </button>
              <button 
                className="px-6 py-2 bg-gradient-to-r from-[#005A50] to-[#004A40] text-white rounded-lg hover:from-[#004A40] hover:to-[#003A30] transition-all duration-200 shadow-md flex items-center gap-2"
                onClick={handleUpload}
              >
                <Upload className="w-4 h-4" />
                อัปโหลด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}