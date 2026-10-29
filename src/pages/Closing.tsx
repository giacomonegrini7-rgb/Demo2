import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { CheckCircle2, Mail, RotateCcw } from 'lucide-react';
import { Button, Card, ErrorBox, LinkButton, Notice, PageHeading } from '../components/ui';
import { useI18n } from '../i18n';
import { PHOTOS } from '../data/media';
import { effectiveMode, useFlow } from '../state/flow';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function EmailStep() {
  const { d } = useI18n();
  const flow = useFlow();
  const { state, config } = flow;
  const navigate = useNavigate();
  const preview = effectiveMode(state, config) === 'preview';
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state.surveyCompleted) flow.markEmailPrompt('viewed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.surveyCompleted]);

  if (!state.surveyCompleted) return <Navigate to={state.sessionId ? '/feedback/1' : '/'} replace />;
  const submitted = state.emailStatus === 'submitted';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (preview) return;
    const v = email.trim();
    if (!EMAIL_RE.test(v) || v.length > 254) return setFieldError(d.email.invalid);
    if (!consent) return setFieldError(d.email.consentRequired);
    setFieldError(null);
    setFailed(false);
    setBusy(true);
    try {
      await flow.submitEmail(v, consent);
      setEmail('');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function finishWithout() {
    flow.markEmailPrompt('declined');
    navigate('/thanks');
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 sm:pt-12">
      <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-petrol-tint px-4 py-2 text-sm font-semibold text-petrol-dark" role="status">
        <CheckCircle2 className="size-4" aria-hidden />{d.email.saved}
      </p>
      <PageHeading lead={d.email.text}>{d.email.title}</PageHeading>

      {submitted ? (
        <Card className="grid gap-4 p-6">
          <p className="flex items-center gap-2 font-semibold text-petrol-dark" role="status"><CheckCircle2 className="size-5" aria-hidden />{d.email.registered}</p>
          <LinkButton to="/thanks" className="sm:self-start">{d.email.continue}</LinkButton>
        </Card>
      ) : (
        <Card className="p-5 sm:p-7">
          {preview && <Notice tone="warm" className="mb-5">{d.email.previewDisabled}</Notice>}
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block font-semibold">{d.email.label}</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <input id="email" type="email" autoComplete="email" inputMode="email" value={email} disabled={preview || busy}
                  onChange={(e) => setEmail(e.target.value)} aria-invalid={fieldError === d.email.invalid || undefined} aria-describedby="email-note"
                  className="min-h-12 w-full rounded-xl border border-line bg-white py-3 pr-4 pl-11 text-[1rem] disabled:bg-sand/50" />
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-[0.95rem] leading-relaxed">
              <input type="checkbox" checked={consent} disabled={preview || busy} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-5 shrink-0 accent-[#176b63]" />
              <span>{d.email.consent}</span>
            </label>
            <p id="email-note" className="text-sm text-muted">
              {d.email.note}{' '}
              <Link to="/privacy" className="font-semibold text-petrol-dark underline underline-offset-4">{d.common.privacy}</Link>
            </p>
            <div aria-live="assertive">
              {fieldError && <ErrorBox>{fieldError}</ErrorBox>}
              {failed && <ErrorBox>{d.email.failed}</ErrorBox>}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" disabled={preview} loading={busy}>{busy ? d.email.sending : d.email.cta}</Button>
              <Button type="button" variant="secondary" onClick={finishWithout} disabled={busy}>{d.email.decline}</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

export function Thanks() {
  const { d, t } = useI18n();
  const flow = useFlow();
  const navigate = useNavigate();
  const { state, config } = flow;
  if (!state.surveyCompleted) return <Navigate to="/" replace />;
  const code = state.sessionId?.slice(0, 8).toUpperCase() ?? '';
  const preview = effectiveMode(state, config) === 'preview';
  return (
    <div className="mx-auto max-w-2xl px-4 pt-12 sm:pt-16">
      <Card className="grid gap-5 p-6 text-center sm:p-10">
        <CheckCircle2 className="mx-auto size-10 text-petrol" aria-hidden />
        <h1 tabIndex={-1} data-page-heading className="text-[2rem] leading-tight font-medium outline-none sm:text-[2.4rem]">{d.thanks.title}</h1>
        <p className="mx-auto max-w-lg text-[1.05rem] leading-relaxed text-ink-soft">{d.thanks.text}</p>
        <p className="text-sm text-muted tabular">{t(d.common.participationCode, { code })}</p>
        {preview && <Notice tone="warm" className="text-left">{d.thanks.previewNote}</Notice>}
        <div className="grid justify-center gap-2">
          <Button variant="secondary" onClick={() => { flow.restart(); navigate('/'); }} icon={<RotateCcw className="size-4" aria-hidden />}>{d.thanks.restart}</Button>
          <p className="text-xs text-muted">{d.thanks.restartNote}</p>
        </div>
      </Card>
    </div>
  );
}

export function Privacy() {
  const { d, t } = useI18n();
  const { state, config } = useFlow();
  const mode = effectiveMode(state, config);
  const p = config.status === 'ready' ? config.config.privacy : null;
  const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <section className="print-break">
      <h2 className="mb-2 text-xl font-medium">{title}</h2>
      <div className="grid gap-2 leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:pt-12">
      <PageHeading lead={d.privacy.intro}>{d.privacy.title}</PageHeading>
      <div className="grid gap-4">
        {mode === 'preview' && <Notice tone="warm">{d.privacy.previewNote}</Notice>}
        {!p && <Notice>{d.privacy.notConfigured}</Notice>}
        <Card className="grid gap-7 p-6 sm:p-8">
          {p && (
            <Section title={d.privacy.controllerTitle}>
              <p>{t(d.privacy.controllerText, { controller: p.controllerName, contact: p.contactEmail })}</p>
              {p.projectContext && <p>{p.projectContext}</p>}
            </Section>
          )}
          <Section title={d.privacy.purposeTitle}><p>{d.privacy.purposeText}</p></Section>
          <Section title={d.privacy.dataTitle}>
            <ul className="list-disc space-y-1 pl-5">{d.privacy.dataItems.map((x) => <li key={x}>{x}</li>)}</ul>
            <p>{d.privacy.notCollected}</p>
            <p>{d.privacy.pseudonym}</p>
          </Section>
          {p && <Section title={d.privacy.basisTitle}><p>{d.privacy.basis[p.legalBasis]}</p></Section>}
          {p && (
            <Section title={d.privacy.retentionTitle}>
              <p>{t(d.privacy.retentionResponses, { months: p.responsesRetentionMonths })}</p>
              <p>{t(d.privacy.retentionContacts, { months: p.contactsRetentionMonths })}</p>
            </Section>
          )}
          <Section title={d.privacy.recipientsTitle}><p>{d.privacy.recipientsText}</p></Section>
          {p && <Section title={d.privacy.rightsTitle}><p>{t(d.privacy.rightsText, { contact: p.contactEmail })}</p></Section>}
          {p && <p className="text-sm text-muted">{t(d.privacy.version, { version: p.privacyVersion })}</p>}
          {Object.values(PHOTOS).some((x) => x?.city || x?.room) && (
            <ul className="grid gap-1 text-xs text-muted" aria-label="Credits">
              {Object.values(PHOTOS).flatMap((x) => [x?.city, x?.room]).filter(Boolean).map((ph) => (
                <li key={ph!.src}><a href={ph!.sourceUrl} className="underline" rel="noopener noreferrer">{ph!.credit}</a> · {ph!.license}</li>
              ))}
            </ul>
          )}
        </Card>
        <LinkButton to="/" variant="secondary" className="self-start">{d.privacy.backHome}</LinkButton>
      </div>
    </div>
  );
}

export function NotFound() {
  const { d } = useI18n();
  return (
    <div className="mx-auto max-w-3xl px-4 pt-16">
      <PageHeading>{d.common.notFoundTitle}</PageHeading>
      <LinkButton to="/">{d.common.notFoundCta}</LinkButton>
    </div>
  );
}
