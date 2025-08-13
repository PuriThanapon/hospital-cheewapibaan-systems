import React from 'react';

export default function ViewPatientModal({ patientData, onClose }) {
    if (!patientData) return null;

    // ฟังก์ชันสำหรับจัดรูปแบบวันที่
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // ฟังก์ชันสำหรับคำนวณอายุ
    const calculateAgeFromBirthdate = (birthdate) => {
        if (!birthdate) return '-';
        const birth = new Date(birthdate);
        if (isNaN(birth.getTime())) return '-';

        const today = new Date();
        let years = today.getFullYear() - birth.getFullYear();
        let months = today.getMonth() - birth.getMonth();

        if (months < 0 || (months === 0 && today.getDate() < birth.getDate())) {
            years--;
            months = 12 + months;
        }

        if (years > 0) {
            return `${years} ปี`;
        } else {
            return `${months} เดือน`;
        }
    };

    const dataItemClass = "flex flex-col gap-1";
    const labelClass = "text-sm font-semibold text-gray-500";
    const valueClass = "text-base font-medium text-gray-800";
    const sectionTitleClass = "text-lg text-black font-semibold border-b pb-2 mb-4";

    return (
        <div className="fixed inset-0 bg-white/80 flex justify-center items-center p-4 z-50">
            <div className="border border-black bg-white rounded-xl shadow-2xl p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-black text-2xl font-bold mb-6 text-center">รายละเอียดผู้ป่วย</h2>
                
                <div className="space-y-6">
                    {/* ส่วนข้อมูลส่วนตัวผู้ป่วย */}
                    <div>
                        <h4 className={sectionTitleClass}>ข้อมูลส่วนตัว</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-gray-700">
                            <div className={dataItemClass}>
                                <span className={labelClass}>ชื่อ-นามสกุล:</span>
                                <span className={valueClass}>{patientData.pname} {patientData.first_name} {patientData.last_name}</span>
                            </div>
                            <div className={dataItemClass}>
                                <span className={labelClass}>รหัสบัตรประชาชน:</span>
                                <span className={valueClass}>{patientData.card_id}</span>
                            </div>
                            <div className={dataItemClass}>
                                <span className={labelClass}>เพศ:</span>
                                <span className={valueClass}>{patientData.gender}</span>
                            </div>
                            <div className={dataItemClass}>
                                <span className={labelClass}>วันเกิด:</span>
                                <span className={valueClass}>{formatDate(patientData.birthdate)}</span>
                            </div>
                            <div className={dataItemClass}>
                                <span className={labelClass}>อายุ:</span>
                                <span className={valueClass}>{calculateAgeFromBirthdate(patientData.birthdate)}</span>
                            </div>
                            <div className={dataItemClass}>
                                <span className={labelClass}>สัญชาติ:</span>
                                <span className={valueClass}>{patientData.nationality}</span>
                            </div>
                        </div>
                    </div>

                    {/* ส่วนข้อมูลสุขภาพ */}
                    <div>
                        <h4 className={sectionTitleClass}>ข้อมูลสุขภาพ</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-x-6 gap-y-4 text-gray-700">
                            <div className={dataItemClass}>
                                <span className={labelClass}>น้ำหนัก:</span>
                                <span className={valueClass}>{patientData.weight ? `${patientData.weight} กก.` : '-'}</span>
                            </div>
                            <div className={dataItemClass}>
                                <span className={labelClass}>ส่วนสูง:</span>
                                <span className={valueClass}>{patientData.height ? `${patientData.height} ซม.` : '-'}</span>
                            </div>
                            <div className={dataItemClass}>
                                <span className={labelClass}>กรุ๊ปเลือด:</span>
                                <span className={valueClass}>{patientData.blood_group || '-'}</span>
                            </div>
                            <div className={dataItemClass}>
                                <span className={labelClass}>ประเภท Rh:</span>
                                <span className={valueClass}>{patientData.bloodgroup_rh || '-'}</span>
                            </div>
                            <div className={dataItemClass}>
                                <span className={labelClass}>ประเภทการช่วยเหลือตนเอง:</span>
                                <span className={valueClass}>{patientData.patients_type || '-'}</span>
                            </div>
                            <div className={dataItemClass}>
                                <span className={labelClass}>โรคประจำตัว:</span>
                                <span className={valueClass}>{patientData.disease || '-'}</span>
                            </div>
                        </div>
                    </div>

                    {/* ส่วนข้อมูลติดต่อและที่อยู่ */}
                    <div>
                        <h4 className={sectionTitleClass}>ข้อมูลติดต่อและที่อยู่</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-x-6 gap-y-4 text-gray-700">
                            <div className={dataItemClass}>
                                <span className={labelClass}>เบอร์โทรศัพท์:</span>
                                <span className={valueClass}>{patientData.phone_number || '-'}</span>
                            </div>
                            <div className={dataItemClass}>
                                <span className={labelClass}>วันที่เข้ารับการรักษา:</span>
                                <span className={valueClass}>{formatDate(patientData.admittion_date)}</span>
                            </div>
                            <div className="col-span-1 sm:col-span-2 flex flex-col gap-2">
                                <span className={labelClass}>ที่อยู่:</span>
                                <span className={valueClass}>{patientData.address || '-'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end mt-8">
                    <button onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold shadow-md transition-all duration-200">ปิด</button>
                </div>
            </div>
        </div>
    );
}
