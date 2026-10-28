import { useId } from 'react';
import { formatCivil, weekdayIndex, windowDays, type CivilDate } from '../lib/dates';
import { INTL_LOCALE } from '../lib/format';
import { useI18n } from '../i18n';

/**
 * Selettore dell'intervallo nelle prossime due settimane: primo tocco = prima partenza possibile,
 * secondo tocco = ultimo rientro possibile. Pulsanti reali con stato annunciato.
 */
export function DateRange({ referenceDate, start, end, onChange, invalid, describedBy }: {
  referenceDate: CivilDate;
  start: CivilDate | null;
  end: CivilDate | null;
  onChange: (start: CivilDate | null, end: CivilDate | null) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const { d, t, locale } = useI18n();
  const intl = INTL_LOCALE[locale];
  const days = windowDays(referenceDate);
  const offset = weekdayIndex(days[0]);
  const hintId = useId();
  const weekdays = Array.from({ length: 7 }, (_, i) => formatCivil(addOffset('2026-01-05', i), intl, { weekday: 'short' }));

  function pick(day: CivilDate) {
    if (!start || (start && end)) return onChange(day, null);
    if (day <= start) return onChange(day, null);
    onChange(start, day);
  }

  const monthLabel = (() => {
    const first = formatCivil(days[0], intl, { month: 'long', year: 'numeric' });
    const last = formatCivil(days[days.length - 1], intl, { month: 'long', year: 'numeric' });
    return first === last ? first : `${first} – ${last}`;
  })();

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold capitalize text-ink-soft">{monthLabel}</p>
        <p id={hintId} className="text-sm text-muted" aria-live="polite">{!start || end ? d.prefs.pickStart : d.prefs.pickEnd}</p>
      </div>
      <div className={`rounded-2xl border bg-white p-2 sm:p-3 ${invalid ? 'border-danger' : 'border-line'}`} role="group" aria-label={d.prefs.datesLabel} aria-describedby={[hintId, describedBy].filter(Boolean).join(' ')}>
        <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[0.7rem] font-semibold uppercase tracking-wide text-muted" aria-hidden>
          {weekdays.map((w, i) => <span key={i}>{w.replace('.', '')}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: offset }, (_, i) => <span key={`e${i}`} />)}
          {days.map((day) => {
            const isStart = day === start;
            const isEnd = day === end;
            const inRange = Boolean(start && end && day > start && day < end);
            const label = formatCivil(day, intl, { weekday: 'long', day: 'numeric', month: 'long' });
            const role = isStart ? `, ${d.prefs.dayStart}` : isEnd ? `, ${d.prefs.dayEnd}` : '';
            return (
              <button
                key={day}
                type="button"
                onClick={() => pick(day)}
                aria-pressed={isStart || isEnd || inRange}
                aria-label={label + role}
                className={`flex min-h-11 flex-col items-center justify-center rounded-xl text-[0.95rem] font-semibold transition-colors tabular ${
                  isStart || isEnd
                    ? 'bg-petrol text-white'
                    : inRange
                      ? 'bg-petrol-tint text-petrol-dark'
                      : 'text-ink hover:bg-sand'
                }`}
              >
                {Number(day.slice(8))}
                {(isStart || isEnd) && <span className="text-[0.6rem] leading-none font-medium opacity-90">{isStart ? d.prefs.dayStart : d.prefs.dayEnd}</span>}
              </button>
            );
          })}
        </div>
      </div>
      {start && end && (
        <p className="mt-2 text-sm font-medium text-ink-soft">
          {t(d.prefs.rangeSummary, { start: formatCivil(start, intl, { weekday: 'short', day: 'numeric', month: 'short' }), end: formatCivil(end, intl, { weekday: 'short', day: 'numeric', month: 'short' }) })}
        </p>
      )}
    </div>
  );
}

function addOffset(monday: CivilDate, i: number): CivilDate {
  const day = Number(monday.slice(8)) + i;
  return `${monday.slice(0, 8)}${String(day).padStart(2, '0')}`;
}
