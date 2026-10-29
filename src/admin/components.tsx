import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { COUNTRY_IDS, COUNTRIES, DESTINATION_IDS, HOTELS, LOCALES, ORIGIN_IDS, ORIGINS } from '../data/catalog';
import { fmtPct, STAGES, type Filters, type Ratio, type Stage } from './stats';
import { useAdminData } from './data';
import { EMPTY_FILTERS } from './stats';

export const STAGE_LABEL: Record<Stage, string> = {
  started: 'Avvio', preferences: 'Preferenze inviate', offers: 'Offerte mostrate', detail: 'Dettaglio aperto',
  checkout: 'Checkout iniziato', paid: 'Pagamento simulato', transferred: 'Trasferimento simulato',
};
export const ENTRY_LABEL: Record<string, string> = {
  outcome: 'Dopo l’esito dell’acquisto simulato', results: 'Dai risultati («Nessuna proposta»)', detail: 'Dal dettaglio, senza procedere',
  summary: 'Dal riepilogo, senza pagare', transfer: 'Dalla pratica', other: 'Accesso diretto / non noto',
};
export const EMAIL_LABEL: Record<string, string> = { not_shown: 'Non mostrata', pending: 'Mostrata, nessuna scelta', declined: 'Saltata esplicitamente', submitted: 'Inviata con consenso' };
export const LOCALE_LABEL: Record<string, string> = { it: 'Italiano', en: 'English', es: 'Español', sv: 'Svenska' };

export function Panel({ title, children, note, className = '', actions }: { title: ReactNode; children: ReactNode; note?: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`print-break rounded-2xl border border-line/80 bg-white p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-sans text-[1.02rem] font-semibold tracking-normal text-ink">{title}</h2>
        {actions}
      </div>
      {children}
      {note && <p className="mt-3 text-xs leading-relaxed text-muted">{note}</p>}
    </section>
  );
}

export function Tile({ label, value, sub, definition }: { label: string; value: ReactNode; sub?: ReactNode; definition: string }) {
  return (
    <div className="rounded-2xl border border-line/80 bg-white p-4">
      <p className="text-[0.8rem] font-semibold text-ink-soft">{label}</p>
      <p className="mt-1 text-[1.9rem] leading-none font-semibold tabular text-ink">{value}</p>
      {sub && <p className="mt-1 text-sm text-muted tabular">{sub}</p>}
      <p className="mt-2 text-xs leading-snug text-muted">{definition}</p>
    </div>
  );
}

/** Barre orizzontali con valori sempre scritti: leggibili senza colore e da screen reader. */
export function BarList({ rows, base, emptyText = 'Nessun dato con i filtri attuali.' }: { rows: { label: string; count: number; ratio?: Ratio; muted?: boolean }[]; base?: number; emptyText?: string }) {
  if (base === 0 || rows.every((r) => r.count === 0 && !r.ratio)) return <p className="text-sm text-muted">{emptyText}</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li key={r.label} className="grid gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className={r.muted ? 'text-muted' : 'text-ink'}>{r.label}</span>
            <span className="shrink-0 font-semibold tabular">{r.count}{r.ratio && <span className="ml-1.5 font-normal text-muted">({fmtPct(r.ratio)})</span>}</span>
          </div>
          <div className="h-2 rounded-full bg-sand" aria-hidden>
            <div className={`h-2 rounded-full ${r.muted ? 'bg-ink-soft/40' : 'bg-petrol'}`} style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const sel = 'min-h-10 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm';

export function FilterBar() {
  const { filters: f, setFilters, settings, preview } = useAdminData();
  const set = (patch: Partial<Filters>) => setFilters({ ...f, ...patch });
  const versions = settings?.versions.map((v) => v.id) ?? [];
  return (
    <form className="no-print grid gap-3 rounded-2xl border border-line/80 bg-white p-4" onSubmit={(e) => e.preventDefault()} aria-label="Filtri">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="grid gap-1 text-xs font-semibold text-ink-soft">Dati
          <select className={sel} value={f.data} onChange={(e) => set({ data: e.target.value as Filters['data'] })}>
            <option value="live">Solo ricerca live</option>
            <option value="test">Solo prove (test)</option>
            <option value="all">Tutti</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-ink-soft">Avvio dal
          <input type="date" className={sel} value={f.from} onChange={(e) => set({ from: e.target.value })} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-ink-soft">Avvio al
          <input type="date" className={sel} value={f.to} onChange={(e) => set({ to: e.target.value })} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-ink-soft">Versione
          <select className={sel} value={f.version} onChange={(e) => set({ version: e.target.value })}>
            <option value="">Tutte</option>
            {versions.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-ink-soft">Lingua iniziale
          <select className={sel} value={f.locale} onChange={(e) => set({ locale: e.target.value })}>
            <option value="">Tutte</option>
            {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABEL[l]}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-ink-soft">Paese di partenza
          <select className={sel} value={f.country} onChange={(e) => set({ country: e.target.value, origin: '' })}>
            <option value="">Tutti</option>
            {COUNTRY_IDS.map((c) => <option key={c} value={c}>{COUNTRIES[c].name.it}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-ink-soft">Città di partenza
          <select className={sel} value={f.origin} onChange={(e) => set({ origin: e.target.value })}>
            <option value="">Tutte</option>
            {ORIGIN_IDS.filter((o) => !f.country || ORIGINS[o].country === f.country).map((o) => <option key={o} value={o}>{ORIGINS[o].name.it}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-ink-soft">Destinazione scelta
          <select className={sel} value={f.destination} onChange={(e) => set({ destination: e.target.value })}>
            <option value="">Tutte</option>
            {DESTINATION_IDS.map((d) => <option key={d} value={d}>{HOTELS[d].city.it}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-ink-soft">Stato demo
          <select className={sel} value={f.stage} onChange={(e) => set({ stage: e.target.value })}>
            <option value="">Tutti</option>
            {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-ink-soft">Questionario
          <select className={sel} value={f.survey} onChange={(e) => set({ survey: e.target.value as Filters['survey'] })}>
            <option value="">Tutti</option>
            <option value="completed">Completato</option>
            <option value="not_completed">Non completato</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-ink-soft">Email
          <select className={sel} value={f.email} onChange={(e) => set({ email: e.target.value as Filters['email'] })}>
            <option value="">Tutte</option>
            <option value="yes">Presente</option>
            <option value="no">Assente</option>
          </select>
        </label>
        <div className="flex items-end">
          <button type="button" onClick={() => setFilters(preview ? { ...EMPTY_FILTERS, data: 'test' } : EMPTY_FILTERS)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-petrol hover:bg-petrol-tint">
            <RotateCcw className="size-3.5" aria-hidden />Azzera filtri
          </button>
        </div>
      </div>
      <p className="text-xs text-muted">I filtri valgono per KPI, grafici, lista ed export. Il periodo si basa sulla data di avvio della partecipazione (UTC). «Paese di partenza» non indica la nazionalità.</p>
    </form>
  );
}
