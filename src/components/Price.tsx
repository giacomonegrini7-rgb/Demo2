import { BadgePercent } from 'lucide-react';
import type { Offer } from '../lib/pricing';
import { formatEur, formatPercentX10 } from '../lib/format';
import { useI18n } from '../i18n';

/** Prezzo originale barrato (con etichetta esplicita) e prezzo di vendita in evidenza. */
export function PriceBlock({ offer, size = 'md' }: { offer: Offer; size?: 'md' | 'lg' }) {
  const { d, t, locale } = useI18n();
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className={`${size === 'lg' ? 'text-[2.4rem]' : 'text-[2rem]'} leading-none font-semibold tracking-tight text-ink tabular`}>
          <span className="sr-only">{d.results.salePrice}: </span>
          {formatEur(offer.hotelSaleCents, locale)}
        </p>
        <p className="text-base text-muted tabular">
          <span className="sr-only">{d.results.originalPaid}: </span>
          <s>{formatEur(offer.hotelOriginalCents, locale)}</s>
        </p>
      </div>
      <p className="mt-1.5 text-xs leading-snug text-muted" aria-hidden>
        <s className="tabular">{formatEur(offer.hotelOriginalCents, locale)}</s> = {d.results.originalPaid}
      </p>
      <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-petrol-tint px-2.5 py-1 text-sm font-semibold text-petrol-dark">
        <BadgePercent className="size-4" aria-hidden />
        {t(d.results.savings, { amount: formatEur(offer.hotelSavingsCents, locale), percent: formatPercentX10(offer.hotelSavingsPercentX10, locale) })}
      </p>
    </div>
  );
}
