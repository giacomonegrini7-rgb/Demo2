import { useEffect, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Globe, ShieldCheck } from 'lucide-react';
import { LOCALES, type Locale } from '../data/catalog';
import { DICTS, useI18n } from '../i18n';
import { effectiveMode, useFlow } from '../state/flow';
import { Pill } from './ui';

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect x="2" y="7" width="28" height="18" rx="4" fill="#176b63" />
        <circle cx="21" cy="7" r="3" fill="#f7f5ef" />
        <circle cx="21" cy="25" r="3" fill="#f7f5ef" />
        <line x1="21" y1="11" x2="21" y2="21" stroke="#f7f5ef" strokeWidth="1.6" strokeDasharray="2 2" />
        <path d="M7.5 19.5 a5 5 0 1 1 6 0" fill="none" stroke="#d77a60" strokeWidth="2" strokeLinecap="round" />
        <path d="M13.5 19.5 l0.3 -2.8 l2.4 1.2" fill="none" stroke="#d77a60" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-serif text-[1.05rem] font-medium tracking-tight whitespace-nowrap text-ink sm:text-[1.18rem]">Travel Recovery</span>
    </span>
  );
}

export function LanguageSelect() {
  const { locale, setLocale, d } = useI18n();
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{d.common.language}</span>
      <Globe className="pointer-events-none absolute left-3 size-4 text-ink-soft" aria-hidden />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="min-h-11 cursor-pointer appearance-none rounded-full border border-line bg-white py-2 pr-4 pl-9 text-sm font-medium text-ink hover:border-ink/40"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={DICTS[l].meta.htmlLang}>{DICTS[l].meta.langName}</option>
        ))}
      </select>
    </label>
  );
}

export function DemoModeBar() {
  const { d } = useI18n();
  return (
    <div className="sticky top-0 z-30 border-b border-petrol/20 bg-petrol-tint/95 backdrop-blur-sm" role="status">
      <p className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-sm font-semibold text-petrol-dark">
        <ShieldCheck className="size-4" aria-hidden />
        {d.common.demoModeBar}
      </p>
    </div>
  );
}

function ModeBadge() {
  const { d } = useI18n();
  const { state, config } = useFlow();
  const mode = effectiveMode(state, config);
  if (mode === 'preview') return <Pill tone="warm">{d.common.previewBadge}</Pill>;
  if (mode === 'test') return <Pill tone="warm">{d.common.testBadge}</Pill>;
  return null;
}

export function PublicLayout({ children }: { children?: ReactNode }) {
  const { d, t } = useI18n();
  const { state, storageOk } = useFlow();
  const { pathname } = useLocation();

  // Navigazione accessibile: a ogni pagina si torna in alto e il focus va al titolo.
  useEffect(() => {
    window.scrollTo(0, 0);
    const h = document.querySelector<HTMLElement>('[data-page-heading]');
    if (h && document.activeElement === document.body) h.focus({ preventScroll: true });
  }, [pathname]);

  const code = state.sessionId?.slice(0, 8).toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">{d.common.skipToContent}</a>
      <header className="border-b border-line/70 bg-ivory/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="rounded-lg" aria-label={d.common.brand}>
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 sm:inline-flex"><Pill>{d.common.researchDemo}</Pill><ModeBadge /></span>
            <LanguageSelect />
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl gap-2 px-4 pb-2 sm:hidden"><Pill>{d.common.researchDemo}</Pill><ModeBadge /></div>
      </header>
      {!storageOk && (
        <p className="bg-terracotta-tint px-4 py-2 text-center text-sm text-ink">{d.errors.storageUnavailable}</p>
      )}
      <main id="main" className="flex-1">
        {children ?? <Outlet />}
      </main>
      <footer className="mt-16 border-t border-line/70 bg-sand/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-xl leading-relaxed">{d.common.footer}</p>
          <div className="flex flex-col gap-1 sm:items-end">
            <Link to="/privacy" className="font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink">{d.common.privacy}</Link>
            {code && <span className="tabular">{t(d.common.participationCode, { code })}</span>}
          </div>
        </div>
      </footer>
    </div>
  );
}
