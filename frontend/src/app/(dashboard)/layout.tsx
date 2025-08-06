'use client'

import { useState } from "react";
import Link from "next/link";
import Menu from "../components/Menu";
import Navbar from "../components/Navbar";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* LEFT SIDEBAR */}
      <div className={`${isCollapsed ? "w-16" : "w-60"} transition-all duration-300 bg-white  p-4 relative`}>
        {/* TOGGLE BUTTON */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-4 bg-white border rounded-full p-1 shadow-md"
        >
          {isCollapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
        </button>

        {/* LOGO + NAME */}
        <div className="flex items-center gap-2 mb-6">
          <img className="rounded-full" src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTu7nMhqiZLkgWSeS8Y1-Mbs0ILsrgt1S0HRA&s" width={32} height={32} alt="logo" />
          {!isCollapsed && (
            <div className="leading-4">
              <span className="font-bold text-lg">แผนกชีวาภิบาล</span>
            </div>
          )}
        </div>

        {/* MENU */}
        <Menu isCollapsed={isCollapsed} />
      </div>

      {/* MAIN */}
      <div className="flex-1 bg-[#f7f8fa] overflow-auto">
        <Navbar />
        {children}
      </div>
    </div>
  );
}