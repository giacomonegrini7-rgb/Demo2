import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, BedDouble, Check, CircleSlash, Clock, FileCheck2, Handshake, MapPin, Search as SearchIcon, ShieldCheck } from 'lucide-react';
import { isDestinationId } from '../data/catalog';
import { formatCivil } from '../lib/dates';
import { formatDuration, formatEur, INTL_LOCALE } from '../lib/format';
import { DestinationArt } from '../components/Illustration';
import { PriceBlock } from '../components/Price';
import { Button, Card, Expandable, LinkButton, Notice, Pill, SectionTitle } from '../components/ui';
import { cityName, connectionVia, hasCityLink, hotelName, legLabel, routeFor, startPlace } from '../components/offerText';
import { MissingSearch, StayDates } from './Results';
import { useI18n } from '../i18n';
import { useFlow } from '../state/flow';

export function TransportDetails({ originId, destinationId, totalCents, mainCents }: { originId: Parameters<typeof routeFor>[0]; destinationId: Parameters<typeof routeFor>[1]; totalCents: number; mainCents: number }) {
  const { d, t, locale } = useI18n();
  const route = routeFor(originId, destinationId);
  const via = connectionVia(route, locale);
  return (
    <div className="grid gap-4">
      <ol className="grid gap-2">
        {route.legs.map((leg, i) => (
          <li key={i} className="flex items-start gap-3 text-[0.95rem]">
            <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-petrol-tint text-[0.7rem] font-bold text-petrol-dark">{i + 1}</span>
            <span className="text-ink">{legLabel(leg, locale, d)}</span>
          </li>
        ))}
        {hasCityLink(route) && (
          <li className="flex items-start gap-3 text-[0.95rem]">
            <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-petrol-tint text-[0.7rem] font-bold text-petrol-dark">{route.legs.length + 1}</span>
            <span className="text-ink">{d.detail.cityLink}</span>
          </li>
        )}
      </ol>
      <ul className="grid gap-1 text-[0.93rem] text-ink-soft">
        <li className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-petrol" aria-hidden />{t(d.detail.startPoint, { place: startPlace(route, locale) })}</li>
        <li className="flex items-start gap-2"><Clock className="mt-0.5 size-4 shrink-0 text-petrol" aria-hidden />{t(d.detail.duration, { duration: formatDuration(route.durationMinutes, locale) })}</li>
      </ul>
      <p className="text-sm text-muted">{d.detail.durationNote}</p>
      {via && <Notice tone="warm">{t(d.detail.connection, { via })}</Notice>}
      <dl className="grid gap-1.5 rounded-xl bg-sand/60 p-4 text-[0.93rem]">
        <div className="flex justify-between gap-3"><dt className="text-ink-soft">{d.detail.mainCost}</dt><dd className="font-semibold tabular">{formatEur(mainCents, locale)}</dd></div>
        {route.transferParts.map((p) => (
          <div key={p.kind} className="flex justify-between gap-3"><dt className="text-ink-soft">{d.detail.transferCost[p.kind]}</dt><dd className="font-semibold tabular">{formatEur(p.cents, locale)}</dd></div>
        ))}
        <div className="mt-1 flex justify-between gap-3 border-t border-line pt-2"><dt className="font-semibold">{d.detail.transportTotal}</dt><dd className="font-semibold tabular">{formatEur(totalCents, locale)}</dd></div>
      </dl>
      <Expandable summary={d.detail.assumptionsTitle}>
        <ul className="list-disc space-y-1 pl-5">{d.detail.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
      </Expandable>
      <p className="text-sm text-muted">{d.detail.excludedTrip}</p>
    </div>
  );
}

export default function Detail() {
  const { destinationId } = useParams();
  const { d, t, locale } = useI18n();
  const flow = useFlow();
  const navigate = useNavigate();
  const search = flow.state.search;
  const offer = search && isDestinationId(destinationId) ? search.offers.find((o) => o.destinationId === destinationId) : undefined;

  useEffect(() => {
    if (offer) flow.openOffer(offer.destinationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer?.destinationId, search?.revision]);

  if (!search) return <MissingSearch />;
  if (!offer) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-12">
        <Notice>{d.detail.notFound}</Notice>
        <LinkButton to="/offers" className="mt-5">{d.detail.backToOffers}</LinkButton>
      </div>
    );
  }

  const city = cityName(offer.destinationId, locale);
  const dest = d.hotel.destinations[offer.destinationId];
  const intl = INTL_LOCALE[locale];
  const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };

  function tryPurchase() {
    flow.chooseOffer(offer!.destinationId);
    navigate('/checkout');
  }
  function feedbackOnly() {
    flow.startFeedback('detail');
    navigate('/feedback/1');
  }

  const handleIcons = [SearchIcon, Handshake, FileCheck2];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:pt-10">
      <Link to="/offers" className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-full pr-3 text-[0.95rem] font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />{d.detail.backToOffers}
      </Link>

      <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr]">
        <figure className="overflow-hidden rounded-[var(--radius-card)] border border-line/70">
          <div className="aspect-[16/10]"><DestinationArt id={offer.destinationId} label={city} /></div>
        </figure>
        <figure className="hidden overflow-hidden rounded-[var(--radius-card)] border border-line/70 sm:block">
          <div className="h-full"><DestinationArt id={offer.destinationId} kind="room" label={`${hotelName(offer.destinationId, d)} — ${d.hotel.room}`} /></div>
        </figure>
      </div>
      <p className="mt-2 text-xs text-muted">{d.hotel.illustrative}</p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="grid gap-8">
          <header>
            <h1 tabIndex={-1} data-page-heading className="text-[2.2rem] leading-tight font-medium outline-none sm:text-[2.8rem]">{city}</h1>
            <p className="mt-1 text-lg text-ink-soft">{hotelName(offer.destinationId, d)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill><MapPin className="size-3.5" aria-hidden />{dest.area}</Pill>
              <Pill><BedDouble className="size-3.5" aria-hidden />{d.common.stayConfig}</Pill>
              <Pill><StayDates offer={offer} /></Pill>
            </div>
            <p className="mt-4 max-w-2xl text-[1.04rem] leading-relaxed text-ink-soft">{dest.long}</p>
          </header>

          <section aria-labelledby="why">
            <div className="rounded-[var(--radius-card)] bg-ink p-5 text-white sm:p-6">
              <h2 id="why" className="text-xl font-medium">{d.detail.whyTitle}</h2>
              <p className="mt-2 leading-relaxed text-white/90">{d.detail.whyText}</p>
            </div>
          </section>

          <section aria-labelledby="stay">
            <SectionTitle id="stay">{d.detail.stayTitle}</SectionTitle>
            <Card className="grid gap-5 p-5 sm:p-6">
              <ul className="grid gap-1.5 text-[0.97rem]">
                <li>{t(d.detail.area, { area: dest.area })}</li>
                <li className="font-medium">{t(d.detail.checkIn, { date: formatCivil(offer.checkIn, intl, dateOpts) })}</li>
                <li className="font-medium">{t(d.detail.checkOut, { date: formatCivil(offer.checkOut, intl, dateOpts) })}</li>
                <li className="text-sm text-muted">{d.detail.localTime}</li>
              </ul>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft">{d.detail.includedTitle}</h3>
                  <ul className="grid gap-1.5">{d.detail.included.map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-petrol" aria-hidden />{x}</li>)}</ul>
                </div>
                <div>
                  <h3 className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft">{d.detail.excludedTitle}</h3>
                  <ul className="grid gap-1.5">{d.detail.excluded.map((x) => <li key={x} className="flex gap-2"><CircleSlash className="mt-0.5 size-4 shrink-0 text-terracotta-text" aria-hidden />{x}</li>)}</ul>
                </div>
              </div>
            </Card>
          </section>

          <section aria-labelledby="conditions">
            <SectionTitle id="conditions">{d.detail.conditionsTitle}</SectionTitle>
            <Card className="p-5 sm:p-6">
              <ul className="grid gap-2">{d.detail.conditions.map((c) => <li key={c} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink" aria-hidden />{c}</li>)}</ul>
              <p className="mt-3 text-sm text-muted">{d.detail.conditionsNote}</p>
            </Card>
          </section>

          <section aria-labelledby="transport">
            <SectionTitle id="transport">{d.detail.transportTitle}</SectionTitle>
            <Card className="grid gap-4 p-5 sm:p-6">
              <p className="text-[0.95rem] leading-relaxed text-ink-soft">{d.detail.transportNote}</p>
              <TransportDetails originId={search.originId} destinationId={offer.destinationId} totalCents={offer.transportTotalCents} mainCents={offer.transportMainCents} />
            </Card>
          </section>

          <section aria-labelledby="handle">
            <SectionTitle id="handle">{d.detail.handleTitle}</SectionTitle>
            <p className="mb-4 text-ink-soft">{d.detail.handleIntro}</p>
            <ol className="grid gap-3 sm:grid-cols-3">
              {d.detail.handleSteps.map((s, i) => {
                const Icon = handleIcons[i];
                return (
                  <li key={s.title} className="rounded-2xl border border-line/80 bg-white p-4">
                    <Icon className="size-5 text-petrol" aria-hidden />
                    <p className="mt-2 font-semibold">{i + 1}. {s.title}</p>
                    <p className="mt-1 text-[0.93rem] leading-relaxed text-muted">{s.text}</p>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 flex items-start gap-2 text-sm text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />{d.detail.handleNote}</p>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start" aria-label={d.detail.summaryTitle}>
          <Card className="grid gap-4 p-5 sm:p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{d.detail.pricesTitle}</p>
            <PriceBlock offer={offer} size="lg" />
            <dl className="grid gap-1.5 border-t border-line/70 pt-4 text-[0.95rem]">
              <div className="flex justify-between gap-3"><dt className="text-ink-soft">{d.summary.stay}</dt><dd className="font-semibold tabular">{formatEur(offer.hotelSaleCents, locale)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-soft">{d.results.transportEst}</dt><dd className="font-semibold tabular">{formatEur(offer.transportTotalCents, locale)}</dd></div>
              <div className="mt-1 flex justify-between gap-3 rounded-xl bg-sand/70 px-3 py-2"><dt className="font-medium">{d.results.total}</dt><dd className="text-lg font-semibold tabular">{formatEur(offer.tripTotalCents, locale)}</dd></div>
              <div className="text-right text-sm text-muted tabular">{t(d.common.perPerson, { amount: formatEur(Math.round(offer.tripTotalCents / 2), locale) })}</div>
            </dl>
            <Button onClick={tryPurchase} className="w-full">{d.detail.cta}</Button>
            <LinkButton to="/offers" variant="secondary" className="w-full">{d.detail.compare}</LinkButton>
            <button type="button" onClick={feedbackOnly} className="min-h-11 text-[0.93rem] font-medium text-ink-soft underline decoration-line underline-offset-4 hover:decoration-ink">
              {d.detail.feedbackLink}
            </button>
          </Card>
        </aside>
      </div>
    </div>
  );
}
