import type { DestinationId, Locale } from '../data/catalog';
import type { CivilDate } from '../lib/dates';
import type { Offer, SearchInput, SearchSnapshot } from '../lib/pricing';
import type { Answer, Answers, QuestionId } from '../survey/definition';

/** preview = nessun backend; test/live = deciso dal server (app_config). */
export type Mode = 'preview' | 'test' | 'live';

export interface PrivacyInfo {
  controllerName: string;
  contactEmail: string;
  legalBasis: 'consent' | 'public_interest_research' | 'legitimate_interest';
  responsesRetentionMonths: number;
  contactsRetentionMonths: number;
  projectContext: string | null;
  privacyVersion: string;
}

export interface PublicConfig {
  mode: Mode;
  ready: boolean;
  privacy: PrivacyInfo | null;
}

export interface SessionState {
  id: string;
  mode: Mode;
  surveyStatus: 'not_started' | 'in_progress' | 'completed';
  emailStatus: EmailStatus;
  currentSearchRevision: number;
}

export type EmailStatus = 'not_shown' | 'pending' | 'declined' | 'submitted';

export const CLIENT_EVENT_TYPES = [
  'offers_viewed', 'offer_opened', 'offer_selected', 'checkout_started',
  'simulated_payment_completed', 'simulated_transfer_completed', 'no_offer_selected', 'feedback_started',
] as const;
export type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];

export const FEEDBACK_ENTRIES = ['outcome', 'results', 'detail', 'summary', 'transfer'] as const;
export type FeedbackEntry = (typeof FEEDBACK_ENTRIES)[number];

export interface ClientEvent {
  eventId: string;
  type: ClientEventType;
  revision: number | null;
  destinationId: DestinationId | null;
  locale: Locale;
  clientTs: string;
  meta?: { entry?: FeedbackEntry };
}

export class BackendError extends Error {
  /** permanent = ripetere la stessa richiesta non servirebbe */
  constructor(public code: string, public permanent: boolean, message?: string) {
    super(message ?? code);
  }
}

export interface Backend {
  kind: 'preview' | 'supabase';
  loadConfig(): Promise<PublicConfig>;
  startSession(locale: Locale, referenceDate: CivilDate, resumeId: string | null): Promise<SessionState>;
  saveSearch(sessionId: string, input: SearchInput, locale: Locale): Promise<SearchSnapshot>;
  logEvent(sessionId: string, ev: ClientEvent): Promise<'ok' | 'duplicate' | 'ignored'>;
  saveAnswer(sessionId: string, questionId: QuestionId, answer: Answer, locale: Locale): Promise<void>;
  submitSurvey(sessionId: string, answers: Answers, locale: Locale): Promise<'completed' | 'already_completed'>;
  emailPrompt(sessionId: string, action: 'viewed' | 'declined', locale: Locale): Promise<void>;
  submitEmail(sessionId: string, email: string, consent: boolean, locale: Locale): Promise<void>;
}

// ------------------------------------------------------------ righe (stesse colonne delle tabelle Supabase)
export interface SessionRow {
  id: string;
  owner_id: string;
  version_id: string;
  is_test: boolean;
  reference_date: string;
  initial_locale: Locale;
  last_locale: Locale;
  created_at: string;
  updated_at: string;
  current_search_revision: number;
  selected_destination_id: DestinationId | null;
  selected_search_revision: number | null;
  feedback_entry: string | null;
  survey_status: SessionState['surveyStatus'];
  survey_locale: Locale | null;
  completed_at: string | null;
  email_prompt_seen: boolean;
  email_status: EmailStatus;
  email_status_at: string | null;
}

export interface SnapshotRow {
  session_id: string;
  search_revision: number;
  origin_country: string;
  origin_id: string;
  interval_start: string;
  interval_end: string;
  checkin: string;
  checkout: string;
  budget_cents: number | null;
  adults: number;
  nights: number;
  catalog_version: string;
  offers: Offer[];
  locale: Locale;
  created_at: string;
}

export type EventType = ClientEventType | 'session_started' | 'preferences_submitted' | 'survey_step_saved' | 'survey_completed' | 'email_prompt_viewed' | 'email_declined' | 'email_submitted';

export interface EventRow {
  id: number;
  event_id: string;
  session_id: string;
  event_type: EventType;
  server_received_at: string;
  client_ts: string | null;
  search_revision: number | null;
  destination_id: DestinationId | null;
  position: number | null;
  locale: Locale | null;
  meta: Record<string, string>;
}

export interface AnswerRow {
  session_id: string;
  question_id: QuestionId;
  survey_version: string;
  option_ids: string[];
  other_text: string | null;
  text_answer: string | null;
  locale: Locale;
  is_final: boolean;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
}

export interface ContactRow {
  id: string;
  email_normalized: string;
  status: 'active' | 'revoked';
  consent_version: string;
  consented_at: string;
  revoked_at: string | null;
  pending_request_after_revocation: boolean;
  last_request_at: string | null;
  locale: Locale | null;
  created_at: string;
}

export interface SessionContactRow {
  session_id: string;
  contact_id: string;
  created_at: string;
}

export interface ConsentEventRow {
  id: number;
  contact_id: string;
  session_id: string | null;
  event_type: string;
  consent_version: string | null;
  actor: string;
  note: string | null;
  created_at: string;
}
