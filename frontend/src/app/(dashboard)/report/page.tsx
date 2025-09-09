'use client'

import React, { useEffect, useMemo, useState } from 'react'
import exportPDF from '../../components/PDFExporter'
import exportCSV from '../../components/CSVExporter'

/***********************************************************
 * Reports (PDF/CSV, no charts)
 * - Thai date formatting (B.E.)
 * - ใช้ PDFExporter & CSVExporter ที่เตรียมไว้แล้ว
 * - Death reports เรียก /api/deaths (มี fallback จาก /api/patients)
 * - ปรับปรุง: PDF layouts ต่อรายงาน, sort รายเดือน, normalize HN
 ***********************************************************/

/*********************** CONFIG & HTTP ************************/
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000'
const HOSPITAL_NAME = 'โรงพยาบาลวัดห้วยปลากั้งเพื่อสังคม'
const DEPARTMENT_NAME = 'แผนกชีวาภิบาล'
const LOGO_URL = '/logo.png' // ใส่โลโก้ใน public/logo.png

const joinUrl = (base: string, path: string) => {
  const b = base.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${b}${p}`
}

async function http<T>(url: string, options: RequestInit = {}): Promise<T> {
  const finalUrl = /^https?:\/\//i.test(url) ? url : joinUrl(API_BASE, url)
  const res = await fetch(finalUrl, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    cache: 'no-store',
  })
  let data: any = null
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) data = await res.json().catch(() => null)
  else data = await res.text().catch(() => null)
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Request failed (${res.status})`
    const err: any = new Error(msg)
    err.status = res.status
    throw err
  }
  return data as T
}

/*********************** DATE HELPERS (TH) ************************/
const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return "-"
  try {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch {
    return "-"
  }
}

const toISO = (d: string | Date) => {
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt.getTime())) return ''
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const thDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('th-TH', { dateStyle: 'long' }) : '-'

/*********************** TYPES ************************/
type Status = 'pending' | 'done' | 'cancelled'
type Patient = {
  patients_id: string
  pname?: string
  first_name?: string
  last_name?: string
  gender?: string
  birthdate?: string
  blood_group?: string
  bloodgroup_rh?: string
  patients_type?: string
  disease?: string
  status?: string
  phone_number?: string
  admittion_date?: string
}
type Treatment = {
  id?: number
  patients_id: string
  treatment_type: 'ประจำ' | 'ทำครั้งเดียว' | ''
  treatment_date: string
  diagnosis_summary?: string
  note?: string
}
type Appointment = {
  appointment_id?: number
  patients_id: string
  appointment_date: string
  start_time: string
  end_time: string
  appointment_type?: string
  place?: string
  status: Status
  note?: string
}
type DeathRecord = {
  patients_id: string
  death_date: string
  death_time?: string
  death_cause?: string
  management?: string
  pname?: string
  first_name?: string
  last_name?: string
  gender?: string
  birthdate?: string
}

/*********************** DATA FETCHERS ************************/
async function fetchPatients(params: { from?: string; to?: string; status?: string; limit?: number }) {
  const p = new URLSearchParams()
  if (params.from) p.set('admit_from', params.from)
  if (params.to) p.set('admit_to', params.to)
  if (params.status) p.set('status', params.status)
  p.set('page', '1')
  p.set('limit', String(params.limit ?? 5000))
  const data = await http<{ data: Patient[]; totalCount?: number }>(`/api/patients?${p.toString()}`)
  return data.data || []
}

async function fetchTreatments(params: { from?: string; to?: string; hn?: string; type?: string; limit?: number }) {
  const p = new URLSearchParams()
  if (params.from) p.set('from', params.from)
  if (params.to) p.set('to', params.to)
  if (params.hn) p.set('hn', params.hn)
  if (params.type) p.set('type', params.type)
  p.set('page', '1')
  p.set('limit', String(params.limit ?? 5000))
  const data = await http<{ data: Treatment[] }>(`/api/treatment?${p.toString()}`)
  return data.data || []
}

async function fetchAppointments(params: { from?: string; to?: string; type?: string; place?: string; status?: Status | 'all'; limit?: number }) {
  const p = new URLSearchParams()
  if (params.from) p.set('from', params.from)
  if (params.to) p.set('to', params.to)
  if (params.type) p.set('type', params.type)
  if (params.place) p.set('place', params.place)
  if (params.status && params.status !== 'all') p.set('status', params.status)
  p.set('sort', 'datetime')
  p.set('dir', 'asc')
  p.set('page', '1')
  p.set('limit', String(params.limit ?? 5000))
  const data = await http<{ data: Appointment[] }>(`/api/appointments?${p.toString()}`)
  return data.data || []
}

async function fetchDeaths(params: { from?: string; to?: string; limit?: number }) {
  const p = new URLSearchParams()
  if (params.from) p.set('from', params.from)
  if (params.to) p.set('to', params.to)
  p.set('page', '1')
  p.set('limit', String(params.limit ?? 5000))
  try {
    const data = await http<{ data: DeathRecord[] }>(`/api/deaths?${p.toString()}`)
    return data.data || []
  } catch {
    // fallback จาก patients
    const pts = await fetchPatients({})
    return pts
      .filter((p: any) => p.death_date)
      .filter((p: any) => inDateRange(p.death_date, params.from, params.to))
      .map((p: any) => ({
        patients_id: p.patients_id,
        death_date: p.death_date,
        death_time: p.death_time,
        death_cause: p.death_cause,
        management: p.management,
        pname: p.pname,
        first_name: p.first_name,
        last_name: p.last_name,
        gender: p.gender,
        birthdate: p.birthdate,
      }))
  }
}

/*********************** REPORT DEFINITIONS ************************/
const REPORTS = [
  { id: 'pt-register',   label: 'ทะเบียนผู้ป่วยทั้งหมด' },
  { id: 'pt-new',        label: 'สถิติผู้ป่วยเข้าใหม่ (รายเดือน)' },
  { id: 'pt-demographic',label: 'สถิติตามเพศ/อายุ/กรุ๊ปเลือด/ประเภท' },
  { id: 'pt-diseases',   label: 'โรคประจำตัวที่พบบ่อย' },
  { id: 'tx-logs',       label: 'บันทึกการรักษา' },
  { id: 'tx-types',      label: 'ประเภทการรักษา' },
  { id: 'tx-freq',       label: 'สถิติความถี่การรักษา (รายเดือน)' },
  { id: 'ap-detail',     label: 'สรุปรายละเอียดการนัดหมายทั้งหมด' },
  { id: 'ap-mth',        label: 'จำนวนนัดหมายรวม (รายเดือน)' },
  { id: 'ap-by-type',    label: 'นัดหมายตามประเภท' },
  { id: 'ap-by-place',   label: 'นัดหมายตามสถานที่' },
  { id: 'ap-noshow',     label: 'อัตรามา/ไม่มาตามนัด' },
  { id: 'ap-status',     label: 'สรุปสถานะนัดหมาย' },
  { id: 'death-count',   label: 'จำนวนผู้ป่วยเสียชีวิต (รายเดือน)' },
  { id: 'death-causes',  label: 'สาเหตุการเสียชีวิต (Top)' },
  { id: 'death-age',     label: 'ช่วงอายุของผู้เสียชีวิต' },
  { id: 'death-mgmt',    label: 'การจัดการศพ (management)' },
] as const

type ReportId = typeof REPORTS[number]['id']

/*********************** FILTER CONTROLS ************************/
const normalizeHN = (id = '') => {
  const raw = String(id).trim().toUpperCase()
  if (!raw) return ''
  if (/^HN-?\d+$/.test(raw)) {
    const digits = raw.replace(/[^0-9]/g, '')
    return `HN-${digits.padStart(8, '0')}`
  }
  if (/^\d+$/.test(raw)) return `HN-${raw.padStart(8, '0')}`
  return raw
}

function FilterControls({ report, filters, setFilters }: { report: ReportId; filters: any; setFilters: (f: any) => void }) {
  const common = (
    <>
      <div className="flex flex-col">
        <label className="text-xs text-gray-600">จากวันที่</label>
        <input type="date" className="border rounded px-2 py-1" value={filters.from || ''} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-gray-600">ถึงวันที่</label>
        <input type="date" className="border rounded px-2 py-1" value={filters.to || ''} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
      </div>
    </>
  )

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
      {common}

      {report === 'pt-register' && (
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">สถานะผู้ป่วย</label>
          <select className="border rounded px-2 py-1" value={filters.ptStatus || ''} onChange={(e) => setFilters({ ...filters, ptStatus: e.target.value })}>
            <option value="">ทั้งหมด</option>
            <option value="มีชีวิต">มีชีวิต</option>
            <option value="เสียชีวิต">เสียชีวิต</option>
          </select>
        </div>
      )}

      {report === 'tx-logs' && (
        <>
          <div className="flex flex-col">
            <label className="text-xs text-gray-600">HN</label>
            <input
              className="border rounded px-2 py-1"
              value={filters.hn || ''}
              onChange={(e) => setFilters({ ...filters, hn: e.target.value })}
              onBlur={(e) => setFilters({ ...filters, hn: normalizeHN(e.target.value) })}
              placeholder="เช่น HN-00000001 / 1"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-600">ประเภทการรักษา</label>
            <select className="border rounded px-2 py-1" value={filters.txType || ''} onChange={(e) => setFilters({ ...filters, txType: e.target.value })}>
              <option value="">ทั้งหมด</option>
              <option value="ประจำ">ประจำ</option>
              <option value="ทำครั้งเดียว">ทำครั้งเดียว</option>
            </select>
          </div>
        </>
      )}

      {(['ap-detail','ap-mth','ap-by-type','ap-by-place','ap-noshow','ap-status'] as ReportId[]).includes(report) && (
        <>
          <div className="flex flex-col">
            <label className="text-xs text-gray-600">ประเภทนัด</label>
            <input className="border rounded px-2 py-1" value={filters.apType || ''} onChange={(e) => setFilters({ ...filters, apType: e.target.value })} placeholder="ตรวจติดตาม/ทำแผล/..." />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-600">สถานที่</label>
            <input className="border rounded px-2 py-1" value={filters.apPlace || ''} onChange={(e) => setFilters({ ...filters, apPlace: e.target.value })} placeholder="OPD/ห้องทำแผล/..." />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-600">สถานะนัด</label>
            <select className="border rounded px-2 py-1" value={filters.apStatus || 'all'} onChange={(e) => setFilters({ ...filters, apStatus: e.target.value })}>
              <option value="all">ทั้งหมด</option>
              <option value="pending">รอดำเนินการ</option>
              <option value="done">เสร็จสิ้น</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
          </div>
        </>
      )}
    </div>
  )
}

/*********************** REPORT BUILDERS ************************/
function pad2(n: number) { return String(n).padStart(2, '0') }
function yearMonthKey(dateStr?: string) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '-'
  const y = d.getFullYear() + 543
  const m = pad2(d.getMonth() + 1)
  return `${m}/${y}`
}
function sortYearMonthBE(entries: [string, any[]][]) {
  // "MM/YYYY_BE" -> sort by actual Date (convert back to CE)
  return entries.sort((a, b) => {
    const [am, ayBE] = a[0].split('/').map(Number)
    const [bm, byBE] = b[0].split('/').map(Number)
    const ad = new Date((ayBE - 543), am - 1, 1)
    const bd = new Date((byBE - 543), bm - 1, 1)
    return ad.getTime() - bd.getTime()
  })
}
function groupByMonth<T>(arr: T[], getDate: (x: T) => string | undefined) {
  const m: Record<string, T[]> = {}
  arr.forEach((it) => {
    const k = yearMonthKey(getDate(it))
    if (!m[k]) m[k] = []
    m[k].push(it)
  })
  return m
}
function countBy<T>(arr: T[], getKey: (x: T) => string) {
  const m: Record<string, number> = {}
  arr.forEach((it) => { const k = getKey(it) || '-'; m[k] = (m[k] || 0) + 1 })
  return m
}
function calcAgeText(birthdate?: string) {
  if (!birthdate) return '-'
  const birth = new Date(birthdate)
  if (isNaN(birth.getTime())) return '-'
  const today = new Date()
  let years = today.getFullYear() - birth.getFullYear()
  let months = today.getMonth() - birth.getMonth()
  if (months < 0 || (months === 0 && today.getDate() < birth.getDate())) { years--; months = 12 + months }
  return years > 0 ? `${years} ปี` : `${months} เดือน`
}
function ageBandFromBirthdate(birthdate?: string) {
  if (!birthdate) return 'ไม่ทราบอายุ'
  const birth = new Date(birthdate)
  if (isNaN(birth.getTime())) return 'ไม่ทราบอายุ'
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  if (age < 0) return 'ไม่ทราบอายุ'
  if (age < 15) return '0–14 ปี'
  if (age < 30) return '15–29 ปี'
  if (age < 45) return '30–44 ปี'
  if (age < 60) return '45–59 ปี'
  if (age < 75) return '60–74 ปี'
  return '75+ ปี'
}
function inDateRange(dateStr?: string, from?: string, to?: string) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false
  const dt = d.getTime()
  if (from) { const f = new Date(from); f.setHours(0,0,0,0); if (dt < f.getTime()) return false }
  if (to) { const t = new Date(to); t.setHours(23,59,59,999); if (dt > t.getTime()) return false }
  return true
}

function timeRangeText(start?: string, end?: string) {
  const s = (start || '').slice(0,5)
  const e = (end || '').slice(0,5)
  if (!s && !e) return '-'
  if (s && !e) return s
  if (!s && e) return e
  return `${s}–${e}`
}

async function buildReport(report: ReportId, filters: any) {
  const from = filters.from || ''
  const to = filters.to || ''

  switch (report) {
    case 'ap-detail': {
      const rows = await fetchAppointments({
        from, to,
        type:  filters.apType  || '',
        place: filters.apPlace || '',
        status: (filters.apStatus || 'all')
      })
      const statusMap: Record<string,string> = {
        pending: 'รอดำเนินการ', done: 'เสร็จสิ้น', cancelled: 'ยกเลิก'
      }
      const data = rows.map((a) => ({
        hn: a.patients_id,
        date: formatDate(a.appointment_date),
        time: timeRangeText(a.start_time, a.end_time),
        type: a.appointment_type || '-',
        place: a.place || '-',
        status: statusMap[a.status] || a.status || '-',
        note: a.note || '-',
      }))
      const raw = rows.map((a) => ({
        patients_id: a.patients_id,
        appointment_date: a.appointment_date,
        start_time: a.start_time, end_time: a.end_time,
        appointment_type: a.appointment_type || '',
        place: a.place || '',
        status: a.status,
        note: a.note || '',
      }))
      return {
        title: 'สรุปรายละเอียดการนัดหมายทั้งหมด',
        columns: [
          { header: 'HN', dataKey: 'hn' },
          { header: 'วันที่นัด', dataKey: 'date' },
          { header: 'เวลา', dataKey: 'time' },
          { header: 'ประเภทนัด', dataKey: 'type' },
          { header: 'สถานที่', dataKey: 'place' },
          { header: 'สถานะ', dataKey: 'status' },
          { header: 'หมายเหตุ', dataKey: 'note' },
        ],
        rows: data,
        rawRows: raw,
      }
    }
    case 'pt-register': {
      const rows = await fetchPatients({ from, to, status: filters.ptStatus || '' })
      const data = rows.map((p) => ({
        hn: p.patients_id,
        name: `${p.pname ?? ''}${p.first_name ?? ''} ${p.last_name ?? ''}`.replace(/\s+/g,' ').trim(),
        gender: p.gender || '-',
        age: calcAgeText(p.birthdate),
        blood: [p.blood_group || '-', p.bloodgroup_rh || ''].filter(Boolean).join(' '),
        type: p.patients_type || '-',
        status: p.status || '-',
        admit: formatDate(p.admittion_date),
        disease: p.disease || '-',
      }))
      const raw = rows.map((p) => ({
        patients_id: p.patients_id,
        pname: p.pname ?? '', first_name: p.first_name ?? '', last_name: p.last_name ?? '',
        gender: p.gender ?? '', birthdate: p.birthdate ?? '',
        blood_group: p.blood_group ?? '', bloodgroup_rh: p.bloodgroup_rh ?? '',
        patients_type: p.patients_type ?? '', status: p.status ?? '',
        admittion_date: p.admittion_date ?? '', disease: p.disease ?? '',
      }))
      return {
        title: 'ทะเบียนผู้ป่วย',
        columns: [
          { header: 'HN', dataKey: 'hn' },
          { header: 'ชื่อ-นามสกุล', dataKey: 'name' },
          { header: 'เพศ', dataKey: 'gender' },
          { header: 'อายุ', dataKey: 'age' },
          { header: 'กรุ๊ปเลือด', dataKey: 'blood' },
          { header: 'ประเภท', dataKey: 'type' },
          { header: 'สถานะ', dataKey: 'status' },
          { header: 'รับเข้า', dataKey: 'admit' },
          { header: 'โรคประจำตัว', dataKey: 'disease' },
        ],
        rows: data, rawRows: raw,
      }
    }

    case 'pt-new': {
      const rows = await fetchPatients({ from, to })
      const bucket = groupByMonth(rows, (p) => p.admittion_date)
      const data = sortYearMonthBE(Object.entries(bucket))
        .map(([ym, arr]) => ({ month: ym, count: arr.length }))
      const raw = data.map((r) => ({ month: r.month, count: r.count }))
      return { title: 'สถิติผู้ป่วยเข้าใหม่ (รายเดือน)', columns: [ { header: 'เดือน', dataKey: 'month' }, { header: 'จำนวน', dataKey: 'count' } ], rows: data, rawRows: raw }
    }

    case 'pt-demographic': {
      const rows = await fetchPatients({ from, to })
      const gender = countBy(rows, (p) => p.gender || '-')
      const blood = countBy(rows, (p) => [p.blood_group || '-', p.bloodgroup_rh || ''].filter(Boolean).join(' '))
      const ptype = countBy(rows, (p) => p.patients_type || '-')
      const age = countBy(rows, (p) => ageBandFromBirthdate(p.birthdate))
      const data = [
        ...Object.entries(gender).map(([k,v]) => ({ กลุ่ม: 'เพศ', รายการ: k, จำนวน: v })),
        ...Object.entries(age).map(([k,v]) => ({ กลุ่ม: 'ช่วงอายุ', รายการ: k, จำนวน: v })),
        ...Object.entries(blood).map(([k,v]) => ({ กลุ่ม: 'กรุ๊ปเลือด', รายการ: k, จำนวน: v })),
        ...Object.entries(ptype).map(([k,v]) => ({ กลุ่ม: 'ประเภทผู้ป่วย', รายการ: k, จำนวน: v })),
      ]
      const raw = data.map((r) => ({ group: r['กลุ่ม'], key: r['รายการ'], count: r['จำนวน'] }))
      return { title: 'สถิติตามเพศ/อายุ/กรุ๊ปเลือด/ประเภท', columns: [ { header:'กลุ่ม', dataKey:'กลุ่ม' }, { header:'รายการ', dataKey:'รายการ' }, { header:'จำนวน', dataKey:'จำนวน' } ], rows: data, rawRows: raw }
    }

    case 'pt-diseases': {
      const rows = await fetchPatients({ from, to })
      const counts: Record<string, number> = {}
      rows.forEach((p) => {
        const d = (p.disease || '').split(/[;,\n]/).map((s) => s.trim()).filter(Boolean)
        d.forEach((dx) => { counts[dx] = (counts[dx] || 0) + 1 })
      })
      const data = Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v]) => ({ โรค: k, จำนวน: v }))
      const raw = data.map((r) => ({ disease: r['โรค'], count: r['จำนวน'] }))
      return { title: 'โรคประจำตัวที่พบบ่อย', columns: [ { header:'โรค', dataKey:'โรค' }, { header:'จำนวน', dataKey:'จำนวน' } ], rows: data, rawRows: raw }
    }

    case 'tx-logs': {
      const rows = await fetchTreatments({ from, to, hn: filters.hn || '', type: filters.txType || '' })
      const data = rows.map((t) => ({
        hn: t.patients_id,
        date: formatDate(t.treatment_date),
        type: t.treatment_type || '-',
        summary: t.diagnosis_summary || '-',
        note: t.note || '-',
      }))
      const raw = rows.map((t) => ({ patients_id: t.patients_id, treatment_date: t.treatment_date, treatment_type: t.treatment_type, diagnosis_summary: t.diagnosis_summary || '', note: t.note || '' }))
      return { title: 'บันทึกการรักษา', columns: [ { header:'HN', dataKey:'hn' }, { header:'วันที่รักษา', dataKey:'date' }, { header:'ประเภท', dataKey:'type' }, { header:'สรุปการรักษา', dataKey:'summary' }, { header:'หมายเหตุ', dataKey:'note' } ], rows: data, rawRows: raw }
    }

    case 'tx-types': {
      const rows = await fetchTreatments({ from, to })
      const cnt = countBy(rows, (t) => t.treatment_type || '-')
      const data = Object.entries(cnt).map(([k,v]) => ({ ประเภท: k, จำนวน: v }))
      const raw = data.map((r) => ({ type: r['ประเภท'], count: r['จำนวน'] }))
      return { title: 'ประเภทการรักษา', columns: [ { header:'ประเภท', dataKey:'ประเภท' }, { header:'จำนวน', dataKey:'จำนวน' } ], rows: data, rawRows: raw }
    }

    case 'tx-freq': {
      const rows = await fetchTreatments({ from, to })
      const bucket = groupByMonth(rows, (t) => t.treatment_date)
      const data = sortYearMonthBE(Object.entries(bucket))
        .map(([ym, arr]) => ({ month: ym, count: arr.length }))
      const raw = data.map((r) => ({ month: r.month, count: r.count }))
      return { title: 'สถิติความถี่การรักษา (รายเดือน)', columns: [ { header:'เดือน', dataKey:'month' }, { header:'จำนวน', dataKey:'count' } ], rows: data, rawRows: raw }
    }

    case 'ap-mth': {
      const rows = await fetchAppointments({ from, to, type: filters.apType || '', place: filters.apPlace || '', status: filters.apStatus || 'all' })
      const bucket = groupByMonth(rows, (a) => a.appointment_date)
      const data = sortYearMonthBE(Object.entries(bucket))
        .map(([ym, arr]) => ({ month: ym, count: arr.length }))
      const raw = data.map((r) => ({ month: r.month, count: r.count }))
      return { title: 'จำนวนนัดหมายรวม (รายเดือน)', columns: [ { header:'เดือน', dataKey:'month' }, { header:'จำนวน', dataKey:'count' } ], rows: data, rawRows: raw }
    }

    case 'ap-by-type': {
      const rows = await fetchAppointments({ from, to, place: filters.apPlace || '', status: filters.apStatus || 'all' })
      const cnt = countBy(rows, (a) => a.appointment_type || '-')
      const data = Object.entries(cnt).map(([k,v]) => ({ ประเภท: k, จำนวน: v }))
      const raw = data.map((r) => ({ type: r['ประเภท'], count: r['จำนวน'] }))
      return { title: 'นัดหมายตามประเภท', columns: [ { header:'ประเภท', dataKey:'ประเภท' }, { header:'จำนวน', dataKey:'จำนวน' } ], rows: data, rawRows: raw }
    }

    case 'ap-by-place': {
      const rows = await fetchAppointments({ from, to, type: filters.apType || '', status: filters.apStatus || 'all' })
      const cnt = countBy(rows, (a) => a.place || '-')
      const data = Object.entries(cnt).map(([k,v]) => ({ สถานที่: k, จำนวน: v }))
      const raw = data.map((r) => ({ place: r['สถานที่'], count: r['จำนวน'] }))
      return { title: 'นัดหมายตามสถานที่', columns: [ { header:'สถานที่', dataKey:'สถานที่' }, { header:'จำนวน', dataKey:'จำนวน' } ], rows: data, rawRows: raw }
    }

    case 'ap-noshow': {
      const rows = await fetchAppointments({ from, to, type: filters.apType || '', place: filters.apPlace || '', status: 'all' })
      const done = rows.filter((r) => r.status === 'done').length
      const cancelled = rows.filter((r) => r.status === 'cancelled').length
      const total = done + cancelled
      const rateAttend = total ? (done / total * 100) : 0
      const rateNoShow = total ? (cancelled / total * 100) : 0
      const data = [
        { ตัวชี้วัด: 'มาตามนัด (เสร็จสิ้น / (เสร็จสิ้น+ยกเลิก))', ค่า: `${done} / ${total}`, ร้อยละ: `${rateAttend.toFixed(1)}%` },
        { ตัวชี้วัด: 'ไม่มาตามนัด (ยกเลิก / (เสร็จสิ้น+ยกเลิก))', ค่า: `${cancelled} / ${total}`, ร้อยละ: `${rateNoShow.toFixed(1)}%` },
      ]
      const raw = [ { metric: 'attend_rate', done, total, percent: rateAttend }, { metric: 'no_show_rate', cancelled, total, percent: rateNoShow } ]
      return { title: 'อัตรามา/ไม่มาตามนัด', columns: [ { header:'ตัวชี้วัด', dataKey:'ตัวชี้วัด' }, { header:'ค่า', dataKey:'ค่า' }, { header:'ร้อยละ', dataKey:'ร้อยละ' } ], rows: data, rawRows: raw }
    }

    case 'ap-status': {
      const rows = await fetchAppointments({ from, to, type: filters.apType || '', place: filters.apPlace || '', status: 'all' })
      const cnt = countBy(rows, (a) => a.status)
      const map: Record<string, string> = { pending: 'รอดำเนินการ', done: 'เสร็จสิ้น', cancelled: 'ยกเลิก' }
      const data = Object.entries(cnt).map(([k,v]) => ({ สถานะ: map[k] || k, จำนวน: v }))
      const raw = data.map((r) => ({ status: r['สถานะ'], count: r['จำนวน'] }))
      return { title: 'สรุปสถานะนัดหมาย', columns: [ { header:'สถานะ', dataKey:'สถานะ' }, { header:'จำนวน', dataKey:'จำนวน' } ], rows: data, rawRows: raw }
    }

    case 'death-count': {
      const rows = await fetchDeaths({ from, to })
      const bucket = groupByMonth(rows, (r) => r.death_date)
      const data = sortYearMonthBE(Object.entries(bucket))
        .map(([ym, arr]) => ({ month: ym, count: arr.length }))
      const raw = data.map((r) => ({ month: r.month, count: r.count }))
      return { title: 'จำนวนผู้ป่วยเสียชีวิต (รายเดือน)', columns: [ { header:'เดือน', dataKey:'month' }, { header:'จำนวน', dataKey:'count' } ], rows: data, rawRows: raw }
    }

    case 'death-causes': {
      const rows = await fetchDeaths({ from, to })
      const cnt = countBy(rows, (r) => (r.death_cause || '-').trim())
      const data = Object.entries(cnt).map(([k,v]) => ({ สาเหตุการเสียชีวิต: k, จำนวน: v }))
      const raw = data.map((r) => ({ cause: r['สาเหตุการเสียชีวิต'], count: r['จำนวน'] }))
      return { title: 'สาเหตุการเสียชีวิต (Top)', columns: [ { header:'สาเหตุการเสียชีวิต', dataKey:'สาเหตุการเสียชีวิต' }, { header:'จำนวน', dataKey:'จำนวน' } ], rows: data, rawRows: raw }
    }

    case 'death-age': {
      const rows = await fetchDeaths({ from, to })
      const cnt = countBy(rows, (r) => ageBandFromBirthdate(r.birthdate))
      const data = Object.entries(cnt).map(([k,v]) => ({ ช่วงอายุ: k, จำนวน: v }))
      const raw = data.map((r) => ({ band: r['ช่วงอายุ'], count: r['จำนวน'] }))
      return { title: 'ช่วงอายุของผู้เสียชีวิต', columns: [ { header:'ช่วงอายุ', dataKey:'ช่วงอายุ' }, { header:'จำนวน', dataKey:'จำนวน' } ], rows: data, rawRows: raw }
    }

    case 'death-mgmt': {
      const rows = await fetchDeaths({ from, to })
      const cnt = countBy(rows, (r) => (r.management || '-').trim())
      const data = Object.entries(cnt).map(([k,v]) => ({ การจัดการศพ: k, จำนวน: v }))
      const raw = data.map((r) => ({ management: r['การจัดการศพ'], count: r['จำนวน'] }))
      return { title: 'การจัดการศพ (management)', columns: [ { header:'การจัดการศพ', dataKey:'การจัดการศพ' }, { header:'จำนวน', dataKey:'จำนวน' } ], rows: data, rawRows: raw }
    }
  }
}

/*********************** MAIN COMPONENT ************************/
export default function ReportsNoChartsFixed() {
  const [report, setReport] = useState<ReportId>('pt-register')
  const [filters, setFilters] = useState<any>({ from: toISO(new Date(new Date().getFullYear(), 0, 1)), to: toISO(new Date()) })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [columns, setColumns] = useState<{ header: string; dataKey: string }[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [rawRows, setRawRows] = useState<any[]>([])

  const title = useMemo(() => REPORTS.find((r) => r.id === report)?.label || 'รายงาน', [report])

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res: any = await buildReport(report, filters)
      setColumns(Array.isArray(res.columns) ? res.columns : [])
      setRows(Array.isArray(res.rows) ? res.rows : [])
      setRawRows(Array.isArray(res.rawRows) ? res.rawRows : (Array.isArray(res.rows) ? res.rows : []))
    } catch (e: any) {
      console.error(e)
      setError(e?.message || 'โหลดรายงานไม่สำเร็จ')
      setColumns([]); setRows([]); setRawRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, JSON.stringify(filters)])

  type Column = { header: string; dataKey: string }

  // รูปแบบต่อรายงาน (แนวหน้า/กว้างคอลัมน์/จัดวาง)
  const PDF_LAYOUTS: Partial<Record<ReportId, {
    widths?: (number | "auto")[];
    aligns?: ("left" | "center" | "right")[];
  }>> = {
    'ap-detail': {
      // รวม ~182 มม. (A4 portrait)
      widths: [22, 24, 20, 36, 30, 24, 'auto'],
      aligns: ['left','center','center','left','left','center','left']
    },
    'pt-register': {
      // รวม ~182 มม.
      widths: [24, 50, 13, 12, 14, 15, 15, 24, 22],
      aligns: ['left','left','center','center','center','center','center','center','left']
    },
    'pt-new':        { widths: [36, 28], aligns: ['center','right'] },
    'pt-demographic':{ widths: [32, 'auto', 26], aligns: ['left','left','right'] },
    'pt-diseases':   { widths: ['auto', 26], aligns: ['left','right'] },
    'tx-logs': {
      // เดิมเคย landscape — ปรับให้พอดี portrait
      widths: [20, 22, 18, 80, 40], // รวม ~180 มม.
      aligns: ['left','center','center','left','left']
    },
    'tx-types':      { widths: ['auto', 26], aligns: ['left','right'] },
    'tx-freq':       { widths: [36, 28], aligns: ['center','right'] },
    'ap-mth':        { widths: [36, 28], aligns: ['center','right'] },
    'ap-by-type':    { widths: ['auto', 26], aligns: ['left','right'] },
    'ap-by-place':   { widths: ['auto', 26], aligns: ['left','right'] },
    'ap-noshow':     { widths: ['auto', 32, 22], aligns: ['left','center','right'] },
    'ap-status':     { widths: ['auto', 26], aligns: ['left','right'] },
    'death-count':   { widths: [36, 28], aligns: ['center','right'] },
    'death-causes':  { widths: ['auto', 26], aligns: ['left','right'] },
    'death-age':     { widths: ['auto', 26], aligns: ['left','right'] },
    'death-mgmt':    { widths: ['auto', 26], aligns: ['left','right'] },
  }

  const handleExportPDF = async (columns: Column[], rows: any[], title: string) => {
    if (!columns.length || !rows.length) return

    const headerRow = columns.map(c => c.header)
    const bodyRows  = rows.map(r => columns.map(c => String(r[c.dataKey] ?? '')))

    // subtitle แสดงช่วงวันที่ + เงื่อนไขสำคัญ (ถ้ามี)
    const parts: string[] = [`ช่วงวันที่: ${thDate(filters.from)} – ${thDate(filters.to)}`]
    if (report === 'pt-register' && filters.ptStatus) parts.push(`สถานะ: ${filters.ptStatus}`)
    if (report === 'tx-logs') {
      if (filters.hn) parts.push(`HN: ${normalizeHN(filters.hn)}`)
      if (filters.txType) parts.push(`ประเภท: ${filters.txType}`)
    }
    if (['ap-mth','ap-by-type','ap-by-place','ap-noshow','ap-status'].includes(report)) {
      if (filters.apType) parts.push(`ประเภทนัด: ${filters.apType}`)
      if (filters.apPlace) parts.push(`สถานที่: ${filters.apPlace}`)
      if (filters.apStatus && filters.apStatus !== 'all') parts.push(`สถานะ: ${filters.apStatus}`)
    }
    const subtitle = parts.join('  •  ')

    // รูปแบบตามรายงาน + default อัตโนมัติ
    const lay = PDF_LAYOUTS[report] || {}
    const orientation: "portrait" | "landscape" = "portrait";
    const columnWidths = lay.widths || Array(columns.length).fill('auto')
    const columnAligns = lay.aligns || columns.map(() => 'left')

    await exportPDF({
      filename: `${title}__${toISO(new Date())}.pdf`,
      title,
      subtitle,
      columns: headerRow,
      rows: bodyRows,
      orientation,
      autoLandscape: false,
      format: "a4",
      margins: { top: 16, right: 12, bottom: 18, left: 12 },
      logoUrl: LOGO_URL,
      columnWidths,
      columnAligns,
      printAt: new Date(),
      // ถ้าใช้ PDFExporter เวอร์ชันธีมโรงพยาบาล จะอ่านค่าเหล่านี้ได้:
      hospitalName: HOSPITAL_NAME,
      department: DEPARTMENT_NAME,
      showConfidential: true,
    } as any)
  }

  const handleExportCSV = (columns: Column[], rows: any[], title: string) => {
    if (!columns.length || !rows.length) {
      console.error('ไม่มีข้อมูลสำหรับ export CSV')
      return
    }
    const bodyRows = rows.map(r =>
      columns.map(c => {
        const value = r[c.dataKey] ?? ''
        return typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))
          ? `"${value.replace(/"/g, '""')}"`
          : String(value)
      })
    )
    try {
      exportCSV({
        filename: `${title}__${toISO(new Date())}.csv`,
        columns: columns.map(c => ({ header: c.header, dataKey: c.dataKey })),
        rows: bodyRows,
      })
    } catch (e) {
      console.error('เกิดข้อผิดพลาดในการ export CSV:', e)
    }
  }

  const clearFilters = () => setFilters({ from: '', to: '' })

  return (
    <div className="p-4 space-y-4 bg-[#F7F7Fb] rounded-[15px]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold text-gray-800">รายงาน (ส่งออก PDF/CSV)</h1>
          <p className="text-sm text-gray-500">ฟอร์แมตวันที่แบบไทย • ไม่มีกราฟ • รองรับฟอนต์ไทย</p>
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            onClick={() => handleExportPDF(columns, rows, title)}
            disabled={!columns.length || !rows.length || loading}
          >
            ส่งออก PDF
          </button>
          <button
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            onClick={() => handleExportCSV(columns, rows, title)}
            disabled={!columns.length || !rows.length || loading}
          >
            ส่งออก CSV
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="flex flex-col">
            <label className="text-xs text-gray-600">เลือกรายงาน</label>
            <select className="border rounded px-2 py-2" value={report} onChange={(e) => setReport(e.target.value as ReportId)}>
              {REPORTS.map((r) => (<option key={r.id} value={r.id}>{r.label}</option>))}
            </select>
          </div>
          <div className="md:col-span-2 text-right flex gap-2 md:justify-end">
            <button className="px-3 py-2 rounded border text-gray-700 hover:bg-gray-50" onClick={clearFilters}>ล้างตัวกรอง</button>
            <button className="px-3 py-2 rounded bg-gray-800 text-white hover:bg-black" onClick={load} disabled={loading}>
              {loading ? 'กำลังโหลด...' : 'ดึงข้อมูล'}
            </button>
          </div>
        </div>

        <div className="mt-3">
          <FilterControls report={report} filters={filters} setFilters={setFilters} />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 p-3">{error}</div>
      )}

      <div className="rounded-xl border bg-white p-0 shadow-sm overflow-hidden">
        <div className="px-3 py-2 text-sm text-gray-600 border-b flex items-center justify-between">
          <span>ผลการค้นหา: <b>{rows.length}</b> แถว</span>
          <span className="text-gray-400">ช่วงวันที่: {filters.from || '-'} ถึง {filters.to || '-'}</span>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#005A50] text-white">
              <tr>
                {columns.length === 0 ? (
                  <th className="text-left px-3 py-2">ไม่มีคอลัมน์</th>
                ) : (
                  columns.map((c) => (
                    <th key={c.dataKey} className="text-left px-3 py-2 whitespace-nowrap">{c.header}</th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td className="px-3 py-3 text-gray-500" colSpan={Math.max(columns.length, 1)}>ไม่มีข้อมูล</td></tr>
              ) : rows.map((r, idx) => (
                <tr key={idx} className={idx % 2 ? 'bg-gray-50' : ''}>
                  {columns.map((c) => (
                    <td key={c.dataKey} className="px-3 py-2 align-top whitespace-pre-wrap">{String(r[c.dataKey] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
