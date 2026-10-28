import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, BedDouble, Moon, RotateCcw, ShieldCheck, Users } from 'lucide-react';
import { BASE_DESTINATIONS } from '../data/catalog';
import { DestinationArt } from '../components/Illustration';
import { Button, ErrorBox, Notice } from '../components/ui';
import { cityName } from '../components/offerText';
import { useI18n } from '../i18n';
import { effectiveMode, useFlow, type FlowState } from '../state/flow';
import { BackendError } from '../backend/types';

export function resumePath(s: FlowState): string {
  if (s.surveyCompleted) return s.emailStatus === 'not_shown' || s.emailStatus === 'pending' ? '/feedback/email' : '/thanks';
  if (s.feedbackEntry) return '/feedback/1';
  if (s.selection?.transferEventId) return '/outcome';
  if (s.selection?.paymentEventId) return '/transfer';
  if (s.selection) return '/checkout';
  if (s.search) return '/offers';
  return '/search';
}

export default function Landing() {
  const { d, locale } = useI18n();
  const flow = useFlow();
  const { state, config } = flow;
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mode = effectiveMode(state, config);
  const notReady = config.status === 'ready' && config.config.mode === 'live' && !config.config.ready;
  const hasProgress = Boolean(state.sessionId);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await flow.begin();
      navigate(hasProgress ? resumePath(state) : '/search');
    } catch (err) {
      setError(err instanceof BackendError && err.code === 'collection_not_ready' ? d.errors.collectionNotReady : d.errors.startFailed);
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    flow.restart();
    setError(null);
  }

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="grid items-center gap-10 pt-8 pb-12 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <div className="tr-fade-up">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-terracotta-text">{d.landing.eyebrow}</p>
          <h1 tabIndex={-1} data-page-heading className="text-[2.35rem] leading-[1.04] font-medium text-ink outline-none sm:text-[3.3rem]">
            {d.landing.title}
          </h1>
          <p className="mt-5 max-w-xl text-[1.12rem] leading-relaxed text-ink-soft">{d.landing.subtitle}</p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            {config.status === 'error' ? (
              <ErrorBox action={<Button variant="secondary" onClick={flow.reloadConfig}>{d.common.retry}</Button>}>{d.errors.startFailed}</ErrorBox>
            ) : state.surveyCompleted ? (
              <Button onClick={startOver} icon={<RotateCcw className="size-4" aria-hidden />}>{d.thanks.restart}</Button>
            ) : (
              <>
                <Button onClick={start} loading={busy || config.status === 'loading'} disabled={notReady} className="sm:min-w-64" icon={!busy ? <ArrowRight className="size-4" aria-hidden /> : undefined}>
                  {hasProgress ? d.landing.resume : d.landing.cta}
                </Button>
                {hasProgress && <Button variant="quiet" onClick={startOver}>{d.landing.startOver}</Button>}
              </>
            )}
          </div>
          <div aria-live="polite" className="mt-3">
            {error && <ErrorBox>{error}</ErrorBox>}
            {notReady && <ErrorBox>{d.errors.collectionNotReady}</ErrorBox>}
          </div>
          <p className="mt-4 flex items-start gap-2 text-[0.95rem] font-medium text-petrol-dark">
            <ShieldCheck className="mt-0.5 size-[1.05rem] shrink-0" aria-hidden />
            {d.landing.note}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4" aria-hidden>
          {BASE_DESTINATIONS.map((id, i) => (
            <figure key={id} className={`overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-white shadow-[var(--shadow-soft)] ${i % 2 === 1 ? 'translate-y-5' : ''}`}>
              <div className="aspect-[4/3]"><DestinationArt id={id} label="" /></div>
              <figcaption className="px-3 py-2 font-serif text-[1.02rem] text-ink">{cityName(id, locale)}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[1fr_1.3fr]">
        <div className="rounded-[var(--radius-card)] bg-ink p-6 text-white">
          <p className="font-serif text-[1.35rem] leading-snug">{d.landing.scenario}</p>
          <ul className="mt-5 flex flex-wrap gap-2 text-sm">
            <li className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5"><Users className="size-4" aria-hidden />{d.common.adultsNights.split('·')[0].trim()}</li>
            <li className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5"><Moon className="size-4" aria-hidden />{d.common.adultsNights.split('·')[1]?.trim()}</li>
            <li className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5"><BedDouble className="size-4" aria-hidden />{d.hotel.room}</li>
          </ul>
        </div>
        <div className="rounded-[var(--radius-card)] border border-line/80 bg-white p-6">
          <h2 className="text-xl font-medium">{d.landing.howTitle}</h2>
          <ol className="mt-4 grid gap-3">
            {d.landing.howSteps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-petrol-tint text-sm font-semibold text-petrol-dark">{i + 1}</span>
                <span className="pt-0.5 leading-relaxed text-ink-soft">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mt-6 grid gap-3">
        <Notice>
          <p>{mode === 'preview' ? d.landing.dataNoticePreview : d.landing.dataNotice}{' '}
            <Link to="/privacy" className="font-semibold text-petrol-dark underline underline-offset-4">{d.common.privacy}</Link>
          </p>
        </Notice>
        <p className="text-sm text-muted">{d.landing.studentProject}</p>
      </section>
    </div>
  );
}
