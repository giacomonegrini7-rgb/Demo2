// localStorage protetto: in navigazione privata o con storage bloccato si usa la memoria.
const memory = new Map<string, string>();
let available: boolean | null = null;

export function storageAvailable(): boolean {
  if (available != null) return available;
  try {
    const k = '__tr_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

export function readJson<T>(key: string): T | null {
  try {
    const raw = storageAvailable() ? window.localStorage.getItem(key) : memory.get(key) ?? null;
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  try {
    if (storageAvailable()) window.localStorage.setItem(key, raw);
    else memory.set(key, raw);
  } catch {
    memory.set(key, raw);
  }
}

export function removeKey(key: string): void {
  try {
    if (storageAvailable()) window.localStorage.removeItem(key);
  } catch {
    /* ignorato */
  }
  memory.delete(key);
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
