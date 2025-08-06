import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {
  LifeBuoy,
  Receipt,
  Boxes,
  Package,
  UserCircle,
  BarChart3,
  LayoutDashboard,
  Settings,
} from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hospital Web Appilcation",
  description: "Code for the hospital web application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        <div className="flex flex-col h-full">
          {children}
        </div>
      </body>
    </html>
  );
}
// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html lang="en">
//       <body
//         className={`${geistSans.variable} ${geistMono.variable} antialiased`}
//       >
//         <div className="flex h-screen">
//           <Sidebar>
//             <SidebarItem icon={LayoutDashboard} text="หน้าแรก" href="/Homepage" active />
//             <SidebarItem icon={UserCircle} text="จัดการผู้ป่วย" href="/Homepage"/>
//             <SidebarItem icon={Boxes} text="Inventory" href="/Homepage"/>
//             <SidebarItem icon={Receipt} text="Billing" href="/Homepage"/>
//             <SidebarItem icon={Settings} text="Settings" href="/Homepage"/>
//           </Sidebar>
//           <main className="flex-1 p-4 overflow-y-auto">{children}</main>
//         </div>
//       </body>
//     </html>
//   );
// }