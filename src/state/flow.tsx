import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isCountryId, isOriginId, type CountryId, type DestinationId, type Locale, type OriginId } from '../data/catalog';
import { previewBackend } from '../backend/preview';
import { hasSupabase, supabaseBackend } from '../backend/supabase';
import { BackendError, type Backend, type ClientEvent, type ClientEventType, type EmailStatus, type FeedbackEntry, type Mode, type PublicConfig } from '../backend/types';
import { diffDays, localToday, validateInterval, type CivilDate, type IntervalError } from '../lib/dates';
import { parseBudget, type SearchSnapshot } from '../lib/pricing';
import { readJson, storageAvailable, uuid, writeJson } from '../lib/storage';
import { normalizeAnswer, QUESTION_BY_ID, type Answer, type Answers, type QuestionId } from '../survey/definition';
import { detectLocale, isLocale } from '../i18n';

export const backend: Backend = hasSupabase ? supabaseBackend : previewBackend;

const STATE_KEY = 'tr-flow-v1';

export interface Prefs {
  country: CountryId | '';
  originId: OriginId | '';
  start: CivilDate | null;
  end: CivilDate | null;
  budget: string;
  flexible: boolean;
}

export interface Selection {
  revision: number;
  destinationId: DestinationId;
  paymentEventId: string | null;
  transferEventId: string | null;
}

type Op =
  | { kind: 'event'; ev: ClientEvent }
  | { kind: 'answer'; questionId: QuestionId; answer: Answer; locale: Locale }
  | { kind: 'email_prompt'; action: 'viewed' | 'declined'; locale: Locale };

export interface FlowState {
  v: 1;
  sessionId: string | null;
  mode: Mode | null;
  referenceDate: CivilDate;
  initialLocale: Locale;
  locale: Locale;
  prefs: Prefs;
  search: SearchSnapshot | null;
  searchChanged: boolean;
  opened: DestinationId[];
  selection: Selection | null;
  feedbackEntry: FeedbackEntry | 'other' | null;
  noOffer: boolean;
  answers: Answers;
  surveyCompleted: boolean;
  emailStatus: EmailStatus;
  pendingOps: Op[];
}

function freshState(locale: Locale): FlowState {
  return {
    v: 1, sessionId: null, mode: null, referenceDate: localToday(), initialLocale: locale, locale,
    prefs: { country: '', originId: '', start: null, end: null, budget: '', flexible: false },
    search: null, searchChanged: false, opened: [], selection: null, feedbackEntry: null, noOffer: false,
    answers: {}, surveyCompleted: false, emailStatus: 'not_shown', pendingOps: [],
  };
}

function loadState(): FlowState {
  const saved = readJson<FlowState>(STATE_KEY);
  const detected = detectLocale();
  if (!saved || saved.v !== 1 || !isLocale(saved.locale)) return freshState(detected);
  // Una partecipazione non completata lasciata da giorni avrebbe date ormai passate: si riparte.
  if (!saved.surveyCompleted && diffDays(saved.referenceDate, localToday()) >= 2) return freshState(saved.locale);
  if (saved.prefs.country && !isCountryId(saved.prefs.country)) saved.prefs.country = '';
  if (saved.prefs.originId && !isOriginId(saved.prefs.originId)) saved.prefs.originId = '';
  return saved;
}

export type ConfigState = { status: 'loading' } | { status: 'ready'; config: PublicConfig } | { status: 'error' };

export type SearchValidation = { country?: true; city?: true; interval?: IntervalError; budget?: true };

interface FlowApi {
  state: FlowState;
  config: ConfigState;
  storageOk: boolean;
  reloadConfig: () => void;
  setLocale: (l: Locale) => void;
  begin: () => Promise<void>;
  updatePrefs: (p: Partial<Prefs>) => void;
  validateSearch: () => SearchValidation;
  submitSearch: () => Promise<void>;
  dismissSearchChanged: () => void;
  track: (type: ClientEventType, opts?: { destinationId?: DestinationId; meta?: ClientEvent['meta'] }) => void;
  openOffer: (d: DestinationId) => void;
  chooseOffer: (d: DestinationId) => void;
  simulatePayment: () => void;
  completeTransfer: () => void;
  startFeedback: (entry: FeedbackEntry | null, opts?: { noOffer?: boolean }) => void;
  setAnswer: (q: QuestionId, a: Answer) => void;
  saveDraft: (q: QuestionId) => void;
  submitSurvey: () => Promise<void>;
  markEmailPrompt: (action: 'viewed' | 'declined') => void;
  submitEmail: (email: string, consent: boolean) => Promise<void>;
  restart: () => void;
}

const Ctx = createContext<FlowApi | null>(null);

export function FlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FlowState>(loadState);
  const ref = useRef(state);
  const [config, setConfig] = useState<ConfigState>({ status: 'loading' });
  const draining = useRef(false);
  const retryTimer = useRef<number | null>(null);
  const retryDelay = useRef(2000);

  const update = useCallback((fn: (s: FlowState) => FlowState) => {
    const next = fn(ref.current);
    ref.current = next;
    writeJson(STATE_KEY, next);
    setState(next);
  }, []);

  const loadConfig = useCallback(() => {
    setConfig({ status: 'loading' });
    backend.loadConfig().then(
      (c) => setConfig({ status: 'ready', config: c }),
      () => setConfig({ status: 'error' }),
    );
  }, []);
  useEffect(loadConfig, [loadConfig]);

  // ---------------------------------------------------------- coda sequenziale verso il backend
  const drain = useCallback(async (): Promise<void> => {
    if (draining.current) return;
    draining.current = true;
    try {
      while (ref.current.pendingOps.length && ref.current.sessionId) {
        const op = ref.current.pendingOps[0];
        const sid = ref.current.sessionId;
        try {
          if (op.kind === 'event') await backend.logEvent(sid, op.ev);
          else if (op.kind === 'answer') await backend.saveAnswer(sid, op.questionId, op.answer, op.locale);
          else await backend.emailPrompt(sid, op.action, op.locale);
          retryDelay.current = 2000;
        } catch (err) {
          const e = err instanceof BackendError ? err : new BackendError('unknown', false);
          if (!e.permanent) {
            // errore temporaneo (rete): si riprova più tardi senza perdere l'operazione
            if (retryTimer.current == null) {
              retryTimer.current = window.setTimeout(() => {
                retryTimer.current = null;
                void drain();
              }, retryDelay.current);
              retryDelay.current = Math.min(retryDelay.current * 2, 30000);
            }
            return;
          }
          console.warn('[travel-recovery] operazione scartata:', op.kind, e.code);
        }
        update((s) => ({ ...s, pendingOps: s.pendingOps.slice(1) }));
      }
    } finally {
      draining.current = false;
    }
  }, [update]);

  const enqueue = useCallback((op: Op) => {
    update((s) => {
      const ops = op.kind === 'answer' ? s.pendingOps.filter((o) => !(o.kind === 'answer' && o.questionId === op.questionId)) : s.pendingOps;
      return { ...s, pendingOps: [...ops, op] };
    });
    void drain();
  }, [update, drain]);

  useEffect(() => {
    if (ref.current.pendingOps.length) void drain();
    const online = () => void drain();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [drain]);

  /** Prova a svuotare la coda prima di un'operazione bloccante; non fallisce per errori temporanei. */
  const flush = useCallback(async () => {
    if (retryTimer.current != null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    await drain();
  }, [drain]);

  // ---------------------------------------------------------- azioni
  const setLocale = useCallback((l: Locale) => update((s) => ({ ...s, locale: l })), [update]);

  const begin = useCallback(async () => {
    const s = ref.current;
    const res = await backend.startSession(s.locale, s.referenceDate, s.sessionId);
    update((cur) => {
      if (cur.sessionId && cur.sessionId !== res.id) {
        // l'identità tecnica precedente non è più disponibile: nuova partecipazione, preferenze mantenute
        return { ...freshState(cur.locale), prefs: cur.prefs, sessionId: res.id, mode: res.mode, referenceDate: cur.referenceDate };
      }
      return { ...cur, sessionId: res.id, mode: res.mode, surveyCompleted: cur.surveyCompleted || res.surveyStatus === 'completed' };
    });
  }, [update]);

  const updatePrefs = useCallback((p: Partial<Prefs>) => update((s) => ({ ...s, prefs: { ...s.prefs, ...p } })), [update]);

  const validateSearch = useCallback((): SearchValidation => {
    const { prefs, referenceDate } = ref.current;
    const v: SearchValidation = {};
    if (!prefs.country) v.country = true;
    if (!prefs.originId) v.city = true;
    const ie = validateInterval(referenceDate, prefs.start, prefs.end);
    if (ie) v.interval = ie;
    if (parseBudget(prefs.budget) === 'invalid') v.budget = true;
    return v;
  }, []);

  const submitSearch = useCallback(async () => {
    const s = ref.current;
    if (!s.sessionId) throw new BackendError('no_session', true);
    const budget = parseBudget(s.prefs.budget);
    if (!s.prefs.originId || !s.prefs.start || !s.prefs.end || budget === 'invalid') throw new BackendError('invalid_search', true);
    await flush();
    const snap = await backend.saveSearch(s.sessionId, { originId: s.prefs.originId, intervalStart: s.prefs.start, intervalEnd: s.prefs.end, budgetCents: budget }, s.locale);
    update((cur) => ({ ...cur, search: snap, searchChanged: cur.search != null, opened: [], selection: null }));
  }, [update, flush]);

  const dismissSearchChanged = useCallback(() => update((s) => ({ ...s, searchChanged: false })), [update]);

  const track = useCallback((type: ClientEventType, opts: { destinationId?: DestinationId; meta?: ClientEvent['meta'] } = {}) => {
    const s = ref.current;
    enqueue({
      kind: 'event',
      ev: { eventId: uuid(), type, revision: s.search?.revision ?? null, destinationId: opts.destinationId ?? null, locale: s.locale, clientTs: new Date().toISOString(), meta: opts.meta },
    });
  }, [enqueue]);

  const openOffer = useCallback((d: DestinationId) => {
    if (ref.current.opened.includes(d)) return;
    update((s) => ({ ...s, opened: [...s.opened, d] }));
    track('offer_opened', { destinationId: d });
  }, [update, track]);

  const chooseOffer = useCallback((d: DestinationId) => {
    const s = ref.current;
    if (!s.search) return;
    if (s.selection && s.selection.destinationId === d && s.selection.revision === s.search.revision) return;
    update((cur) => ({ ...cur, selection: { revision: s.search!.revision, destinationId: d, paymentEventId: null, transferEventId: null } }));
    track('offer_selected', { destinationId: d });
    track('checkout_started', { destinationId: d });
  }, [update, track]);

  const simulatePayment = useCallback(() => {
    const s = ref.current;
    if (!s.selection || s.selection.paymentEventId || !s.search || s.selection.revision !== s.search.revision) return;
    const id = uuid();
    update((cur) => ({ ...cur, selection: cur.selection && { ...cur.selection, paymentEventId: id } }));
    enqueue({ kind: 'event', ev: { eventId: id, type: 'simulated_payment_completed', revision: s.selection.revision, destinationId: s.selection.destinationId, locale: s.locale, clientTs: new Date().toISOString() } });
  }, [update, enqueue]);

  const completeTransfer = useCallback(() => {
    const s = ref.current;
    if (!s.selection?.paymentEventId || s.selection.transferEventId) return;
    const id = uuid();
    update((cur) => ({ ...cur, selection: cur.selection && { ...cur.selection, transferEventId: id } }));
    enqueue({ kind: 'event', ev: { eventId: id, type: 'simulated_transfer_completed', revision: s.selection.revision, destinationId: s.selection.destinationId, locale: s.locale, clientTs: new Date().toISOString() } });
  }, [update, enqueue]);

  const startFeedback = useCallback((entry: FeedbackEntry | null, opts: { noOffer?: boolean } = {}) => {
    const s = ref.current;
    if (opts.noOffer && s.search && !s.noOffer) {
      update((cur) => ({ ...cur, noOffer: true }));
      track('no_offer_selected');
    }
    if (!s.feedbackEntry) {
      update((cur) => ({ ...cur, feedbackEntry: entry ?? 'other' }));
      track('feedback_started', entry ? { meta: { entry } } : {});
    }
  }, [update, track]);

  const setAnswer = useCallback((q: QuestionId, a: Answer) => {
    if (ref.current.surveyCompleted) return;
    update((s) => ({ ...s, answers: { ...s.answers, [q]: a } }));
  }, [update]);

  const saveDraft = useCallback((q: QuestionId) => {
    const s = ref.current;
    const a = s.answers[q];
    if (s.surveyCompleted || !a) return;
    enqueue({ kind: 'answer', questionId: q, answer: normalizeAnswer(QUESTION_BY_ID[q], a), locale: s.locale });
  }, [enqueue]);

  const submitSurvey = useCallback(async () => {
    const s = ref.current;
    if (!s.sessionId) throw new BackendError('no_session', true);
    if (s.surveyCompleted) return;
    await flush();
    await backend.submitSurvey(s.sessionId, s.answers, s.locale);
    update((cur) => ({ ...cur, surveyCompleted: true, pendingOps: cur.pendingOps.filter((o) => o.kind !== 'answer') }));
  }, [update, flush]);

  const markEmailPrompt = useCallback((action: 'viewed' | 'declined') => {
    const s = ref.current;
    if (!s.surveyCompleted || s.emailStatus === 'submitted') return;
    if (action === 'viewed' && s.emailStatus !== 'not_shown') return;
    update((cur) => ({ ...cur, emailStatus: action === 'viewed' ? 'pending' : 'declined' }));
    enqueue({ kind: 'email_prompt', action, locale: s.locale });
  }, [update, enqueue]);

  const submitEmail = useCallback(async (email: string, consent: boolean) => {
    const s = ref.current;
    if (!s.sessionId || !s.surveyCompleted) throw new BackendError('survey_not_completed', true);
    await flush();
    await backend.submitEmail(s.sessionId, email, consent, s.locale);
    update((cur) => ({ ...cur, emailStatus: 'submitted' }));
  }, [update, flush]);

  const restart = useCallback(() => {
    update((s) => freshState(s.locale));
  }, [update]);

  const api = useMemo<FlowApi>(() => ({
    state, config, storageOk: storageAvailable(), reloadConfig: loadConfig, setLocale, begin, updatePrefs, validateSearch, submitSearch,
    dismissSearchChanged, track, openOffer, chooseOffer, simulatePayment, completeTransfer, startFeedback, setAnswer,
    saveDraft, submitSurvey, markEmailPrompt, submitEmail, restart,
  }), [state, config, loadConfig, setLocale, begin, updatePrefs, validateSearch, submitSearch, dismissSearchChanged, track, openOffer, chooseOffer, simulatePayment, completeTransfer, startFeedback, setAnswer, saveDraft, submitSurvey, markEmailPrompt, submitEmail, restart]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useFlow(): FlowApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFlow outside provider');
  return v;
}

/** Modalità effettiva: quella decisa dal server per la sessione, oppure quella della configurazione. */
export function effectiveMode(state: FlowState, config: ConfigState): Mode | null {
  if (state.mode) return state.mode;
  return config.status === 'ready' ? config.config.mode : null;
}
