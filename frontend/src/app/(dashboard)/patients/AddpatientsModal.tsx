'use client';
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import Swal from 'sweetalert2';

// ฟังก์ชันสำหรับคำนวณอายุจากวันเกิด
const calculateAgeFromBirthdate = (birthdate) => {
    if (!birthdate) return '';
    const birth = new Date(birthdate);
    if (isNaN(birth.getTime())) return ''; // ตรวจสอบ valid date
    
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();

    if (months < 0 || (months === 0 && today.getDate() < birth.getDate())) {
        years--;
        months = 12 + months;
    }
    
    // Adjust months if today's day is before birth day
    if (today.getDate() < birth.getDate() && months > 0) {
        months--;
    }

    if (years > 0) {
        return `${years} ปี`;
    } else if (months > 0) {
        return `${months} เดือน`;
    } else {
        // กรณีวันเกิดและวันนี้เป็นวันเดียวกัน
        return `0 เดือน`;
    }
};

// ฟังก์ชันสำหรับตรวจสอบความถูกต้องของข้อมูลทั้งหมด
const validatePatientData = (patientData) => {
  const errors = {};

  // ตรวจสอบข้อมูลส่วนตัว
  if (!patientData.pname) {
      errors.pname = 'กรุณาเลือกคำนำหน้า';
  }
  if (!patientData.first_name) {
      errors.first_name = 'กรุณากรอกชื่อจริง';
  }
  if (!patientData.last_name) {
      errors.last_name = 'กรุณากรอกนามสกุล';
  }
  if (!patientData.card_id) {
      errors.card_id = 'กรุณากรอกเลขบัตรประชาชน';
  } else if (!/^\d{13}$/.test(patientData.card_id)) {
      errors.card_id = 'เลขบัตรประชาชนไม่ถูกต้อง (13 หลัก)';
  }
  if (!patientData.birthdate) {
    errors.birthdate = 'กรุณาเลือกวันเกิด';
  } else {
    const birthDate = new Date(patientData.birthdate);
    const today = new Date();
    if (birthDate > today) {
      errors.birthdate = 'วันเกิดไม่ถูกต้อง';
    }
  }
  if (!patientData.gender) {
    errors.gender = 'กรุณาเลือกเพศ';
  }

  // ตรวจสอบข้อมูลร่างกายและทางการแพทย์
  if (!patientData.weight) {
      errors.weight = 'กรุณากรอกน้ำหนัก';
  } else if (isNaN(patientData.weight) || patientData.weight <= 0) {
      errors.weight = 'น้ำหนักต้องเป็นตัวเลขที่มากกว่า 0';
  }
  if (!patientData.height) {
      errors.height = 'กรุณากรอกส่วนสูง';
  } else if (isNaN(patientData.height) || patientData.height <= 0) {
      errors.height = 'ส่วนสูงต้องเป็นตัวเลขที่มากกว่า 0';
  }
  if (!patientData.blood_group) {
    errors.blood_group = 'กรุณาเลือกกรุ๊ปเลือด (ABO)';
  }
  if (!patientData.bloodgroup_rh) {
    errors.bloodgroup_rh = 'กรุณาเลือกกรุ๊ปเลือด (Rh)';
  }
  if (!patientData.patients_type) {
    errors.patients_type = 'กรุณาเลือกประเภทการช่วยเหลือตนเอง';
  }

  // ตรวจสอบข้อมูลติดต่อและที่อยู่
  if (!patientData.phone_number) {
    errors.phone_number = 'กรุณากรอกเบอร์โทรศัพท์';
  }
  if (!patientData.admittion_date) {
    errors.admittion_date = 'กรุณาเลือกวันที่เข้ารับการรักษา';
} else {
    const admissionDate = new Date(patientData.admittion_date);
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    if (admissionDate > today) {
        errors.admittion_date = 'วันที่เข้ารับการรักษาไม่ถูกต้อง (ไม่สามารถเลือกวันที่ในอนาคตได้)';
    }
}

  if (!patientData.address) {
    errors.address = 'กรุณากรอกที่อยู่';
  }


  return errors;
};

// คอมโพเนนต์ Modal สำหรับเพิ่มข้อมูลผู้ป่วย
const AddPatientModal = ({ onClose, onSave }) => {
    // เพิ่ม state สำหรับเก็บข้อผิดพลาด
    const [errors, setErrors] = useState({});

    const [form, setForm] = useState({
        pname: '',
        first_name: '',
        last_name: '',
        card_id: '',
        birthdate: '',
        gender: '',
        nationality: '',
        phone_number: '',
        weight: '',
        height: '',
        patients_type: '',
        blood_group: '',
        bloodgroup_rh: '',
        disease: '',
        address: '',
        admittion_date: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'birthdate') {
            const age = calculateAgeFromBirthdate(value);
            setForm(prev => ({ ...prev, birthdate: value, age }));
        } else {
            setForm(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); // ป้องกันการรีโหลดหน้าเว็บ

        // เรียกใช้ฟังก์ชัน validatePatientData เพื่อตรวจสอบข้อมูลทั้งหมด
        const validationErrors = validatePatientData(form);
        setErrors(validationErrors); // ตั้งค่า state ข้อผิดพลาด

        // ตรวจสอบว่ามีข้อผิดพลาดหรือไม่
        if (Object.keys(validationErrors).length > 0) {
            console.error('Validation failed', validationErrors);
            // สร้างข้อความสรุปสำหรับแสดงใน Swal
            const errorMessages = Object.values(validationErrors).join('<br>');
            Swal.fire({
                title: "มีข้อผิดพลาด",
                html: errorMessages,
                icon: "error",
                draggable: true
            });
            return; // หยุดการทำงานถ้ามีข้อผิดพลาด
        }

        // ถ้าข้อมูลถูกต้องทั้งหมด ให้ดำเนินการต่อ
        try {
            const payload = { ...form };
            delete payload.age; // ลบฟิลด์อายุที่ไม่ต้องการส่งไป backend

            // แก้ไขค่า birthdate และ admittion_date ที่เป็น string ว่างให้เป็น null เพื่อป้องกันข้อผิดพลาดจาก database
            if (payload.birthdate === '') {
                payload.birthdate = null;
            }
            if (payload.admittion_date === '') {
                payload.admittion_date = null;
            }

            // ส่งข้อมูลไปยัง API
            const res = await fetch('http://localhost:5000/api/patients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                Swal.fire({
                    title: "บันทึกข้อมูลสำเร็จ",
                    icon: "success",
                    draggable: true
                });
                onSave();
            } else {
                const errorData = await res.json();
                Swal.fire({
                    title: "เกิดข้อผิดพลาด",
                    text: errorData.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
                    icon: "error",
                    draggable: true
                });
            }
        } catch (err) {
            console.error(err);
            Swal.fire({
                title: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้",
                text: "โปรดลองอีกครั้งในภายหลัง",
                icon: "error",
                draggable: true
            });
        }
    };

    const inputClasses = "peer w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500";
    const labelClasses = "absolute left-3 -top-2.5 text-gray-600 text-sm bg-white px-1 transition-all duration-200 peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-blue-500";

    return (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex justify-center items-center p-4 z-40">
            <div className="border border-black bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-2xl text-black font-bold mb-6 text-center">เพิ่มข้อมูลผู้ป่วยใหม่</h3>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-6">
                        {/* ส่วนข้อมูลส่วนตัวผู้ป่วย */}
                        <h4 className="text-lg text-black font-semibold border-b pb-2 mb-4">ข้อมูลส่วนตัวผู้ป่วย</h4>
                        <div className="text-black grid grid-cols-1 md:grid-cols-2 gap-4">

                            {/* แถวสำหรับ คำนำหน้า, ชื่อ, และนามสกุล */}
                            <div className="grid grid-cols-5 gap-2 md:col-span-2">
                                {/* ช่องกรอกคำนำหน้าชื่อ */}
                                <div className="relative col-span-1">
                                    <select id="pname" name="pname" value={form.pname} onChange={handleChange} className={inputClasses}>
                                        <option value="" disabled hidden>-- เลือกคำนำหน้า --</option>
                                        <option value="นาย">นาย</option>
                                        <option value="นางสาว">นางสาว</option>
                                        <option value="น.ส.">น.ส.</option>
                                    </select>
                                    <label htmlFor="pname" className={labelClasses}>คำนำหน้า</label>
                                    {errors.pname && <p className="text-red-500 text-sm mt-1">{errors.pname}</p>}
                                </div>
                                {/* ช่องกรอกชื่อจริง */}
                                <div className="relative col-span-2">
                                    <input id="first_name" name="first_name" value={form.first_name} onChange={handleChange} placeholder=" " className={inputClasses} />
                                    <label htmlFor="first_name" className={labelClasses}>ชื่อจริง</label>
                                    {errors.first_name && <p className="text-red-500 text-sm mt-1">{errors.first_name}</p>}
                                </div>
                                {/* ช่องกรอกนามสกุล */}
                                <div className="relative col-span-2">
                                    <input id="last_name" name="last_name" value={form.last_name} onChange={handleChange} placeholder=" " className={inputClasses} />
                                    <label htmlFor="last_name" className={labelClasses}>นามสกุล</label>
                                    {errors.last_name && <p className="text-red-500 text-sm mt-1">{errors.last_name}</p>}
                                </div>
                            </div>

                            {/* แถวเดิมสำหรับช่องที่เหลือ */}
                            <div className="relative">
                                <input id="card_id" name="card_id" value={form.card_id} onChange={handleChange} placeholder=" " className={inputClasses} />
                                <label htmlFor="card_id" className={labelClasses}>เลขบัตรประชาชน</label>
                                {errors.card_id && <p className="text-red-500 text-sm mt-1">{errors.card_id}</p>}
                            </div>
                            <div className="relative">
                                <input id="birthdate" name="birthdate" type="date" value={form.birthdate} onChange={handleChange} className={inputClasses} />
                                <label htmlFor="birthdate" className={labelClasses}>วันเกิด</label>
                                {errors.birthdate && <p className="text-red-500 text-sm mt-1">{errors.birthdate}</p>}
                            </div>
                            <div className="relative">
                                <input id="age" name="age" value={form.age} placeholder=" " readOnly className={`${inputClasses} bg-gray-100 cursor-not-allowed`} />
                                <label htmlFor="age" className={labelClasses}>อายุ</label>
                            </div>
                            <div className="relative">
                                <select id="gender" name="gender" value={form.gender} onChange={handleChange} className={inputClasses}>
                                    <option value="" disabled hidden>-- เลือกเพศ --</option>
                                    <option value="ชาย">ชาย</option>
                                    <option value="หญิง">หญิง</option>
                                    <option value="อื่น ๆ">อื่น ๆ</option>
                                </select>
                                <label htmlFor="gender" className={labelClasses}>เพศ</label>
                                {errors.gender && <p className="text-red-500 text-sm mt-1">{errors.gender}</p>}
                            </div>
                            <div className="relative">
                                <input id="nationality" name="nationality" value={form.nationality} onChange={handleChange} placeholder=" " className={inputClasses} />
                                <label htmlFor="nationality" className={labelClasses}>สัญชาติ</label>
                            </div>
                        </div>

                        {/* ส่วนข้อมูลร่างกายและทางการแพทย์ */}
                        <div>
                            <h4 className="text-lg text-black font-semibold border-b pb-2 mb-4">ข้อมูลร่างกายและทางการแพทย์</h4>
                            <div className="text-black grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative">
                                    <input id="weight" name="weight" value={form.weight} onChange={handleChange} placeholder=" " className={inputClasses} />
                                    <label htmlFor="weight" className={labelClasses}>น้ำหนัก (กก.)</label>
                                    {errors.weight && <p className="text-red-500 text-sm mt-1">{errors.weight}</p>}
                                </div>
                                <div className="relative">
                                    <input id="height" name="height" value={form.height} onChange={handleChange} placeholder=" " className={inputClasses} />
                                    <label htmlFor="height" className={labelClasses}>ส่วนสูง (ซม.)</label>
                                    {errors.height && <p className="text-red-500 text-sm mt-1">{errors.height}</p>}
                                </div>
                                <div className="relative">
                                    <select id="blood_group" name="blood_group" value={form.blood_group} onChange={handleChange} className={inputClasses}>
                                        <option value="" disabled hidden>-- เลือกประเภทกรุ๊ปเลือด --</option>
                                        <option value="A">A</option>
                                        <option value="B">B</option>
                                        <option value="AB">AB</option>
                                        <option value="O">O</option>
                                    </select>
                                    <label htmlFor="blood_group" className={labelClasses}>กรุ๊ปเลือด</label>
                                    {errors.blood_group && <p className="text-red-500 text-sm mt-1">{errors.blood_group}</p>}
                                </div>
                                <div className="relative">
                                    <select id="bloodgroup_rh" name="bloodgroup_rh" value={form.bloodgroup_rh} onChange={handleChange} className={inputClasses}>
                                        <option value="" disabled hidden>-- เลือกประเภท Rh --</option>
                                        <option value="Rh+">Rh+</option>
                                        <option value="Rh-">Rh-</option>
                                    </select>
                                    <label htmlFor="bloodgroup_rh" className={labelClasses}>ประเภท Rh</label>
                                    {errors.bloodgroup_rh && <p className="text-red-500 text-sm mt-1">{errors.bloodgroup_rh}</p>}
                                </div>
                                <div className="relative">
                                    <select id="patients_type" name="patients_type" value={form.patients_type} onChange={handleChange} className={inputClasses}>
                                        <option value="" disabled hidden>-- เลือกประเภทการช่วยเหลือตนเอง --</option>
                                        <option value="ช่วยเหลือตัวเองได้">ช่วยเหลือตัวเองได้</option>
                                        <option value="ต้องการช่วยเหลือบางส่วน">ต้องการช่วยเหลือบางส่วน</option>
                                        <option value="ช่วยเหลือตัวเองไม่ได้เลย">ช่วยเหลือตัวเองไม่ได้เลย</option>
                                    </select>
                                    <label htmlFor="patients_type" className={labelClasses}>ประเภทการช่วยเหลือตนเอง</label>
                                    {errors.patients_type && <p className="text-red-500 text-sm mt-1">{errors.patients_type}</p>}
                                </div>
                                <div className="relative md:col-span-2">
                                    <input id="disease" name="disease" value={form.disease} onChange={handleChange} placeholder=" " className={inputClasses} />
                                    <label htmlFor="disease" className={labelClasses}>โรคประจำตัว</label>
                                </div>
                            </div>
                        </div>

                        {/* ส่วนข้อมูลติดต่อและที่อยู่ */}
                        <div>
                            <h4 className="text-lg text-black font-semibold border-b pb-2 mb-4">ข้อมูลติดต่อและที่อยู่</h4>
                            <div className="text-black grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative">
                                    <input id="phone_number" name="phone_number" value={form.phone_number} onChange={handleChange} placeholder=" " className={inputClasses} />
                                    <label htmlFor="phone_number" className={labelClasses}>เบอร์โทร</label>
                                    {errors.phone_number && <p className="text-red-500 text-sm mt-1">{errors.phone_number}</p>}
                                </div>
                                <div className="relative">
                                    <input id="admittion_date" name="admittion_date" type="date" value={form.admittion_date} onChange={handleChange} className={inputClasses} />
                                    <label htmlFor="admittion_date" className={labelClasses}>วันที่เข้ารับการรักษา</label>
                                    {errors.admittion_date && <p className="text-red-500 text-sm mt-1">{errors.admittion_date}</p>}
                                </div>
                                <div className="relative md:col-span-2">
                                    <textarea id="address" name="address" value={form.address} onChange={handleChange} placeholder=" " rows="3" className={inputClasses}></textarea>
                                    <label htmlFor="address" className={labelClasses}>ที่อยู่</label>
                                    {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 mt-8">
                        <button onClick={onClose} type="button" className="px-6 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800">ยกเลิก</button>
                        <button type="submit" className="px-6 py-2 rounded-md bg-green-500 hover:bg-green-600 text-white">บันทึกข้อมูล</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddPatientModal;
