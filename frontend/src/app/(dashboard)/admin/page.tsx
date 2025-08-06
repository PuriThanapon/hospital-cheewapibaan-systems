import Announcements from '@/app/components/Announcements'
import AttendanceChart from '@/app/components/AttendanceChart'
import CountChart from '@/app/components/CountChart'
import EventCalender from '@/app/components/EventCalender'
import FinanceChart from '@/app/components/FinanceChart'
import UserCard from '@/app/components/UserCard'
import React from 'react'

const AdminPage = () => {
  return (
    <div className='p-4 flex flex-col gap-4 md:flex-row bg-gray-300'>
      {/* LEFT */}
      <div className='w-full lg:w-2/3 flex flex-col gap-8'>
      {/* USER CARD */}
      {/* <div className='flex justify-between gap-4 flex-wrap'>
        <UserCard type='Patients' />
        <UserCard type='Nurses' />
      </div> */}
      {/* MIDDLE CHART */}
      <div className='flex gap-4 flex-col lg:flex-row'>
        {/* COUNT CHART */}
        <div className='w-full lg:w-1/3 h-[450px]'>
        <CountChart/>
        </div>
        {/* ATTENDACE CHART */}
        <div className='w-full lg:w-2/3 h-[450px]'>
          <AttendanceChart/>
        </div>
      </div>
      {/* BOTTIOM CHART */}
      <div className='w-full h-full'>
        <FinanceChart/>
      </div>
      </div>
      {/* RIGHT */}
      <div className='w-full lg:w-1/3 flex flex-col gap-8'>
      <EventCalender />
      <Announcements />
      </div>
    </div>
  )
}

export default AdminPage
