'use client'

// File: src/app/(dashboard)/patient/[hn]/diagnosis/page.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import styles from './diagnosis.module.css'

// ================== Types ==================
type DxStatus = 'active' | 'resolved' | 'inactive'

type Diagnosis = {
  diag_id: number | string
  patients_id: string
  code: string | null
  term: string
  is_primary: boolean
  onset_date: string | null // YYYY-MM-DD
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

// ===== แปลงค่าสถานะ -> ข้อความไทย (โชว์อย่างเดียว) =====
const STATUS_LABEL: Record<DxStatus, string> = {
  active: 'กำลังรักษา',
  resolved: 'หายแล้ว',
  inactive: 'ยกเลิกติดตาม',
}

// ================== API ==================
const API_BASE = (
  (process as any).env.NEXT_PUBLIC_API_BASE ||
  (process as any).env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000'
).replace(/\/$/, '') // กันมี / ท้าย

const ENDPOINTS = {
  getPatient: (id: string) => `${API_BASE}/api/patients/${encodeURIComponent(id)}`,
  // ใช้แบบ ?patients_id= ให้ตรงกับ backend
  listDx: (id: string) => `${API_BASE}/api/patient_diagnosis?patients_id=${encodeURIComponent(id)}`,
  createDx: () => `${API_BASE}/api/patient_diagnosis`,
  updateDx: (diag_id: number | string) => `${API_BASE}/api/patient_diagnosis/${diag_id}`,
  deleteDx: (diag_id: number | string) => `${API_BASE}/api/patient_diagnosis/${diag_id}`,
}

// ================== Utils ==================
function fmtDate(d?: string | null) {
  if (!d) return '-'
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString()
}
function ageFromDOB(dob?: string | null): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--
  return a
}

const EMPTY_FORM: Partial<Diagnosis> = {
  code: '',
  term: '',
  is_primary: false,
  onset_date: '',
  status: 'active',
}

// ================== Page ==================
export default function PatientDiagnosisPage() {
  // อ่าน hn จาก URL
  const { hn } = useParams<{ hn: string }>()
  const router = useRouter()

  // เก็บ hn ไว้ใน state (และ sync เมื่อเปลี่ยน route)
  const [patientsId, setPatientsId] = useState<string>(hn || '')
  useEffect(() => { setPatientsId(hn || '') }, [hn])

  const [patient, setPatient] = useState<Patient | null>(null)
  const [items, setItems] = useState<Diagnosis[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DxStatus>('all')

  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Diagnosis | null>(null)
  const [form, setForm] = useState<Partial<Diagnosis>>(EMPTY_FORM)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | number | null>(null)

  async function loadAll() {
    if (!patientsId) return
    try {
      setLoading(true)
      setMessage(null)
      const [pRes, dRes] = await Promise.all([
        fetch(ENDPOINTS.getPatient(patientsId), { cache: 'no-store' }),
        fetch(ENDPOINTS.listDx(patientsId),    { cache: 'no-store' }),
      ])
      setPatient(pRes.ok ? await pRes.json() : null)
      setItems(dRes.ok ? await dRes.json() : [])
      if (!pRes.ok && !dRes.ok) {
        setMessage('โหลดข้อมูลไม่สำเร็จ')
      }
    } catch (err: any) {
      setMessage(err?.message || 'โหลดข้อมูลไม่สำเร็จ')
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
    return list.sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || (b.created_at > a.created_at ? 1 : -1))
  }, [items, q, statusFilter])

  const summary = useMemo(() => {
    const total = items.length
    const active = items.filter((x) => x.status === 'active').length
    const resolved = items.filter((x) => x.status === 'resolved').length
    const inactive = items.filter((x) => x.status === 'inactive').length
    return { total, active, resolved, inactive }
  }, [items])

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setOpenForm(true)
  }
  function openEdit(row: Diagnosis) {
    setEditing(row)
    setForm({ ...row })
    setOpenForm(true)
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    if (!form.term) { setMessage('กรุณากรอกคำวินิจฉัย'); return }
    try {
      setMessage(null)
      const payload = {
        patients_id: patientsId,
        code: form.code || null,
        term: form.term,
        is_primary: !!form.is_primary,
        onset_date: form.onset_date || null,
        status: (form.status as DxStatus) || 'active',
      }
      const url = editing ? ENDPOINTS.updateDx(editing.diag_id) : ENDPOINTS.createDx()
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        let text = ''
        try { text = await res.text() } catch {}
        throw new Error(text || 'บันทึกไม่สำเร็จ')
      }
      setOpenForm(false)
      setEditing(null)
      setForm({ ...EMPTY_FORM })
      await loadAll()
      setMessage('บันทึกสำเร็จ')
    } catch (err: any) {
      const msg = String(err?.message || '')
      if (msg.includes('unique') || msg.includes('23505')) {
        setMessage("ตั้งโรคหลักซ้ำ: มี 'โรคหลัก' ที่สถานะ 'กำลังรักษา' อยู่แล้ว")
      } else {
        setMessage(msg || 'บันทึกไม่สำเร็จ')
      }
    }
  }

  async function onDelete(diag_id: number | string) {
    try {
      const res = await fetch(ENDPOINTS.deleteDx(diag_id), { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      setConfirmDeleteId(null)
      await loadAll()
      setMessage('ลบสำเร็จ')
    } catch (err: any) {
      setMessage(err?.message || 'ลบไม่สำเร็จ')
    }
  }

  // ปุ่ม "โหลดข้อมูล" → เปลี่ยน URL ให้ตรงกับ HN; ถ้า HN เท่าเดิมก็ reload
  const goToPatient = () => {
    const hnNext = patientsId.trim()
    if (!hnNext) { setMessage('กรุณากรอก HN'); return }
    const url = `/patient/${encodeURIComponent(hnNext)}/diagnosis` // ← ใช้ /patient
    if (hnNext === (hn || '')) {
      loadAll()
    } else {
      router.push(url)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>การวินิจฉัยของผู้ป่วย</h1>
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
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={openCreate}>+ เพิ่มวินิจฉัย</button>
        </div>
      </header>

      {patient ? (
        <section className={styles.patient}>
          <div><span className={styles.muted}>ผู้ป่วย:</span> <b>{patient.first_name || '-'} {patient.last_name || ''}</b></div>
          <div><span className={styles.muted}>HN:</span> <b>{patient.patients_id}</b></div>
          <div><span className={styles.muted}>เพศ:</span> <b>{patient.gender || '-'}</b></div>
          <div><span className={styles.muted}>อายุ:</span> <b>{ageFromDOB(patient.birthdate) ?? '-'}</b></div>
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
        <input className={styles.input} placeholder="ค้นหา (ICD-10 หรือชื่อโรค)" value={q} onChange={(e) => setQ(e.target.value)} />
        <label>
          <span className={styles.muted}>สถานะ</span>
          <select className={styles.input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="all">ทั้งหมด</option>
            <option value="active">กำลังรักษา</option>
            <option value="resolved">หายแล้ว</option>
            <option value="inactive">ยกเลิกติดตาม</option>
          </select>
        </label>
      </section>

      <section className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>โรคหลัก</th>
                <th>ICD-10</th>
                <th>คำวินิจฉัย</th>
                <th>เริ่มเป็น</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.diag_id}>
                  <td title={row.is_primary ? 'โรคหลัก' : 'ไม่ใช่โรคหลัก'}>
                    {row.is_primary ? '★' : '—'}
                  </td>
                  <td className={styles.mono}>{row.code || '-'}</td>
                  <td>{row.term}</td>
                  <td>{fmtDate(row.onset_date)}</td>
                  <td>
                    <span className={styles.badge} data-status={row.status}>
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.btn} onClick={() => openEdit(row)}>แก้ไข</button>
                      <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setConfirmDeleteId(row.diag_id)}>ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className={`${styles.center} ${styles.muted}`}>ยังไม่มีข้อมูล</td></tr>
              )}
              {loading && (
                <tr><td colSpan={6} className={styles.center}>กำลังโหลด…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {message && <div className={styles.message}>{message}</div>}

      {/* Modal: Create/Edit */}
      {openForm && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.dialog}>
            <h3 className={styles.dialogTitle}>{editing ? 'แก้ไขการวินิจฉัย' : 'เพิ่มการวินิจฉัย'}</h3>
            <form onSubmit={submitForm} className={styles.formGrid}>
              <label>
                <span>ICD-10</span>
                <input className={styles.input} value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="เช่น E11.9" />
              </label>
              <label>
                <span>วันที่เริ่มเป็น</span>
                <input className={styles.input} type="date" value={(form.onset_date as string) ?? ''} onChange={(e) => setForm({ ...form, onset_date: e.target.value })} />
              </label>
              <label className={styles.col2}>
                <span>คำวินิจฉัย</span>
                <input className={styles.input} value={form.term ?? ''} onChange={(e) => setForm({ ...form, term: e.target.value })} placeholder="เช่น เบาหวานชนิดที่ 2" />
              </label>
              <label>
                <span>ตั้งเป็นโรคหลัก</span>
                <input type="checkbox" checked={!!form.is_primary} onChange={(e) => setForm({ ...form, is_primary: e.target.checked })} />
              </label>
              <label>
                <span>สถานะ</span>
                <select className={styles.input} value={(form.status as DxStatus) ?? 'active'} onChange={(e) => setForm({ ...form, status: e.target.value as DxStatus })}>
                  <option value="active">กำลังรักษา</option>
                  <option value="resolved">หายแล้ว</option>
                  <option value="inactive">ยกเลิกติดตาม</option>
                </select>
              </label>
              <div className={`${styles.dialogActions} ${styles.col2}`}>
                <button type="button" className={styles.btn} onClick={() => setOpenForm(false)}>ยกเลิก</button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>{editing ? 'บันทึกการแก้ไข' : 'เพิ่มวินิจฉัย'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete confirm */}
      {confirmDeleteId !== null && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={`${styles.dialog} ${styles.dialogSmall}`}>
            <h3 className={styles.dialogTitle}>ลบรายการวินิจฉัย?</h3>
            <p className={styles.muted}>การลบจะไม่สามารถย้อนกลับได้</p>
            <div className={styles.dialogActions}>
              <button className={styles.btn} onClick={() => setConfirmDeleteId(null)}>ยกเลิก</button>
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => onDelete(confirmDeleteId!)}>ลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
