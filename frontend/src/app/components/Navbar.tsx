import React from 'react'

const Navbar = () => {
  return (
    <div  style={{ backgroundColor: '#005a50ff' }} className='flex items-center justify-between p-4 gap-4 shadow-md'>

      {/* CENTER - SEARCH BAR */}
      <div className='hidden md:flex items-center gap-4 bg-white text-xs rounded-full px-2 shadow-md ring-[1.5px] ring-gray-300 max-w-[700px] w-full mx-auto'>
        <img src="/search.png" alt="" width={14} height={14} />
        <input
          type="text"
          className='flex-1 p-2 bg-transparent outline-none'
          placeholder='ค้นหา...'
        />
      </div>


      {/* RIGHT - ICONS + USER */}
      <div className='flex items-center gap-4 flex-shrink-0 ml-auto'>
        <div className='bg-white rounded-full h-7 w-7 flex items-center justify-center cursor-pointer'>
          <img src="/message.png" alt="" width={20} height={20} />
        </div>
        <div className='bg-white rounded-full h-7 w-7 flex items-center justify-center cursor-pointer relative'>
          <img src="/announcement.png" alt="" width={20} height={20} />
          <div className='absolute -top-3 -right-3 w-5 h-5 flex items-center justify-center bg-purple-500 text-white rounded-full text-xs'>1</div>
        </div>
        <div className='flex flex-col text-right'>
          <span className='text-xs leading-3 font-medium text-[#ffd700]'>Phuthanet Sitthiwichai</span>
          <span className='text-[10px] text-white'>ผู้ดูแลระบบ</span>
        </div>
        <div className='w-8 h-8 rounded-full overflow-hidden cursor-pointer'>
          <img
            src="https://scontent.fbkk5-6.fna.fbcdn.net/v/t39.30808-1/462507050_4069822256579766_3251004265784467628_n.jpg?stp=dst-jpg_s200x200_tt6&_nc_cat=102&ccb=1-7&_nc_sid=e99d92&_nc_ohc=bKbcnsC5WCcQ7kNvwHCaczt&_nc_oc=Admq99vC4DoduEdKTOfQLG1x4VjcFiwuLdVEqzbtM4Buzb1OLG2TJW2ch-WwUPjOKVk&_nc_zt=24&_nc_ht=scontent.fbkk5-6.fna&_nc_gid=SxYCDOBZTnGFZOpVHz7Y1g&oh=00_AfUqbp-MPI8dZEZ9UYbdrnDn5-GtuG5guQz5B9ReqSTUBA&oe=6899381A"
            alt="User Avatar"
            className='w-full h-full object-cover'
          />
        </div>
      </div>
    </div>
  )
}

export default Navbar
