// Backend reale: Supabase con identità anonima tecnica (anonymous sign-in) e funzioni RPC.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '../data/catalog';
import type { CivilDate } from '../lib/dates';
import type { SearchInput, SearchSnapshot } from '../lib/pricing';
import { normalizeAnswer, QUESTIONS, QUESTION_BY_ID, type Answer, type Answers, type QuestionId } from '../survey/definition';
import { BackendError, type Backend, type ClientEvent, type PublicConfig, type SessionState } from './types';

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Errori che non migliorano ripetendo la stessa richiesta.
const PERMANENT = ['invalid_', 'session_not_found', 'session_completed', 'stale_revision', 'event_not_allowed', 'consent_required', 'survey_not_completed', 'collection_not_ready', 'forbidden', 'rate_limited', 'not_configured', 'privacy_not_configured', 'note_required', 'no_pending_request', 'contact_not_found'];

export function toBackendError(err: unknown): BackendError {
  const e = err as { message?: string; code?: string; details?: string } | null;
  const message = e?.message ?? String(err);
  const token = /([a-z_]+(?::[a-z_]+)?)/.exec(message)?.[1] ?? 'unknown';
  const network = /fetch|network|Failed to fetch|timeout|NetworkError|Load failed/i.test(message);
  if (network) return new BackendError('network', false, message);
  const permanent = PERMANENT.some((p) => message.startsWith(p) || token.startsWith(p)) || e?.code === '42501';
  return new BackendError(token, permanent, e?.details || message);
}

/** Client Supabase caricato solo quando serve: l'anteprima locale non scarica la libreria. */
export async function makeClient(storageKey: string): Promise<SupabaseClient> {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
}

let participantClient: Promise<SupabaseClient> | null = null;
export function participantSupabase(): Promise<SupabaseClient> {
  // storageKey distinta da quella dei creator: le due identità non si sovrascrivono nello stesso browser.
  participantClient ??= makeClient('tr-participant-auth');
  return participantClient;
}

async function ensureAnonymousIdentity(): Promise<void> {
  const sb = await participantSupabase();
  const { data } = await sb.auth.getSession();
  if (data.session) return;
  const { error } = await sb.auth.signInAnonymously();
  if (error) throw toBackendError(error);
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  let res;
  try {
    res = await (await participantSupabase()).rpc(fn, args);
  } catch (err) {
    throw toBackendError(err);
  }
  if (res.error) throw toBackendError(res.error);
  return res.data as T;
}

function answerPayload(q: QuestionId, a: Answer | undefined) {
  const n = normalizeAnswer(QUESTION_BY_ID[q], a);
  return { optionIds: n.optionIds, ...(n.otherText ? { otherText: n.otherText } : {}), ...(n.text ? { text: n.text } : {}) };
}

export const supabaseBackend: Backend = {
  kind: 'supabase',

  async loadConfig() {
    const data = await rpc<{ mode: 'test' | 'live'; ready: boolean; privacy: PublicConfig['privacy'] }>('tr_public_config', {});
    return { mode: data.mode, ready: data.ready, privacy: data.privacy };
  },

  async startSession(locale: Locale, referenceDate: CivilDate, resumeId: string | null) {
    await ensureAnonymousIdentity();
    const s = await rpc<{ id: string; mode: 'test' | 'live'; surveyStatus: SessionState['surveyStatus']; emailStatus: SessionState['emailStatus']; currentSearchRevision: number }>(
      'tr_start_session', { p_locale: locale, p_reference_date: referenceDate, p_resume_id: resumeId },
    );
    return { id: s.id, mode: s.mode, surveyStatus: s.surveyStatus, emailStatus: s.emailStatus, currentSearchRevision: s.currentSearchRevision };
  },

  async saveSearch(sessionId: string, input: SearchInput, locale: Locale) {
    return rpc<SearchSnapshot>('tr_save_search', {
      p_session_id: sessionId, p_origin_id: input.originId, p_interval_start: input.intervalStart,
      p_interval_end: input.intervalEnd, p_budget_cents: input.budgetCents, p_locale: locale,
    });
  },

  async logEvent(sessionId: string, ev: ClientEvent) {
    const r = await rpc<{ status: 'ok' | 'duplicate' | 'ignored' }>('tr_log_event', {
      p_session_id: sessionId, p_event_id: ev.eventId, p_event_type: ev.type, p_search_revision: ev.revision,
      p_destination_id: ev.destinationId, p_locale: ev.locale, p_client_ts: ev.clientTs, p_meta: ev.meta ?? {},
    });
    return r.status;
  },

  async saveAnswer(sessionId: string, questionId: QuestionId, answer: Answer, locale: Locale) {
    const p = answerPayload(questionId, answer);
    await rpc('tr_save_answer', {
      p_session_id: sessionId, p_question_id: questionId, p_option_ids: p.optionIds,
      p_other_text: p.otherText ?? null, p_text: p.text ?? null, p_locale: locale,
    });
  },

  async submitSurvey(sessionId: string, answers: Answers, locale: Locale) {
    const payload = Object.fromEntries(QUESTIONS.map((q) => [q.id, answerPayload(q.id, answers[q.id])]));
    const r = await rpc<{ status: 'completed' | 'already_completed' }>('tr_submit_survey', { p_session_id: sessionId, p_answers: payload, p_locale: locale });
    return r.status;
  },

  async emailPrompt(sessionId: string, action: 'viewed' | 'declined', locale: Locale) {
    await rpc('tr_email_prompt', { p_session_id: sessionId, p_action: action, p_locale: locale });
  },

  async submitEmail(sessionId: string, email: string, consent: boolean, locale: Locale) {
    // L'email viaggia solo nel corpo della richiesta RPC (mai in URL o log del client).
    await rpc('tr_submit_email', { p_session_id: sessionId, p_email: email, p_consent: consent, p_locale: locale });
  },
};
