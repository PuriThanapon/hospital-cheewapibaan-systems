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
  onset_date?: string | null
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
}

function fmtDate(d?: string | null) {
  if (!d) return '-'
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString()
}

const dxStatusTH: Record<DxStatus, string> = {
  active: 'กำลังรักษา',
  resolved: 'หายแล้ว',
  inactive: 'ยุติ',
}

// หัวข้อหลักของการพบ (หัวการ์ดไม่แสดง ICD-10)
function getEncounterHeadline(enc: Encounter, dxList: Diagnosis[]) {
  if (dxList?.length) {
    const primary = dxList.find(d => d.is_primary) || dxList[0]
    return { title: 'วินิจฉัย', subtitle: primary.term }
  }
  if ((enc.note || '').trim()) return { title: 'บันทึก', subtitle: enc.encounter_type || '' }
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

  // วินิจฉัยแบบกรุ๊ปตาม encounter_id ('none' = ไม่ผูก)
  const [dxByEncounter, setDxByEncounter] = useState<Record<string, Diagnosis[]>>({})

  // load
  async function loadAll() {
    if (!patientsId) return
    try {
      setLoading(true); setMessage(null)
      const [pRes, eRes, dRes] = await Promise.all([
        fetch(ENDPOINTS.getPatient(patientsId), { cache: 'no-store' }),
        fetch(ENDPOINTS.listEnc(patientsId),    { cache: 'no-store' }),
        fetch(ENDPOINTS.listDx(patientsId),     { cache: 'no-store' }),
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
        <h1 className={styles.title}>ประวัติการดูแล</h1>
        <div className={styles.toolbar}>
          <label className={styles.inline}>
            <span>HN</span>
            <input
              className={`${styles.input} ${styles.w220}`}
              value={hnInput}
              onChange={(e) => setHnInput(e.target.value)}
              placeholder="เช่น HN-00000001"
            />
          </label>
          <button className={styles.btn} onClick={goToPatient}>โหลดข้อมูล</button>
        </div>
      </header>

      {patient ? (
        <section className={styles.patient}>
          <div><span className={styles.muted}>ผู้ป่วย:</span> <b>{patient.first_name || '-'} {patient.last_name || ''}</b></div>
          <div><span className={styles.muted}>HN:</span> <b>{patient.patients_id}</b></div>
        </section>
      ) : (
        <section className={`${styles.notice} ${styles.sectionPad}`}>ไม่พบข้อมูลผู้ป่วย</section>
      )}

      {/* ***** TIMELINE VIEW (แบบย่อ: แสดงเฉพาะวินิจฉัย + หมายเหตุ) ***** */}
      <section className={`${styles.timeline} ${styles.sectionPad}`}>
        {rows.length > 0 && rows.map((row, i) => {
          const countLabel = `ครั้งที่ ${rows.length - i}`
          const dxList = dxByEncounter[String(row.encounter_id)] || []
          const { title, subtitle } = getEncounterHeadline(row, dxList)
          const hasDx = dxList.length > 0
          const hasNote = (row.note || '').trim().length > 0

          return (
            <article key={`enc-${row.encounter_id}`} className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.count}>{countLabel}</div>
                <div className={styles.bigTitle}>
                  <span className={styles.bigMain}>{title}</span>
                  {subtitle ? <span className={styles.bigSub}>· {subtitle}</span> : null}
                </div>
                <div className={styles.date}>{fmtDate(row.encounter_date)}</div>
              </div>

              <div className={styles.cardBody}>
                {/* วินิจฉัย */}
                {hasDx && (
                  <div className={styles.block}>
                    <ul className={styles.dxList}>
                      {dxList.map(dx => (
                        <li key={`dx-${dx.diag_id}`} className={styles.dxRow}>
                          <div className={styles.dxMain}>
                            <span className={styles.dxTerm}>
                              {dx.term}{dx.is_primary ? ' (โรคหลัก)' : ''}
                            </span>
                            <span className={styles.badgeSmall} data-status={dx.status}>
                              {dxStatusTH[dx.status]}
                            </span>
                          </div>
                          <div className={styles.dxMeta}>
                            <span className={styles.muted}>
                              วันที่: {fmtDate(dx.onset_date) !== '-' ? fmtDate(dx.onset_date) : fmtDate(row.encounter_date)}
                            </span>
                            {/* ต้องการซ่อนรหัส ICD-10 ทั้งหมด? ลบบรรทัดด้านล่างได้เลย */}
                            {dx.code ? <span className={styles.dxCode}>[{dx.code}]</span> : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* หมายเหตุ */}
                {hasNote && (
                  <div className={styles.block}>
                    <div className={styles.note}>{row.note}</div>
                  </div>
                )}
              </div>
            </article>
          )
        })}

        {!loading && rows.length === 0 && (
          <div className={`${styles.center} ${styles.muted}`}>ยังไม่มีข้อมูล</div>
        )}
        {loading && <div className={styles.center}>กำลังโหลด…</div>}
      </section>

      {message && <div className={`${styles.message} ${styles.sectionPad}`}>{message}</div>}
    </div>
  )
}
