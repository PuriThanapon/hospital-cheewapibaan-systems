'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import styles from './diagnosis.module.css'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

type DxStatus = 'active' | 'resolved' | 'inactive'
type DxType = 'principal' | 'secondary' | 'complication' | 'external_cause'
type Verification = 'confirmed' | 'presumed' | 'ruled_out'

type Diagnosis = {
  diag_id: number | string
  patients_id: string
  encounter_id?: number | null
  code: string | null
  term: string
  dx_type?: DxType | null
  is_primary?: boolean
  verification_status?: Verification | null
  diagnosed_at?: string | null
  onset_date: string | null
  status: DxStatus
  created_at: string
  updated_at: string
}

type Patient = {
  patients_id: string
  first_name: string | null
  last_name: string | null
  gender?: string | null
  birthdate?: string | null
  phone_number?: string | null
}

const STATUS_LABEL: Record<DxStatus, string> = {
  active: 'กำลังรักษา',
  resolved: 'หายแล้ว',
  inactive: 'ยกเลิกติดตาม',
}
const DTYPE_LABEL: Record<DxType, string> = {
  principal: 'โรคหลัก',
  secondary: 'โรคร่วม',
  complication: 'ภาวะแทรกซ้อน',
  external_cause: 'สาเหตุภายนอก',
}
const VERI_LABEL: Record<Verification, string> = {
  confirmed: 'ยืนยันแล้ว',
  presumed: 'สงสัย/คาดว่า',
  ruled_out: 'ตัดออก',
}

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  timer: 2300,
  timerProgressBar: true,
  showConfirmButton: false,
})

const API_BASE = (
  (process as any).env.NEXT_PUBLIC_API_BASE ||
  (process as any).env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000'
).replace(/\/$/, '')

const ENDPOINTS = {
  getPatient: (id: string) => `${API_BASE}/api/patients/${encodeURIComponent(id)}`,
  listDx: (id: string) => `${API_BASE}/api/patient_diagnosis?patients_id=${encodeURIComponent(id)}`,
  createDx: () => `${API_BASE}/api/patient_diagnosis`,
  updateDx: (diag_id: number | string) => `${API_BASE}/api/patient_diagnosis/${diag_id}`,
  deleteDx: (diag_id: number | string) => `${API_BASE}/api/patient_diagnosis/${diag_id}`,
}

function fmtDate(d?: string | null) {
  if (!d) return '-'
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString()
}
function calculateAge(birthdateStr) {
  if (!birthdateStr) return '-';
  const birthDate = new Date(birthdateStr);
  if (isNaN(birthDate.getTime())) return '-';
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
    years--;
    months = 12 + months;
  }
  if (today.getDate() < birthDate.getDate() && months > 0) months--;
  if (years > 0) return `${years} ปี`;
  if (months > 0) return `${months} เดือน`;
  return `0 เดือน`;
}

export default function PatientDiagnosisPage() {
  const { hn } = useParams<{ hn: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()

  const encounterParam = searchParams.get('encounter') ?? searchParams.get('enc_id') ?? searchParams.get('enc')
  const defaultEncounterId = encounterParam ? Number(encounterParam) : undefined

  const [patientsId, setPatientsId] = useState<string>(hn || '')
  useEffect(() => { setPatientsId(hn || '') }, [hn])

  const [patient, setPatient] = useState<Patient | null>(null)
  const [items, setItems] = useState<Diagnosis[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DxStatus>('all')
  const [dxTypeFilter, setDxTypeFilter] = useState<'all' | DxType>('all')

  async function loadAll() {
    if (!patientsId) return
    try {
      setLoading(true)
      setMessage(null)
      const [pRes, dRes] = await Promise.all([
        fetch(ENDPOINTS.getPatient(patientsId), { cache: 'no-store' }),
        fetch(ENDPOINTS.listDx(patientsId), { cache: 'no-store' }),
      ])
      const raw = dRes.ok ? await dRes.json() : []
      const mapped: Diagnosis[] = (raw || []).map((x: Diagnosis) => ({
        ...x,
        dx_type: x.dx_type ?? (x.is_primary ? 'principal' : 'secondary'),
      }))
      setPatient(pRes.ok ? await pRes.json() : null)
      setItems(mapped)
      if (!pRes.ok && !dRes.ok) {
        setMessage('โหลดข้อมูลไม่สำเร็จ')
        await Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ' })
      }
    } catch (err: any) {
      const msg = err?.message || 'โหลดข้อมูลไม่สำเร็จ'
      setMessage(msg)
      await Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: msg })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadAll() }, [patientsId])

  const filtered = useMemo(() => {
    let list = items
    const s = q.trim().toLowerCase()
    if (s) list = list.filter((x) => (x.code || '').toLowerCase().includes(s) || x.term.toLowerCase().includes(s))
    if (statusFilter !== 'all') list = list.filter((x) => x.status === statusFilter)
    if (dxTypeFilter !== 'all') list = list.filter((x) => (x.dx_type ?? 'secondary') === dxTypeFilter)
    return list.sort((a, b) =>
      Number((b.dx_type ?? 'secondary') === 'principal') - Number((a.dx_type ?? 'secondary') === 'principal') ||
      (b.created_at > a.created_at ? 1 : -1)
    )
  }, [items, q, statusFilter, dxTypeFilter])

  const summary = useMemo(() => {
    const total = items.length
    const active = items.filter((x) => x.status === 'active').length
    const resolved = items.filter((x) => x.status === 'resolved').length
    const inactive = items.filter((x) => x.status === 'inactive').length
    return { total, active, resolved, inactive }
  }, [items])

  // ---------- Dialog (SweetAlert) ----------
  async function openDxDialog(initial?: Partial<Diagnosis>) {
    const v = {
      code: initial?.code ?? '',
      term: initial?.term ?? '',
      diagnosed_at: (initial?.diagnosed_at as string) ?? '',
      onset_date: (initial?.onset_date as string) ?? '',
      dx_type: (initial?.dx_type ??
        (initial?.is_primary ? 'principal' : 'secondary') ??
        'secondary') as DxType,
      verification_status: (initial?.verification_status ?? 'confirmed') as Verification,
      status: (initial?.status ?? 'active') as DxStatus,
    }

    const html = `
      <div class="grid grid-cols-1 gap-4 p-4">
      <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-1 block">ICD-10-TM</span>
        <input 
          id="dx-code" 
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
          placeholder="เช่น E11.9" 
          value="${v.code ?? ''}"
        >
      </label>
      
      <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-1 block">คำวินิจฉัย</span>
        <input 
          id="dx-term" 
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
          placeholder="เช่น เบาหวานชนิดที่ 2" 
          value="${v.term ?? ''}"
        >
      </label>
      
      <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-1 block">วันที่ให้บริการ</span>
        <input 
          id="dx-dateserv" 
          type="date" 
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          value="${v.diagnosed_at ?? ''}"
        >
      </label>
      
      <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-1 block">วันที่เริ่มเป็น</span>
        <input 
          id="dx-onset" 
          type="date" 
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          value="${v.onset_date ?? ''}"
        >
      </label>
      
      <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-1 block">ชนิดการวินิจฉัย</span>
        <select 
          id="dx-type" 
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
        >
          <option value="principal" ${v.dx_type === 'principal' ? 'selected' : ''}>โรคหลัก (Principal)</option>
          <option value="secondary" ${v.dx_type === 'secondary' ? 'selected' : ''}>โรคร่วม (Secondary)</option>
          <option value="complication" ${v.dx_type === 'complication' ? 'selected' : ''}>ภาวะแทรกซ้อน</option>
          <option value="external_cause" ${v.dx_type === 'external_cause' ? 'selected' : ''}>สาเหตุภายนอก</option>
        </select>
      </label>
      
      <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-1 block">ยืนยันผล</span>
        <select 
          id="dx-veri" 
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
        >
          <option value="confirmed" ${v.verification_status === 'confirmed' ? 'selected' : ''}>ยืนยันแล้ว</option>
          <option value="presumed" ${v.verification_status === 'presumed' ? 'selected' : ''}>สงสัย/คาดว่า</option>
          <option value="ruled_out" ${v.verification_status === 'ruled_out' ? 'selected' : ''}>ตัดออก</option>
        </select>
      </label>
      
      <label class="block">
        <span class="text-sm font-medium text-gray-700 mb-1 block">สถานะ</span>
        <select 
          id="dx-status" 
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
        >
          <option value="active" ${v.status === 'active' ? 'selected' : ''}>กำลังรักษา</option>
          <option value="resolved" ${v.status === 'resolved' ? 'selected' : ''}>หายแล้ว</option>
          <option value="inactive" ${v.status === 'inactive' ? 'selected' : ''}>ยกเลิกติดตาม</option>
        </select>
      </label>
    </div>
    `

    const result = await Swal.fire({
      title: initial?.diag_id ? 'แก้ไขการวินิจฉัย' : 'เพิ่มการวินิจฉัย',
      html,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: initial?.diag_id ? 'บันทึก' : 'เพิ่ม',
      cancelButtonText: 'ยกเลิก',
      preConfirm: () => {
        const code = (document.getElementById('dx-code') as HTMLInputElement)?.value.trim()
        const term = (document.getElementById('dx-term') as HTMLInputElement)?.value.trim()
        const diagnosed_at = (document.getElementById('dx-dateserv') as HTMLInputElement)?.value || null
        const onset_date = (document.getElementById('dx-onset') as HTMLInputElement)?.value || null
        const dx_type = (document.getElementById('dx-type') as HTMLSelectElement)?.value as DxType
        const verification_status = (document.getElementById('dx-veri') as HTMLSelectElement)?.value as Verification
        const status = (document.getElementById('dx-status') as HTMLSelectElement)?.value as DxStatus

        if (!term) {
          Swal.showValidationMessage('กรุณากรอกคำวินิจฉัย')
          return
        }
        return { code, term, diagnosed_at, onset_date, dx_type, verification_status, status }
      }
    })

    if (!result.isConfirmed) return null
    return result.value as Partial<Diagnosis>
  }

  function violatesPrincipalRule(payload: Partial<Diagnosis>, editingId?: number | string) {
    const dtype = payload.dx_type ?? 'secondary'
    if (dtype !== 'principal') return false
    const enc = (defaultEncounterId ?? null)
    if (enc === null) return false
    return items.some(x =>
      (x.encounter_id ?? null) === enc &&
      (x.dx_type ?? (x.is_primary ? 'principal' : 'secondary')) === 'principal' &&
      x.status === 'active' &&
      x.diag_id !== editingId
    )
  }

  async function handleCreate() {
    const values = await openDxDialog({})
    if (!values) return

    if (violatesPrincipalRule(values)) {
      await Swal.fire({ icon: 'warning', title: 'ตั้งโรคหลักซ้ำ', text: 'Encounter เดียวกันมี “โรคหลัก (Principal)” ได้เพียง 1 รายการ' })
      return
    }

    try {
      const payload = {
        patients_id: patientsId,
        encounter_id: (defaultEncounterId ?? null),
        code: values.code || null,
        term: values.term!,
        dx_type: values.dx_type as DxType,
        is_primary: values.dx_type === 'principal',
        verification_status: (values.verification_status as Verification) ?? 'confirmed',
        diagnosed_at: values.diagnosed_at ?? null,
        onset_date: values.onset_date ?? null,
        status: (values.status as DxStatus) ?? 'active',
      }
      const res = await fetch(ENDPOINTS.createDx(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      await loadAll()
      Toast.fire({ icon: 'success', title: 'เพิ่มวินิจฉัยสำเร็จ' })
    } catch (err: any) {
      const msg = String(err?.message || 'บันทึกไม่สำเร็จ')
      if (msg.includes('unique') || msg.includes('23505')) {
        await Swal.fire({ icon: 'warning', title: 'ตั้งโรคหลักซ้ำ', text: 'Encounter เดียวกันมีโรคหลัก (Principal) อยู่แล้ว' })
      } else {
        await Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: msg })
      }
      setMessage(msg)
    }
  }

  async function handleEdit(row: Diagnosis) {
    const values = await openDxDialog(row)
    if (!values) return

    if (violatesPrincipalRule(values, row.diag_id)) {
      await Swal.fire({ icon: 'warning', title: 'ตั้งโรคหลักซ้ำ', text: 'Encounter เดียวกันมี “โรคหลัก (Principal)” ได้เพียง 1 รายการ' })
      return
    }

    try {
      const payload = {
        patients_id: patientsId,
        encounter_id: (defaultEncounterId ?? null),
        code: values.code || null,
        term: values.term!,
        dx_type: values.dx_type as DxType,
        is_primary: values.dx_type === 'principal',
        verification_status: (values.verification_status as Verification) ?? 'confirmed',
        diagnosed_at: values.diagnosed_at ?? null,
        onset_date: values.onset_date ?? null,
        status: (values.status as DxStatus) ?? 'active',
      }
      const res = await fetch(ENDPOINTS.updateDx(row.diag_id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      await loadAll()
      Toast.fire({ icon: 'success', title: 'บันทึกการแก้ไขสำเร็จ' })
    } catch (err: any) {
      const msg = String(err?.message || 'บันทึกไม่สำเร็จ')
      await Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: msg })
      setMessage(msg)
    }
  }

  async function confirmAndDelete(diag_id: number | string) {
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'ลบรายการวินิจฉัย?',
      text: 'การลบจะไม่สามารถย้อนกลับได้',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
    })
    if (!isConfirmed) return
    try {
      const res = await fetch(ENDPOINTS.deleteDx(diag_id), { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      await loadAll()
      Toast.fire({ icon: 'success', title: 'ลบสำเร็จ' })
    } catch (err: any) {
      await Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: err?.message || '' })
    }
  }

  const goToPatient = async () => {
    const hnNext = patientsId.trim()
    if (!hnNext) {
      await Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบ', text: 'กรุณากรอก HN' })
      return
    }
    const url = `/patient/${encodeURIComponent(hnNext)}/diagnosis${encounterParam ? `?encounter=${encodeURIComponent(encounterParam)}` : ''}`
    if (hnNext === (hn || '')) {
      await loadAll()
      Toast.fire({ icon: 'info', title: 'รีเฟรชข้อมูลแล้ว' })
    } else {
      router.push(url)
      Toast.fire({ icon: 'info', title: 'กำลังไปยังผู้ป่วยที่เลือก' })
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <Link
            href={`/patient`}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>🩺 การวินิจฉัยของผู้ป่วย (ICD-10-TM)</h1>
        <div className={styles.toolbar}>
          <label className={styles.inline}>
            <span>รหัสผู้ป่วย (HN)</span>
            <input
              className={`${styles.input} ${styles.w160}`}
              value={patientsId}
              onChange={(e) => setPatientsId(e.target.value)}
              placeholder="HN-00000001"
            />
          </label>
          <button className={styles.btn} onClick={goToPatient}>โหลดข้อมูล</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleCreate}>+ เพิ่มวินิจฉัย</button>
        </div>
      </header>

      {patient ? (
        <section className={styles.patient}>
          <div><span className={styles.muted}>ผู้ป่วย:</span> <b>{patient.first_name || '-'} {patient.last_name || ''}</b></div>
          <div><span className={styles.muted}>HN:</span> <b>{patient.patients_id}</b></div>
          <div><span className={styles.muted}>เพศ:</span> <b>{patient.gender || '-'}</b></div>
          <div><span className={styles.muted}>อายุ:</span> <b>{calculateAge(patient.birthdate) ?? '-'}</b></div>
        </section>
      ) : (
        <section className={styles.notice}>ไม่พบข้อมูลผู้ป่วย ลองตรวจสอบ HN แล้วกดโหลดอีกครั้ง</section>
      )}

      <section className={styles.stats}>
        <div className={styles.stat}><div className={styles.statLabel}>ทั้งหมด</div><div className={styles.statValue}>{summary.total}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>กำลังรักษา</div><div className={styles.statValue}>{summary.active}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>หายแล้ว</div><div className={styles.statValue}>{summary.resolved}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>ยกเลิกติดตาม</div><div className={styles.statValue}>{summary.inactive}</div></div>
      </section>

      <section className={styles.filters}>
        <input className={styles.input} placeholder="ค้นหา (ICD-10-TM หรือชื่อโรค)" value={q} onChange={(e) => setQ(e.target.value)} />
        <label>
          <span className={styles.muted}>สถานะ</span>
          <select className={styles.input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="all">ทั้งหมด</option>
            <option value="active">กำลังรักษา</option>
            <option value="resolved">หายแล้ว</option>
            <option value="inactive">ยกเลิกติดตาม</option>
          </select>
        </label>
        <label>
          <span className={styles.muted}>ชนิด</span>
          <select className={styles.input} value={dxTypeFilter} onChange={(e) => setDxTypeFilter(e.target.value as any)}>
            <option value="all">ทั้งหมด</option>
            <option value="principal">โรคหลัก</option>
            <option value="secondary">โรคร่วม</option>
            <option value="complication">ภาวะแทรกซ้อน</option>
            <option value="external_cause">สาเหตุภายนอก</option>
          </select>
        </label>
      </section>

      <section className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ชนิด</th>
                <th>ICD-10-TM</th>
                <th>คำวินิจฉัย</th>
                <th>วันที่ให้บริการ</th>
                <th>เริ่มเป็น</th>
                <th>ยืนยันผล</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const dtype: DxType = (row.dx_type ?? (row.is_primary ? 'principal' : 'secondary')) as DxType
                return (
                  <tr key={row.diag_id}>
                    <td title={DTYPE_LABEL[dtype]}>
                      {dtype === 'principal' ? 'โรคหลัก' : DTYPE_LABEL[dtype]}
                    </td>
                    <td className={styles.mono}>{row.code || '-'}</td>
                    <td>{row.term}</td>
                    <td>{fmtDate(row.diagnosed_at)}</td>
                    <td>{fmtDate(row.onset_date)}</td>
                    <td>{row.verification_status ? VERI_LABEL[row.verification_status] : '-'}</td>
                    <td>
                      <span className={styles.badge} data-status={row.status}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.btn} onClick={() => handleEdit(row)}>แก้ไข</button>
                        <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => confirmAndDelete(row.diag_id)}>ลบ</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className={`${styles.center} ${styles.muted}`}>ยังไม่มีข้อมูล</td></tr>
              )}
              {loading && (
                <tr><td colSpan={8} className={styles.center}>กำลังโหลด…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {message && <div className={styles.message}>{message}</div>}
    </div>
  )
}
