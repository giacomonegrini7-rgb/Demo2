// Date di calendario "YYYY-MM-DD" senza fuso orario. L'aritmetica avviene in UTC,
// che non ha ora legale: nessun calcolo con millisecondi/86400000 su orari locali.

export type CivilDate = string;

const RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCivilDate(v: unknown): v is CivilDate {
  if (typeof v !== 'string') return false;
  const m = RE.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function toUtc(d: CivilDate): Date {
  const m = RE.exec(d);
  if (!m) throw new Error(`Invalid civil date: ${d}`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

function fromUtc(d: Date): CivilDate {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function addDays(d: CivilDate, days: number): CivilDate {
  const u = toUtc(d);
  u.setUTCDate(u.getUTCDate() + days);
  return fromUtc(u);
}

export function diffDays(from: CivilDate, to: CivilDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** Data locale del dispositivo, calcolata con i campi locali (non con toISOString, che è UTC). */
export function localToday(now: Date = new Date()): CivilDate {
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const da = String(now.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export const WINDOW_FIRST_OFFSET = 1;
export const WINDOW_LAST_OFFSET = 14;
export const MIN_SPAN_DAYS = 2;

export function windowBounds(referenceDate: CivilDate) {
  return { min: addDays(referenceDate, WINDOW_FIRST_OFFSET), max: addDays(referenceDate, WINDOW_LAST_OFFSET) };
}

export type IntervalError = 'missing' | 'order' | 'too_early' | 'too_late' | 'too_short';

export function validateInterval(referenceDate: CivilDate, start?: CivilDate | null, end?: CivilDate | null): IntervalError | null {
  if (!start || !end || !isCivilDate(start) || !isCivilDate(end)) return 'missing';
  const { min, max } = windowBounds(referenceDate);
  if (diffDays(start, end) < 0) return 'order';
  if (diffDays(min, start) < 0) return 'too_early';
  if (diffDays(end, max) < 0) return 'too_late';
  if (diffDays(start, end) < MIN_SPAN_DAYS) return 'too_short';
  return null;
}

/** Regola deterministica: check-in = primo giorno dell'intervallo, check-out = +2 giorni. */
export function stayDates(intervalStart: CivilDate) {
  return { checkIn: intervalStart, checkOut: addDays(intervalStart, 2) };
}

export function windowDays(referenceDate: CivilDate): CivilDate[] {
  const out: CivilDate[] = [];
  for (let i = WINDOW_FIRST_OFFSET; i <= WINDOW_LAST_OFFSET; i++) out.push(addDays(referenceDate, i));
  return out;
}

/** Formatta una data di calendario con Intl, ancorata a UTC per non slittare di un giorno. */
export function formatCivil(d: CivilDate, locale: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).format(toUtc(d));
}

export function formatRange(a: CivilDate, b: CivilDate, locale: string): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' };
  const fmt = new Intl.DateTimeFormat(locale, opts);
  return typeof fmt.formatRange === 'function' ? fmt.formatRange(toUtc(a), toUtc(b)) : `${fmt.format(toUtc(a))} – ${fmt.format(toUtc(b))}`;
}

export function weekdayIndex(d: CivilDate): number {
  return (toUtc(d).getUTCDay() + 6) % 7; // lunedì = 0
}
