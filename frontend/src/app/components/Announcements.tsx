import React from 'react'

const Announcements = () => {
  return (
    <div className='bg-white rounded-md p-4'>
      <div className='flex item-center justify-between'>
        <h1 className='test-xl font-semibold'>ประกาศ</h1>
        <span className='text-xs text-gray-500'>ดูทั้งหมด</span>
      </div>
      <div className='flex flex-col gap-4 mt-4'>
        <div className='bg-blue-100 rounded-md p-4'>
            <div className='flex item-center justify-between'>
                <h2 className='font-medium'>แจ้งบำรุงห้องน้ำ</h2>
                <span className='text-xs text-gray-500 bg-white rounded-md py-1 px-1'>วันที่ 6 สิงหาคม พ.ศ.2568</span>
            </div>
            <p className='text-sm text-gray-400 mt-1'>ซ่อมเครื่องทำน้ำอุ่น ช่วงเวลาประมาณ : 10:00 น.-12:00 น.</p>
        </div>    
      </div>
      <div className='flex flex-col gap-4 mt-4'>
        <div className='bg-yellow-100 rounded-md p-4'>
            <div className='flex item-center justify-between'>
                <h2 className='font-medium'>แจ้งส่งชุดปฐมพยาบาล</h2>
                <span className='text-xs text-gray-500 bg-white rounded-md py-1 px-1'>วันที่ 7 สิงหาคม พ.ศ.2568</span>
            </div>
            <p className='text-sm text-gray-400 mt-1'>Lorem, ipsum dolor sit amet consectetur adipisicing maiores nemo, corrupti nisi tenetur?</p>
        </div>    
      </div>
      <div className='flex flex-col gap-4 mt-4'>
        <div className='bg-blue-100 rounded-md p-4'>
            <div className='flex item-center justify-between'>
                <h2 className='font-medium'>แจ้งเปลี่ยนข้อตกลงใหม่</h2>
                <span className='text-xs text-gray-500 bg-white rounded-md py-1 px-1'>วันที่ 13 สิงหาคม พ.ศ.2568</span>
            </div>
            <p className='text-sm text-gray-400 mt-1'>Lorem, ipsum dolor sit amet consectetur adipisicing maiores nemo, corrupti nisi tenetur?</p>
        </div>    
      </div>
    </div>
  )
}

export default Announcements
