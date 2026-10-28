import { HOTELS, ORIGINS, findRoute, placeLabel, routeKind, AIRPORTS, type DestinationId, type Leg, type Locale, type OriginId, type Route } from '../data/catalog';
import type { Dict } from '../i18n/it';
import { interpolate } from '../lib/format';

export const cityName = (d: DestinationId, l: Locale) => HOTELS[d].city[l];
export const originName = (o: OriginId, l: Locale) => ORIGINS[o].name[l];
export const hotelName = (d: DestinationId, dict: Dict) => `${HOTELS[d].name} — ${dict.hotel.suffix}`;

export function routeFor(origin: OriginId, d: DestinationId): Route {
  return findRoute(origin, d);
}

export function startPlace(route: Route, l: Locale): string {
  return placeLabel(route.legs[0].from, l);
}

/** «Volo A/R da Milano Malpensa MXP» — sempre con il punto di partenza reale (aeroporto o stazione). */
export function transportSummary(route: Route, l: Locale, dict: Dict): string {
  const main = route.legs.find((x) => x.mode === 'flight') ?? route.legs[0];
  return interpolate(dict.results.transport[routeKind(route)], { place: placeLabel(main.from, l) });
}

export function legLabel(leg: Leg, l: Locale, dict: Dict): string {
  const from = placeLabel(leg.from, l);
  const to = placeLabel(leg.to, l);
  if (leg.mode === 'train') return interpolate(dict.detail.legs.train, { from, to });
  if (leg.mode === 'airport_link') return interpolate(dict.detail.legs.airport_link, { from, to });
  if (leg.via) return interpolate(dict.detail.legs.flightVia, { from, to, via: `${AIRPORTS[leg.via][l]} ${leg.via}` });
  return interpolate(dict.detail.legs.flight, { from, to });
}

export function connectionVia(route: Route, l: Locale): string | null {
  const v = route.legs.find((x) => x.via)?.via;
  return v ? `${AIRPORTS[v][l]} ${v}` : null;
}

export function hasCityLink(route: Route): boolean {
  return route.transferParts.some((p) => p.kind === 'arrival_airport_city');
}

/** Punto di partenza diverso da quello del mezzo principale (es. Malmö C → CPH, Venezia Mestre → TSF). */
export function separateStart(route: Route, l: Locale): string | null {
  const main = route.legs.find((x) => x.mode === 'flight') ?? route.legs[0];
  return main === route.legs[0] ? null : placeLabel(route.legs[0].from, l);
}
