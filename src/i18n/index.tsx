import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import it, { type Dict } from './it';
import en from './en';
import es from './es';
import sv from './sv';
import { LOCALES, type Locale } from '../data/catalog';
import { interpolate } from '../lib/format';

export const DICTS: Record<Locale, Dict> = { it, en, es, sv };

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

/** Lingua del browser se supportata, altrimenti inglese. */
export function detectLocale(langs: readonly string[] = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []): Locale {
  for (const l of langs) {
    const base = l.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return 'en';
}

interface I18nValue {
  locale: Locale;
  d: Dict;
  t: (template: string, vars?: Record<string, string | number>) => string;
  setLocale: (l: Locale) => void;
}

const Ctx = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, setLocale, children }: { locale: Locale; setLocale: (l: Locale) => void; children: ReactNode }) {
  const d = DICTS[locale];
  useEffect(() => {
    document.documentElement.lang = d.meta.htmlLang;
  }, [d]);
  const t = useCallback((template: string, vars?: Record<string, string | number>) => interpolate(template, vars), []);
  const value = useMemo(() => ({ locale, d, t, setLocale }), [locale, d, t, setLocale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside provider');
  return v;
}
