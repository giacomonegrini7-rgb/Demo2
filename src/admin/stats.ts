// Statistiche dell'area creator: funzioni pure sui dati grezzi (stesse colonne delle tabelle).
// Nessun punteggio di "validazione", nessuna soglia inventata: solo conteggi con denominatori espliciti.
import type { DestinationId } from '../data/catalog';
import { QUESTIONS, QUESTION_BY_ID, type QuestionId } from '../survey/definition';
import type { AnswerRow, ContactRow, ConsentEventRow, EventRow, EventType, SessionContactRow, SessionRow, SnapshotRow } from '../backend/types';

export interface Dataset {
  sessions: SessionRow[];
  snapshots: SnapshotRow[];
  events: EventRow[];
  answers: AnswerRow[];
  contacts: ContactRow[] | null; // null = non autorizzato (viewer) o non disponibile
  sessionContacts: SessionContactRow[] | null;
  consentEvents: ConsentEventRow[] | null;
}

export type Stage = 'started' | 'preferences' | 'offers' | 'detail' | 'checkout' | 'paid' | 'transferred';
export const STAGES: Stage[] = ['started', 'preferences', 'offers', 'detail', 'checkout', 'paid', 'transferred'];
const STAGE_EVENT: Record<Stage, EventType> = {
  started: 'session_started', preferences: 'preferences_submitted', offers: 'offers_viewed', detail: 'offer_opened',
  checkout: 'checkout_started', paid: 'simulated_payment_completed', transferred: 'simulated_transfer_completed',
};

/** Vista per partecipazione, derivata una volta e usata da KPI, lista ed export. */
export interface SessionView {
  s: SessionRow;
  events: EventRow[];
  snapshots: SnapshotRow[];
  latest: SnapshotRow | null;
  answers: Partial<Record<QuestionId, AnswerRow>>;
  has: Set<EventType>;
  stage: Stage;
  opened: Set<DestinationId>;
  exposed: Set<DestinationId>;
  paidDestination: DestinationId | null;
  noOffer: boolean;
  feedbackEntry: string | null;
  emails: ContactRow[];
}

export function buildViews(ds: Dataset): SessionView[] {
  const byS = <T extends { session_id: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) (m.get(r.session_id) ?? m.set(r.session_id, []).get(r.session_id)!).push(r);
    return m;
  };
  const ev = byS(ds.events);
  const sn = byS(ds.snapshots);
  const an = byS(ds.answers);
  const contactById = new Map((ds.contacts ?? []).map((c) => [c.id, c]));
  const sc = byS(ds.sessionContacts ?? []);
  return ds.sessions.map((s) => {
    const events = (ev.get(s.id) ?? []).slice().sort((a, b) => a.server_received_at.localeCompare(b.server_received_at) || a.id - b.id);
    const snapshots = (sn.get(s.id) ?? []).slice().sort((a, b) => a.search_revision - b.search_revision);
    const has = new Set(events.map((e) => e.event_type));
    let stage: Stage = 'started';
    for (const st of STAGES) if (has.has(STAGE_EVENT[st])) stage = st;
    const answers: SessionView['answers'] = {};
    for (const a of an.get(s.id) ?? []) answers[a.question_id] = a;
    const paid = [...events].reverse().find((e) => e.event_type === 'simulated_payment_completed');
    return {
      s, events, snapshots, latest: snapshots[snapshots.length - 1] ?? null, answers, has, stage,
      opened: new Set(events.filter((e) => e.event_type === 'offer_opened' && e.destination_id).map((e) => e.destination_id!)),
      exposed: new Set(snapshots.flatMap((x) => x.offers.map((o) => o.destinationId))),
      paidDestination: paid?.destination_id ?? null,
      noOffer: has.has('no_offer_selected'),
      feedbackEntry: s.feedback_entry ?? (events.find((e) => e.event_type === 'feedback_started')?.meta?.entry ?? null),
      emails: (sc.get(s.id) ?? []).map((x) => contactById.get(x.contact_id)).filter(Boolean) as ContactRow[],
    };
  });
}

/** Scelta finale: selezione corrente, altrimenti destinazione del pagamento simulato. */
export function chosenDestination(v: SessionView): DestinationId | null {
  return v.s.selected_destination_id ?? v.paidDestination;
}

// ------------------------------------------------------------ filtri (identici per KPI, grafici, lista, export)
export interface Filters {
  data: 'live' | 'test' | 'all';
  from: string; // YYYY-MM-DD su created_at (avvio partecipazione)
  to: string;
  version: string;
  locale: string;
  country: string;
  origin: string;
  destination: string;
  stage: string;
  survey: '' | 'completed' | 'not_completed';
  email: '' | 'yes' | 'no';
}

export const EMPTY_FILTERS: Filters = { data: 'live', from: '', to: '', version: '', locale: '', country: '', origin: '', destination: '', stage: '', survey: '', email: '' };

export function applyFilters(views: SessionView[], f: Filters): SessionView[] {
  return views.filter((v) => {
    const s = v.s;
    if (f.data === 'live' && s.is_test) return false;
    if (f.data === 'test' && !s.is_test) return false;
    const day = s.created_at.slice(0, 10);
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    if (f.version && s.version_id !== f.version) return false;
    if (f.locale && s.initial_locale !== f.locale) return false;
    if (f.country && v.latest?.origin_country !== f.country) return false;
    if (f.origin && v.latest?.origin_id !== f.origin) return false;
    if (f.destination && chosenDestination(v) !== f.destination) return false;
    if (f.stage && v.stage !== f.stage) return false;
    if (f.survey === 'completed' && s.survey_status !== 'completed') return false;
    if (f.survey === 'not_completed' && s.survey_status === 'completed') return false;
    if (f.email === 'yes' && s.email_status !== 'submitted') return false;
    if (f.email === 'no' && s.email_status === 'submitted') return false;
    return true;
  });
}

// ------------------------------------------------------------ KPI
export interface Ratio { num: number; den: number }
export const pct = (r: Ratio): number | null => (r.den === 0 ? null : (r.num / r.den) * 100);
export const fmtPct = (r: Ratio, digits = 1): string => {
  const p = pct(r);
  return p == null ? '—' : `${p.toLocaleString('it-IT', { maximumFractionDigits: digits, minimumFractionDigits: 0 })}%`;
};

export function kpis(views: SessionView[], contacts: ContactRow[] | null) {
  const count = (pred: (v: SessionView) => boolean) => views.filter(pred).length;
  const started = count((v) => v.has.has('session_started'));
  const completed = count((v) => v.s.survey_status === 'completed');
  const promptSeen = count((v) => v.s.email_prompt_seen);
  const emailSubmitted = count((v) => v.s.email_status === 'submitted');
  const sessionIds = new Set(views.map((v) => v.s.id));
  const linked = contacts ? views.flatMap((v) => v.emails) : null;
  const uniqueContacts = linked ? new Map(linked.map((c) => [c.id, c])) : null;
  return {
    started,
    searches: count((v) => v.has.has('offers_viewed')),
    detail: count((v) => v.has.has('offer_opened')),
    checkout: count((v) => v.has.has('checkout_started')),
    paid: count((v) => v.has.has('simulated_payment_completed')),
    completed,
    completionRate: { num: completed, den: started } as Ratio,
    promptSeen,
    emailSubmitted,
    emailAdoption: { num: emailSubmitted, den: promptSeen } as Ratio,
    uniqueContacts: uniqueContacts ? uniqueContacts.size : null,
    activeContacts: uniqueContacts ? [...uniqueContacts.values()].filter((c) => c.status === 'active').length : null,
    sessionIds,
  };
}

export function funnel(views: SessionView[]): { stage: Stage; sessions: number }[] {
  return STAGES.map((st) => ({ stage: st, sessions: views.filter((v) => v.has.has(STAGE_EVENT[st])).length }));
}

/** Ramo del questionario: da dove si arriva al feedback (sessioni distinte). */
export function feedbackEntries(views: SessionView[]) {
  const m = new Map<string, number>();
  for (const v of views) if (v.has.has('feedback_started') || v.s.survey_status !== 'not_started') {
    const k = v.feedbackEntry ?? 'other';
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function emailStatuses(views: SessionView[]) {
  const out = { not_shown: 0, pending: 0, declined: 0, submitted: 0 };
  for (const v of views) if (v.s.survey_status === 'completed') out[v.s.email_status]++;
  return out;
}

// ------------------------------------------------------------ distribuzioni delle risposte (solo questionari completati)
export interface Distribution {
  questionId: QuestionId;
  base: number; // rispondenti alla domanda
  rows: { optionId: string; count: number; ratio: Ratio }[];
}

export function finalAnswer(v: SessionView, q: QuestionId): AnswerRow | null {
  const a = v.answers[q];
  return v.s.survey_status === 'completed' && a && a.is_final ? a : null;
}

export function distribution(views: SessionView[], q: QuestionId): Distribution {
  const def = QUESTION_BY_ID[q];
  const respondents = views.map((v) => finalAnswer(v, q)).filter((a): a is AnswerRow => Boolean(a && a.option_ids.length));
  const base = respondents.length;
  // per le scelte multiple: % dei rispondenti che ha selezionato l'opzione (le somme possono superare 100%)
  return {
    questionId: q,
    base,
    rows: def.options.map((o) => {
      const count = respondents.filter((a) => a.option_ids.includes(o)).length;
      return { optionId: o, count, ratio: { num: count, den: base } };
    }),
  };
}

export function c3Summary(views: SessionView[]) {
  const d = distribution(views, 'c3');
  const sum = (ids: string[]) => d.rows.filter((r) => ids.includes(r.optionId)).reduce((s, r) => s + r.count, 0);
  return {
    base: d.base,
    within14: { num: sum(['c3_01', 'c3_02', 'c3_03', 'c3_04']), den: d.base },
    over14: { num: sum(['c3_05']), den: d.base },
    notInterested: { num: sum(['c3_06']), den: d.base },
    dontKnow: { num: sum(['c3_07']), den: d.base },
  };
}

export interface Crosstab { rowsQ: QuestionId; colsQ: QuestionId; rows: string[]; cols: string[]; cells: number[][]; rowTotals: number[] }

/** Incrocio tra due domande (righe a scelta singola). Con colonne multiple, una persona può contare in più colonne. */
export function crosstab(views: SessionView[], rowsQ: QuestionId, colsQ: QuestionId): Crosstab {
  const rows = QUESTION_BY_ID[rowsQ].options;
  const cols = QUESTION_BY_ID[colsQ].options;
  const cells = rows.map(() => cols.map(() => 0));
  const rowTotals = rows.map(() => 0);
  for (const v of views) {
    const ra = finalAnswer(v, rowsQ);
    const ca = finalAnswer(v, colsQ);
    if (!ra || !ca) continue;
    const ri = rows.indexOf(ra.option_ids[0]);
    if (ri < 0) continue;
    rowTotals[ri]++;
    for (const o of ca.option_ids) {
      const ci = cols.indexOf(o);
      if (ci >= 0) cells[ri][ci]++;
    }
  }
  return { rowsQ, colsQ, rows, cols, cells, rowTotals };
}

// ------------------------------------------------------------ esposizione e scelte
export function destinationStats(views: SessionView[]) {
  const dests: DestinationId[] = ['vienna', 'budapest', 'verona', 'valencia', 'lisbon'];
  return dests.map((d) => {
    const exposed = views.filter((v) => v.exposed.has(d)).length;
    const opened = views.filter((v) => v.opened.has(d)).length;
    const chosen = views.filter((v) => chosenDestination(v) === d).length;
    const paid = views.filter((v) => v.paidDestination === d).length;
    // denominatore = partecipazioni che hanno visto la meta (Lisbona: solo partenze da Valencia)
    return { destination: d, exposed, opened: { num: opened, den: exposed } as Ratio, chosen: { num: chosen, den: exposed } as Ratio, paid };
  });
}

export function countBy<T>(items: T[], key: (x: T) => string | null | undefined): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export interface OpenText { sessionId: string; questionId: QuestionId; kind: 'comment' | 'other'; text: string; locale: string; isTest: boolean }

export function openTexts(views: SessionView[]): OpenText[] {
  const out: OpenText[] = [];
  for (const v of views) for (const q of QUESTIONS) {
    const a = finalAnswer(v, q.id);
    if (!a) continue;
    if (a.text_answer) out.push({ sessionId: v.s.id, questionId: q.id, kind: 'comment', text: a.text_answer, locale: a.locale, isTest: v.s.is_test });
    if (a.other_text) out.push({ sessionId: v.s.id, questionId: q.id, kind: 'other', text: a.other_text, locale: a.locale, isTest: v.s.is_test });
  }
  return out;
}

/** Riepilogo deterministico dei fatti, senza interpretazioni psicologiche. */
export function factsSummary(v: SessionView, cityName: (d: DestinationId) => string): string[] {
  const facts: string[] = [];
  facts.push(v.snapshots.length ? `Ha effettuato ${v.snapshots.length} ${v.snapshots.length === 1 ? 'ricerca' : 'ricerche'}` : 'Non ha inviato preferenze');
  if (v.snapshots.length) facts.push(`ha aperto ${v.opened.size} ${v.opened.size === 1 ? 'offerta' : 'offerte'}`);
  const chosen = chosenDestination(v);
  if (chosen) facts.push(`ha scelto ${cityName(chosen)}`);
  if (v.has.has('simulated_payment_completed')) facts.push('ha completato il pagamento simulato');
  else if (v.has.has('checkout_started')) facts.push('ha iniziato il checkout senza completare il pagamento simulato');
  if (v.noOffer) facts.push('ha indicato «Nessuna proposta fa per me»');
  facts.push(v.s.survey_status === 'completed' ? 'questionario completato' : v.s.survey_status === 'in_progress' ? 'questionario iniziato ma non inviato' : 'questionario non iniziato');
  if (v.s.email_status === 'submitted') facts.push('ha lasciato l’email con consenso');
  return facts;
}

/** Opzioni che esprimono un rifiuto esplicito, evidenziate nel report (senza correggere nulla). */
export const NEGATIVE_OPTIONS = new Set(['c1_04', 'c1_05', 'c2_01', 'c3_06', 'c4_05', 'c6_06', 'v1_04', 'v1_05', 'v2_08', 'v3_12']);
