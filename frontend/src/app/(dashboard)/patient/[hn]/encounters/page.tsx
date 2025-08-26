'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import styles from './encounters.module.css'

// ---------- Types ----------
type EncStatus = 'open' | 'closed' | 'cancelled'
type Encounter = {
  encounter_id: number
  patients_id: string
  encounter_date: string   // YYYY-MM-DD
  encounter_type: string
  provider?: string | null
  place?: string | null
  note?: string | null
  status: EncStatus
  created_at: string
  updated_at: string
}

type Patient = {
  patients_id: string
  first_name: string | null
  last_name: string | null
  gender?: string | null
  birthdate?: string | null
}

/** วินิจฉัยที่ผูกกับ encounter */
type DxStatus = 'active' | 'resolved' | 'inactive'
type Diagnosis = {
  diag_id: number
  encounter_id?: number | null
  code?: string | null
  term: string
  is_primary: boolean
  status: DxStatus
}

// ---------- API endpoints ----------
const API_BASE = (
  (process as any).env.NEXT_PUBLIC_API_BASE ||
  (process as any).env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000'
).replace(/\/$/, '')

const ENDPOINTS = {
  getPatient: (id: string) => `${API_BASE}/api/patients/${encodeURIComponent(id)}`,
  listEnc:    (id: string) => `${API_BASE}/api/encounters?patients_id=${encodeURIComponent(id)}`,
  listDx:     (id: string) => `${API_BASE}/api/patient_diagnosis?patients_id=${encodeURIComponent(id)}`,
  createEnc:  () => `${API_BASE}/api/encounters`,
  updateEnc:  (id: number) => `${API_BASE}/api/encounters/${id}`,
  deleteEnc:  (id: number) => `${API_BASE}/api/encounters/${id}`,
}

const EMPTY_FORM: Partial<Encounter> = {
  encounter_date: new Date().toISOString().slice(0,10),
  encounter_type: '',
  provider: '',
  place: '',
  note: '',
  status: 'open',
}

function fmtDate(d?: string | null) {
  if (!d) return '-'
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString()
}

const statusTH: Record<EncStatus, string> = {
  open: 'เปิด',
  closed: 'ปิดแล้ว',
  cancelled: 'ยกเลิก',
}
const dxStatusTH: Record<DxStatus, string> = {
  active: 'กำลังรักษา',
  resolved: 'หายแล้ว',
  inactive: 'ยุติ',
}

// หัวข้อหลักของการพบครั้งนั้น ๆ
function getEncounterHeadline(enc: Encounter, dxList: Diagnosis[]) {
  // ถ้ามีวินิจฉัย -> หัวข้อ = วินิจฉัย (โชว์ชื่อโรคหลักสั้น ๆ เป็นคำโปรย)
  if (dxList?.length) {
    const primary = dxList.find(d => d.is_primary) || dxList[0]
    const subtitle = [primary.term, primary.code ? `[${primary.code}]` : ''].filter(Boolean).join(' ')
    return { title: 'วินิจฉัย', subtitle }
  }
  // ถ้าประเภทสื่อถึงนัดหมาย
  if (/(นัด|follow|appt|appoint|ติดตาม)/i.test(enc.encounter_type || '')) {
    return { title: 'นัดหมาย', subtitle: enc.encounter_type || '' }
  }
  // ถ้ามีหมายเหตุ -> บันทึก
  if ((enc.note || '').trim()) {
    return { title: 'บันทึก', subtitle: enc.encounter_type || '' }
  }
  // อย่างอื่น ๆ ใช้ประเภทเป็นคำโปรยไป
  return { title: 'การพบแพทย์', subtitle: enc.encounter_type || '' }
}

// ================== Page ==================
export default function PatientEncountersPage() {
  const { hn } = useParams<{ hn: string }>()
  const router = useRouter()
  const [patientsId, setPatientsId] = useState(hn || '')

  useEffect(() => { setPatientsId(hn || '') }, [hn])

  const [patient, setPatient] = useState<Patient | null>(null)
  const [rows, setRows] = useState<Encounter[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | EncStatus>('all')

  // วินิจฉัยแบบกรุ๊ปตาม encounter_id ('none' = ไม่ผูก)
  const [dxByEncounter, setDxByEncounter] = useState<Record<string, Diagnosis[]>>({})

  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Encounter | null>(null)
  const [form, setForm] = useState<Partial<Encounter>>(EMPTY_FORM)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  // load
  async function loadAll() {
    if (!patientsId) return
    try {
      setLoading(true); setMessage(null)
      const [pRes, eRes, dRes] = await Promise.all([
        fetch(ENDPOINTS.getPatient(patientsId)),
        fetch(ENDPOINTS.listEnc(patientsId)),
        fetch(ENDPOINTS.listDx(patientsId)),
      ])

      setPatient(pRes.ok ? await pRes.json() : null)
      setRows(eRes.ok ? await eRes.json() : [])

      if (dRes.ok) {
        const allDx: Diagnosis[] = await dRes.json()
        const grouped: Record<string, Diagnosis[]> = {}
        for (const dx of allDx) {
          const key = dx.encounter_id != null ? String(dx.encounter_id) : 'none'
          ;(grouped[key] ||= []).push(dx)
        }
        Object.keys(grouped).forEach(k => {
          grouped[k].sort((a,b) => Number(b.is_primary) - Number(a.is_primary))
        })
        setDxByEncounter(grouped)
      } else {
        setDxByEncounter({})
      }
    } catch (e:any) {
      setMessage(e?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadAll() }, [patientsId])

  // filter + sort
  const filtered = useMemo(() => {
    let list = rows
    const s = q.trim().toLowerCase()
    if (s) {
      list = list.filter(x =>
        x.encounter_type.toLowerCase().includes(s) ||
        (x.provider||'').toLowerCase().includes(s) ||
        (x.place||'').toLowerCase().includes(s) ||
        (x.note||'').toLowerCase().includes(s)
      )
    }
    if (statusFilter !== 'all') list = list.filter(x => x.status === statusFilter)
    return list.sort((a,b) =>
      (b.encounter_date > a.encounter_date ? 1 : -1) ||
      (b.created_at > a.created_at ? 1 : -1)
    )
  }, [rows, q, statusFilter])

  const summary = useMemo(() => {
    const total = rows.length
    const open = rows.filter(x => x.status==='open').length
    const closed = rows.filter(x => x.status==='closed').length
    const cancelled = rows.filter(x => x.status==='cancelled').length
    return { total, open, closed, cancelled }
  }, [rows])

  // actions
  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, encounter_date: new Date().toISOString().slice(0,10) })
    setOpenForm(true)
  }
  function openEdit(row: Encounter) {
    setEditing(row)
    setForm({ ...row })
    setOpenForm(true)
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    if (!form.encounter_type) { setMessage('กรุณาระบุประเภทการดูแล'); return }
    if (!form.encounter_date) { setMessage('กรุณาระบุวันที่'); return }

    const payload = {
      patients_id: patientsId,
      encounter_date: form.encounter_date,
      encounter_type: form.encounter_type,
      provider: form.provider || null,
      place: form.place || null,
      note: form.note || null,
      status: (form.status as EncStatus) || 'open',
    }

    try {
      const url = editing ? ENDPOINTS.updateEnc(editing.encounter_id) : ENDPOINTS.createEnc()
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text() || 'บันทึกไม่สำเร็จ')
      setOpenForm(false); setEditing(null); setForm({ ...EMPTY_FORM })
      await loadAll()
      setMessage('บันทึกสำเร็จ')
    } catch (err:any) {
      setMessage(err?.message || 'บันทึกไม่สำเร็จ')
    }
  }

  async function onDelete(id: number) {
    try {
      const res = await fetch(ENDPOINTS.deleteEnc(id), { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text() || 'ลบไม่สำเร็จ')
      setConfirmDeleteId(null)
      await loadAll()
      setMessage('ลบสำเร็จ')
    } catch (e:any) {
      setMessage(e?.message || 'ลบไม่สำเร็จ')
    }
  }

  // เปลี่ยน HN จากช่องค้นหา
  const [hnInput, setHnInput] = useState(patientsId)
  useEffect(() => setHnInput(patientsId), [patientsId])
  const goToPatient = () => {
    const next = hnInput.trim()
    if (!next) { setMessage('กรุณากรอก HN'); return }
    const url = `/patient/${encodeURIComponent(next)}/encounters`
    if (next === (hn || '')) loadAll()
    else router.push(url)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Encounter (ครั้งการดูแล)</h1>
        <div className={styles.toolbar}>
          <label className={styles.inline}>
            <span>HN</span>
            <input
              className={`${styles.input} ${styles.w160}`}
              value={hnInput}
              onChange={(e) => setHnInput(e.target.value)}
              placeholder="HN-00000001"
            />
          </label>
          <button className={styles.btn} onClick={goToPatient}>โหลดข้อมูล</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={openCreate}>+ เพิ่ม Encounter</button>
        </div>
      </header>

      {patient ? (
        <section className={styles.patient}>
          <div><span className={styles.muted}>ผู้ป่วย:</span> <b>{patient.first_name || '-'} {patient.last_name || ''}</b></div>
          <div><span className={styles.muted}>HN:</span> <b>{patient.patients_id}</b></div>
        </section>
      ) : (
        <section className={styles.notice}>ไม่พบข้อมูลผู้ป่วย</section>
      )}

      <section className={styles.stats}>
        <div className={styles.stat}><div className={styles.statLabel}>ทั้งหมด</div><div className={styles.statValue}>{summary.total}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>เปิด</div><div className={styles.statValue}>{summary.open}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>ปิดแล้ว</div><div className={styles.statValue}>{summary.closed}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>ยกเลิก</div><div className={styles.statValue}>{summary.cancelled}</div></div>
      </section>

      {/* ***** TIMELINE VIEW ***** */}
      <section className={styles.timeline}>
        {filtered.map((row, i) => {
          const countLabel = `ครั้งที่ ${filtered.length - i}`
          const dxList = dxByEncounter[String(row.encounter_id)] || []
          const { title, subtitle } = getEncounterHeadline(row, dxList)

          return (
            <article key={`enc-${row.encounter_id}`} className={styles.card}>
              {/* หัวการ์ด: ครั้งที่ + หัวข้อใหญ่ + วันที่ */}
              <div className={styles.cardHead}>
                <div className={styles.count}>{countLabel}</div>

                <div className={styles.bigTitle}>
                  <span className={styles.bigMain}>{title}</span>
                  {subtitle ? <span className={styles.bigSub}>· {subtitle}</span> : null}
                </div>

                <div className={styles.date}>{fmtDate(row.encounter_date)}</div>
              </div>

              <div className={styles.cardBody}>
                {/* เมตาเบื้องต้น */}
                <div className={styles.cols}>
                  <p><b>ประเภท:</b> {row.encounter_type || '-'}</p>
                  <p><b>ผู้ดูแล:</b> {row.provider || '-'}</p>
                  <p><b>สถานที่:</b> {row.place || '-'}</p>
                  <p><b>สถานะ:</b> <span className={styles.badge} data-status={row.status}>{statusTH[row.status]}</span></p>
                </div>

                {/* วินิจฉัย */}
                <div className={styles.block}>
                  <h4 className={styles.sectionTitle}>วินิจฉัย</h4>
                  {dxList.length ? (
                    <ul className={styles.dxList}>
                      {dxList.map(dx => (
                        <li key={`dx-${dx.diag_id}`}>
                          <span className={styles.dxTerm}>
                            {dx.term}{dx.is_primary ? ' (โรคหลัก)' : ''}
                          </span>
                          {dx.code ? <span className={styles.dxCode}>[{dx.code}]</span> : null}
                          <span className={styles.badgeSmall} data-status={dx.status}>
                            {dxStatusTH[dx.status]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className={styles.muted}>— ไม่มีการวินิจฉัยที่ผูกกับการพบครั้งนี้ —</div>
                  )}
                </div>

                {/* หมายเหตุ */}
                <div className={styles.block}>
                  <h4 className={styles.sectionTitle}>หมายเหตุ</h4>
                  <div className={styles.note}>{row.note || '-'}</div>
                </div>

                {/* นัดหมาย (placeholder) */}
                <div className={styles.block}>
                  <h4 className={styles.sectionTitle}>นัดหมาย</h4>
                  <div className={styles.muted}>— ยังไม่มีนัดหมายที่เชื่อมกับการพบครั้งนี้ —</div>
                </div>

                <div className={styles.actionsRow}>
                  <button className={styles.btn} onClick={() => openEdit(row)}>แก้ไข</button>
                  <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setConfirmDeleteId(row.encounter_id)}>ลบ</button>
                </div>
              </div>
            </article>
          )
        })}

        {!loading && filtered.length === 0 && (
          <div className={`${styles.center} ${styles.muted}`}>ยังไม่มีข้อมูล</div>
        )}
        {loading && <div className={styles.center}>กำลังโหลด…</div>}
      </section>

      {message && <div className={styles.message}>{message}</div>}

      {/* Modal: Create/Edit */}
      {openForm && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.dialog}>
            <h3 className={styles.dialogTitle}>{editing ? 'แก้ไข Encounter' : 'เพิ่ม Encounter'}</h3>
            <form onSubmit={submitForm} className={styles.formGrid}>
              <label>
                <span>วันที่</span>
                <input className={styles.input} type="date" value={(form.encounter_date as string) ?? ''} onChange={(e)=>setForm({...form, encounter_date: e.target.value})} />
              </label>
              <label>
                <span>ประเภท</span>
                <input className={styles.input} value={form.encounter_type ?? ''} onChange={(e)=>setForm({...form, encounter_type: e.target.value})} placeholder="เยี่ยมบ้าน / นัดติดตาม / รับเข้า / โทรศัพท์" />
              </label>
              <label>
                <span>ผู้ดูแล</span>
                <input className={styles.input} value={form.provider ?? ''} onChange={(e)=>setForm({...form, provider: e.target.value})} placeholder="เช่น RN สุชาดา / พญ. ชุติมา" />
              </label>
              <label>
                <span>สถานที่</span>
                <input className={styles.input} value={form.place ?? ''} onChange={(e)=>setForm({...form, place: e.target.value})} placeholder="OPD ชีวาภิบาล / บ้านผู้ป่วย" />
              </label>
              <label className={styles.col2}>
                <span>หมายเหตุ</span>
                <textarea className={`${styles.input} ${styles.textarea}`} value={form.note ?? ''} onChange={(e)=>setForm({...form, note: e.target.value})} placeholder="รายละเอียด / ข้อสังเกต / แผนการดูแล"></textarea>
              </label>
              <label>
                <span>สถานะ</span>
                <select className={styles.input} value={(form.status as EncStatus) ?? 'open'} onChange={(e)=>setForm({...form, status: e.target.value as EncStatus})}>
                  <option value="open">เปิด</option>
                  <option value="closed">ปิดแล้ว</option>
                  <option value="cancelled">ยกเลิก</option>
                </select>
              </label>

              <div className={`${styles.dialogActions} ${styles.col2}`}>
                <button type="button" className={styles.btn} onClick={()=>setOpenForm(false)}>ยกเลิก</button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>{editing ? 'บันทึกการแก้ไข' : 'เพิ่ม Encounter'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete confirm */}
      {confirmDeleteId !== null && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={`${styles.dialog} ${styles.dialogSmall}`}>
            <h3 className={styles.dialogTitle}>ลบ Encounter นี้?</h3>
            <p className={styles.muted}>การลบจะไม่สามารถย้อนกลับได้</p>
            <div className={styles.dialogActions}>
              <button className={styles.btn} onClick={()=>setConfirmDeleteId(null)}>ยกเลิก</button>
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={()=>onDelete(confirmDeleteId!)}>ลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
