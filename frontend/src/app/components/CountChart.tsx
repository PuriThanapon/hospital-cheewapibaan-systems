"use client";
import React from 'react'
import { RadialBarChart, RadialBar, Legend, ResponsiveContainer } from 'recharts';

const data = [
  {
    name: 'Total',
    count: 100,
    fill: 'white',
  },
  {
    name: 'Womens',
    count: 18,
    fill: '#ffd700',
  },
  {
    name: 'Mens',
    count: 32,
    fill: '#02786e',
  },
];

const CountChart = () => {
  return (
    <div className='rounded-2xl bg-white p-4 w-full h-full'>
      {/* TITLE */}
      <div className='flex justify-between items-center '>
        <h1 className='text-lg font-semibold'>จำนวนผู้ป่วย</h1>
        <img src="/moreDark.png" alt="" width={20} height={20}/>
      </div>
      {/* CHART */}
      <div className='relative w-full h-[75%]'>
        <ResponsiveContainer>
        <RadialBarChart cx="50%" cy="50%" innerRadius="40%" outerRadius="100%" barSize={32} data={data}>
          <RadialBar
            background
            dataKey="count"
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <img src="/peoples.png" alt="" width={50} height={50} className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'/>
      </div>
      {/* BUTTOM */}
      <div className='flex justify-center gap-16'>
        <div className='flex flex-col gap-1'>
            <div style={{ backgroundColor: '#02786e' }} className='w-5 h-5  rounded-full'></div>
            <h1 className='font-bold'>32</h1>
            <h2 className='text-xs text-gray-600'>ผู้ชาย (64%)</h2>
        </div>
        <div className='flex flex-col gap-1'>
            <div style={{ backgroundColor: '#ffd700' }} className='w-5 h-5 rounded-full'></div>
            <h1 className='font-bold'>18</h1>
            <h2 className='text-xs text-gray-600'>ผู้หญิง (36%)</h2>
        </div>
      </div>
    </div>
  )
}

export default CountChart
