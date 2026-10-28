// Struttura del questionario: ID stabili, uguali in ogni lingua. I testi stanno nei dizionari.
// La stessa definizione genera la tabella SQL usata per la validazione server-side.

export const SURVEY_VERSION = 'survey-2026-10-v1';

export type QuestionId = 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'c7' | 'v1' | 'v2' | 'v3';

export interface QuestionDef {
  id: QuestionId;
  kind: 'single' | 'multi' | 'text';
  required: boolean;
  options: string[];
  min?: number;
  max?: number;
  /** opzioni che non possono essere combinate con nessun'altra */
  exclusive?: string[];
  /** opzione «Altro» con campo di testo facoltativo */
  otherOption?: string;
  maxTextLength?: number;
}

const opts = (q: string, n: number) => Array.from({ length: n }, (_, i) => `${q}_${String(i + 1).padStart(2, '0')}`);

export const QUESTIONS: QuestionDef[] = [
  { id: 'c1', kind: 'single', required: true, options: opts('c1', 5) },
  { id: 'c2', kind: 'single', required: true, options: opts('c2', 5) },
  { id: 'c3', kind: 'single', required: true, options: opts('c3', 7) },
  { id: 'c4', kind: 'single', required: true, options: opts('c4', 6), otherOption: 'c4_06' },
  { id: 'c5', kind: 'multi', required: true, options: opts('c5', 10), min: 1, max: 3, exclusive: ['c5_09'], otherOption: 'c5_10' },
  { id: 'c6', kind: 'multi', required: true, options: opts('c6', 7), min: 1, exclusive: ['c6_06', 'c6_07'] },
  { id: 'c7', kind: 'text', required: false, options: [], maxTextLength: 1500 },
  { id: 'v1', kind: 'single', required: true, options: opts('v1', 5) },
  { id: 'v2', kind: 'multi', required: true, options: opts('v2', 9), min: 1, max: 2, exclusive: ['v2_08'], otherOption: 'v2_09' },
  { id: 'v3', kind: 'single', required: true, options: opts('v3', 13) },
];

export const OTHER_TEXT_MAX = 300;
export const COMMENT_MAX = 1500;

/** Passi del questionario: l'introduzione venditore precede V1 e non è una domanda. */
export type SurveyStep = { type: 'question'; question: QuestionDef; number: number } | { type: 'seller_intro' };

export const SURVEY_STEPS: SurveyStep[] = [
  ...QUESTIONS.slice(0, 7).map((q, i) => ({ type: 'question' as const, question: q, number: i + 1 })),
  { type: 'seller_intro' },
  ...QUESTIONS.slice(7).map((q, i) => ({ type: 'question' as const, question: q, number: i + 8 })),
];

export const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q])) as Record<QuestionId, QuestionDef>;

export interface Answer {
  optionIds: string[];
  otherText?: string;
  text?: string;
}

export type AnswerError = 'required' | 'unknown_option' | 'too_many' | 'too_few' | 'exclusive' | 'single' | 'too_long';

/** Pulisce una risposta: rimuove duplicati e il testo «Altro» se l'opzione non è selezionata. */
export function normalizeAnswer(q: QuestionDef, a: Answer | undefined): Answer {
  if (q.kind === 'text') {
    const text = (a?.text ?? '').trim();
    return { optionIds: [], ...(text ? { text } : {}) };
  }
  const optionIds = Array.from(new Set(a?.optionIds ?? []));
  const otherSelected = q.otherOption ? optionIds.includes(q.otherOption) : false;
  const otherText = otherSelected ? (a?.otherText ?? '').trim() : '';
  return { optionIds, ...(otherText ? { otherText } : {}) };
}

export function validateAnswer(q: QuestionDef, raw: Answer | undefined, opts: { final: boolean }): AnswerError | null {
  const a = normalizeAnswer(q, raw);
  if (q.kind === 'text') {
    if ((a.text ?? '').length > (q.maxTextLength ?? COMMENT_MAX)) return 'too_long';
    return null;
  }
  if (a.optionIds.some((o) => !q.options.includes(o))) return 'unknown_option';
  if ((a.otherText ?? '').length > OTHER_TEXT_MAX) return 'too_long';
  if (q.kind === 'single') {
    if (a.optionIds.length > 1) return 'single';
    if (opts.final && q.required && a.optionIds.length === 0) return 'required';
    return null;
  }
  if (q.max != null && a.optionIds.length > q.max) return 'too_many';
  if (q.exclusive?.some((x) => a.optionIds.includes(x)) && a.optionIds.length > 1) return 'exclusive';
  if (opts.final && q.required && a.optionIds.length < (q.min ?? 1)) return a.optionIds.length === 0 ? 'required' : 'too_few';
  return null;
}

export type Answers = Partial<Record<QuestionId, Answer>>;

export function validateAll(answers: Answers): Partial<Record<QuestionId, AnswerError>> {
  const errors: Partial<Record<QuestionId, AnswerError>> = {};
  for (const q of QUESTIONS) {
    const e = validateAnswer(q, answers[q.id], { final: true });
    if (e) errors[q.id] = e;
  }
  return errors;
}

/**
 * Applica un clic su un'opzione a scelta multipla in modo prevedibile:
 * un'opzione esclusiva deseleziona le altre; un'opzione normale deseleziona le esclusive;
 * oltre il massimo il clic viene rifiutato (il chiamante mostra «Puoi selezionare al massimo…»).
 */
export function toggleMulti(q: QuestionDef, current: string[], option: string): { next: string[]; rejected: boolean } {
  if (current.includes(option)) return { next: current.filter((o) => o !== option), rejected: false };
  const isExclusive = q.exclusive?.includes(option) ?? false;
  if (isExclusive) return { next: [option], rejected: false };
  const base = current.filter((o) => !(q.exclusive?.includes(o) ?? false));
  if (q.max != null && base.length >= q.max) return { next: current, rejected: true };
  return { next: [...base, option], rejected: false };
}
