'use client';
import React, { useState, useEffect } from 'react';

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
    } else {
        return `${months} เดือน`;
    }
};

// Custom Modal สำหรับแสดงข้อความแจ้งเตือนแทน alert()
const CustomMessageModal = ({ message, onClose }) => (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
            <p className="text-gray-800 text-center mb-4">{message}</p>
            <div className="flex justify-center">
                <button
                    onClick={onClose}
                    className="px-6 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white"
                >
                    ตกลง
                </button>
            </div>
        </div>
    </div>
);

const EditPatientModal = ({ patientData, onClose, onSaveSuccess }) => {
    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        card_id: '',
        birthdate: '',
        age: '',
        gender: '',
        nationality: '',
        phone_number: '',
        weight: '',
        height: '',
        patients_type: '',
        blood_group: '',
        disease: '',
        address: '',
        admittion_date: '',
    });

    const [message, setMessage] = useState('');
    const [showMessageModal, setShowMessageModal] = useState(false);

    useEffect(() => {
        if (patientData) {
            setForm({
                ...patientData,
                // แปลง birthdate เป็นรูปแบบ yyyy-mm-dd สำหรับ input type="date"
                birthdate: patientData.birthdate ? new Date(patientData.birthdate).toISOString().split('T')[0] : '',
                admittion_date: patientData.admittion_date ? new Date(patientData.admittion_date).toISOString().split('T')[0] : '',
                age: calculateAgeFromBirthdate(patientData.birthdate),
            });
        }
    }, [patientData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'birthdate') {
            const age = calculateAgeFromBirthdate(value);
            setForm(prev => ({ ...prev, birthdate: value, age }));
        } else {
            setForm(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async () => {
        try {
            // ตรวจสอบความถูกต้องของข้อมูลเบื้องต้น
            if (!form.first_name || !form.last_name || !form.card_id) {
                setMessage('กรุณากรอกชื่อ นามสกุล และเลขบัตรประชาชนให้ครบถ้วน');
                setShowMessageModal(true);
                return;
            }

            if (!/^\d{13}$/.test(form.card_id)) {
                setMessage('เลขบัตรประชาชนไม่ถูกต้อง');
                setShowMessageModal(true);
                return;
            }

            const payload = { ...form };
            delete payload.age;

            // แก้ไขค่า birthdate และ admittion_date ที่เป็น string ว่างให้เป็น null
            if (payload.birthdate === '') {
                payload.birthdate = null;
            }
            if (payload.admittion_date === '') {
                payload.admittion_date = null;
            }

            const res = await fetch(`http://localhost:5000/api/patients/${patientData.patients_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                setMessage('แก้ไขข้อมูลสำเร็จ');
                setShowMessageModal(true);
                onSaveSuccess();
            } else {
                const errorData = await res.json();
                setMessage(errorData.error || 'เกิดข้อผิดพลาดในการแก้ไข');
                setShowMessageModal(true);
            }
        } catch (err) {
            console.error(err);
            setMessage('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
            setShowMessageModal(true);
        }
    };

    const inputClasses = "peer w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500";
    const labelClasses = "absolute left-3 -top-2.5 text-gray-600 text-sm bg-white px-1 transition-all duration-200 peer-placeholder-shown:top-2 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-blue-500";
    const sectionTitleClass = "text-lg text-black font-semibold border-b pb-2 mb-4";

    return (
        <div className="fixed inset-0 bg-white/80 flex justify-center items-center p-4 z-50">
            <div className="border border-black bg-white rounded-xl shadow-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-black text-2xl font-bold mb-6 text-center">แก้ไขข้อมูลผู้ป่วย</h3>
                
                <div className="space-y-6">
                    {/* ส่วนข้อมูลส่วนตัวผู้ป่วย */}
                    <div>
                        <h4 className={sectionTitleClass}>ข้อมูลส่วนตัวผู้ป่วย</h4>
                        <div className="text-black grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                                <input id="first_name" name="first_name" value={form.first_name} onChange={handleChange} placeholder=" " required className={inputClasses} />
                                <label htmlFor="first_name" className={labelClasses}>ชื่อจริง</label>
                            </div>
                            <div className="relative">
                                <input id="last_name" name="last_name" value={form.last_name} onChange={handleChange} placeholder=" " required className={inputClasses} />
                                <label htmlFor="last_name" className={labelClasses}>นามสกุล</label>
                            </div>
                            <div className="relative">
                                <input id="card_id" name="card_id" value={form.card_id} onChange={handleChange} placeholder=" " required className={inputClasses} />
                                <label htmlFor="card_id" className={labelClasses}>เลขบัตรประชาชน</label>
                            </div>
                            <div className="relative">
                                <input id="birthdate" name="birthdate" type="date" value={form.birthdate} onChange={handleChange} required className={inputClasses} />
                                <label htmlFor="birthdate" className={labelClasses}>วันเกิด</label>
                            </div>
                            <div className="relative">
                                <input id="age" name="age" value={form.age} placeholder=" " readOnly className={`${inputClasses} bg-gray-100 cursor-not-allowed`} />
                                <label htmlFor="age" className={labelClasses}>อายุ</label>
                            </div>
                            <div className="relative">
                                <select id="gender" name="gender" value={form.gender} onChange={handleChange} required className={inputClasses}>
                                    <option value="">-- เลือกเพศ --</option>
                                    <option value="ชาย">ชาย</option>
                                    <option value="หญิง">หญิง</option>
                                    <option value="อื่น ๆ">อื่น ๆ</option>
                                </select>
                                <label htmlFor="gender" className={labelClasses}>เพศ</label>
                            </div>
                            <div className="relative md:col-span-2">
                                <input id="nationality" name="nationality" value={form.nationality} onChange={handleChange} placeholder=" " required className={inputClasses} />
                                <label htmlFor="nationality" className={labelClasses}>สัญชาติ</label>
                            </div>
                        </div>
                    </div>

                    {/* ส่วนข้อมูลร่างกายและทางการแพทย์ */}
                    <div>
                        <h4 className={sectionTitleClass}>ข้อมูลร่างกายและทางการแพทย์</h4>
                        <div className="text-black grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                                <input id="weight" name="weight" value={form.weight} onChange={handleChange} placeholder=" " required className={inputClasses} />
                                <label htmlFor="weight" className={labelClasses}>น้ำหนัก (กก.)</label>
                            </div>
                            <div className="relative">
                                <input id="height" name="height" value={form.height} onChange={handleChange} placeholder=" " required className={inputClasses} />
                                <label htmlFor="height" className={labelClasses}>ส่วนสูง (ซม.)</label>
                            </div>
                            <div className="relative">
                                <input id="blood_group" name="blood_group" value={form.blood_group} onChange={handleChange} placeholder=" " required className={inputClasses} />
                                <label htmlFor="blood_group" className={labelClasses}>กรุ๊ปเลือด</label>
                            </div>
                            <div className="relative">
                                <select id="patients_type" name="patients_type" value={form.patients_type} onChange={handleChange} required className={inputClasses}>
                                    <option value="">-- เลือกประเภทการช่วยเหลือตนเอง --</option>
                                    <option value="ช่วยเหลือตัวเองได้">ช่วยเหลือตัวเองได้</option>
                                    <option value="ต้องการช่วยเหลือบางส่วน">ต้องการช่วยเหลือบางส่วน</option>
                                    <option value="ช่วยเหลือตัวเองไม่ได้เลย">ช่วยเหลือตัวเองไม่ได้เลย</option>
                                </select>
                                <label htmlFor="patients_type" className={labelClasses}>ประเภทการช่วยเหลือตนเอง</label>
                            </div>
                            <div className="relative md:col-span-2">
                                <input id="disease" name="disease" value={form.disease} onChange={handleChange} placeholder=" " required className={inputClasses} />
                                <label htmlFor="disease" className={labelClasses}>โรคประจำตัว</label>
                            </div>
                        </div>
                    </div>

                    {/* ส่วนข้อมูลติดต่อและที่อยู่ */}
                    <div>
                        <h4 className={sectionTitleClass}>ข้อมูลติดต่อและที่อยู่</h4>
                        <div className="text-black grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                                <input id="phone_number" name="phone_number" value={form.phone_number} onChange={handleChange} placeholder=" " required className={inputClasses} />
                                <label htmlFor="phone_number" className={labelClasses}>เบอร์โทร</label>
                            </div>
                            <div className="relative">
                                <input id="admittion_date" name="admittion_date" type="date" value={form.admittion_date} onChange={handleChange} required className={inputClasses} />
                                <label htmlFor="admittion_date" className={labelClasses}>วันที่เข้ารับการรักษา</label>
                            </div>
                            <div className="relative md:col-span-2">
                                <textarea id="address" name="address" value={form.address} onChange={handleChange} placeholder=" " required rows="3" className={inputClasses}></textarea>
                                <label htmlFor="address" className={labelClasses}>ที่อยู่</label>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-3 mt-8">
                    <button onClick={onClose} className="px-6 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800">ยกเลิก</button>
                    <button onClick={handleSubmit} className="px-6 py-2 rounded-md bg-green-500 hover:bg-green-600 text-white">บันทึกการแก้ไข</button>
                </div>
            </div>
            {showMessageModal && <CustomMessageModal message={message} onClose={() => setShowMessageModal(false)} />}
        </div>
    );
};

export default EditPatientModal;
