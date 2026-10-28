// Anteprima locale: nessun backend e nessun invio. Un piccolo "database" nel browser replica
// le regole del server (stesse colonne), così la dashboard creator si può provare con dati di prova
// chiaramente marcati. I contatti email sono disabilitati.
import { HOTELS, isOriginId, type Locale } from '../data/catalog';
import { RESEARCH_VERSION_ID } from '../data/versions';
import { diffDays, type CivilDate } from '../lib/dates';
import { buildSnapshot, type SearchInput, type SearchSnapshot } from '../lib/pricing';
import { readJson, removeKey, uuid, writeJson } from '../lib/storage';
import { QUESTIONS, QUESTION_BY_ID, SURVEY_VERSION, normalizeAnswer, validateAll, validateAnswer, type Answer, type Answers, type QuestionId } from '../survey/definition';
import { BackendError, type AnswerRow, type Backend, type ClientEvent, type EventRow, type EventType, type SessionRow, type SessionState, type SnapshotRow } from './types';

const DB_KEY = 'tr-preview-db-v1';
const OWNER = 'preview-local';

export interface PreviewDb {
  sessions: SessionRow[];
  snapshots: SnapshotRow[];
  events: EventRow[];
  answers: AnswerRow[];
  nextEventId: number;
}

export function loadPreviewDb(): PreviewDb {
  return readJson<PreviewDb>(DB_KEY) ?? { sessions: [], snapshots: [], events: [], answers: [], nextEventId: 1 };
}
export function clearPreviewDb(): void {
  removeKey(DB_KEY);
}

function mutate<T>(fn: (db: PreviewDb) => T): T {
  const db = loadPreviewDb();
  const out = fn(db);
  writeJson(DB_KEY, db);
  return out;
}

const now = () => new Date().toISOString();

function insertEvent(db: PreviewDb, sessionId: string, type: EventType, dedupeKey: string, extra: Partial<EventRow> = {}): boolean {
  const all = db.events as (EventRow & { dedupe_key?: string })[];
  if (all.some((e) => e.dedupe_key === dedupeKey || (extra.event_id && e.event_id === extra.event_id))) return false;
  all.push({
    id: db.nextEventId++,
    event_id: extra.event_id ?? uuid(),
    session_id: sessionId,
    event_type: type,
    server_received_at: now(),
    client_ts: extra.client_ts ?? null,
    search_revision: extra.search_revision ?? null,
    destination_id: extra.destination_id ?? null,
    position: extra.position ?? null,
    locale: extra.locale ?? null,
    meta: extra.meta ?? {},
    dedupe_key: dedupeKey,
  });
  return true;
}

function own(db: PreviewDb, id: string): SessionRow {
  const s = db.sessions.find((x) => x.id === id);
  if (!s) throw new BackendError('session_not_found', true);
  return s;
}

function state(s: SessionRow): SessionState {
  return { id: s.id, mode: 'preview', surveyStatus: s.survey_status, emailStatus: s.email_status, currentSearchRevision: s.current_search_revision };
}

export const previewBackend: Backend = {
  kind: 'preview',

  async loadConfig() {
    return { mode: 'preview', ready: false, privacy: null };
  },

  async startSession(locale: Locale, referenceDate: CivilDate, resumeId: string | null) {
    return mutate((db) => {
      const existing = resumeId ? db.sessions.find((s) => s.id === resumeId) : undefined;
      if (existing) {
        existing.last_locale = locale;
        return state(existing);
      }
      const s: SessionRow = {
        id: uuid(), owner_id: OWNER, version_id: RESEARCH_VERSION_ID, is_test: true, reference_date: referenceDate,
        initial_locale: locale, last_locale: locale, created_at: now(), updated_at: now(), current_search_revision: 0,
        selected_destination_id: null, selected_search_revision: null, feedback_entry: null, survey_status: 'not_started',
        survey_locale: null, completed_at: null, email_prompt_seen: false, email_status: 'not_shown', email_status_at: null,
      };
      db.sessions.push(s);
      insertEvent(db, s.id, 'session_started', `${s.id}:session_started`, { locale });
      return state(s);
    });
  },

  async saveSearch(sessionId: string, input: SearchInput, locale: Locale): Promise<SearchSnapshot> {
    return mutate((db) => {
      const s = own(db, sessionId);
      if (s.survey_status === 'completed') throw new BackendError('session_completed', true);
      if (!isOriginId(input.originId)) throw new BackendError('invalid_origin', true);
      const ref = s.reference_date;
      if (diffDays(ref, input.intervalStart) < 1 || diffDays(input.intervalEnd, ref) < -14 || diffDays(input.intervalStart, input.intervalEnd) < 2) {
        throw new BackendError('invalid_interval', true);
      }
      const rev = s.current_search_revision + 1;
      const snap = buildSnapshot(input, rev);
      db.snapshots.push({
        session_id: s.id, search_revision: rev, origin_country: snap.originCountry, origin_id: snap.originId,
        interval_start: snap.intervalStart, interval_end: snap.intervalEnd, checkin: snap.checkIn, checkout: snap.checkOut,
        budget_cents: snap.budgetCents, adults: 2, nights: 2, catalog_version: snap.catalogVersion, offers: snap.offers, locale, created_at: now(),
      });
      Object.assign(s, { current_search_revision: rev, selected_destination_id: null, selected_search_revision: null, last_locale: locale, updated_at: now() });
      insertEvent(db, s.id, 'preferences_submitted', `${s.id}:preferences_submitted:${rev}`, { search_revision: rev, locale });
      return snap;
    });
  },

  async logEvent(sessionId: string, ev: ClientEvent) {
    return mutate((db) => {
      const s = own(db, sessionId);
      if (s.survey_status === 'completed') return 'ignored' as const;
      let revision = ev.revision;
      let position: number | null = null;
      if (ev.type !== 'feedback_started') {
        if (revision == null || revision !== s.current_search_revision) throw new BackendError('stale_revision', true);
      } else if (revision !== s.current_search_revision) revision = null;
      const needsDest = ['offer_opened', 'offer_selected', 'checkout_started', 'simulated_payment_completed', 'simulated_transfer_completed'].includes(ev.type);
      if (needsDest) {
        const snap = db.snapshots.find((x) => x.session_id === s.id && x.search_revision === revision);
        position = snap?.offers.find((o) => o.destinationId === ev.destinationId)?.position ?? null;
        if (position == null || !ev.destinationId || !HOTELS[ev.destinationId]) throw new BackendError('invalid_destination', true);
      }
      const dest = needsDest ? ev.destinationId : null;
      const key = ['offers_viewed', 'no_offer_selected'].includes(ev.type)
        ? `${s.id}:${ev.type}:${revision}`
        : ['checkout_started', 'simulated_payment_completed', 'simulated_transfer_completed'].includes(ev.type)
          ? `${s.id}:${ev.type}:${revision}:${dest}`
          : ev.type === 'feedback_started' ? `${s.id}:feedback_started` : ev.eventId;
      const meta: Record<string, string> = ev.type === 'feedback_started' && ev.meta?.entry ? { entry: ev.meta.entry } : {};
      const inserted = insertEvent(db, s.id, ev.type, key, { event_id: ev.eventId, search_revision: revision, destination_id: dest, position, locale: ev.locale, meta, client_ts: ev.clientTs });
      if (inserted && ev.type === 'offer_selected') Object.assign(s, { selected_destination_id: dest, selected_search_revision: revision });
      if (inserted && ev.type === 'feedback_started') s.feedback_entry ??= meta.entry ?? 'other';
      s.updated_at = now();
      return inserted ? ('ok' as const) : ('duplicate' as const);
    });
  },

  async saveAnswer(sessionId: string, questionId: QuestionId, answer: Answer, locale: Locale) {
    mutate((db) => {
      const s = own(db, sessionId);
      if (s.survey_status === 'completed') throw new BackendError('session_completed', true);
      const q = QUESTION_BY_ID[questionId];
      const err = validateAnswer(q, answer, { final: false });
      if (err) throw new BackendError(`invalid_answer:${err}`, true);
      upsertAnswer(db, s.id, questionId, normalizeAnswer(q, answer), locale, false);
      s.survey_status = 'in_progress';
      insertEvent(db, s.id, 'survey_step_saved', `${s.id}:survey_step_saved:${questionId}`, { locale, meta: { question: questionId } });
    });
  },

  async submitSurvey(sessionId: string, answers: Answers, locale: Locale) {
    return mutate((db) => {
      const s = own(db, sessionId);
      if (s.survey_status === 'completed') return 'already_completed' as const;
      const errors = validateAll(answers);
      if (Object.keys(errors).length) throw new BackendError('invalid_answers', true, JSON.stringify(errors));
      for (const q of QUESTIONS) upsertAnswer(db, s.id, q.id, normalizeAnswer(q, answers[q.id]), locale, true);
      Object.assign(s, { survey_status: 'completed', completed_at: now(), survey_locale: locale, last_locale: locale });
      insertEvent(db, s.id, 'survey_completed', `${s.id}:survey_completed`, { locale });
      return 'completed' as const;
    });
  },

  async emailPrompt(sessionId: string, action: 'viewed' | 'declined', locale: Locale) {
    mutate((db) => {
      const s = own(db, sessionId);
      s.email_prompt_seen = true;
      if (action === 'viewed' && s.email_status === 'not_shown') Object.assign(s, { email_status: 'pending', email_status_at: now() });
      if (action === 'declined' && s.email_status !== 'submitted') Object.assign(s, { email_status: 'declined', email_status_at: now() });
      insertEvent(db, s.id, action === 'viewed' ? 'email_prompt_viewed' : 'email_declined', `${s.id}:email_${action}`, { locale });
    });
  },

  async submitEmail() {
    // In anteprima locale la raccolta di email reali è disabilitata: nessuna finta iscrizione.
    throw new BackendError('preview_contacts_disabled', true);
  },
};

function upsertAnswer(db: PreviewDb, sessionId: string, qid: QuestionId, a: Answer, locale: Locale, final: boolean) {
  const existing = db.answers.find((x) => x.session_id === sessionId && x.question_id === qid);
  const row: AnswerRow = {
    session_id: sessionId, question_id: qid, survey_version: SURVEY_VERSION, option_ids: a.optionIds,
    other_text: a.otherText ?? null, text_answer: a.text ?? null, locale, is_final: final,
    created_at: existing?.created_at ?? now(), updated_at: now(), finalized_at: final ? now() : null,
  };
  if (existing) Object.assign(existing, row);
  else db.answers.push(row);
}
