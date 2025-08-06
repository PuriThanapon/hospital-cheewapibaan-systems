"use client";
import React, { useState } from 'react'
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

type ValuePiece = Date | null;

type Value = ValuePiece | [ValuePiece, ValuePiece];

// TEMPORARY
const events = [
  {
    id: 1,
    title: "นายธนพล ยะใหม่วงค์",
    time: "10:00 น. - 11:00 น.",
    description: "ตรวจสุขภาพประจำปี",
  },
  {
    id: 2,
    title: "นายเป็นหนึ่ง สายทรัพย์",
    time: "11:00 น. - 12:00 น.",
    description: "ตรวจสุขภาพประจำปี และฉีดวัคซีน",
  },
  {
    id: 3,
    title: "นายนฤพนธ์ วงศ์ชัย",
    time: "12:30 น. - 13:00 น.",
    description: "ผ่าตัดเล็ก",
  },
];

const EventCalender = () => {
  const [value, onChange] = useState<Value>(new Date());
  return (
    <div className='bg-white rounded-md p-4'>
      <Calendar onChange={onChange} value={value} />
      <div className='flex justify-between items-center '>
        <h1 className='text-xl font-semibold my-4'>การนัดหมายประจำวัน</h1>
        <img src="/moreDark.png" alt="" width={20} height={20}/>
      </div>
      <div className='flex flex-col gap-4 '>
        {events.map(event=>(
            <div className='p-5 rounded-md border-2 border-gray-100 border-t-4 odd:border-t-blue-500 even:border-t-yellow-500' 
            key={event.id}>
                <div className='flex item-center justify-between'>
                    <h1 className='font-semibold text-gray-600'>{event.title}</h1>
                    <span className='text-gray-500 text-xs'>{event.time}</span>
                </div>
                <p className='mt-2 text-gray-400 text-sm'>{event.description}</p>
            </div>
        ))}
      </div>
    </div>
  )
}

export default EventCalender
