import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import it from '../../i18n/it';
import { HOTELS, ORIGINS, type OriginId } from '../../data/catalog';
import { QUESTIONS, QUESTION_BY_ID, type QuestionId } from '../../survey/definition';
import { BarList, ENTRY_LABEL, EMAIL_LABEL, FilterBar, LOCALE_LABEL, Panel, STAGE_LABEL, Tile } from '../components';
import { useAdminData } from '../data';
import { c3Summary, countBy, crosstab, destinationStats, distribution, emailStatuses, feedbackEntries, fmtPct, funnel, kpis, openTexts, type Crosstab } from '../stats';
import { download, stamp, statsCsv } from '../exports';
import { Button } from '../../components/ui';
import { Link } from 'react-router';

const short = (s: string, n = 64) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const optLabel = (q: QuestionId, i: number) => it.survey.questions[q].options[i];

function CrossTable({ x, title }: { x: Crosstab; title: string }) {
  const multi = QUESTION_BY_ID[x.colsQ].kind === 'multi';
  return (
    <Panel title={title} note={multi ? 'Le colonne sono a scelta multipla: una persona può comparire in più colonne. Le percentuali sono sul totale di riga (rispondenti a entrambe le domande).' : 'Percentuali sul totale di riga (rispondenti a entrambe le domande). Tutte le categorie sono mostrate, comprese incertezze e rifiuti.'}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col" className="p-2 text-left font-semibold text-ink-soft">{x.rowsQ.toUpperCase()} \ {x.colsQ.toUpperCase()}</th>
              {x.cols.map((c, i) => <th key={c} scope="col" className="p-2 text-left align-bottom font-semibold text-ink-soft" title={optLabel(x.colsQ, i)}>{i + 1}. {short(optLabel(x.colsQ, i), 28)}</th>)}
              <th scope="col" className="p-2 text-right font-semibold">Totale</th>
            </tr>
          </thead>
          <tbody>
            {x.rows.map((r, ri) => (
              <tr key={r} className="border-t border-line/70">
                <th scope="row" className="p-2 text-left font-medium" title={optLabel(x.rowsQ, ri)}>{ri + 1}. {short(optLabel(x.rowsQ, ri), 40)}</th>
                {x.cells[ri].map((n, ci) => (
                  <td key={ci} className="p-2 tabular" style={{ background: x.rowTotals[ri] ? `rgb(23 107 99 / ${(n / x.rowTotals[ri]) * 0.35})` : undefined }}>
                    {n}{x.rowTotals[ri] > 0 && <span className="text-muted"> ({Math.round((n / x.rowTotals[ri]) * 100)}%)</span>}
                  </td>
                ))}
                <td className="p-2 text-right font-semibold tabular">{x.rowTotals[ri]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export default function Dashboard() {
  const { filtered, dataset, filters, settings, role } = useAdminData();
  const [query, setQuery] = useState('');
  const k = useMemo(() => kpis(filtered, dataset?.contacts ?? null), [filtered, dataset]);
  const f = useMemo(() => funnel(filtered), [filtered]);
  const entries = useMemo(() => feedbackEntries(filtered), [filtered]);
  const dests = useMemo(() => destinationStats(filtered), [filtered]);
  const c3 = useMemo(() => c3Summary(filtered), [filtered]);
  const emails = useMemo(() => emailStatuses(filtered), [filtered]);
  const texts = useMemo(() => openTexts(filtered), [filtered]);
  const shownTexts = texts.filter((t) => !query || t.text.toLowerCase().includes(query.toLowerCase()));
  const dists = useMemo(() => QUESTIONS.filter((q) => q.kind !== 'text').map((q) => distribution(filtered, q.id)), [filtered]);

  function exportStats() {
    const rows: Parameters<typeof statsCsv>[0] = [
      { section: 'kpi', metric: 'partecipazioni_avviate', num: k.started, den: '' },
      { section: 'kpi', metric: 'ricerche_visualizzate', num: k.searches, den: k.started },
      { section: 'kpi', metric: 'dettaglio_aperto', num: k.detail, den: k.started },
      { section: 'kpi', metric: 'checkout_iniziato', num: k.checkout, den: k.started },
      { section: 'kpi', metric: 'pagamento_simulato_completato', num: k.paid, den: k.started },
      { section: 'kpi', metric: 'questionari_completati', num: k.completed, den: k.started },
      { section: 'kpi', metric: 'adesione_email', num: k.emailSubmitted, den: k.promptSeen, note: 'inviate con consenso / richieste viste' },
      ...f.map((s) => ({ section: 'funnel', metric: s.stage, num: s.sessions, den: k.started })),
      ...entries.map(([e, n]) => ({ section: 'ingresso_feedback', metric: e, num: n, den: '' as const })),
      ...dests.flatMap((d) => [
        { section: 'destinazioni', metric: `${d.destination}_esposte`, num: d.exposed, den: '' as const },
        { section: 'destinazioni', metric: `${d.destination}_aperte`, num: d.opened.num, den: d.opened.den },
        { section: 'destinazioni', metric: `${d.destination}_scelte`, num: d.chosen.num, den: d.chosen.den },
      ]),
      ...dists.flatMap((d) => d.rows.map((r) => ({ section: `risposte_${d.questionId}`, metric: r.optionId, num: r.count, den: d.base, note: optLabel(d.questionId, QUESTION_BY_ID[d.questionId].options.indexOf(r.optionId)) }))),
      { section: 'c3', metric: 'preavviso_entro_14_giorni', num: c3.within14.num, den: c3.base, note: 'opzioni 1–4' },
      ...Object.entries(emails).map(([s, n]) => ({ section: 'email_stato', metric: s, num: n, den: k.completed })),
    ];
    download(`travel-recovery_statistiche_${settings?.versionId ?? ''}_${stamp()}.csv`, statsCsv(rows, filters, settings?.versionId ?? ''));
  }

  const origins = countBy(filtered, (v) => v.latest?.origin_id);
  const locales = countBy(filtered, (v) => v.s.initial_locale);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-medium">Statistiche</h1>
          <p className="text-sm text-muted">{filtered.length} partecipazioni con i filtri attuali. Conteggi reali, nessun dato illustrativo.</p>
        </div>
        <Button variant="secondary" onClick={exportStats} icon={<Download className="size-4" aria-hidden />}>CSV statistiche</Button>
      </div>
      <FilterBar />

      {filtered.length === 0 ? (
        <Panel title="Nessuna partecipazione">
          <p className="text-muted">Non ci sono ancora partecipazioni con questi filtri. Le prove del gruppo (test) sono escluse di default: usa il filtro «Dati» per vederle.</p>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Partecipazioni avviate" value={k.started} definition="Sessioni distinte con evento di avvio confermato dal server. Una partecipazione non è una persona identificata." />
            <Tile label="Con almeno un dettaglio aperto" value={k.detail} sub={`${k.searches} hanno visto le offerte`} definition="Sessioni distinte con almeno un’offerta aperta." />
            <Tile label="Pagamento simulato completato" value={k.paid} sub={`${k.checkout} checkout iniziati`} definition="Clic sul pagamento fittizio: non è un acquisto reale." />
            <Tile label="Questionari completati" value={k.completed} sub={`Tasso: ${fmtPct(k.completionRate)} (${k.completionRate.num}/${k.completionRate.den})`} definition="Invio finale confermato dal backend / partecipazioni avviate." />
            <Tile label="Richieste email viste" value={k.promptSeen} definition="Sessioni che hanno visualizzato la schermata email (solo dopo il questionario)." />
            <Tile label="Email inviate con consenso" value={k.emailSubmitted} sub={`Adesione: ${fmtPct(k.emailAdoption)} (${k.emailAdoption.num}/${k.emailAdoption.den})`} definition="Partecipazioni con invio email valido / partecipazioni che hanno visto la richiesta." />
            <Tile label="Contatti unici" value={k.uniqueContacts ?? '—'} definition={role === 'owner' ? 'Indirizzi normalizzati distinti collegati alle partecipazioni filtrate.' : 'Visibile solo al ruolo owner.'} />
            <Tile label="Contatti attivi" value={k.activeContacts ?? '—'} definition={role === 'owner' ? 'Contatti con consenso non revocato.' : 'Visibile solo al ruolo owner.'} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Funnel della demo" note="Sessioni distinte che hanno raggiunto ogni passaggio. Base: partecipazioni avviate.">
              <BarList rows={f.map((s) => ({ label: STAGE_LABEL[s.stage], count: s.sessions, ratio: { num: s.sessions, den: k.started } }))} />
            </Panel>
            <Panel title="Ramo del questionario: da dove si arriva" note="Il questionario è raggiungibile anche senza acquisto simulato. Conteggio per sessione.">
              <BarList rows={entries.map(([e, n]) => ({ label: ENTRY_LABEL[e] ?? e, count: n }))} />
            </Panel>
          </div>

          <Panel title="Destinazioni: esposizione, aperture e scelte" note="Le percentuali usano come base le partecipazioni a cui la meta è stata mostrata. Lisbona è mostrata solo a chi parte da Valencia: non confrontarla direttamente con le altre. «Scelta» = selezione finale per sessione, non il numero di visualizzazioni.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead><tr className="text-left text-ink-soft"><th className="p-2">Meta</th><th className="p-2">Esposte</th><th className="p-2">Aperte</th><th className="p-2">Scelte</th><th className="p-2">Pagamento simulato</th></tr></thead>
                <tbody>
                  {dests.map((d) => (
                    <tr key={d.destination} className="border-t border-line/70">
                      <th scope="row" className="p-2 text-left font-medium">{HOTELS[d.destination].city.it}</th>
                      <td className="p-2 tabular">{d.exposed}</td>
                      <td className="p-2 tabular">{d.opened.num} <span className="text-muted">({fmtPct(d.opened)})</span></td>
                      <td className="p-2 tabular">{d.chosen.num} <span className="text-muted">({fmtPct(d.chosen)})</span></td>
                      <td className="p-2 tabular">{d.paid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Città di partenza (ultima ricerca)"><BarList rows={origins.map(([o, n]) => ({ label: ORIGINS[o as OriginId]?.name.it ?? o, count: n }))} /></Panel>
            <Panel title="Lingua iniziale"><BarList rows={locales.map(([l, n]) => ({ label: LOCALE_LABEL[l] ?? l, count: n }))} /></Panel>
          </div>

          <h2 className="mt-2 text-2xl font-medium">Risposte</h2>
          <p className="-mt-3 text-sm text-muted">Solo questionari completati. Per le domande a scelta multipla (C5, C6, V2) la percentuale è sui rispondenti: le somme possono superare il 100%.</p>
          <Panel title="C3 — Preavviso dichiarato" note="Entro 14 giorni = opzioni 1–4 sul totale dei rispondenti C3.">
            <ul className="grid gap-1 text-sm sm:grid-cols-4">
              <li><strong className="tabular">{fmtPct(c3.within14)}</strong> entro 14 giorni ({c3.within14.num}/{c3.base})</li>
              <li><strong className="tabular">{fmtPct(c3.over14)}</strong> oltre due settimane ({c3.over14.num})</li>
              <li><strong className="tabular">{fmtPct(c3.notInterested)}</strong> non interessati ({c3.notInterested.num})</li>
              <li><strong className="tabular">{fmtPct(c3.dontKnow)}</strong> non so ({c3.dontKnow.num})</li>
            </ul>
          </Panel>
          <div className="grid gap-5 lg:grid-cols-2">
            {dists.map((d) => (
              <Panel key={d.questionId} title={`${d.questionId.toUpperCase()} — ${it.survey.questions[d.questionId].title}`}
                note={`Base: ${d.base} rispondenti${QUESTION_BY_ID[d.questionId].kind === 'multi' ? ' · scelta multipla' : ''}${d.questionId === 'v3' ? ' · le categorie «qualsiasi recupero», «non venderei» e «dipende» non sono valori numerici: nessuna media calcolata' : ''}${d.questionId === 'c6' ? ' · nessuna media di notti: distribuzione delle durate accettabili' : ''}`}>
                <BarList base={d.base} rows={d.rows.map((r, i) => ({ label: `${i + 1}. ${optLabel(d.questionId, i)}`, count: r.count, ratio: r.ratio }))} />
              </Panel>
            ))}
          </div>

          <CrossTable title="Incrocio C1 × V1 (compratore × venditore)" x={crosstab(filtered, 'c1', 'v1')} />
          <CrossTable title="Incrocio C2 × C3 (interesse per le occasioni × preavviso)" x={crosstab(filtered, 'c2', 'c3')} />
          <CrossTable title="Incrocio C1 × ostacoli C5" x={crosstab(filtered, 'c1', 'c5')} />

          <Panel title="Stato dell’email (questionari completati)" note="«Mostrata, nessuna scelta» e «Non mostrata» non sono rifiuti.">
            <BarList rows={Object.entries(emails).map(([s, n]) => ({ label: EMAIL_LABEL[s], count: n, ratio: { num: n, den: k.completed } }))} />
          </Panel>

          <Panel title={`Commenti C7 e testi «Altro» (${texts.length})`} note="Testi originali nella lingua del partecipante, non tradotti e non inviati a servizi esterni. Riservato ai creator.">
            <label className="mb-3 grid max-w-sm gap-1 text-xs font-semibold text-ink-soft">Cerca nei testi
              <input value={query} onChange={(e) => setQuery(e.target.value)} className="min-h-10 rounded-lg border border-line px-3 text-sm font-normal" />
            </label>
            {shownTexts.length === 0 ? <p className="text-sm text-muted">Nessun testo.</p> : (
              <ul className="grid gap-2">
                {shownTexts.map((t, i) => (
                  <li key={i} className="rounded-xl border border-line/70 p-3 text-sm">
                    <p className="mb-1 text-xs text-muted">
                      {t.questionId.toUpperCase()} · {t.kind === 'comment' ? 'commento' : 'Altro'} · {LOCALE_LABEL[t.locale]} · <Link className="underline" to={`/admin/partecipazioni/${t.sessionId}`}>{t.sessionId.slice(0, 8).toUpperCase()}</Link>{t.isTest && ' · test'}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{t.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
