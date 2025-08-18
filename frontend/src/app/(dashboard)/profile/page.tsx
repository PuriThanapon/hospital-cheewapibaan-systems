'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './page.module.css';

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------
type UserProfile = {
  id: string;
  name: string;
  role: 'ผู้ดูแลระบบ' | 'พยาบาล' | 'เจ้าหน้าที่' | 'แพทย์' | 'ผู้ใช้ทั่วไป';
  email: string;
  phone?: string;
  department?: string;
  about?: string;
  avatarUrl?: string; // remote url
};

type FormErrors = Partial<Record<keyof UserProfile, string>> & { password?: string };

// ------------------------------------------------------------
// Page Component
// ------------------------------------------------------------
export default function ProfilePage() {
  // ⚠️ แทนที่ initialProfile ด้วยข้อมูลจริงจากระบบของคุณ (เช่น fetch จาก API ใน useEffect)
  const initialProfile: UserProfile = useMemo(
    () => ({
      id: 'u_001',
      name: 'Phuthanet Sitthiwichai',
      role: 'ผู้ดูแลระบบ',
      email: 'admin@example.com',
      phone: '08x-xxx-xxxx',
      department: 'แผนกชีวาภิบาล',
      about: 'ดูแลระบบโรงพยาบาลและเวิร์กโฟลว์ของทีมงาน',
      avatarUrl:
        'https://scontent.fbkk12-3.fna.fbcdn.net/v/t39.30808-1/462507050_4069822256579766_3251004265784467628_n.jpg?stp=dst-jpg_s200x200_tt6&_nc_cat=102&ccb=1-7&_nc_sid=e99d92&_nc_ohc=ErJqVZMN420Q7kNvwHQ7ESj&_nc_oc=AdkJr_Y9WBSl5BSR7Mn4mh9vfvCWtCuhWF141ATN0QkZeZG-q-t1r_dj7_-hQrO9-v7IKD_AamaWX5SD5YBvqBDh&_nc_zt=24&_nc_ht=scontent.fbkk12-3.fna&_nc_gid=AotkxksVEWFUWH-xe---DA&oh=00_AfXdXPJgV3NfUEaV7ya_-clke_7xm4zVjTOBXDjUlCIEig&oe=68A4349A',
    }),
    []
  );

  const [form, setForm] = useState<UserProfile>(initialProfile);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [changePwOpen, setChangePwOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!avatarFile) return;
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  function validate(f: UserProfile): FormErrors {
    const e: FormErrors = {};
    if (!f.name?.trim()) e.name = 'กรุณากรอกชื่อ-นามสกุล';
    if (!f.email?.trim()) e.email = 'กรุณากรอกอีเมล';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'รูปแบบอีเมลไม่ถูกต้อง';
    if (f.phone && !/^[0-9+\-\s]{6,}$/.test(f.phone)) e.phone = 'รูปแบบเบอร์โทรไม่ถูกต้อง';
    return e;
  }

  async function handleSave() {
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setSaving(true);
    setSaved(false);

    try {
      // 1) ถ้ามีไฟล์รูปใหม่ -> อัปโหลดไฟล์ไปยัง backend/Storage ก่อน แล้วได้ avatarUrl ใหม่
      // const avatarUrl = avatarFile ? await uploadAvatar(avatarFile) : form.avatarUrl;

      // 2) ส่งข้อมูล profile ไป API
      // await fetch('/api/profile', { method: 'PUT', body: JSON.stringify({ ...form, avatarUrl }) })

      await new Promise((r) => setTimeout(r, 500)); // mock
      setSaved(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  function handleSignOut() {
    // TODO: วาง logic ออกจากระบบ
    alert('กำลังออกจากระบบ (ตัวอย่าง)');
  }

  function handleDeleteAccount() {
    if (!confirm('ยืนยันลบบัญชีผู้ใช้และข้อมูลที่เกี่ยวข้องทั้งหมดหรือไม่?')) return;
    // TODO: เรียก API ลบบัญชี
    alert('ลบบัญชีแล้ว (ตัวอย่าง)');
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrapper}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>ข้อมูลส่วนตัว</h1>
            <p className={styles.subtitle}>แก้ไขข้อมูลบัญชีของคุณและการตั้งค่าความปลอดภัย</p>
          </div>
          <div className={styles.headerActions}>
            <button onClick={() => setChangePwOpen(true)} className={styles.btnSecondary}>
              เปลี่ยนรหัสผ่าน
            </button>
            <button onClick={handleSave} disabled={saving} className={styles.btnPrimary}>
              {saving ? 'กำลังบันทึก…' : 'บันทึกการเปลี่ยนแปลง'}
            </button>
          </div>
        </div>

        {/* Top section: Avatar + Basic Info */}
        <div className={styles.grid3}>
          {/* Avatar Card */}
          <div className={styles.card}>
            <div className={styles.avatarRow}>
              <div className={styles.avatar}>
                <img
                  src={avatarPreview || form.avatarUrl || '/user.png'}
                  alt="avatar"
                  className={styles.avatarImg}
                />
                {/* Upload button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={styles.avatarUploadBtn}
                >
                  เปลี่ยนรูป
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className={styles.hiddenInput}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setAvatarFile(f);
                  }}
                />
              </div>

              <div className={styles.basicInfo}>
                <div className={styles.name} title={form.name}>{form.name}</div>
                <div className={styles.role}>{form.role}</div>
                {form.department && (
                  <div className={styles.deptBadge}>
                    <span>🏥</span> {form.department}
                  </div>
                )}
              </div>
            </div>

            <p className={styles.about}>{form.about || '—'}</p>
          </div>

          {/* Basic Info Form */}
          <div className={`${styles.card} ${styles.colSpan2}`}>
            <div className={styles.formGrid}>
              <Field label="ชื่อ-นามสกุล" error={errors.name}>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={styles.input}
                  placeholder="เช่น สมชาย ใจดี"
                />
              </Field>

              <Field label="อีเมล" error={errors.email}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={styles.input}
                  placeholder="you@example.com"
                />
              </Field>

              <Field label="เบอร์โทร" error={errors.phone}>
                <input
                  value={form.phone || ''}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={styles.input}
                  placeholder="08x-xxx-xxxx"
                />
              </Field>

              <Field label="แผนก/หน่วยงาน">
                <input
                  value={form.department || ''}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className={styles.input}
                  placeholder="เช่น แผนกชีวาภิบาล"
                />
              </Field>

              <Field label="เกี่ยวกับฉัน" full>
                <textarea
                  value={form.about || ''}
                  onChange={(e) => setForm({ ...form, about: e.target.value })}
                  className={`${styles.input} ${styles.textarea}`}
                  placeholder="เล่าเกี่ยวกับหน้าที่/ความรับผิดชอบโดยย่อ"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Account & Security */}
        <div className={styles.grid3}>
          <div className={styles.card}>
            <SectionTitle>ความปลอดภัยของบัญชี</SectionTitle>
            <ul className={styles.securityList}>
              <li className={styles.securityItem}>
                <span>การยืนยันอีเมล</span>
                <span className={`${styles.pill} ${styles.pillSuccess}`}>ยืนยันแล้ว</span>
              </li>
              <li className={styles.securityItem}>
                <span>เปิด 2FA</span>
                <span className={`${styles.pill}`}>ยังไม่เปิด</span>
              </li>
              <li className={styles.securityFooter}>
                <button
                  onClick={() => setChangePwOpen(true)}
                  className={styles.linkBrand}
                >
                  เปลี่ยนรหัสผ่าน
                </button>
              </li>
            </ul>
          </div>

          <div className={`${styles.card} ${styles.colSpan2}`}>
            <SectionTitle>อุปกรณ์ที่ใช้งานล่าสุด</SectionTitle>
            <div className={styles.devices}>
              {[
                { os: 'Windows 10 · Chrome', ip: '183.88.***.***', when: '2 ชั่วโมงที่แล้ว', current: true },
                { os: 'iPhone · Safari', ip: '49.49.***.***', when: 'เมื่อวานนี้ 14:21', current: false },
              ].map((it, idx) => (
                <div key={idx} className={styles.deviceItem}>
                  <div>
                    <div className={styles.deviceTitle}>{it.os}</div>
                    <div className={styles.deviceSub}>IP: {it.ip}</div>
                  </div>
                  <div className={styles.deviceActions}>
                    {it.current && (
                      <span className={`${styles.pill} ${styles.pillSuccess}`}>อุปกรณ์ปัจจุบัน</span>
                    )}
                    <button className={styles.btnTextDanger}>ออกจากระบบอุปกรณ์นี้</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className={styles.card}>
          <SectionTitle>เขตอันตราย</SectionTitle>
          <div className={styles.dangerRow}>
            <div className={styles.dangerText}>
              การออกจากระบบ หรือการลบบัญชีผู้ใช้ของคุณและข้อมูลที่เกี่ยวข้องทั้งหมด โปรดดำเนินการด้วยความระมัดระวัง
            </div>
            <div className={styles.btnGroup}>
              <button onClick={handleSignOut} className={styles.btnSecondary}>ออกจากระบบ</button>
              <button onClick={handleDeleteAccount} className={styles.btnDanger}>ลบบัญชี</button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div className={`${styles.toast} ${saved ? styles.toastVisible : styles.toastHidden}`}>
        <div className={styles.toastBox}>บันทึกเรียบร้อย</div>
      </div>

      {/* Change Password Modal */}
      {changePwOpen && (
        <ChangePasswordModal onClose={() => setChangePwOpen(false)} onSaved={() => setChangePwOpen(false)} />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Sub Components
// ------------------------------------------------------------
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className={styles.sectionTitle}>{children}</h2>;
}

function Field({
  label,
  error,
  children,
  full,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`${styles.field} ${full ? styles.full : ''}`}>
      <span className={styles.label}>{label}</span>
      {children}
      {error && <span className={styles.error}>{error}</span>}
    </label>
  );
}

function ChangePasswordModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [current, setCurrent] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current) return;
      const t = e.target as Node;
      if (!panelRef.current.contains(t)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [onClose]);

  function validate() {
    if (!current.trim() || !pw1.trim() || !pw2.trim()) return 'กรุณากรอกข้อมูลให้ครบ';
    if (pw1.length < 8) return 'รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร';
    if (pw1 !== pw2) return 'รหัสผ่านใหม่ไม่ตรงกัน';
    return null;
  }

  async function submit() {
    const v = validate();
    setErr(v);
    if (v) return;
    setSaving(true);
    try {
      // await fetch('/api/change-password', { method: 'POST', body: JSON.stringify({ current, pw1 }) })
      await new Promise((r) => setTimeout(r, 500));
      onSaved();
      alert('เปลี่ยนรหัสผ่านเรียบร้อย');
    } catch (e) {
      setErr('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.modalOverlay}>
      <div ref={panelRef} className={styles.modalPanel}>
        <h3 className={styles.modalTitle}>เปลี่ยนรหัสผ่าน</h3>
        <p className={styles.modalDesc}>เพื่อความปลอดภัย โปรดกรอกรหัสผ่านปัจจุบันและตั้งรหัสผ่านใหม่</p>

        <div className={styles.modalFields}>
          <label className={styles.field}>
            <span className={styles.label}>รหัสผ่านปัจจุบัน</span>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className={styles.input} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>รหัสผ่านใหม่</span>
            <input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} className={styles.input} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>ยืนยันรหัสผ่านใหม่</span>
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={styles.input} />
          </label>
          {err && <div className={styles.error}>{err}</div>}
        </div>

        <div className={styles.modalActions}>
          <button onClick={onClose} className={styles.btnSecondary}>ยกเลิก</button>
          <button onClick={submit} disabled={saving} className={styles.btnBrand}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
}