import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ArrowRight, BedDouble, CalendarRange, MapPin, Wallet } from 'lucide-react';
import { COUNTRIES, COUNTRY_IDS, ORIGINS, type CountryId, type OriginId } from '../data/catalog';
import { windowBounds } from '../lib/dates';
import { Button, ErrorBox, PageHeading } from '../components/ui';
import { DateRange } from '../components/DateRange';
import { useI18n } from '../i18n';
import { useFlow, type SearchValidation } from '../state/flow';

const selectClass = 'min-h-12 w-full appearance-none rounded-xl border bg-white px-4 py-3 text-[1rem] text-ink disabled:bg-sand/50 disabled:text-muted';

export default function Preferences() {
  const { d, locale } = useI18n();
  const flow = useFlow();
  const { prefs, referenceDate, sessionId } = flow.state;
  const navigate = useNavigate();
  const [errors, setErrors] = useState<SearchValidation>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  if (!sessionId) return <Navigate to="/" replace />;
  const bounds = windowBounds(referenceDate);
  const live = (v: SearchValidation) => (submitted ? setErrors(v) : undefined);

  function setCountry(c: CountryId | '') {
    const keepCity = c && prefs.originId && ORIGINS[prefs.originId as OriginId].country === c;
    flow.updatePrefs({ country: c, originId: keepCity ? prefs.originId : '' });
    live(flow.validateSearch());
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const v = flow.validateSearch();
    setErrors(v);
    if (Object.keys(v).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setBusy(true);
    setSaveError(false);
    try {
      await flow.submitSearch();
      navigate('/offers');
    } catch {
      setSaveError(true);
    } finally {
      setBusy(false);
    }
  }

  const errorList = [
    errors.country && d.prefs.errors.country,
    errors.city && d.prefs.errors.city,
    errors.interval && d.prefs.errors[errors.interval],
    errors.budget && d.prefs.errors.budget,
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:pt-12">
      <PageHeading lead={d.prefs.intro}>{d.prefs.title}</PageHeading>

      <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm text-ink-soft">
        <BedDouble className="size-4 text-petrol" aria-hidden />
        <span className="font-semibold text-ink">{d.prefs.fixedLabel}:</span> {d.prefs.fixedValue}
      </p>

      <form onSubmit={onSubmit} noValidate className="grid gap-6">
        {errorList.length > 0 && (
          <div ref={summaryRef} tabIndex={-1} className="outline-none">
            <ErrorBox>
              <ul className="list-disc pl-4">{errorList.map((m) => <li key={m}>{m}</li>)}</ul>
            </ErrorBox>
          </div>
        )}

        <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line/80 bg-white p-5 sm:p-6">
          <legend className="sr-only">{d.prefs.cityLabel}</legend>
          <p className="flex items-center gap-2 font-serif text-xl text-ink" aria-hidden><MapPin className="size-5 text-petrol" />{d.prefs.cityLabel}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="country" className="mb-1.5 block text-sm font-semibold text-ink">{d.prefs.countryLabel}</label>
              <select id="country" value={prefs.country} onChange={(e) => setCountry(e.target.value as CountryId | '')}
                aria-invalid={errors.country || undefined} aria-describedby={errors.country ? 'country-err' : undefined}
                className={`${selectClass} ${errors.country ? 'border-danger' : 'border-line'}`}>
                <option value="">{d.prefs.countryPlaceholder}</option>
                {COUNTRY_IDS.map((c) => <option key={c} value={c}>{COUNTRIES[c].name[locale]}</option>)}
              </select>
              {errors.country && <p id="country-err" className="mt-1 text-sm text-danger">{d.prefs.errors.country}</p>}
            </div>
            <div>
              <label htmlFor="city" className="mb-1.5 block text-sm font-semibold text-ink">{d.prefs.cityLabel}</label>
              <select id="city" value={prefs.originId} disabled={!prefs.country}
                onChange={(e) => { flow.updatePrefs({ originId: e.target.value as OriginId | '' }); live(flow.validateSearch()); }}
                aria-invalid={errors.city || undefined} aria-describedby={`city-help${errors.city ? ' city-err' : ''}`}
                className={`${selectClass} ${errors.city ? 'border-danger' : 'border-line'}`}>
                <option value="">{prefs.country ? d.prefs.cityPlaceholder : d.prefs.cityPlaceholderDisabled}</option>
                {prefs.country && COUNTRIES[prefs.country].origins.map((o) => <option key={o} value={o}>{ORIGINS[o].name[locale]}</option>)}
              </select>
              {errors.city && <p id="city-err" className="mt-1 text-sm text-danger">{d.prefs.errors.city}</p>}
            </div>
          </div>
          <div id="city-help" className="text-sm leading-relaxed text-muted">
            <p>{d.prefs.cityHelp}</p>
            <p>{d.prefs.cityHelpHome}</p>
          </div>
        </fieldset>

        <fieldset className="grid gap-4 rounded-[var(--radius-card)] border border-line/80 bg-white p-5 sm:p-6">
          <legend className="sr-only">{d.prefs.datesLabel}</legend>
          <div>
            <p className="flex items-center gap-2 font-serif text-xl text-ink" aria-hidden><CalendarRange className="size-5 text-petrol" />{d.prefs.datesLabel}</p>
            <p id="dates-help" className="mt-1 text-sm leading-relaxed text-muted">{d.prefs.datesHelp}</p>
          </div>
          <button type="button" aria-pressed={prefs.flexible}
            onClick={() => { flow.updatePrefs(prefs.flexible ? { flexible: false, start: null, end: null } : { flexible: true, start: bounds.min, end: bounds.max }); live(flow.validateSearch()); }}
            className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left font-semibold transition-colors ${prefs.flexible ? 'border-petrol bg-petrol-tint text-petrol-dark' : 'border-line bg-white text-ink hover:border-ink/40'}`}>
            {d.prefs.flexible}
            <span aria-hidden className={`flex size-5 items-center justify-center rounded-full border-2 ${prefs.flexible ? 'border-petrol bg-petrol' : 'border-line'}`}>
              {prefs.flexible && <span className="size-2 rounded-full bg-white" />}
            </span>
          </button>
          <DateRange
            referenceDate={referenceDate}
            start={prefs.start}
            end={prefs.end}
            invalid={Boolean(errors.interval)}
            describedBy={errors.interval ? 'dates-err' : 'dates-help'}
            onChange={(start, end) => { flow.updatePrefs({ start, end, flexible: start === bounds.min && end === bounds.max }); live(flow.validateSearch()); }}
          />
          {errors.interval && <p id="dates-err" className="text-sm text-danger" role="alert">{d.prefs.errors[errors.interval]}</p>}
          {(prefs.start || prefs.end) && (
            <div><Button type="button" variant="quiet" onClick={() => flow.updatePrefs({ start: null, end: null, flexible: false })}>{d.prefs.clearDates}</Button></div>
          )}
        </fieldset>

        <fieldset className="grid gap-2 rounded-[var(--radius-card)] border border-line/80 bg-white p-5 sm:p-6">
          <legend className="sr-only">{d.prefs.budgetLabel}</legend>
          <label htmlFor="budget" className="flex items-center gap-2 font-serif text-xl text-ink"><Wallet className="size-5 text-petrol" aria-hidden />{d.prefs.budgetLabel}</label>
          <p id="budget-help" className="text-sm text-muted">{d.prefs.budgetHelp}</p>
          <div className="relative max-w-56">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-semibold text-muted" aria-hidden>€</span>
            <input id="budget" inputMode="decimal" autoComplete="off" value={prefs.budget}
              onChange={(e) => { flow.updatePrefs({ budget: e.target.value.slice(0, 10) }); live(flow.validateSearch()); }}
              aria-invalid={errors.budget || undefined} aria-describedby={`budget-help${errors.budget ? ' budget-err' : ''}`}
              className={`min-h-12 w-full rounded-xl border bg-white py-3 pr-4 pl-9 text-[1rem] tabular ${errors.budget ? 'border-danger' : 'border-line'}`} />
          </div>
          {errors.budget && <p id="budget-err" className="text-sm text-danger">{d.prefs.errors.budget}</p>}
        </fieldset>

        <div aria-live="polite">{saveError && <ErrorBox action={<Button type="submit" variant="secondary">{d.common.retry}</Button>}>{d.errors.searchFailed}</ErrorBox>}</div>
        <div>
          <Button type="submit" loading={busy} className="w-full sm:w-auto sm:min-w-72" icon={!busy ? <ArrowRight className="size-4" aria-hidden /> : undefined}>
            {busy ? d.prefs.updating : d.prefs.cta}
          </Button>
        </div>
      </form>
    </div>
  );
}
