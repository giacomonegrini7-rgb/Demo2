import type { Locale } from '../data/catalog';

export const INTL_LOCALE: Record<Locale, string> = { it: 'it-IT', en: 'en-GB', es: 'es-ES', sv: 'sv-SE' };

export function formatEur(cents: number, locale: Locale): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatPercentX10(x10: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(x10 / 10);
}

/** Durata indicativa di sola andata: "4–5 h", "1 h 15–1 h 50", "1–1 h 45". */
export function formatDuration([a, b]: [number, number], locale: Locale): string {
  const unit = locale === 'sv' ? 'tim' : 'h';
  const part = (m: number, bare: boolean) => {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    if (mm === 0) return bare ? `${hh}` : `${hh} ${unit}`;
    return `${hh} ${unit} ${String(mm).padStart(2, '0')}`;
  };
  return `${part(a, true)}–${part(b, false)}`;
}

export function interpolate(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
