"use client";
import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const data = [
{
    name: 'พ.ศ.2564',
    เสียชีวิตจากสาเหตุอื่นๆ: 2,
    เสียชีวิตจากโรคประจำตัว: 5,
  },
  {
    name: 'พ.ศ.2565',
    เสียชีวิตจากสาเหตุอื่นๆ: 1,
    เสียชีวิตจากโรคประจำตัว: 4,
  },
  {
    name: 'พ.ศ.2566',
    เสียชีวิตจากสาเหตุอื่นๆ: 1,
    เสียชีวิตจากโรคประจำตัว: 1,
  },
  {
    name: 'พ.ศ.2567',
    เสียชีวิตจากสาเหตุอื่นๆ: 0,
    เสียชีวิตจากโรคประจำตัว: 0,
  },
  {
    name: 'พ.ศ.2568',
    เสียชีวิตจากสาเหตุอื่นๆ: 1,
    เสียชีวิตจากโรคประจำตัว: 2,
  },
];
const FinanceChart = () => {
  return (
    <div className='rounded-2xl bg-white p-4 w-full h-full'>
      {/* TITLE */}
      <div className='flex justify-between items-center '>
        <h1 className='text-lg font-semibold'>อัตราการเสียชึวิตรายปี</h1>
        <img src="/moreDark.png" alt="" width={20} height={20}/>
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart
          width={500}
          height={500}
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke='#ddd'/>
          <XAxis dataKey="name" axisLine={false} tick={{ fill: "#6b6d70ff" }} tickLine={false} tickMargin={15}/>
          <YAxis axisLine={false} tick={{ fill: "#6b6d70ff" }} tickLine={false} tickMargin={10}/>
          <Tooltip />
          <Legend
            align='center'
            verticalAlign='top'
            wrapperStyle={{ paddingTop: "10px", paddingBottom: "40px" }}
          />

          <Line type="monotone" dataKey="เสียชีวิตจากสาเหตุอื่นๆ" stroke="#82ca9d" strokeWidth={5} activeDot={{ r: 8 }} />
          <Line type="monotone" dataKey="เสียชีวิตจากโรคประจำตัว" stroke="#8884d8" strokeWidth={5} />
        </LineChart>
      </ResponsiveContainer>
    </div>
    
  )
}

export default FinanceChart
