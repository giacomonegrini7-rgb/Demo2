import { useEffect, useId, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, Repeat } from 'lucide-react';
import { COMMENT_MAX, OTHER_TEXT_MAX, SURVEY_STEPS, toggleMulti, validateAnswer, type Answer, type QuestionDef } from '../survey/definition';
import { Button, ErrorBox, Notice, Pill } from '../components/ui';
import { useI18n } from '../i18n';
import { useFlow } from '../state/flow';

const TOTAL_QUESTIONS = 10;

/** Primo passo con una domanda obbligatoria ancora senza risposta valida (per non saltare avanti via URL). */
function firstIncompleteStep(answers: ReturnType<typeof useFlow>['state']['answers']): number {
  for (let i = 0; i < SURVEY_STEPS.length; i++) {
    const s = SURVEY_STEPS[i];
    if (s.type === 'question' && validateAnswer(s.question, answers[s.question.id], { final: true })) return i + 1;
  }
  return SURVEY_STEPS.length;
}

function QuestionView({ q, answer, onChange, error, onLimit }: { q: QuestionDef; answer: Answer | undefined; onChange: (a: Answer) => void; error: string | null; onLimit: (max: number) => void }) {
  const { d, t } = useI18n();
  const text = d.survey.questions[q.id];
  const errId = useId();
  const hintId = useId();
  const selected = answer?.optionIds ?? [];
  const otherSelected = q.otherOption ? selected.includes(q.otherOption) : false;

  if (q.kind === 'text') {
    const value = answer?.text ?? '';
    return (
      <div className="grid gap-3">
        <label htmlFor="c7" className="font-semibold">{d.survey.commentLabel}</label>
        <p id={hintId} className="text-sm text-muted">{d.survey.personalData}</p>
        <textarea id="c7" rows={6} maxLength={COMMENT_MAX} value={value} aria-describedby={hintId}
          onChange={(e) => onChange({ optionIds: [], text: e.target.value })}
          className="w-full rounded-2xl border border-line bg-white p-4 text-[1rem] leading-relaxed" />
        <p className="text-right text-sm text-muted tabular" aria-live="polite">{t(d.survey.charsLeft, { n: COMMENT_MAX - value.length })}</p>
      </div>
    );
  }

  const type = q.kind === 'single' ? 'radio' : 'checkbox';
  return (
    <fieldset aria-describedby={`${hintId}${error ? ` ${errId}` : ''}`} aria-invalid={error ? true : undefined}>
      <legend className="sr-only">{text.text}</legend>
      <p id={hintId} className="mb-4 text-sm text-muted">{text.hint}</p>
      <div className="grid gap-2">
        {q.options.map((opt, i) => {
          const checked = selected.includes(opt);
          return (
            <div key={opt}>
              <label className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${checked ? 'border-petrol bg-petrol-tint' : 'border-line bg-white hover:border-ink/40'}`}>
                <input
                  type={type}
                  name={q.id}
                  value={opt}
                  checked={checked}
                  onChange={() => {
                    if (q.kind === 'single') return onChange({ optionIds: [opt], otherText: answer?.otherText });
                    const r = toggleMulti(q, selected, opt);
                    if (r.rejected) return onLimit(q.max ?? 0);
                    onChange({ optionIds: r.next, otherText: answer?.otherText });
                  }}
                  className="mt-0.5 size-5 shrink-0 accent-[#176b63]"
                />
                <span className="leading-snug">{text.options[i]}</span>
              </label>
              {opt === q.otherOption && otherSelected && (
                <div className="mt-2 ml-8">
                  <label htmlFor={`${q.id}-other`} className="mb-1 block text-sm font-medium text-ink-soft">{d.survey.otherLabel}</label>
                  <input id={`${q.id}-other`} maxLength={OTHER_TEXT_MAX} value={answer?.otherText ?? ''}
                    onChange={(e) => onChange({ optionIds: selected, otherText: e.target.value })}
                    className="min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2" />
                  <p className="mt-1 text-xs text-muted">{d.survey.personalData}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div id={errId} aria-live="assertive" className="mt-3">{error && <ErrorBox>{error}</ErrorBox>}</div>
    </fieldset>
  );
}

export default function Survey() {
  const { d, t } = useI18n();
  const flow = useFlow();
  const { state } = flow;
  const navigate = useNavigate();
  const params = useParams();
  const stepNo = Number(params.step);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState(false);
  const [busy, setBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setError(null);
    setSubmitError(false);
    headingRef.current?.focus({ preventScroll: true });
  }, [stepNo]);

  useEffect(() => {
    // accesso diretto al questionario (senza passare da risultati/dettaglio/esito)
    if (state.sessionId && !state.feedbackEntry && !state.surveyCompleted) flow.startFeedback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sessionId]);

  if (!state.sessionId) return <Navigate to="/" replace />;
  if (state.surveyCompleted) return <Navigate to="/feedback/email" replace />;
  if (!Number.isInteger(stepNo) || stepNo < 1 || stepNo > SURVEY_STEPS.length) return <Navigate to="/feedback/1" replace />;
  const maxStep = firstIncompleteStep(state.answers);
  if (stepNo > maxStep) return <Navigate to={`/feedback/${maxStep}`} replace />;

  const step = SURVEY_STEPS[stepNo - 1];
  const isLast = stepNo === SURVEY_STEPS.length;
  const progressNumber = step.type === 'question' ? step.number : 7;

  function goBack() {
    if (stepNo > 1) navigate(`/feedback/${stepNo - 1}`);
    else navigate(-1);
  }

  async function goNext() {
    if (step.type === 'question') {
      const q = step.question;
      const e = validateAnswer(q, state.answers[q.id], { final: true });
      if (e) {
        setError(e === 'required' || e === 'too_few' ? (q.kind === 'single' ? d.survey.requiredSingle : d.survey.requiredMulti) : e === 'too_many' ? t(d.survey.maxReached, { max: q.max ?? 0 }) : d.survey.invalidCombination);
        return;
      }
      flow.saveDraft(q.id);
    }
    if (!isLast) return navigate(`/feedback/${stepNo + 1}`);
    setBusy(true);
    setSubmitError(false);
    try {
      await flow.submitSurvey();
      navigate('/feedback/email', { replace: true });
    } catch {
      setSubmitError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 sm:pt-12">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-ink-soft">{step.type === 'question' ? t(d.survey.progress, { n: progressNumber }) : d.survey.sellerStep}</span>
          {step.type === 'question' && !step.question.required && <Pill tone="warm">{d.survey.optional}</Pill>}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-sand-deep" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL_QUESTIONS} aria-valuenow={progressNumber} aria-label={d.survey.title}>
          <div className="h-full rounded-full bg-petrol transition-[width] duration-300" style={{ width: `${(progressNumber / TOTAL_QUESTIONS) * 100}%` }} />
        </div>
      </div>

      {step.type === 'seller_intro' ? (
        <section className="rounded-[var(--radius-card)] bg-ink p-6 text-white sm:p-8">
          <Repeat className="size-6 text-terracotta" aria-hidden />
          <h1 ref={headingRef} tabIndex={-1} data-page-heading className="mt-3 text-[1.9rem] leading-tight font-medium outline-none">{d.survey.sellerIntro.title}</h1>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-white/90">{d.survey.sellerIntro.text}</p>
        </section>
      ) : (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-terracotta-text">{step.question.id.toUpperCase()} — {d.survey.questions[step.question.id].title}</p>
          <h1 ref={headingRef} tabIndex={-1} data-page-heading className="mb-5 text-[1.55rem] leading-snug font-medium outline-none sm:text-[1.8rem]">{d.survey.questions[step.question.id].text}</h1>
          <QuestionView
            q={step.question}
            answer={state.answers[step.question.id]}
            error={error}
            onLimit={(max) => setError(t(d.survey.maxReached, { max }))}
            onChange={(a) => { setError(null); flow.setAnswer(step.question.id, a); }}
          />
        </section>
      )}

      <div aria-live="polite" className="mt-4">
        {submitError && <ErrorBox action={<Button variant="secondary" onClick={goNext} loading={busy}>{d.common.retry}</Button>}>{d.errors.saveFailed}</ErrorBox>}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="secondary" onClick={goBack} icon={<ArrowLeft className="size-4" aria-hidden />}>{d.survey.back}</Button>
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          {step.type === 'question' && !step.question.required && !(state.answers[step.question.id]?.text ?? '').trim() && (
            <Button variant="quiet" onClick={() => navigate(`/feedback/${stepNo + 1}`)}>{d.survey.skip}</Button>
          )}
          <Button onClick={goNext} loading={busy} icon={!busy && !isLast ? <ArrowRight className="size-4" aria-hidden /> : undefined}>
            {isLast ? (busy ? d.survey.submitting : d.survey.submit) : step.type === 'seller_intro' ? d.survey.sellerContinue : d.survey.next}
          </Button>
        </div>
      </div>
      {step.type === 'question' && step.question.kind === 'text' && <Notice className="mt-6">{d.survey.questions.c7.hint}</Notice>}
    </div>
  );
}
