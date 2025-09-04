export type Routine = {
  id: number;
  name: string;
  note?: string | null;
  times: string[];          // "HH:MM"
  days: number[];           // 1..7 (จันทร์=1 ... อาทิตย์=7)
  startDate?: string | null; // YYYY-MM-DD (optional)
  endDate?: string | null;   // YYYY-MM-DD (optional)
  active?: boolean;          // default true
};

export type FlatItem = {
  routine_id: number;
  routine_name: string;
  routine_time: string;  // HH:MM:SS
};

const STORAGE_KEY = 'routine-global-v1';

function readAll(): Routine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // seed ตัวอย่าง
      const seed: Routine[] = [
        { id: 1, name: 'ตื่นนอน', times: ['07:30'], days: [1,2,3,4,5,6,7], active: true },
        { id: 2, name: 'กินข้าวเช้า', times: ['08:00'], days: [1,2,3,4,5,6,7], active: true },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeAll(list: Routine[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function isoDow(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const n = d.getDay(); // 0..6 (Sun..Sat)
  return n === 0 ? 7 : n; // 1..7
}

export const RoutineStore = {
  listForDate(dateStr: string): FlatItem[] {
    const dow = isoDow(dateStr);
    const all = readAll().filter(r => r.active !== false)
      .filter(r => r.days.includes(dow))
      .filter(r => !r.startDate || r.startDate <= dateStr)
      .filter(r => !r.endDate || r.endDate >= dateStr);

    const flat: FlatItem[] = [];
    for (const r of all) {
      for (const t of r.times) flat.push({ routine_id: r.id, routine_name: r.name, routine_time: `${t}:00` });
    }
    flat.sort((a,b)=> a.routine_time.localeCompare(b.routine_time) || a.routine_name.localeCompare(b.routine_name));
    return flat;
  },

  create({ name, time, days = [1,2,3,4,5,6,7] }: { name: string; time: string; days?: number[] }) {
    const all = readAll();
    const nextId = all.reduce((m, r) => Math.max(m, r.id), 0) + 1;
    all.push({ id: nextId, name, times: [time], days, active: true });
    writeAll(all);
  },

  updateName(id: number, name: string) {
    const all = readAll();
    const r = all.find(x => x.id === id);
    if (r) { r.name = name; writeAll(all); }
  },

  replaceTime(id: number, oldTime: string, newTime: string) {
    const all = readAll();
    const r = all.find(x => x.id === id);
    if (!r) return;
    const i = r.times.indexOf(oldTime);
    if (i >= 0) { r.times[i] = newTime; writeAll(all); }
  },

  deleteTime(id: number, time: string) {
    const all = readAll();
    const r = all.find(x => x.id === id);
    if (!r) return { ok: false, error: 'not found' };
    if (r.times.length <= 1) return { ok: false, error: 'ต้องเหลือเวลาอย่างน้อย 1 ค่า' };
    r.times = r.times.filter(t => t !== time);
    writeAll(all);
    return { ok: true };
  },

  deleteRoutine(id: number) {
    const all = readAll().filter(x => x.id !== id);
    writeAll(all);
  },

  clearAll() { writeAll([]); }
};



