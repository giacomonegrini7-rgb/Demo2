import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { formatEur, formatPercentX10 } from '../lib/format';
import type { Offer } from '../lib/pricing';
import { DestinationArt } from '../components/Illustration';
import { DemoModeBar } from '../components/Layout';
import { Button, Card, LinkButton, Notice, PageHeading } from '../components/ui';
import { cityName, hotelName, originName, routeFor, transportSummary } from '../components/offerText';
import { StayDates } from './Results';
import { useI18n } from '../i18n';
import { useFlow, type FlowState } from '../state/flow';

/** Offerta selezionata, solo se coerente con la ricerca corrente (stessa revisione). */
export function currentSelection(s: FlowState): Offer | null {
  if (!s.search || !s.selection || s.selection.revision !== s.search.revision) return null;
  return s.search.offers.find((o) => o.destinationId === s.selection!.destinationId) ?? null;
}

function Stale() {
  const { d } = useI18n();
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12">
      <Notice>{d.summary.stale}</Notice>
      <LinkButton to="/offers" className="mt-5">{d.detail.backToOffers}</LinkButton>
    </div>
  );
}

export function Summary() {
  const { d, t, locale } = useI18n();
  const flow = useFlow();
  const navigate = useNavigate();
  const offer = currentSelection(flow.state);
  if (!offer || !flow.state.search) return <Stale />;
  const route = routeFor(flow.state.search.originId, offer.destinationId);
  const paid = Boolean(flow.state.selection?.paymentEventId);

  function pay() {
    flow.simulatePayment();
    navigate('/transfer');
  }

  return (
    <>
      <DemoModeBar />
      <div className="mx-auto max-w-3xl px-4 pt-6 sm:pt-10">
        <Link to={`/offers/${offer.destinationId}`} className="mb-4 inline-flex min-h-11 items-center gap-2 pr-3 text-[0.95rem] font-medium text-ink-soft hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />{d.summary.backToDetail}
        </Link>
        <PageHeading>{d.summary.title}</PageHeading>

        <Card className="overflow-hidden">
          <div className="grid sm:grid-cols-[220px_1fr]">
            <div className="aspect-[16/9] sm:aspect-auto"><DestinationArt id={offer.destinationId} label={cityName(offer.destinationId, locale)} /></div>
            <div className="grid gap-3 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{d.summary.stay}</p>
              <h2 className="text-2xl font-medium">{cityName(offer.destinationId, locale)}</h2>
              <p className="text-ink-soft">{hotelName(offer.destinationId, d)}</p>
              <p className="text-[0.95rem]"><StayDates offer={offer} /> · {d.common.stayConfig}</p>
              <p className="inline-flex items-center gap-2 text-sm text-muted"><UserRound className="size-4" aria-hidden />{d.summary.holder}</p>
            </div>
          </div>
          <div className="border-t border-line/70 p-5">
            <h3 className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft">{d.summary.conditions}</h3>
            <ul className="grid gap-1.5 text-[0.95rem]">{d.detail.conditions.map((c) => <li key={c} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-petrol" aria-hidden />{c}</li>)}</ul>
            <p className="mt-2 text-sm text-muted">{d.detail.conditionsNote}</p>
          </div>
          <div className="grid gap-2 border-t border-line/70 bg-sand/40 p-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-ink-soft">{d.results.originalPaid}</span>
              <s className="text-muted tabular">{formatEur(offer.hotelOriginalCents, locale)}</s>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{d.summary.totalSim}</span>
              <span className="text-[1.9rem] leading-none font-semibold tabular">{formatEur(offer.hotelSaleCents, locale)}</span>
            </div>
            <p className="text-right text-sm font-semibold text-petrol-dark">
              {t(d.summary.savings, { amount: formatEur(offer.hotelSavingsCents, locale), percent: formatPercentX10(offer.hotelSavingsPercentX10, locale) })}
            </p>
            <p className="text-sm text-muted">{d.summary.noFees}</p>
          </div>
        </Card>

        <section className="mt-4 rounded-[var(--radius-card)] border border-dashed border-line bg-white/50 p-5" aria-label={d.summary.transportBox}>
          <p className="text-sm font-semibold text-ink-soft">{d.summary.transportBox}</p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <span className="text-ink-soft">{transportSummary(route, locale, d)}</span>
            <span className="font-semibold tabular">{formatEur(offer.transportTotalCents, locale)}</span>
          </div>
        </section>

        <div className="mt-6 grid gap-4">
          <Notice tone="petrol" icon={<ShieldCheck className="size-[1.1rem]" />}><p className="font-medium">{d.summary.notice}</p></Notice>
          <Button onClick={pay} className="w-full sm:w-auto sm:min-w-80" icon={<ArrowRight className="size-4" aria-hidden />}>{paid ? d.transfer.viewOutcome : d.summary.cta}</Button>
          <button type="button" onClick={() => { flow.startFeedback('summary'); navigate('/feedback/1'); }} className="min-h-11 self-start text-[0.93rem] font-medium text-ink-soft underline decoration-line underline-offset-4 hover:decoration-ink">
            {d.detail.feedbackLink}
          </button>
        </div>
      </div>
    </>
  );
}

const STEP_MS = 1000;

export function Transfer() {
  const { d } = useI18n();
  const flow = useFlow();
  const navigate = useNavigate();
  const offer = currentSelection(flow.state);
  const sel = flow.state.selection;
  const alreadyDone = Boolean(sel?.transferEventId);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const total = d.transfer.steps.length;
  const [done, setDone] = useState(alreadyDone || reduced ? total : 0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!sel?.paymentEventId) return;
    if (done >= total) {
      flow.completeTransfer();
      return;
    }
    timer.current = window.setTimeout(() => setDone((x) => x + 1), STEP_MS);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, total, sel?.paymentEventId]);

  if (!offer || !sel?.paymentEventId) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-12">
        <Notice>{d.transfer.missing}</Notice>
        <LinkButton to="/offers" className="mt-5">{d.detail.backToOffers}</LinkButton>
      </div>
    );
  }

  const finished = done >= total;
  return (
    <>
      <DemoModeBar />
      <div className="mx-auto max-w-2xl px-4 pt-8 sm:pt-12">
        <PageHeading lead={d.transfer.intro}>{d.transfer.title}</PageHeading>
        <Card className="p-5 sm:p-7">
          <ol className="relative grid gap-5">
            {d.transfer.steps.map((s, i) => {
              const state = i < done ? 'done' : i === done ? 'current' : 'pending';
              return (
                <li key={s.title} className="relative flex gap-4">
                  {i < total - 1 && <span className={`absolute top-8 left-[15px] h-[calc(100%-4px)] w-0.5 ${i < done ? 'bg-petrol' : 'bg-line'}`} aria-hidden />}
                  <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${state === 'done' ? 'border-petrol bg-petrol text-white' : state === 'current' ? 'tr-pulse border-petrol bg-white text-petrol' : 'border-line bg-white text-muted'}`} aria-hidden>
                    {state === 'done' ? <Check className="size-4" /> : state === 'current' ? <Loader2 className="size-4 animate-spin" /> : <span className="text-xs font-semibold">{i + 1}</span>}
                  </span>
                  <div className={state === 'pending' ? 'opacity-55' : ''}>
                    <p className="font-semibold">{s.title} <span className="sr-only">— {state === 'done' ? d.transfer.stepDone : state === 'current' ? d.transfer.stepCurrent : d.transfer.stepPending}</span></p>
                    <p className="text-[0.94rem] text-muted">{s.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="sr-only" aria-live="polite">{finished ? d.transfer.steps[total - 1].title : d.transfer.steps[done]?.title}</p>
        </Card>
        <p className="mt-3 text-sm text-muted">{d.transfer.note}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {finished ? (
            <Button onClick={() => navigate('/outcome')} icon={<ArrowRight className="size-4" aria-hidden />}>{d.transfer.viewOutcome}</Button>
          ) : (
            <Button variant="secondary" onClick={() => setDone(total)}>{d.transfer.showAll}</Button>
          )}
        </div>
      </div>
    </>
  );
}

export function Outcome() {
  const { d, t, locale } = useI18n();
  const flow = useFlow();
  const navigate = useNavigate();
  const offer = currentSelection(flow.state);
  const search = flow.state.search;
  if (!offer || !search || !flow.state.selection?.transferEventId) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-12">
        <Notice>{d.transfer.missing}</Notice>
        <LinkButton to="/offers" className="mt-5">{d.detail.backToOffers}</LinkButton>
      </div>
    );
  }
  const city = cityName(offer.destinationId, locale);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:pt-12">
      <Card className="overflow-hidden">
        <div className="aspect-[16/7]"><DestinationArt id={offer.destinationId} label={city} /></div>
        <div className="grid gap-5 p-6 sm:p-8">
          <header>
            <h1 tabIndex={-1} data-page-heading className="text-[2.1rem] leading-tight font-medium outline-none sm:text-[2.6rem]">{t(d.outcome.title, { destination: city })}</h1>
            <p className="mt-2 text-lg text-ink-soft">{t(d.outcome.subtitle, { origin: originName(search.originId, locale) })}</p>
            <p className="mt-1 text-[0.95rem] text-muted"><StayDates offer={offer} /> · {hotelName(offer.destinationId, d)}</p>
          </header>
          <dl className="grid gap-2 rounded-2xl bg-sand/60 p-5 text-[0.98rem]">
            <div className="flex justify-between gap-3"><dt>{d.outcome.original}</dt><dd><s className="text-muted tabular">{formatEur(offer.hotelOriginalCents, locale)}</s></dd></div>
            <div className="flex justify-between gap-3"><dt className="font-semibold">{d.outcome.purchase}</dt><dd className="text-xl font-semibold tabular">{formatEur(offer.hotelSaleCents, locale)}</dd></div>
            <div className="font-semibold text-petrol-dark">{t(d.outcome.savings, { amount: formatEur(offer.hotelSavingsCents, locale), percent: formatPercentX10(offer.hotelSavingsPercentX10, locale) })}</div>
            <div className="mt-2 border-t border-line pt-3">{t(d.outcome.transport, { amount: formatEur(offer.transportTotalCents, locale) })}</div>
            <div className="font-semibold">{t(d.outcome.total, { amount: formatEur(offer.tripTotalCents, locale) })}</div>
          </dl>
          <Notice tone="petrol" icon={<ShieldCheck className="size-[1.1rem]" />}><p className="font-semibold">{d.outcome.noPayment}</p></Notice>
          <div className="grid gap-1 text-sm text-muted">
            <p>{d.outcome.savingsNote}</p>
            <p>{d.outcome.excluded}</p>
          </div>
          <Button onClick={() => { flow.startFeedback('outcome'); navigate('/feedback/1'); }} className="w-full sm:w-auto sm:self-start" icon={<ArrowRight className="size-4" aria-hidden />}>{d.outcome.cta}</Button>
        </div>
      </Card>
    </div>
  );
}
