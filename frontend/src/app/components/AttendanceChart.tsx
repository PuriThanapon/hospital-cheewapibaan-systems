"use client";
import React, { use } from 'react'
import { BarChart, Bar, Rectangle, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const data = [
  {
    name: 'กลุ่ม 1',
    จำนวนกลุ่มเป้าหมาย: 20,
  },
  {
    name: 'กลุ่ม 2',
    จำนวนกลุ่มเป้าหมาย: 12,
  },
  {
    name: 'กลุ่ม 3',
    จำนวนกลุ่มเป้าหมาย: 10,
  },
  {
    name: 'กลุ่ม 4.1',
    จำนวนกลุ่มเป้าหมาย: 5,
  },
  {
    name: 'กลุ่ม 4.2',
    จำนวนกลุ่มเป้าหมาย: 3,
  },
];

const AttendanceChart = () => {
  return (
    <div className='rounded-2xl bg-white p-4 h-full'>
      <div className='flex justify-between items-center mb-4'>
        <h1 className='text-lg font-semibold'>กลุ่มเป้าหมาย</h1>
        <img src="/moreDark.png" alt="" width={20} height={20}/>
      </div>
      <ResponsiveContainer width="100%" height="90%">
      <BarChart
        width={500}
        height={300}
        data={data}
        barSize={20}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ddd"/>
        {/* แก้สีตัวหนังสือพวกวัน */}
        <XAxis dataKey="name" axisLine={false} tick={{fill:"#6b6d70ff"}} tickLine={false}/>
        <YAxis axisLine={false} tick={{fill:"#6b6d70ff"}} tickLine={false}/>
        <Tooltip contentStyle={{borderRadius:"10px",borderColor:"light"}}/>
        <Legend align='left' verticalAlign='top' wrapperStyle={{paddingTop:"10px",paddingBottom:"40px"}}/>
        <Bar dataKey="จำนวนกลุ่มเป้าหมาย" fill="#02786e" legendType='circle' radius={[10,10,0,0]}/>
      </BarChart>
    </ResponsiveContainer>
    </div>
  )
}

export default AttendanceChart
