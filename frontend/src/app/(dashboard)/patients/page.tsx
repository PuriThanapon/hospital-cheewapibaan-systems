"use client";

import React, { useEffect, useState } from 'react';
import axios from 'axios';
// import styles from './patients.module.css'; // Remove CSS Module import
import { Eye, Pencil, Plus } from 'lucide-react';
import AddPatientModal from './AddpatientsModal';
import EditPatientModal from './EditpatientsModal';
import ViewPatientModal from './ViewpatientsModal';


export default function PatientsTable() {
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [error, setError] = useState('');

  //ตัวกรอง
  const [filterGender, setFilterGender] = useState('');
  const [filterPatientType, setFilterPatientType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBlood_group, setFilterBlood_group] = useState('');
  const [filterBloodgroup_rh, setFilterBloodgroup_rh] = useState('');

  const fetchPatients = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/patients');
      const allPatients = response.data;
      const filteredPatients = allPatients.filter(patient => {
        const matchGender = filterGender ? patient.gender === filterGender : true;
        const matchPatientType = filterPatientType ? patient.patients_type === filterPatientType : true;
        const matchStatus = filterStatus ? patient.status === filterStatus : true;
        const matchBlood_group = filterBlood_group ? patient.blood_group === filterBlood_group : true;
        const matchBloodgroup_rh = filterBloodgroup_rh ? patient.bloodgroup_rh === filterBloodgroup_rh : true;
        return matchGender && matchPatientType && matchStatus && matchBlood_group && matchBloodgroup_rh;
      });
      setPatients(filteredPatients);
    } catch (error) {
      console.error('ดึงข้อมูลไม่สำเร็จ', error);
    }
  };

  const handleSearch = async () => {
    if (!patientId.trim()) return;

    try {
      const response = await axios.get(`http://localhost:5000/api/patients/${patientId}`);
      setPatients([response.data]);  // ใส่เป็น array เดียว
      setError('');
    } catch (err) {
      setPatients([]);
      setError('ไม่พบข้อมูลผู้ป่วย');
    }
  };

  const handleClearFilters = () => {
  setFilterGender('');
  setFilterPatientType('');
  setFilterStatus('');
  setFilterBlood_group('');
  setFilterBloodgroup_rh('');
};


  useEffect(() => {
    fetchPatients();
  }, [filterGender, filterPatientType, filterStatus, filterBlood_group, filterBloodgroup_rh]);

  const handleEditClick = async (patientId) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/patients/${patientId}`);
      setSelectedPatient(res.data);
      setShowEditModal(true);
    } catch (error) {
      console.error('โหลดข้อมูลผู้ป่วยล้มเหลว', error);
    }
  };

  const handleViewClick = async (patientId) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/patients/${patientId}`);
      setSelectedPatient(res.data);
      setShowViewModal(true);
    } catch (error) {
      console.error('ไม่สามารถโหลดข้อมูลผู้ป่วยได้', error);
      alert('โหลดข้อมูลผู้ป่วยไม่สำเร็จ');
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setSelectedPatient(null);
    fetchPatients();
  };

  return (
    <div className="p-6 bg-gray-300 min-h-screen flex flex-col">
      <div className="justify-between items-center mb-6 bg-white min-h-screen ps-6 px-5 py-5 rounded-xl ">
      <div className="flex justify-between items-center mb-6"> 
        <h2 className="text-2xl text-black font-bold ">ข้อมูลผู้ป่วยในแผนก</h2>
        <button className="bg-[#4CAF50] text-white px-4 py-2 rounded-md hover:bg-green-600 flex items-center space-x-2" onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> 
          <span>เพิ่มผู้ป่วย</span>
        </button>
      </div>

      <div className="flex space-x-2 mb-6 text-black">
        <input
          type="text"
          placeholder="กรอกรหัสผู้ป่วยเพื่อค้นหา"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          className="flex-grow p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={handleSearch} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">ค้นหา</button>
        <button onClick={fetchPatients} className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400">แสดงทั้งหมด</button>
      </div>

      <div className="flex flex-wrap space-x-2 mb-6 text-black">
        <select
          value={filterGender}
          onChange={(e) => setFilterGender(e.target.value)}
          className="p-2 border rounded-md"
        >
          <option value="" disabled hidden>เพศทั้งหมด</option>
          <option value="ชาย">ชาย</option>
          <option value="หญิง">หญิง</option>
          <option value="อื่นๆ">อื่นๆ</option>
        </select>

        <select
          value={filterBlood_group}
          onChange={(e) => setFilterBlood_group(e.target.value)}
          className="p-2 border rounded-md"
        >
          <option value="" disabled hidden>กรู๊ปเลือดทั้งหมด</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="AB">AB</option>
          <option value="O">O</option>
        </select>

        <select
          value={filterBloodgroup_rh}
          onChange={(e) => setFilterBloodgroup_rh(e.target.value)}
          className="p-2 border rounded-md"
        >
          <option value="" disabled hidden>ประเภท Rh ทั้งหมด</option>
          <option value="Rh+">Rh+</option>
          <option value="Rh-">Rh-</option>
        </select>

        <select
          value={filterPatientType}
          onChange={(e) => setFilterPatientType(e.target.value)}
          className="p-2 border rounded-md"
        >
          <option value="" disabled hidden>ประเภทผู้ป่วยทั้งหมด</option>
          <option value="ช่วยเหลือตัวเองได้">ช่วยเหลือตัวเองได้</option>
          <option value="ต้องการช่วยเหลือบางส่วน">ต้องการช่วยเหลือบางส่วน</option>
          <option value="ช่วยเหลือตัวเองไม่ได้เลย">ช่วยเหลือตัวเองไม่ได้เลย</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="p-2 border rounded-md"
        >
          <option value="" disabled hidden>สถานะทั้งหมด</option>
          <option value="มีชีวิต">มีชีวิต</option>
          <option value="เสียชีวิต">เสียชีวิต</option>
        </select>

        <button onClick={handleClearFilters} className="bg-red-500 text-white px-4 rounded-md hover:bg-red-600">
        ล้างตัวกรอง
        </button>

      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">{error}</div>}

      <div className="flex-1 overflow-auto bg-white shadow-md rounded-lg">
        <table className="min-w-full">
            <thead className="bg-[#00796b]">
            <tr>
                <th className="px-6 py-6 text-left text-sm text-white font-bold uppercase tracking-wider">รหัสประจำตัว</th>
                <th className="px-4 py-6 text-left text-sm text-white font-bold uppercase tracking-wider">ชื่อจริง-นามสกุล</th>
                <th className="px-4 py-6 text-left text-sm text-white font-bold uppercase tracking-wider">อายุ</th>
                <th className="px-4 py-6 text-left text-sm text-white font-bold uppercase tracking-wider">วันที่เข้ารับการรักษา</th>
                <th className="px-4 py-6 text-left text-sm text-white font-bold uppercase tracking-wider">เพศ</th>
                <th className="pl-6 py-6 text-left text-sm text-white font-bold uppercase tracking-wider">กรุ๊ปเลือด</th>
                <th className="px-4 py-6 text-left text-sm text-white font-bold uppercase tracking-wider">ประเภท Rh</th>
                <th className="px-4 py-6 text-left text-sm text-white font-bold uppercase tracking-wider">การช่วยเหลือตนเอง</th>
                <th className="px-4 py-6 text-left text-sm text-white font-bold uppercase tracking-wider">โรคประจำตัว</th>
                <th className="px-4 py-6 text-left text-sm text-white font-bold uppercase tracking-wider">สถานะ</th>
                <th className="px-4 py-6 text-left text-sm text-white font-bold uppercase tracking-wider">การจัดการ</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
            {patients.length > 0 ? (
                patients.map((p, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-black font-medium whitespace-nowrap">{p.patients_id || 'N/A'}</td>
                    <td className="px-4 py-4 text-black font-medium whitespace-nowrap">{p.pname} {p.first_name} {p.last_name}</td>
                    <td className="px-4 py-4 text-black font-medium whitespace-nowrap">{calcAge(p.birthdate)} ปี</td>
                    <td className="px-4 py-4 text-black font-medium whitespace-nowrap">{formatThaiDate(p.admittion_date)}</td>
                    <td className="px-4 py-4 text-black font-medium whitespace-nowrap">{p.gender}</td>
                    <td className="pl-6 py-4 text-black font-medium whitespace-nowrap">{p.blood_group}</td>
                    <td className="px-4 py-4 text-black font-medium whitespace-nowrap">{p.bloodgroup_rh}</td>
                    <td className="px-4 py-4 text-black font-medium whitespace-nowrap">{p.patients_type}</td>
                    <td className="px-4 py-4 text-black font-medium whitespace-nowrap">{p.disease}</td>
                    <td className="px-4 py-4 text-black font-medium whitespace-nowrap">{p.status || '-'}</td>
                    <td className="px-4 py-4 text-black font-medium whitespace-nowrap flex space-x-2">
                    {/* Converted from styles.actions */}
                    <button className="px-2 text-gray-600 hover:text-blue-500" onClick={() => handleViewClick(p.patients_id)} title='ตรวจสอบ'><Eye size={20} /></button>
                    {/* Converted from styles.iconButton */}
                    <button className="text-gray-600 hover:text-yellow-500" onClick={() => handleEditClick(p.patients_id)} title='แก้ไข'><Pencil size={20} /></button>
                    {/* Converted from styles.iconButton */}
                    </td>
                </tr>
                ))
            ) : (
                <tr>
                <td colSpan="8" className="px-6 py-4 text-center text-gray-500 h-screen">ไม่มีข้อมูลผู้ป่วย</td>
                </tr>
            )}
            </tbody>
        </table>
      </div>

      {/* Modal เพิ่มข้อมูล */}
      {showAddModal && (
        <AddPatientModal
          onClose={() => setShowAddModal(false)}
          onSave={() => {
            setShowAddModal(false);
            fetchPatients();  // รีเฟรชข้อมูลหลังเพิ่มสำเร็จ
          }}
        />
      )}

      {/* Modal ตรวจสอบข้อมูล */}
      {showViewModal && selectedPatient && (
        <ViewPatientModal
          patientData={selectedPatient}
          onClose={() => {
            setShowViewModal(false);
            setSelectedPatient(null);
          }}
        />
      )}

      {/* Modal แก้ไขข้อมูล */}
      {showEditModal && selectedPatient && (
        <EditPatientModal
          patientData={selectedPatient}
          onClose={handleCloseModal}
          onSaveSuccess={handleCloseModal}
        />
      )}

      </div>
    </div>
  );
}

// ฟังก์ชันคำนวณอายุ
function calcAge(birthdate) {
  if (!birthdate) return '-';
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}


// แปลงวันที่เป็นภาษาไทย
function formatThaiDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}