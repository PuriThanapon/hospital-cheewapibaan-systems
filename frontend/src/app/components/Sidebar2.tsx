// import { ChevronFirstIcon, MoreVertical } from 'lucide-react';
// import Link from 'next/link';
// import { LucideIcon } from "lucide-react";
// import { Children } from 'react';

// export default function Sidebar({ children }: { children: React.ReactNode }) {
//   // Ensure children is an array for mapping
//   return (
//     <aside className="h-screen">
//         <nav className='h-full flex flex-col bg-white border-r border-gray-300 shadow-sm '>
//             <div className='p-4 pb-2 flex justify-between items-center '>
//                 <img src="https://www.zilliondesigns.com/images/portfolio/healthcare-hospital/iStock-471629610-Converted.png" className='w-20' alt="" />
//                 {/* <div className='font-bold mr-5'>Wat Huay Pla Kang </div> */}
//                 <div className='font-bold mr-5'>วัดห้วยปลากั้ง</div>
//                 <button className='p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100'>
//                     <ChevronFirstIcon />
//                 </button>
//             </div>
//             <ul className='flex-1 px-3'>{children}</ul>
//             <div className='mt-auto border-t border-gray-300 p-3 flex '>
//                 <img src="https://static.vecteezy.com/system/resources/thumbnails/005/544/718/small_2x/profile-icon-design-free-vector.jpg" 
//                 className='w-10 h-10 rounded-md'
//                 alt="" />
//                 <div className='flex justify-between items-center w-52 ml-3'>
//                     <div className='leading-4'>
//                         <h4 className='font-semibold'>John Doe</h4>
//                         <span className='text-xs text-gray-600'>johndoe@gmail.com</span>
//                     </div>
//                     <MoreVertical size={20}/>

//                 </div>
//             </div>
//         </nav>

//     </aside>
//   );
// }

// export function SidebarItem({
//   icon: Icon,
//   text, href,
//   active = false,
// }: {
//   icon: LucideIcon;
//   text: string;
//   href: string; 
//   active?: boolean;
// }) {
//   return (
//     <li>
//       <Link href={href}>
//         <div
//           className={`flex items-center gap-3 px-4 py-2 rounded-md cursor-pointer hover:bg-blue-100
//           ${active ? "bg-blue-200 font-semibold" : "text-gray-700"}`}
//         >
//           <Icon className="w-5 h-5" />
//           <span className="text-sm">{text}</span>
//         </div>
//       </Link>
//     </li>
//   );
// }
