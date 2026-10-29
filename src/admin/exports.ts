// Export CSV/JSON. Formato documentato nel README:
// separatore «;» (Excel in italiano), UTF-8 con BOM, righe CRLF, campi sempre tra virgolette,
// risposte multiple con separatore « | » sia per ID sia per etichette.
import it from '../i18n/it';
import { HOTELS, ORIGINS, type DestinationId, type OriginId } from '../data/catalog';
import { QUESTIONS, QUESTION_BY_ID, type QuestionId } from '../survey/definition';
import { chosenDestination, type Filters, type SessionView } from './stats';
import type { ContactRow, SessionContactRow, ConsentEventRow } from '../backend/types';

export const CSV_SEP = ';';

/** Neutralizza celle che Excel interpreterebbe come formule (=, +, -, @, tab, CR). */
export function safeCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((r) => r.map(safeCell).join(CSV_SEP));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function optionLabel(q: QuestionId, optionId: string): string {
  const idx = QUESTION_BY_ID[q].options.indexOf(optionId);
  return idx >= 0 ? it.survey.questions[q].options[idx] : optionId;
}

const cityIt = (d: DestinationId | null | undefined) => (d ? HOTELS[d].city.it : '');
const originIt = (o: string | null | undefined) => (o && o in ORIGINS ? ORIGINS[o as OriginId].name.it : o ?? '');

export function participationsCsv(views: SessionView[], opts: { includeEmail: boolean }): string {
  const header = [
    'session_id', 'codice', 'avvio_utc', 'dati', 'versione', 'lingua_iniziale', 'lingua_finale', 'lingua_questionario',
    'paese_partenza', 'citta_partenza_id', 'citta_partenza', 'intervallo_inizio', 'intervallo_fine', 'budget_eur', 'ricerche',
    'checkin', 'checkout', 'offerte_mostrate', 'prezzi_mostrati_eur', 'offerte_aperte', 'scelta_finale', 'checkout_iniziato', 'pagamento_simulato',
    'trasferimento_simulato', 'nessuna_proposta', 'ingresso_feedback', 'stato_questionario', 'completato_utc', 'stato_email',
    ...QUESTIONS.flatMap((q) => (q.kind === 'text' ? [`${q.id}_testo`] : [`${q.id}_id`, `${q.id}_etichette`, ...(q.otherOption ? [`${q.id}_altro`] : [])])),
    ...(opts.includeEmail ? ['email', 'email_stato_consenso'] : []),
  ];
  const rows = views.map((v) => {
    const s = v.s;
    const l = v.latest;
    const offers = l?.offers ?? [];
    const answers = QUESTIONS.flatMap((q) => {
      const a = s.survey_status === 'completed' ? v.answers[q.id] : undefined;
      if (q.kind === 'text') return [a?.text_answer ?? ''];
      const ids = a?.option_ids ?? [];
      return [ids.join(' | '), ids.map((o) => optionLabel(q.id, o)).join(' | '), ...(q.otherOption ? [a?.other_text ?? ''] : [])];
    });
    return [
      s.id, s.id.slice(0, 8).toUpperCase(), s.created_at, s.is_test ? 'test' : 'live', s.version_id, s.initial_locale, s.last_locale, s.survey_locale ?? '',
      l?.origin_country ?? '', l?.origin_id ?? '', originIt(l?.origin_id), l?.interval_start ?? '', l?.interval_end ?? '',
      l?.budget_cents != null ? (l.budget_cents / 100).toFixed(2) : '', v.snapshots.length,
      l?.checkin ?? '', l?.checkout ?? '',
      offers.map((o) => `${o.position}:${o.destinationId}`).join(' | '),
      offers.map((o) => `${o.destinationId}=${o.hotelSaleCents / 100}+${o.transportTotalCents / 100}=${o.tripTotalCents / 100}`).join(' | '),
      [...v.opened].join(' | '), chosenDestination(v) ?? '',
      v.has.has('checkout_started') ? 'si' : 'no', v.has.has('simulated_payment_completed') ? 'si' : 'no',
      v.has.has('simulated_transfer_completed') ? 'si' : 'no', v.noOffer ? 'si' : 'no', v.feedbackEntry ?? '',
      s.survey_status, s.completed_at ?? '', s.email_status,
      ...answers,
      ...(opts.includeEmail ? [v.emails.map((c) => c.email_normalized).join(' | '), v.emails.map((c) => c.status).join(' | ')] : []),
    ];
  });
  return toCsv(header, rows);
}

export function contactsCsv(contacts: ContactRow[], links: SessionContactRow[], consent: ConsentEventRow[], views: SessionView[]): string {
  const testById = new Map(views.map((v) => [v.s.id, v.s.is_test]));
  const header = ['email', 'stato', 'versione_consenso', 'consenso_utc', 'revoca_utc', 'richiesta_dopo_revoca', 'lingua', 'sessioni', 'sessioni_test', 'eventi_consenso'];
  const rows = contacts.map((c) => {
    const ls = links.filter((l) => l.contact_id === c.id);
    return [
      c.email_normalized, c.status === 'active' ? 'attivo' : 'revocato', c.consent_version, c.consented_at, c.revoked_at ?? '',
      c.pending_request_after_revocation ? 'si' : 'no', c.locale ?? '',
      ls.map((l) => l.session_id).join(' | '), ls.filter((l) => testById.get(l.session_id)).length,
      consent.filter((e) => e.contact_id === c.id).map((e) => `${e.created_at}:${e.event_type}`).join(' | '),
    ];
  });
  return toCsv(header, rows);
}

export function statsCsv(rows: { section: string; metric: string; num: number | ''; den: number | ''; note?: string }[], filters: Filters, versions: string): string {
  const f = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(', ');
  return toCsv(
    ['sezione', 'metrica', 'numeratore', 'denominatore', 'percentuale', 'nota', 'filtri', 'versioni'],
    rows.map((r) => [r.section, r.metric, r.num, r.den, typeof r.num === 'number' && typeof r.den === 'number' && r.den > 0 ? ((r.num / r.den) * 100).toFixed(1) : '—', r.note ?? '', f, versions]),
  );
}

export function download(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const stamp = () => new Date().toISOString().slice(0, 10);

export function cityItName(d: DestinationId | null | undefined) {
  return cityIt(d);
}
export function originItName(o: string | null | undefined) {
  return originIt(o);
}
