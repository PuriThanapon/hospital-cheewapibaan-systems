'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { Zap, Stethoscope, Filter, Search, CalendarDays, X, LayoutList, LayoutGrid, Clock, ChevronDown, User, Hospital, ClipboardList, BadgeInfo, RefreshCw } from 'lucide-react';
import styles from './treatment.module.css';

/**
 * Treatments List Page (ประจำ / ฉุกเฉิน) — CSS Modules version
 * - สรุปตัวเลข + ตัวสลับประเภท
 * - ค้นหา/ฟิลเตอร์ (ข้อความ, สถานะ, แผนก, วันที่)
 * - โหมด: ตาราง / การ์ด / ไทม์ไลน์
 * - Hydration-safe: ใช้ useHasMounted + suppressHydrationWarning สำหรับวันเวลา
 */

/** ---------------------- Mock Data ---------------------- */
const MOCK_TREATMENTS = [
  { id:'TRT-0001', type:'ฉุกเฉิน', hn:'HN000012', pname:'นาย', first_name:'สมชาย', last_name:'ใจดี', diagnosis:'ปวดท้องเฉียบพลัน (สงสัยไส้ติ่ง)', department:'ER', doctor:'นพ.กิตติ', status:'กำลังรักษา', lastUpdated:'2025-08-16T15:40:00+07:00', nextAppointment:null },
  { id:'TRT-0002', type:'ประจำ', hn:'HN000245', pname:'น.ส.', first_name:'กานดา', last_name:'สุขใจ', diagnosis:'ติดตามเบาหวาน', department:'อายุรกรรม', doctor:'พญ.มิลิน', status:'นัดติดตาม', lastUpdated:'2025-08-14T10:15:00+07:00', nextAppointment:'2025-08-21T09:00:00+07:00' },
  { id:'TRT-0003', type:'ฉุกเฉิน', hn:'HN000377', pname:'นาย', first_name:'วีระ', last_name:'ปกป้อง', diagnosis:'อุบัติเหตุรถล้ม ศีรษะแตก', department:'ER', doctor:'นพ.ธนา', status:'รอผล', lastUpdated:'2025-08-16T11:05:00+07:00', nextAppointment:null },
  { id:'TRT-0004', type:'ประจำ', hn:'HN000512', pname:'นาง', first_name:'สุมิตรา', last_name:'เพียรดี', diagnosis:'ความดันโลหิตสูง ติดตามยา', department:'อายุรกรรม', doctor:'นพ.นเรศ', status:'กำลังรักษา', lastUpdated:'2025-08-15T14:20:00+07:00', nextAppointment:'2025-08-30T13:30:00+07:00' },
  { id:'TRT-0005', type:'ฉุกเฉิน', hn:'HN000599', pname:'น.ส.', first_name:'ชนิกานต์', last_name:'บวร', diagnosis:'หอบเฉียบพลัน (Asthma Exacerbation)', department:'ER', doctor:'พญ.ศศิประภา', status:'รอตรวจ', lastUpdated:'2025-08-16T08:55:00+07:00', nextAppointment:null },
  { id:'TRT-0006', type:'ประจำ', hn:'HN000721', pname:'นาย', first_name:'อรรถพล', last_name:'ชัยชนะ', diagnosis:'ไตวายเรื้อรัง ติดตาม Labs', department:'อายุรกรรม', doctor:'นพ.ก้องภพ', status:'รอผล', lastUpdated:'2025-08-13T09:10:00+07:00', nextAppointment:'2025-08-22T10:00:00+07:00' },
  { id:'TRT-0007', type:'ประจำ', hn:'HN000888', pname:'นาง', first_name:'ปราณี', last_name:'ใจงาม', diagnosis:'ตรวจสุขภาพประจำปี', department:'เวชปฏิบัติครอบครัว', doctor:'พญ.ปิยะดา', status:'เสร็จสิ้น', lastUpdated:'2025-08-10T16:00:00+07:00', nextAppointment:null },
  { id:'TRT-0008', type:'ฉุกเฉิน', hn:'HN000909', pname:'นาย', first_name:'ปกรณ์', last_name:'ญาณวิทย์', diagnosis:'โรคลมชักชักเฉียบพลัน', department:'ER', doctor:'นพ.เมธัส', status:'กำลังรักษา', lastUpdated:'2025-08-16T17:05:00+07:00', nextAppointment:null },
  { id:'TRT-0009', type:'ประจำ', hn:'HN001010', pname:'น.ส.', first_name:'ขวัญข้าว', last_name:'อารีย์', diagnosis:'ติดตามโรคไทรอยด์', department:'อายุรกรรม', doctor:'พญ.วริษฐา', status:'นัดติดตาม', lastUpdated:'2025-08-12T11:30:00+07:00', nextAppointment:'2025-08-25T08:30:00+07:00' },
  { id:'TRT-0010', type:'ประจำ', hn:'HN001111', pname:'นาย', first_name:'จิรพัฒน์', last_name:'บุญมาก', diagnosis:'ตรวจหลังผ่าตัดเล็ก', department:'ศัลยกรรม', doctor:'นพ.สิทธิพงศ์', status:'รอตรวจ', lastUpdated:'2025-08-16T07:15:00+07:00', nextAppointment:'2025-08-19T15:00:00+07:00' },
];

/** ---------------------- Utils ---------------------- */
function useHasMounted(){
  const [mounted, setMounted] = useState(false);
  useEffect(()=>setMounted(true), []);
  return mounted;
}

function cx(...arr){ return arr.filter(Boolean).join(' '); }

function formatThaiDateTime(iso){
  if(!iso) return '-';
  try{
    const d = new Date(iso);
    return d.toLocaleString('th-TH', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Asia/Bangkok' });
  }catch{ return iso; }
}
function dateKey(iso, tz='Asia/Bangkok'){
  try{ return new Intl.DateTimeFormat('th-TH',{ timeZone:tz, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(iso)); }
  catch{ const d=new Date(iso); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
}
function isSameDayTz(aIso,bIso,tz='Asia/Bangkok'){ return dateKey(aIso,tz)===dateKey(bIso,tz); }
function isToday(iso){ return isSameDayTz(iso, new Date().toISOString()); }
function thaiDateGroupLabel(iso){
  const now=new Date();
  const y=new Date(now); y.setDate(now.getDate()-1);
  const weekStart=new Date(now); weekStart.setDate(now.getDate()-now.getDay());
  if(isSameDayTz(iso, now.toISOString())) return 'วันนี้';
  if(isSameDayTz(iso, y.toISOString())) return 'เมื่อวานนี้';
  if(new Date(iso)>=weekStart) return 'สัปดาห์นี้';
  return new Date(iso).toLocaleDateString('th-TH',{ year:'numeric', month:'short', timeZone:'Asia/Bangkok' });
}
const STATUS_ORDER=['กำลังรักษา','รอตรวจ','รอผล','นัดติดตาม','เสร็จสิ้น','ยกเลิก'];
function byLastUpdatedDesc(a,b){ return new Date(b.lastUpdated)-new Date(a.lastUpdated); }
function emergencyFirstThenRecent(a,b){ if(a.type!==b.type) return a.type==='ฉุกเฉิน'?-1:1; return byLastUpdatedDesc(a,b); }

/** ---------------------- Small UI Parts ---------------------- */
const TypeBadge=({type})=> (
  <span className={cx(styles.badgeType, type==='ฉุกเฉิน'?styles.isEmergency:styles.isRegular)}>
    {type==='ฉุกเฉิน'?<Zap width={14} height={14}/>:<Stethoscope width={14} height={14}/>} {type}
  </span>
);

const StatusPill=({status})=> (
  <span className={cx(styles.pill, styles[`pill--${status}`]||'')}>{status}</span>
);

const SummaryCard=({title,value,icon})=> (
  <div className={styles.summaryCard}>
    <div className={styles.summaryIcon}>{icon}</div>
    <div className={styles.grid2}>
      <div className={styles.summaryTitle}>{title}</div>
      <div className={styles.summaryValue}>{value}</div>
    </div>
  </div>
);

function Chip({text,onClear}){
  return (
    <span className={styles.chip}>
      <Filter width={12} height={12}/>
      {text}
      <button onClick={onClear} className={styles.chipClose}><X width={12} height={12}/></button>
    </span>
  );
}

function Th({children, className}){ return <th className={cx(styles.th, className)}>{children}</th>; }
function Td({children, className}){ return <td className={cx(styles.td, className)}>{children}</td>; }

function ActionBtn({children, variant='ghost', size='md'}){
  const cls=cx(styles.btn, variant==='primary'&&styles.btnPrimary, size==='sm'&&styles.btnSm);
  return <button className={cls}>{children}</button>;
}

/** ---------------------- Sub-Views ---------------------- */
function TableView({rows}){
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            <Th>ประเภท</Th>
            <Th>ผู้ป่วย</Th>
            <Th>วินิจฉัย/เหตุผล</Th>
            <Th>แผนก/ผู้รับผิดชอบ</Th>
            <Th>อัปเดตล่าสุด</Th>
            <Th>สถานะ</Th>
            <Th>นัดถัดไป</Th>
            <Th className={styles.right}>การทำงาน</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r=> (
            <tr key={r.id}>
              <Td>
                <TypeBadge type={r.type}/>
              </Td>
              <Td>
                <div className={styles.bold}>{r.hn} | {r.pname} {r.first_name} {r.last_name}</div>
                <div className={styles.small}>รหัสเคส: {r.id}</div>
              </Td>
              <Td>
                <div className={styles.textDim}><BadgeInfo width={16} height={16}/> {r.diagnosis}</div>
              </Td>
              <Td>
                <div className={styles.textDim}><Hospital width={16} height={16}/> {r.department} / {r.doctor}</div>
              </Td>
              <Td><span suppressHydrationWarning>{formatThaiDateTime(r.lastUpdated)}</span></Td>
              <Td><StatusPill status={r.status}/></Td>
              <Td><span suppressHydrationWarning>{r.nextAppointment?formatThaiDateTime(r.nextAppointment):'-'}</span></Td>
              <Td className={styles.right}>
                <div style={{display:'inline-flex',gap:8}}>
                  <ActionBtn>ดูรายละเอียด</ActionBtn>
                  <ActionBtn variant="primary">เพิ่มบันทึก</ActionBtn>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CardsView({rows}){
  return (
    <div className={styles.cards}>
      {rows.map(r=> (
        <div key={r.id} className={cx(styles.card, r.type==='ฉุกเฉิน'&&styles.cardEmg)}>
          <div className={styles.rowBetween}>
            <TypeBadge type={r.type}/>
            <StatusPill status={r.status}/>
          </div>
          <div className={styles.grid2}>
            <div className={styles.bold} style={{fontSize:16}}>{r.hn} | {r.pname} {r.first_name} {r.last_name}</div>
            <div className={styles.textDim}><User width={16} height={16}/> {r.department} / {r.doctor}</div>
          </div>
          <div className={styles.textDim}><BadgeInfo width={16} height={16}/> {r.diagnosis}</div>
          <div className={styles.textDim}><Clock width={16} height={16}/> อัปเดตล่าสุด <span suppressHydrationWarning>{formatThaiDateTime(r.lastUpdated)}</span></div>
          <div className={styles.rowBetween}>
            <div><CalendarDays width={16} height={16}/> <span className={styles.inline}>นัดถัดไป: </span><span suppressHydrationWarning>{r.nextAppointment?formatThaiDateTime(r.nextAppointment):'-'}</span></div>
            <div style={{display:'inline-flex', gap:8}}>
              <ActionBtn size="sm">รายละเอียด</ActionBtn>
              <ActionBtn size="sm" variant="primary">เพิ่มบันทึก</ActionBtn>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineView({rows}){
  const groups=rows.reduce((acc,r)=>{ const label=thaiDateGroupLabel(r.lastUpdated); (acc[label]=acc[label]||[]).push(r); return acc; },{});
  const labels=Object.keys(groups);
  return (
    <div style={{display:'grid',gap:24}}>
      {labels.map(label=> (
        <div key={label}>
          <div className={styles.sectionTitle}>{label}</div>
          <div className={styles.timelineGroup}>
            <div className={styles.timelineLine}/>
            <div style={{display:'grid', gap:16}}>
              {groups[label].sort(byLastUpdatedDesc).map(r=> (
                <div key={r.id} className={styles.timelineItem}>
                  <div className={cx(styles.timelineDot, r.type==='ฉุกเฉิน'&&styles.timelineDotEmg)}>
                    {r.type==='ฉุกเฉิน'?<Zap width={14} height={14}/>:<Stethoscope width={14} height={14}/>}  
                  </div>
                  <div className={styles.timelineCard}>
                    <div className={styles.rowBetween}>
                      <div className={styles.bold}>{r.hn} | {r.pname} {r.first_name} {r.last_name}</div>
                      <StatusPill status={r.status}/>
                    </div>
                    <div className={styles.textDim}><BadgeInfo width={16} height={16}/> {r.diagnosis}</div>
                    <div className={styles.small} style={{opacity:.8}}>{r.department} / {r.doctor} • อัปเดต <span suppressHydrationWarning>{formatThaiDateTime(r.lastUpdated)}</span></div>
                    <div style={{display:'inline-flex', gap:8, marginTop:8}}>
                      <ActionBtn size="sm">รายละเอียด</ActionBtn>
                      <ActionBtn size="sm" variant="primary">เพิ่มบันทึก</ActionBtn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** ---------------------- Main Component ---------------------- */
export default function TreatmentsListPage(){
  const [tab,setTab]=useState('ทั้งหมด'); // ทั้งหมด | ประจำ | ฉุกเฉิน
  const [view,setView]=useState('ตาราง'); // ตาราง | การ์ด | ไทม์ไลน์
  const [query,setQuery]=useState('');
  const [statusFilter,setStatusFilter]=useState('');
  const [deptFilter,setDeptFilter]=useState('');
  const [dateFrom,setDateFrom]=useState('');
  const [dateTo,setDateTo]=useState('');
  const [todayOnly,setTodayOnly]=useState(false);
  const mounted=useHasMounted();

  const counters=useMemo(()=>{
    const total=MOCK_TREATMENTS.length;
    const reg=MOCK_TREATMENTS.filter(r=>r.type==='ประจำ').length;
    const emg=MOCK_TREATMENTS.filter(r=>r.type==='ฉุกเฉิน').length;
    const today=mounted?MOCK_TREATMENTS.filter(r=>isToday(r.lastUpdated)).length:0;
    return { total, reg, emg, today };
  },[mounted]);

  const emergenciesToday=useMemo(()=> mounted?MOCK_TREATMENTS.filter(r=>r.type==='ฉุกเฉิน'&&isToday(r.lastUpdated)) : [], [mounted]);

  const filtered=useMemo(()=>{
    let data=[...MOCK_TREATMENTS];
    if(tab!=='ทั้งหมด') data=data.filter(d=>d.type===tab);
    if(query.trim()){
      const q=query.toLowerCase();
      data=data.filter(d=>[d.hn, `${d.pname}${d.first_name} ${d.last_name}`, d.diagnosis, d.department, d.doctor].filter(Boolean).join(' ').toLowerCase().includes(q));
    }
    if(statusFilter) data=data.filter(d=>d.status===statusFilter);
    if(deptFilter) data=data.filter(d=>d.department===deptFilter);
    if(dateFrom) data=data.filter(d=> new Date(d.lastUpdated)>=new Date(dateFrom));
    if(dateTo) data=data.filter(d=> new Date(d.lastUpdated)<=new Date(dateTo));
    if(todayOnly) data=data.filter(d=> isToday(d.lastUpdated));
    data.sort(tab==='ทั้งหมด'?emergencyFirstThenRecent:byLastUpdatedDesc);
    return data;
  },[tab,query,statusFilter,deptFilter,dateFrom,dateTo,todayOnly]);

  const depts=useMemo(()=> Array.from(new Set(MOCK_TREATMENTS.map(d=>d.department))), []);
  const statuses=STATUS_ORDER;

  return (
    <div className={styles.wrapper}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.title}>รายการการรักษา</div>
          <div className={styles.subtitle}>สรุปการรักษาแบบประจำและฉุกเฉิน ทุกแผนก</div>
        </div>
        <button onClick={()=>{ setQuery(''); setStatusFilter(''); setDeptFilter(''); setDateFrom(''); setDateTo(''); setTodayOnly(false); setTab('ทั้งหมด'); }} className={styles.resetBtn}>
          <RefreshCw width={16} height={16}/> ล้างตัวกรองทั้งหมด
        </button>
      </div>

      {/* Emergency banner today */}
      {mounted && emergenciesToday.length>0 && (
        <div className={styles.emgBanner}>
          <Zap width={20} height={20}/>
          <div className={styles.small}>
            ฉุกเฉินวันนี้ <span className={styles.bold}>{emergenciesToday.length}</span> รายการ —
            <button onClick={()=>{ setTab('ฉุกเฉิน'); setTodayOnly(true); }} className={styles.emgLink}>ดูเฉพาะวันนี้</button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className={styles.summaryGrid}>
        <SummaryCard title="ทั้งหมด" value={counters.total} icon={<ClipboardList width={20} height={20}/>} />
        <SummaryCard title="ประจำ" value={counters.reg} icon={<Stethoscope width={20} height={20}/>} />
        <SummaryCard title="ฉุกเฉิน" value={counters.emg} icon={<Zap width={20} height={20}/>} />
        <SummaryCard title="อัปเดตวันนี้" value={counters.today} icon={<Clock width={20} height={20}/>} />
      </div>

      {/* Tabs & view toggle */}
      <div className={styles.tabs}>
        {['ทั้งหมด','ประจำ','ฉุกเฉิน'].map(t=> (
          <button key={t} onClick={()=>setTab(t)} className={cx(styles.tabBtn, t===tab&&styles.tabBtnActive)}>
            {t} {t==='ประจำ'&&`(${counters.reg})`} {t==='ฉุกเฉิน'&&`(${counters.emg})`}
          </button>
        ))}
        <div className={styles.viewBtns}>
          <button onClick={()=>setView('ตาราง')} className={cx(styles.viewBtn, view==='ตาราง'&&styles.viewBtnActive)}><LayoutList width={16} height={16}/> ตาราง</button>
          <button onClick={()=>setView('การ์ด')} className={cx(styles.viewBtn, view==='การ์ด'&&styles.viewBtnActive)}><LayoutGrid width={16} height={16}/> การ์ด</button>
          <button onClick={()=>setView('ไทม์ไลน์')} className={cx(styles.viewBtn, view==='ไทม์ไลน์'&&styles.viewBtnActive)}><Clock width={16} height={16}/> ไทม์ไลน์</button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div>
          <label className={styles.label}>ค้นหา</label>
          <div className={styles.searchWrap}>
            <Search width={16} height={16} className={styles.searchIcon} />
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ชื่อ, HN, วินิจฉัย, แผนก, แพทย์" className={cx(styles.input, styles.inputWithIcon)} />
          </div>
        </div>
        <div>
          <label className={styles.label}>สถานะ</label>
          <div style={{position:'relative'}}>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className={styles.select}>
              <option value="">ทั้งหมด</option>
              {statuses.map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown width={16} height={16} style={{position:'absolute', right:8, top:10, opacity:.6}} />
          </div>
        </div>
        <div>
          <label className={styles.label}>แผนก</label>
          <div style={{position:'relative'}}>
            <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)} className={styles.select}>
              <option value="">ทั้งหมด</option>
              {depts.map(d=> <option key={d} value={d}>{d}</option>)}
            </select>
            <ChevronDown width={16} height={16} style={{position:'absolute', right:8, top:10, opacity:.6}} />
          </div>
        </div>
        <div>
          <label className={styles.label}>จากวันที่ (อัปเดต)</label>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className={styles.input} />
        </div>
        <div>
          <label className={styles.label}>ถึงวันที่ (อัปเดต)</label>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className={styles.input} />
        </div>
        <div style={{gridColumn:'1 / -1', display:'flex', alignItems:'center', gap:12}}>
          <label style={{display:'inline-flex', alignItems:'center', gap:8, fontSize:14}}>
            <input type="checkbox" checked={todayOnly} onChange={e=>setTodayOnly(e.target.checked)} />
            เฉพาะที่อัปเดตวันนี้
          </label>
          {(query||statusFilter||deptFilter||dateFrom||dateTo||todayOnly) && (
            <div className={styles.chips}>
              {query && <Chip text={`ค้นหา: ${query}`} onClear={()=>setQuery('')} />}
              {statusFilter && <Chip text={`สถานะ: ${statusFilter}`} onClear={()=>setStatusFilter('')} />}
              {deptFilter && <Chip text={`แผนก: ${deptFilter}`} onClear={()=>setDeptFilter('')} />}
              {dateFrom && <Chip text={`จาก: ${dateFrom}`} onClear={()=>setDateFrom('')} />}
              {dateTo && <Chip text={`ถึง: ${dateTo}`} onClear={()=>setDateTo('')} />}
              {todayOnly && <Chip text={`อัปเดตวันนี้`} onClear={()=>setTodayOnly(false)} />}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div>
        {view==='ตาราง' && <TableView rows={filtered}/>}
        {view==='การ์ด' && <CardsView rows={filtered}/>}
        {view==='ไทม์ไลน์' && (mounted? <TimelineView rows={filtered}/> : <div className={styles.small}>กำลังโหลดมุมมองไทม์ไลน์…</div>)}
        {filtered.length===0 && (
          <div style={{textAlign:'center', padding:48, border:'1px solid #e5e7eb', borderRadius:16, background:'#fff', opacity:.8}}>
            ไม่พบรายการที่ตรงกับเงื่อนไข — ลองปรับตัวกรองใหม่
          </div>
        )}
      </div>
    </div>
  );
}