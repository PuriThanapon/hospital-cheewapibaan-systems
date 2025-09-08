// src/integrations/supabase.js
// ใช้ได้กับโปรเจกต์ CommonJS (require) และยังเหมาะกับ serverless เพราะ reuse client
let _clientPromise = null;

function ensureEnv() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
}

function normalizePath(p) {
  // ห้ามมี '/' นำหน้า และห้ามเว้นว่าง
  const s = String(p || '').trim().replace(/^\/+/, '');
  if (!s) throw new Error('Invalid Supabase path');
  return s;
}

async function getClient() {
  if (_clientPromise) return _clientPromise;
  ensureEnv();
  _clientPromise = (async () => {
    // dynamic import เพื่อเลี่ยง ERR_REQUIRE_ESM
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  })();
  return _clientPromise;
}

/**
 * สร้าง signed URL สำหรับพรีวิว/ดาวน์โหลด
 * @param {string} bucket ชื่อ bucket (เช่น 'templates')
 * @param {string} path   path ใน bucket (เช่น 'core/register.pdf') — ห้ามนำหน้าด้วย '/'
 * @param {{expiresSec?:number, downloadName?:string}} opts
 *   - expiresSec: อายุลิงก์ (วินาที) ค่าเริ่มต้น 300
 *   - downloadName: ใส่เมื่อเป็นโหมดดาวน์โหลดเท่านั้น (เซิร์ฟเวอร์จะส่ง Content-Disposition ให้ชื่อไฟล์นี้)
 */
async function signUrl(bucket, path, { expiresSec = 300, downloadName } = {}) {
  const sb = await getClient();
  const clean = normalizePath(path);

  const options = {};
  if (downloadName) options.download = downloadName;

  const { data, error } = await sb.storage
    .from(bucket)
    .createSignedUrl(clean, expiresSec, options);

  if (error) throw new Error(`Supabase signUrl failed: ${error.message}`);
  return data.signedUrl;
}

/**
 * อัปโหลดไฟล์ขึ้น Supabase Storage
 * @returns {{ path: string, fullPath?: string }|{bucket:string,path:string}}
 */
async function uploadFile(bucket, path, buffer, mime, { upsert = true } = {}) {
  const sb = await getClient();
  const clean = normalizePath(path);

  const { data, error } = await sb.storage
    .from(bucket)
    .upload(clean, buffer, { contentType: mime, upsert });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  // data อาจเป็น undefined ในบางเวอร์ชัน — ส่งค่ามาตรฐานกลับไปด้วย
  return data ?? { bucket, path: clean };
}

module.exports = { signUrl, uploadFile };
