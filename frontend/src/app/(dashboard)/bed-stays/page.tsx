'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BedDouble, Plus, ArrowLeftRight, History, X, CheckCircle2, LogOut, Users, Clock, Calendar, User, Stethoscope, Building2, AlertCircle, Check } from 'lucide-react';
import Modal from '@/app/components/ui/Modal';
import DatePickerField from '@/app/components/DatePicker';
import TimePicker from '@/app/components/TimePicker';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

type ServiceType = 'LTC' | 'PC';
type StayStatus = 'reserved' | 'occupied' | 'completed' | 'cancelled';

type Bed = { id: number; code: string; service_type: ServiceType };
type Occupancy = {
    id: number;
    bed_id: number;
    bed_code: string;
    service_type: ServiceType;
    patients_id: string; // HN
    pname?: string;
    first_name?: string;
    last_name?: string;
    start_at: string;
    end_at?: string | null;
    status: StayStatus;
    note?: string | null;
};

type Patient = {
    patients_id: string;
    pname?: string;
    first_name?: string;
    last_name?: string;
    phone_number?: string;
};

const $swal = Swal.mixin({
    confirmButtonText: 'ตกลง',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#6b7280',
});
const toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true,
    didOpen: (t) => {
        (t as any).onmouseenter = Swal.stopTimer;
        (t as any).onmouseleave = Swal.resumeTimer;
    },
});

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';
function joinUrl(base: string, path: string) {
    const b = base.replace(/\/$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${b}${p}`;
}
async function http<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    const finalUrl = /^https?:\/\//i.test(url) ? url : joinUrl(API_BASE, url);
    const res = await fetch(finalUrl, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        cache: 'no-store',
    });
    let data: any = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) data = await res.json().catch(() => null);
    else data = await res.text().catch(() => null);

    if (!res.ok) {
        const msg = (data && (data.message || data.error)) || `Request failed (${res.status})`;
        const err: any = new Error(msg);
        (err as any).status = res.status;
        throw err;
    }
    return data as T;
}

/* ---------------- Utils ---------------- */
const YMD = (d = new Date()) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d); // YYYY-MM-DD
const HM = (d = new Date()) =>
    new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
        .format(d).replace('.', ':');
const TH_DATETIME = (s?: string | null) => s ? new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium', timeStyle: 'short'
}).format(new Date(s)) : '-';

function normalizeHN(v: string) {
    const digits = v.replace(/\D/g, '');
    if (!digits) return '';
    return 'HN-' + digits.padStart(8, '0');
}
function toNumericId(v: string) {
    if (!v) return '';
    const t = String(v).trim().toUpperCase();
    if (/^\d+$/.test(t)) return t;
    const m = t.match(/\d+/g);
    if (!m) return '';
    const n = String(parseInt(m.join(''), 10));
    return n === 'NaN' ? '' : n;
}
function unwrapPatient(p: any) {
    return p?.data ?? p;
}
async function fetchPatientSmart(raw: string): Promise<Patient> {
    const hn = normalizeHN(raw);
    const num = toNumericId(raw);
    const attempts = [
        `/api/patients/${encodeURIComponent(hn)}`,
        num ? `/api/patients/${encodeURIComponent(num)}` : null,
    ].filter(Boolean) as string[];
    let lastErr: any = null;
    for (const url of attempts) {
        try {
            const res = await http(url);
            const patient = unwrapPatient(res);
            if (patient) return patient;
        } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('ไม่พบข้อมูลผู้ป่วย');
}

/* ---------------- Page ---------------- */
export default function BedStaysPage() {
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [serviceTab, setServiceTab] = useState<'ALL' | ServiceType>('ALL');

    const [occupancy, setOccupancy] = useState<Occupancy[]>([]);
    const [beds, setBeds] = useState<Bed[]>([]);
    const [hasBedsApi, setHasBedsApi] = useState(true); // ถ้า 404 จะสลับไปโหมดกรอก bed_id ตรงๆ

    // modals state
    const [openAssign, setOpenAssign] = useState(false);
    const [assign, setAssign] = useState({
        hn: '',
        patient: '' as string,
        verified: false,
        service_type: 'LTC' as ServiceType,
        bed_id: '' as string,    // select หรือกรอกเอง
        date: YMD(),
        time: HM(),
        note: '',
        saving: false,
    });

    const [openEnd, setOpenEnd] = useState<{ open: boolean, stay: Occupancy | null, date: string, time: string, reason: string, saving: boolean }>({
        open: false, stay: null, date: YMD(), time: HM(), reason: 'discharge', saving: false
    });

    const [openTransfer, setOpenTransfer] = useState<{ open: boolean, stay: Occupancy | null, to_bed_id: string, date: string, time: string, note: string, saving: boolean }>({
        open: false, stay: null, to_bed_id: '', date: YMD(), time: HM(), note: '', saving: false
    });

    const [openHistory, setOpenHistory] = useState<{ open: boolean, patient?: Patient | null, items: any[], loading: boolean, err: string }>({
        open: false, patient: null, items: [], loading: false, err: ''
    });

    // fetch

    async function fetchCurrent() {
        const data = await http<{ data: Occupancy[] }>('/api/bed_stays/current');
        setOccupancy(data.data || []);
    }
    async function fetchBedsMaybe() {
        try {
            const data = await http<{ data: Bed[] } | Bed[]>('/api/beds');
            const rawList = Array.isArray(data) ? data : (data as any).data;
            const list: Bed[] = (rawList || []).map((b: any) => ({
                id: Number(b.id ?? b.bed_id),
                code: String(b.code),
                // รองรับ API ที่ส่ง care_side หรือ service_type มาก็ได้ และกันค่าเพี้ยนให้เป็น 'PC' เป็นค่า default
                service_type: (b.service_type ?? b.care_side) === 'LTC' ? 'LTC' : 'PC',
            })).filter((b: Bed) => Number.isFinite(b.id));
            setBeds(list);
            setHasBedsApi(true);
        } catch (e: any) {
            if (e?.status === 404) {
                setHasBedsApi(false);
                setBeds([]); // โหมดกรอก id ตรงๆ
            } else {
                throw e;
            }
        }
    }


    useEffect(() => {
        (async () => {
            try {
                setLoading(true); setErr('');
                await fetchCurrent();
                await fetchBedsMaybe();
            } catch (e: any) {
                setErr(e?.message || 'โหลดข้อมูลไม่สำเร็จ');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const occupiedBedIds = useMemo(
        () =>
            new Set(
                (Array.isArray(occupancy) ? occupancy : [])
                    .filter(o => (o.status === 'reserved' || o.status === 'occupied') && !o.end_at)
                    .map(o => Number(o.bed_id))
            ),
        [occupancy]
    );

    const freeBeds = useMemo(() => {
        if (!hasBedsApi) return [];
        return beds.filter(b => !occupiedBedIds.has(b.id));
    }, [beds, occupiedBedIds, hasBedsApi]);

    const freeBedsByService = useMemo(() => {
        const map: Record<ServiceType, Bed[]> = { LTC: [], PC: [] };
        if (!hasBedsApi) return map;

        (freeBeds || []).forEach(b => {
            const key: ServiceType = b?.service_type === 'LTC' ? 'LTC' : 'PC';
            map[key].push(b);
        });
        return map;
    }, [freeBeds, hasBedsApi]);


    const occupancyGrouped = useMemo(() => {
        const list = serviceTab === 'ALL'
            ? (Array.isArray(occupancy) ? occupancy : [])
            : (Array.isArray(occupancy) ? occupancy : []).filter(o => o.service_type === serviceTab);

        const g: Record<ServiceType, Occupancy[]> = { LTC: [], PC: [] };
        list.forEach(o => {
            const key: ServiceType = o?.service_type === 'LTC' ? 'LTC' : 'PC';
            g[key].push(o);
        });
        (['LTC', 'PC'] as ServiceType[]).forEach(k => g[k].sort((a, b) => a.bed_code.localeCompare(b.bed_code, 'th')));
        return g;
    }, [occupancy, serviceTab]);


    // helpers
    function buildTs(date: string, time: string) {
        // ส่งเป็น "YYYY-MM-DD HH:mm" ให้ pg แปลงเป็น timestamptz ตาม timezone ของ server
        return `${date} ${time}`;
    }
    function fullName(p?: Patient | null) {
        if (!p) return '';
        return `${p.pname ?? ''}${p.first_name ?? ''} ${p.last_name ?? ''}`.replace(/\s+/g, ' ').trim();
    }

    /* ---------------- Assign / Occupy ---------------- */
    async function verifyHN() {
        try {
            const p = await fetchPatientSmart(assign.hn);
            setAssign(a => ({
                ...a,
                hn: p.patients_id || normalizeHN(a.hn),
                patient: fullName(p) || p.patients_id,
                verified: true,
            }));
            toast.fire({ icon: 'success', title: 'ตรวจสอบผู้ป่วยแล้ว' });
        } catch (e: any) {
            toast.fire({ icon: 'error', title: e?.message || 'ตรวจสอบไม่สำเร็จ' });
            setAssign(a => ({ ...a, verified: false, patient: '' }));
        }
    }
    function openAssignModal() {
        setAssign({
            hn: '',
            patient: '',
            verified: false,
            service_type: 'LTC',
            bed_id: '',
            date: YMD(),
            time: HM(),
            note: '',
            saving: false,
        });
        setOpenAssign(true);
    }
    async function saveAssign() {
        if (!assign.verified) { toast.fire({ icon: 'warning', title: 'กรุณาตรวจสอบ HN ก่อน' }); return; }
        if (!assign.bed_id) { toast.fire({ icon: 'warning', title: 'กรุณาเลือก/กรอกเตียง' }); return; }

        setAssign(a => ({ ...a, saving: true }));
        try {
            await http('/api/bed_stays', {
                method: 'POST',
                body: JSON.stringify({
                    bed_id: Number(assign.bed_id),
                    patients_id: assign.hn,
                    start_at: buildTs(assign.date, assign.time),
                    note: assign.note || null,
                }),
            });
            toast.fire({ icon: 'success', title: 'รับเข้าครองเตียงแล้ว' });
            setOpenAssign(false);
            await fetchCurrent();
        } catch (e: any) {
            toast.fire({ icon: 'error', title: e?.message || 'บันทึกไม่สำเร็จ' });
        } finally {
            setAssign(a => ({ ...a, saving: false }));
        }
    }

    /* ---------------- End Stay ---------------- */
    function openEndModal(stay: Occupancy) {
        setOpenEnd({ open: true, stay, date: YMD(), time: HM(), reason: 'discharge', saving: false });
    }
    async function saveEnd() {
        if (!openEnd.stay) return;
        const stayId = (openEnd.stay as any).id ?? (openEnd.stay as any).stay_id;
        if (!stayId) {
            toast.fire({ icon:'error', title:'ไม่พบรหัสการครองเตียง (stay_id)' });
            return;
        }
        setOpenEnd(s => ({ ...s, saving:true }));
        try {
            await http(`/api/bed_stays/${stayId}/end`, {
            method: 'PATCH',
            body: JSON.stringify({
                at: `${openEnd.date} ${openEnd.time}`,
                reason: openEnd.reason || null, // ส่งมาเป็น string/null ชัดๆ
            }),
            });
            toast.fire({ icon:'success', title:'สิ้นสุดการครองเตียงแล้ว' });
            setOpenEnd({ open:false, stay:null, date:YMD(), time:HM(), reason:'discharge', saving:false });
            await fetchCurrent();
        } catch (e:any) {
            toast.fire({ icon:'error', title: e?.message || 'ไม่สำเร็จ' });
            setOpenEnd(s => ({ ...s, saving:false }));
        }
        }

    /* ---------------- Transfer ---------------- */
    function openTransferModal(stay: Occupancy) {
        setOpenTransfer({
            open: true, stay,
            to_bed_id: '',
            date: YMD(), time: HM(),
            note: '', saving: false
        });
    }
    async function saveTransfer() {
        if (!openTransfer.stay) return;
        if (!openTransfer.to_bed_id) { toast.fire({ icon: 'warning', title: 'เลือกเตียงปลายทางก่อน' }); return; }
        setOpenTransfer(s => ({ ...s, saving: true }));
        try {
            await http(`/api/bed_stays/${openTransfer.stay.id}/transfer`, {
                method: 'POST',
                body: JSON.stringify({
                    to_bed_id: Number(openTransfer.to_bed_id),
                    at: buildTs(openTransfer.date, openTransfer.time),
                    note: openTransfer.note || null,
                }),
            });
            toast.fire({ icon: 'success', title: 'โอนย้ายเตียงเรียบร้อย' });
            setOpenTransfer({ open: false, stay: null, to_bed_id: '', date: YMD(), time: HM(), note: '', saving: false });
            await fetchCurrent();
        } catch (e: any) {
            toast.fire({ icon: 'error', title: e?.message || 'ไม่สำเร็จ' });
            setOpenTransfer(s => ({ ...s, saving: false }));
        }
    }

    /* ---------------- History ---------------- */
    async function openHistoryModal(hn: string) {
        setOpenHistory({ open: true, patient: null, items: [], loading: true, err: '' });
        try {
            const p = await fetchPatientSmart(hn);
            const res = await http<{ data: any[] }>(`/api/bed_stays/patients/${encodeURIComponent(p.patients_id)}/history`);
            setOpenHistory({ open: true, patient: p, items: res.data || [], loading: false, err: '' });
        } catch (e: any) {
            setOpenHistory({ open: true, patient: null, items: [], loading: false, err: e?.message || 'โหลดประวัติไม่สำเร็จ' });
        }
    }
    return (
        <div className="bg-gray-100 min-h-screen p-6 md:p-10 font-sans bg-[#f7f7fb] rounded-2xl">
            <div className="w-full mx-auto bg-[#f7f7fb]">

                {/* Header and Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <BedDouble className="w-10 h-10 text-purple-600" />
                        <h1 className="text-3xl font-bold text-gray-800">การจัดการเตียงผู้ป่วย</h1>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        {/* Tab Switcher */}
                        <div className="inline-flex rounded-full border border-gray-300 bg-white p-1">
                            {(['ALL', 'LTC', 'PC'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setServiceTab(t)}
                                    className={`
                                        px-4 py-2 text-sm font-medium rounded-full
                                        transition-colors duration-200
                                        ${serviceTab === t ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}
                                    `}
                                >
                                    {t === 'ALL' ? 'ทั้งหมด' : t}
                                </button>
                            ))}
                        </div>
                        {/* Main Action Button */}
                        <button
                            className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-600 to-purple-800 text-white font-medium shadow-lg hover:from-purple-700 hover:to-purple-900 transition-all duration-200"
                            onClick={openAssignModal}
                        >
                            <Plus size={18} /> รับเข้าครองเตียง
                        </button>
                    </div>
                </div>

                {/* Status Banners */}
                {err && (
                    <div className="p-4 rounded-xl border border-red-300 bg-red-50 text-red-700 mb-6 font-medium flex items-center gap-2">
                        <X size={20} className="text-red-500" /> {err}
                    </div>
                )}
                {!err && loading && (
                    <div className="p-4 rounded-xl border border-blue-300 bg-blue-50 text-blue-700 mb-6 font-medium flex items-center gap-2">
                        <div className="animate-spin h-5 w-5 rounded-full border-2 border-t-2 border-blue-500 border-t-transparent"></div>
                        กำลังโหลดข้อมูล...
                    </div>
                )}

                {/* Overview by service cards */}
                {!loading && !err && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {(['LTC', 'PC'] as ServiceType[]).map(svc => (
                            <div key={svc} className="rounded-3xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                                    <div className="text-lg font-semibold text-gray-800">{svc} — เตียงที่กำลังใช้งาน</div>
                                    <div className="text-base text-gray-500">
                                        ว่าง <span className="font-bold text-gray-700">{hasBedsApi ? freeBedsByService[svc].length : '-'}</span> เตียง
                                    </div>
                                </div>
                                <div className="divide-y divide-gray-200">
                                    {occupancyGrouped[svc].length === 0 && (
                                        <div className="p-6 text-base text-gray-500 text-center">
                                            ไม่มีผู้ป่วยครองเตียงอยู่ในขณะนี้
                                        </div>
                                    )}
                                    {occupancyGrouped[svc].map(o => (
                                        <div key={o.id ?? (o as any).stay_id ?? `${o.bed_id}-${o.patients_id}-${o.start_at}`} className="p-6 transition-colors hover:bg-gray-50">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <div className="text-sm font-bold text-white bg-purple-600 px-3 py-1 rounded-full">{o.bed_code}</div>
                                                    <div className="font-medium text-gray-800">
                                                        {`${o.pname ?? ''}${o.first_name ?? ''} ${o.last_name ?? ''}`.trim() || `ผู้ป่วย (${o.patients_id})`}
                                                        <span className="text-gray-500 font-normal ml-2 text-sm">({o.patients_id})</span>
                                                    </div>
                                                </div>
                                                <div className="text-sm text-gray-600 font-medium">
                                                    เริ่มเมื่อ: {TH_DATETIME(o.start_at)}
                                                </div>
                                            </div>
                                            {o.note && <div className="text-sm text-gray-700 mt-2 pl-2 border-l-2 border-gray-300">หมายเหตุ: {o.note}</div>}
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <button
                                                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 flex items-center gap-2 text-sm transition-colors"
                                                    onClick={() => openHistoryModal(o.patients_id)}
                                                >
                                                    <History size={16} /> ประวัติเตียง
                                                </button>
                                                <button
                                                    className="px-4 py-2 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 flex items-center gap-2 text-sm transition-colors"
                                                    onClick={() => openTransferModal(o)}
                                                >
                                                    <ArrowLeftRight size={16} /> โอนย้ายเตียง
                                                </button>
                                                <button
                                                    className="px-4 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 flex items-center gap-2 text-sm transition-colors"
                                                    onClick={() => openEndModal(o)}
                                                >
                                                    <LogOut size={16} /> สิ้นสุดการครองเตียง
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Assign Modal */}
                {openAssign && (
                    <Modal
                        open
                        size="lg"
                        onClose={() => setOpenAssign(false)}
                        onConfirm={saveAssign}
                        title={
                            <div className="flex items-center gap-2">
                                <Plus size={20} className="text-purple-600" />
                                <span className="font-bold">รับเข้าครองเตียง</span>
                            </div>
                        }
                        footer={
                            <div className="w-full flex flex-col sm:flex-row sm:justify-between items-center gap-2">
                                <div className="text-sm text-gray-500 hidden sm:block">ระบุ HN → ตรวจสอบ → เลือกเตียง</div>
                                <div className="flex gap-2">
                                    <button className="px-5 py-2 border rounded-lg text-gray-700 hover:bg-gray-100 flex items-center gap-2" onClick={() => setOpenAssign(false)} disabled={assign.saving}><X size={16} /> ยกเลิก</button>
                                    <button className="px-5 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60 flex items-center gap-2" onClick={saveAssign} disabled={assign.saving || !assign.verified}><CheckCircle2 size={16} /> บันทึก</button>
                                </div>
                            </div>
                        }
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="sm:col-span-2">
                                <div className="mb-1 text-sm text-gray-700 font-medium">รหัสผู้ป่วย (HN)</div>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                                        placeholder="เช่น HN-00000001"
                                        value={assign.hn}
                                        onChange={(e) => setAssign(a => ({ ...a, hn: e.target.value, verified: false, patient: '' }))}
                                        onBlur={(e) => setAssign(a => ({ ...a, hn: normalizeHN(e.target.value) }))}
                                    />
                                    <button className="px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors" type="button" onClick={verifyHN}>ตรวจสอบ</button>
                                </div>
                                {assign.patient && <div className="mt-2 text-sm text-gray-600">ผู้ป่วย: <span className="font-bold">{assign.patient}</span></div>}
                            </label>

                            <label>
                                <div className="mb-1 text-sm text-gray-700 font-medium">ประเภทฝั่งเตียง</div>
                                <select
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                                    value={assign.service_type}
                                    onChange={(e) => setAssign(a => ({ ...a, service_type: e.target.value as ServiceType, bed_id: '' }))}
                                >
                                    <option value="LTC">LTC</option>
                                    <option value="PC">PC</option>
                                </select>
                            </label>

                            {hasBedsApi ? (
                                <label>
                                    <div className="mb-1 text-sm text-gray-700 font-medium">เตียง (ว่าง)</div>
                                    <select
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                                        value={assign.bed_id}
                                        onChange={(e) => setAssign(a => ({ ...a, bed_id: e.target.value }))}
                                    >
                                        <option value="">— เลือกเตียง —</option>
                                        {freeBedsByService[assign.service_type].map(b => (
                                            <option key={b.id} value={b.id}>{b.code}</option>
                                        ))}
                                    </select>
                                    <div className="mt-1 text-xs text-gray-500">
                                        {freeBedsByService[assign.service_type].length > 0
                                            ? `* แสดงเฉพาะเตียงว่างของ ${assign.service_type}`
                                            : `* ยังไม่มีเตียงว่างในฝั่ง ${assign.service_type}`}
                                    </div>
                                </label>
                            ) : (
                                <label>
                                    <div className="mb-1 text-sm text-gray-700 font-medium">รหัสเตียง (กรอกเลข id)</div>
                                    <input
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                                        placeholder="เช่น 12"
                                        value={assign.bed_id}
                                        onChange={(e) => setAssign(a => ({ ...a, bed_id: e.target.value }))}
                                    />
                                    <div className="mt-1 text-xs text-gray-500">* ยังไม่มี API /api/beds ให้กรอก id ตรงๆ ชั่วคราว</div>
                                </label>
                            )}

                            <label>
                                <div className="mb-1 text-sm text-gray-700 font-medium">วันที่เริ่ม</div>
                                <DatePickerField value={assign.date} onChange={(d) => setAssign(a => ({ ...a, date: d }))} />
                            </label>
                            <label>
                                <div className="mb-1 text-sm text-gray-700 font-medium">เวลาเริ่ม</div>
                                <TimePicker value={assign.time} onChange={(t) => setAssign(a => ({ ...a, time: t }))} mode="select" />
                            </label>

                            <label className="sm:col-span-2">
                                <div className="mb-1 text-sm text-gray-700 font-medium">หมายเหตุ</div>
                                <input className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300" value={assign.note} onChange={(e) => setAssign(a => ({ ...a, note: e.target.value }))} />
                            </label>
                        </div>
                    </Modal>
                )}

                {/* End Modal */}
                {openEnd.open && openEnd.stay && (
                    <Modal
                        open
                        size="md"
                        onClose={() => setOpenEnd({ open: false, stay: null, date: YMD(), time: HM(), reason: 'discharge', saving: false })}
                        onConfirm={saveEnd}
                        title={
                            <div className="flex items-center gap-2">
                                <LogOut size={20} className="text-red-600" />
                                <span className="font-bold">สิ้นสุดการครองเตียง</span>
                            </div>
                        }
                        footer={
                            <div className="w-full flex justify-end gap-2">
                                <button className="px-5 py-2 border rounded-lg text-gray-700 hover:bg-gray-100 flex items-center gap-2" onClick={() => setOpenEnd({ open: false, stay: null, date: YMD(), time: HM(), reason: 'discharge', saving: false })} disabled={openEnd.saving}><X size={16} /> ยกเลิก</button>
                                <button className="px-5 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 flex items-center gap-2" onClick={saveEnd} disabled={openEnd.saving}><CheckCircle2 size={16} /> บันทึก</button>
                            </div>
                        }
                    >
                        <div className="space-y-4">
                            <div className="text-sm text-gray-600">
                                ผู้ป่วย <span className="font-bold text-gray-800">{`${openEnd.stay.pname ?? ''}${openEnd.stay.first_name ?? ''} ${openEnd.stay.last_name ?? ''}`.trim()}</span> ({openEnd.stay.patients_id})
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <label>
                                    <div className="mb-1 text-sm text-gray-700 font-medium">วันที่สิ้นสุด</div>
                                    <DatePickerField value={openEnd.date} onChange={(d) => setOpenEnd(s => ({ ...s, date: d }))} />
                                </label>
                                <label>
                                    <div className="mb-1 text-sm text-gray-700 font-medium">เวลาสิ้นสุด</div>
                                    <TimePicker value={openEnd.time} onChange={(t) => setOpenEnd(s => ({ ...s, time: t }))} mode="select" />
                                </label>
                            </div>
                            <label>
                                <div className="mb-1 text-sm text-gray-700 font-medium">เหตุผล</div>
                                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300" value={openEnd.reason} onChange={(e) => setOpenEnd(s => ({ ...s, reason: e.target.value }))}>
                                    <option value="discharge">จำหน่าย</option>
                                    <option value="death">เสียชีวิต</option>
                                    <option value="transfer">ย้ายเตียง</option>
                                    <option value="other">อื่นๆ</option>
                                </select>
                            </label>
                        </div>
                    </Modal>
                )}

                {/* Transfer Modal */}
                {openTransfer.open && openTransfer.stay && (
                    <Modal
                        open
                        size="lg"
                        onClose={() => setOpenTransfer({ open: false, stay: null, to_bed_id: '', date: YMD(), time: HM(), note: '', saving: false })}
                        onConfirm={saveTransfer}
                        title={
                            <div className="flex items-center gap-2">
                                <ArrowLeftRight size={20} className="text-amber-600" />
                                <span className="font-bold">โอนย้ายเตียง</span>
                            </div>
                        }
                        footer={
                            <div className="w-full flex justify-end gap-2">
                                <button className="px-5 py-2 border rounded-lg text-gray-700 hover:bg-gray-100 flex items-center gap-2" onClick={() => setOpenTransfer({ open: false, stay: null, to_bed_id: '', date: YMD(), time: HM(), note: '', saving: false })} disabled={openTransfer.saving}><X size={16} /> ยกเลิก</button>
                                <button className="px-5 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60 flex items-center gap-2" onClick={saveTransfer} disabled={openTransfer.saving}><CheckCircle2 size={16} /> บันทึก</button>
                            </div>
                        }
                    >
                        <div className="space-y-4">
                            <div className="text-sm text-gray-600">
                                ผู้ป่วย <span className="font-bold text-gray-800">{`${openTransfer.stay.pname ?? ''}${openTransfer.stay.first_name ?? ''} ${openTransfer.stay.last_name ?? ''}`.trim()}</span> ({openTransfer.stay.patients_id})
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <div className="mb-1 text-sm text-gray-700 font-medium">จากเตียง</div>
                                    <div className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 flex items-center gap-2 text-sm text-gray-600">
                                        <BedDouble size={16} />
                                        <span className="font-bold text-gray-800">{openTransfer.stay.bed_code}</span>
                                    </div>
                                </div>
                                <label>
                                    <div className="mb-1 text-sm text-gray-700 font-medium">ไปเตียง</div>
                                    {hasBedsApi ? (
                                        <select
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                                            value={openTransfer.to_bed_id}
                                            onChange={(e) => setOpenTransfer(s => ({ ...s, to_bed_id: e.target.value }))}
                                        >
                                            <option value="">— เลือกเตียงว่าง —</option>
                                            {freeBeds
                                                .filter(b => b.service_type === openTransfer.stay!.service_type)
                                                .map(b => <option key={b.id ?? (b as any).bed_id ?? b.code} value={b.id}>{b.code}</option>)}
                                        </select>
                                    ) : (
                                        <input
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                                            placeholder="กรอกรหัสเตียง (id)"
                                            value={openTransfer.to_bed_id}
                                            onChange={(e) => setOpenTransfer(s => ({ ...s, to_bed_id: e.target.value }))}
                                        />
                                    )}
                                </label>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <label>
                                    <div className="mb-1 text-sm text-gray-700 font-medium">วันที่ย้าย</div>
                                    <DatePickerField value={openTransfer.date} onChange={(d) => setOpenTransfer(s => ({ ...s, date: d }))} />
                                </label>
                                <label>
                                    <div className="mb-1 text-sm text-gray-700 font-medium">เวลาย้าย</div>
                                    <TimePicker value={openTransfer.time} onChange={(t) => setOpenTransfer(s => ({ ...s, time: t }))} mode="select" />
                                </label>
                            </div>
                            <label className="md:col-span-2">
                                <div className="mb-1 text-sm text-gray-700 font-medium">หมายเหตุ</div>
                                <input className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300" value={openTransfer.note} onChange={(e) => setOpenTransfer(s => ({ ...s, note: e.target.value }))} />
                            </label>
                        </div>
                    </Modal>
                )}

                {/* History Modal */}
                {openHistory.open && (
                    <Modal
                        open
                        size="xl"
                        onClose={() => setOpenHistory({ open: false, patient: null, items: [], loading: false, err: '' })}
                        title={
                            <div className="flex items-center gap-2">
                                <History size={20} className="text-blue-600" />
                                <span className="font-bold">ประวัติการครองเตียง</span>
                                <span className="text-gray-500 font-normal text-sm ml-1">
                                    — {fullName(openHistory.patient)} ({openHistory.patient?.patients_id || ''})
                                </span>
                            </div>
                        }
                        footer={
                            <div className="w-full flex justify-center">
                                <button className="px-8 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700" onClick={() => setOpenHistory({ open: false, patient: null, items: [], loading: false, err: '' })}><X size={16} /> ปิด</button>
                            </div>
                        }
                    >
                        {openHistory.loading && <div className="text-center p-4 text-gray-600">กำลังโหลด...</div>}
                        {!openHistory.loading && openHistory.err && <div className="text-center p-4 text-red-600">{openHistory.err}</div>}
                        {!openHistory.loading && !openHistory.err && (
                            <ul className="divide-y divide-gray-200">
                                {(openHistory.items || []).map((s: any) => (
                                    <li key={s.id ?? s.stay_id ?? `${s.bed_id}-${s.start_at}`} className="py-4">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="text-sm font-bold text-white bg-gray-700 px-3 py-1 rounded-full">{s.bed_code}</div>
                                            <div className="text-sm text-gray-600 font-medium">เริ่ม {TH_DATETIME(s.start_at)}</div>
                                            {s.end_at && <div className="text-sm text-gray-600 font-medium">สิ้นสุด {TH_DATETIME(s.end_at)}</div>}
                                            <div className="text-sm font-medium text-purple-600">{s.service_type}</div>
                                        </div>
                                        {s.note && <div className="text-sm text-gray-700 mt-2 pl-2 border-l-2 border-gray-300">หมายเหตุ: {s.note}</div>}
                                    </li>
                                ))}
                                {(!openHistory.items || openHistory.items.length === 0) && (
                                    <li className="py-4 text-center text-sm text-gray-500">ไม่มีประวัติการครองเตียงสำหรับผู้ป่วยรายนี้</li>
                                )}
                            </ul>
                        )}
                    </Modal>
                )}
            </div>
        </div>
    );
}
