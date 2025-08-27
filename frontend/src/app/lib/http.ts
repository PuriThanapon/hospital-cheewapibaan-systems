const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ||       // รองรับชื่อเดิมของคุณ
  process.env.NEXT_PUBLIC_API_BASE ||      // เผื่อหน้าอื่นใช้ชื่อนี้
  'http://localhost:5000'                  // fallback
).replace(/\/$/, '');

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

export async function http<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const url = /^https?:\/\//i.test(path) ? path : joinUrl(API_BASE, path);
  const headers = options.body instanceof FormData
    ? {} : { 'Content-Type': 'application/json' };

  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    cache: 'no-store',
  });

  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const j = await res.json(); msg = j.message || msg; } catch {}
    console.error('HTTP error:', url, msg);
    throw new Error(msg);
  }
  if (res.status === 204) return null as T;
  const ct = res.headers.get('content-type') || '';
  return (ct.includes('application/json') ? res.json() : res.text()) as T;
}
