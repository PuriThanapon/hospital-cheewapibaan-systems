"use client"

import Announcements from '@/app/components/Announcements'
import AttendanceChart from '@/app/components/AttendanceChart'
import CountChart from '@/app/components/CountChart'
import EventCalender from '@/app/components/EventCalender'
import FinanceChart from '@/app/components/FinanceChart'
import UserCard from '@/app/components/UserCard'
import React from 'react'
import dynamic from "next/dynamic";

const Select = dynamic(() => import('react-select'), { ssr: false });

const HomePage = () => {
  return (
    <div className=' flex flex-col gap-4 md:flex-row bg-gray-300'>
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
        {/* ATTENDANCE CHART */}
        <div className='w-full lg:w-2/3 h-[450px]'>
          <AttendanceChart/>
        </div>
      </div>
      {/* BOTTOM CHART */}
      <div className='w-full h-full'>
        <FinanceChart/>
      </div>
      </div>
      {/* RIGHT */}
      <div className='w-full lg:w-1/3 flex flex-col gap-8'>
      <EventCalender />
      </div>
    </div>
  )
}

export default HomePage