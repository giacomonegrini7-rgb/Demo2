import { CATALOG_VERSION, HOTELS, destinationsFor, findRoute, type DestinationId, type OriginId, ORIGINS, type CountryId } from '../data/catalog';
import { stayDates, type CivilDate } from './dates';

export interface Offer {
  destinationId: DestinationId;
  /** posizione visualizzata, 1–4 */
  position: number;
  checkIn: CivilDate;
  checkOut: CivilDate;
  hotelOriginalCents: number;
  hotelSaleCents: number;
  hotelSavingsCents: number;
  /** percentuale di risparmio ×10, arrotondata (423 = 42,3%) */
  hotelSavingsPercentX10: number;
  transportMainCents: number;
  transportTransfersCents: number;
  transportTotalCents: number;
  tripTotalCents: number;
  /** null se non è stato indicato un budget */
  withinBudget: boolean | null;
}

export interface SearchInput {
  originId: OriginId;
  intervalStart: CivilDate;
  intervalEnd: CivilDate;
  budgetCents: number | null;
}

export interface SearchSnapshot extends SearchInput {
  revision: number;
  originCountry: CountryId;
  checkIn: CivilDate;
  checkOut: CivilDate;
  adults: 2;
  nights: 2;
  catalogVersion: string;
  offers: Offer[];
}

export function savingsPercentX10(originalCents: number, saleCents: number): number {
  return Math.round(((originalCents - saleCents) * 1000) / originalCents);
}

export function buildOffers(input: SearchInput): Offer[] {
  const { checkIn, checkOut } = stayDates(input.intervalStart);
  return destinationsFor(input.originId).map((destinationId, i) => {
    const hotel = HOTELS[destinationId];
    const route = findRoute(input.originId, destinationId);
    const transportTotalCents = route.mainCents + route.transfersCents;
    const tripTotalCents = hotel.saleCents + transportTotalCents;
    return {
      destinationId,
      position: i + 1,
      checkIn,
      checkOut,
      hotelOriginalCents: hotel.originalCents,
      hotelSaleCents: hotel.saleCents,
      hotelSavingsCents: hotel.originalCents - hotel.saleCents,
      hotelSavingsPercentX10: savingsPercentX10(hotel.originalCents, hotel.saleCents),
      transportMainCents: route.mainCents,
      transportTransfersCents: route.transfersCents,
      transportTotalCents,
      tripTotalCents,
      withinBudget: input.budgetCents == null ? null : tripTotalCents <= input.budgetCents,
    };
  });
}

export function buildSnapshot(input: SearchInput, revision: number): SearchSnapshot {
  const { checkIn, checkOut } = stayDates(input.intervalStart);
  return {
    ...input,
    revision,
    originCountry: ORIGINS[input.originId].country,
    checkIn,
    checkOut,
    adults: 2,
    nights: 2,
    catalogVersion: CATALOG_VERSION,
    offers: buildOffers(input),
  };
}

/** Converte il budget digitato (es. "450", "450,50") in centesimi; null se vuoto, 'invalid' se non valido. */
export function parseBudget(raw: string): number | null | 'invalid' {
  const s = raw.trim().replace(/\s|€/g, '');
  if (!s) return null;
  if (!/^\d{1,6}([.,]\d{1,2})?$/.test(s)) return 'invalid';
  const cents = Math.round(parseFloat(s.replace(',', '.')) * 100);
  if (!(cents > 0) || cents > 10_000_000) return 'invalid';
  return cents;
}
