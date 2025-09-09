'use client';

import { useState } from "react";
import Menu from "../components/Menu";
import Navbar from "../components/Navbar";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import AppointmentsToastSweet from "../components/AppointmentsToastSweet";
import 'sweetalert2/dist/sweetalert2.min.css';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="h-screen flex flex-col">
      {/* NAVBAR TOP */}
      <div className="w-full">
        <Navbar />
      </div>

      {/* ★ Toast ระดับ layout */}
      <AppointmentsToastSweet limit={3} />

      {/* MAIN AREA */}
      <div className="flex flex-1 overflow-hidden bg-gray-300">
        {/* LEFT SIDEBAR */}
        <div
          className={`${isCollapsed ? "w-16 pt-14" : "w-57"} 
          transition-all duration-300 bg-white mt-2 p-4 relative 
          rounded-tr-2xl shadow-lg`}
        >
          {/* TOGGLE BUTTON */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3 top-4 bg-white border rounded-full p-1 shadow-md"
          >
            {isCollapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
          </button>

          {/* MENU */}
          <Menu isCollapsed={isCollapsed} />
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 bg-gray-300 overflow-auto p-3">
          {children}
        </div>
      </div>
    </div>
  );
}
