import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, CalendarDays, MapPin, Pencil, Plane, TrainFront, Users, X } from 'lucide-react';
import { routeKind } from '../data/catalog';
import type { Offer, SearchSnapshot } from '../lib/pricing';
import { formatEur, INTL_LOCALE } from '../lib/format';
import { formatRange } from '../lib/dates';
import { DestinationArt } from '../components/Illustration';
import { PriceBlock } from '../components/Price';
import { Button, Expandable, LinkButton, Notice, PageHeading, Pill } from '../components/ui';
import { cityName, hotelName, originName, routeFor, separateStart, transportSummary } from '../components/offerText';
import { useI18n } from '../i18n';
import { useFlow } from '../state/flow';

export function MissingSearch() {
  const { d } = useI18n();
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12">
      <PageHeading>{d.results.title}</PageHeading>
      <Notice>{d.results.missingSearch}</Notice>
      <LinkButton to="/search" className="mt-5">{d.results.goPrefs}</LinkButton>
    </div>
  );
}

export function SearchSummary({ search }: { search: SearchSnapshot }) {
  const { d, t, locale } = useI18n();
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line/80 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[0.93rem] text-ink-soft">
        <li className="inline-flex items-center gap-1.5"><MapPin className="size-4 text-petrol" aria-hidden />{t(d.results.from, { origin: originName(search.originId, locale) })}</li>
        <li className="inline-flex items-center gap-1.5"><CalendarDays className="size-4 text-petrol" aria-hidden />{t(d.results.period, { range: formatRange(search.intervalStart, search.intervalEnd, INTL_LOCALE[locale]) })}</li>
        <li className="inline-flex items-center gap-1.5"><Users className="size-4 text-petrol" aria-hidden />{d.common.adultsNights}</li>
        {search.budgetCents != null && <li>{t(d.results.budget, { amount: formatEur(search.budgetCents, locale) })}</li>}
      </ul>
      <LinkButton to="/search" variant="secondary" className="shrink-0 !py-2" icon={<Pencil className="size-4" aria-hidden />}>{d.results.edit}</LinkButton>
    </div>
  );
}

export function StayDates({ offer }: { offer: Offer }) {
  const { locale } = useI18n();
  return <span className="tabular">{formatRange(offer.checkIn, offer.checkOut, INTL_LOCALE[locale])}</span>;
}

function OfferCard({ offer, search }: { offer: Offer; search: SearchSnapshot }) {
  const { d, t, locale } = useI18n();
  const route = routeFor(search.originId, offer.destinationId);
  const kind = routeKind(route);
  const city = cityName(offer.destinationId, locale);
  const TransportIcon = kind === 'train' ? TrainFront : Plane;
  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line/80 bg-white shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-lift)]" aria-labelledby={`offer-${offer.destinationId}`}>
      <div className="relative aspect-[16/9] sm:aspect-[16/8]">
        <DestinationArt id={offer.destinationId} label={city} />
        <span className="absolute bottom-2 left-2 rounded-full bg-ivory/90 px-2.5 py-1 text-[0.7rem] font-medium text-ink-soft">{d.hotel.illustrative}</span>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h2 id={`offer-${offer.destinationId}`} className="text-[1.6rem] leading-tight font-medium">{city}</h2>
          <p className="text-sm font-medium text-ink-soft">{hotelName(offer.destinationId, d)} · {d.hotel.destinations[offer.destinationId].area}</p>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{d.hotel.destinations[offer.destinationId].short}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Pill tone="neutral"><CalendarDays className="size-3.5" aria-hidden /><StayDates offer={offer} /></Pill>
          <Pill tone="neutral">{d.common.stayConfig}</Pill>
        </div>
        <PriceBlock offer={offer} />
        <div className="mt-auto grid gap-2 border-t border-line/70 pt-4 text-[0.93rem]">
          <p className="flex items-start gap-2 text-ink-soft">
            <TransportIcon className="mt-0.5 size-4 shrink-0 text-petrol" aria-hidden />
            <span>
              {transportSummary(route, locale, d)}
              {separateStart(route, locale) && <span className="block text-sm text-muted">{t(d.detail.startPoint, { place: separateStart(route, locale)! })}</span>}
            </span>
          </p>
          <p className="flex justify-between gap-3 text-ink-soft"><span>{d.results.transportEst}</span><span className="font-semibold text-ink tabular">{formatEur(offer.transportTotalCents, locale)}</span></p>
          <p className="flex justify-between gap-3 rounded-xl bg-sand/70 px-3 py-2"><span className="font-medium">{d.results.total}</span><span className="text-lg font-semibold text-ink tabular">{formatEur(offer.tripTotalCents, locale)}</span></p>
          {offer.withinBudget != null && (
            <p className={`text-sm font-semibold ${offer.withinBudget ? 'text-petrol-dark' : 'text-terracotta-text'}`}>
              {offer.withinBudget ? `✓ ${d.results.withinBudget}` : `↑ ${t(d.results.overBudget, { amount: formatEur(offer.tripTotalCents - (search.budgetCents ?? 0), locale) })}`}
            </p>
          )}
        </div>
        <LinkButton to={`/offers/${offer.destinationId}`} variant="secondary" className="w-full" aria-describedby={`offer-${offer.destinationId}`} icon={<ArrowRight className="size-4" aria-hidden />}>
          {d.results.details}
        </LinkButton>
      </div>
    </article>
  );
}

export default function Results() {
  const { d } = useI18n();
  const flow = useFlow();
  const { search, searchChanged } = flow.state;
  const navigate = useNavigate();
  const revision = search?.revision;

  useEffect(() => {
    if (revision) flow.track('offers_viewed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  if (!search) return <MissingSearch />;

  function noneFits() {
    flow.startFeedback('results', { noOffer: true });
    navigate('/feedback/1');
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:pt-12">
      <PageHeading>{d.results.title}</PageHeading>
      <div className="grid gap-3">
        <SearchSummary search={search} />
        <div aria-live="polite">
          {searchChanged && (
            <Notice tone="petrol" className="items-center">
              <div className="flex items-center justify-between gap-3">
                <span>{d.results.updated}</span>
                <button type="button" onClick={flow.dismissSearchChanged} className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-white" aria-label="OK"><X className="size-4" aria-hidden /></button>
              </div>
            </Notice>
          )}
        </div>
        <Expandable summary={d.results.simNote}>{d.results.simNoteMore}</Expandable>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {search.offers.map((o) => <OfferCard key={o.destinationId} offer={o} search={search} />)}
      </div>

      <section className="mt-10 flex flex-col items-start gap-2 rounded-[var(--radius-card)] border border-dashed border-line bg-white/50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[0.97rem] text-ink-soft">{d.results.noneFitsHelp}</p>
        <Button variant="secondary" onClick={noneFits}>{d.results.noneFits}</Button>
      </section>
    </div>
  );
}
