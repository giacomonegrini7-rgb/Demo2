// Dati di scenario del prototipo: NON sono quotazioni di mercato né itinerari verificati.
// Unica fonte per frontend, generatore SQL e test. Importi in centesimi interi (EUR).

export const LOCALES = ['it', 'en', 'es', 'sv'] as const;
export type Locale = (typeof LOCALES)[number];
export type Localized = Record<Locale, string>;

export const CATALOG_VERSION = 'catalog-2026-10-v1';
export const ADULTS = 2;
export const NIGHTS = 2;

export const BASE_DESTINATIONS = ['vienna', 'budapest', 'verona', 'valencia'] as const;
export const DESTINATION_IDS = ['vienna', 'budapest', 'verona', 'valencia', 'lisbon'] as const;
export type DestinationId = (typeof DESTINATION_IDS)[number];

export const COUNTRY_IDS = ['IT', 'ES', 'SE'] as const;
export type CountryId = (typeof COUNTRY_IDS)[number];

export const ORIGIN_IDS = [
  'milan', 'bologna', 'rome', 'venice',
  'madrid', 'barcelona', 'valencia',
  'stockholm', 'gothenburg', 'malmo',
] as const;
export type OriginId = (typeof ORIGIN_IDS)[number];

export const COUNTRIES: Record<CountryId, { name: Localized; origins: OriginId[] }> = {
  IT: { name: { it: 'Italia', en: 'Italy', es: 'Italia', sv: 'Italien' }, origins: ['milan', 'bologna', 'rome', 'venice'] },
  ES: { name: { it: 'Spagna', en: 'Spain', es: 'España', sv: 'Spanien' }, origins: ['madrid', 'barcelona', 'valencia'] },
  SE: { name: { it: 'Svezia', en: 'Sweden', es: 'Suecia', sv: 'Sverige' }, origins: ['stockholm', 'gothenburg', 'malmo'] },
};

export const ORIGINS: Record<OriginId, { country: CountryId; name: Localized }> = {
  milan: { country: 'IT', name: { it: 'Milano', en: 'Milan', es: 'Milán', sv: 'Milano' } },
  bologna: { country: 'IT', name: { it: 'Bologna', en: 'Bologna', es: 'Bolonia', sv: 'Bologna' } },
  rome: { country: 'IT', name: { it: 'Roma', en: 'Rome', es: 'Roma', sv: 'Rom' } },
  venice: { country: 'IT', name: { it: 'Venezia', en: 'Venice', es: 'Venecia', sv: 'Venedig' } },
  madrid: { country: 'ES', name: { it: 'Madrid', en: 'Madrid', es: 'Madrid', sv: 'Madrid' } },
  barcelona: { country: 'ES', name: { it: 'Barcellona', en: 'Barcelona', es: 'Barcelona', sv: 'Barcelona' } },
  valencia: { country: 'ES', name: { it: 'Valencia', en: 'Valencia', es: 'Valencia', sv: 'Valencia' } },
  stockholm: { country: 'SE', name: { it: 'Stoccolma', en: 'Stockholm', es: 'Estocolmo', sv: 'Stockholm' } },
  gothenburg: { country: 'SE', name: { it: 'Göteborg', en: 'Gothenburg', es: 'Gotemburgo', sv: 'Göteborg' } },
  malmo: { country: 'SE', name: { it: 'Malmö', en: 'Malmö', es: 'Malmö', sv: 'Malmö' } },
};

export interface Hotel {
  id: DestinationId;
  city: Localized;
  /** Nome inventato dello scenario; il suffisso «soggiorno demo» è tradotto nei dizionari. */
  name: string;
  timeZone: string;
  originalCents: number;
  saleCents: number;
}

export const HOTELS: Record<DestinationId, Hotel> = {
  vienna: { id: 'vienna', city: { it: 'Vienna', en: 'Vienna', es: 'Viena', sv: 'Wien' }, name: 'Atelier Stadt', timeZone: 'Europe/Vienna', originalCents: 32000, saleCents: 19000 },
  budapest: { id: 'budapest', city: { it: 'Budapest', en: 'Budapest', es: 'Budapest', sv: 'Budapest' }, name: 'Duna Courtyard', timeZone: 'Europe/Budapest', originalCents: 24000, saleCents: 14000 },
  verona: { id: 'verona', city: { it: 'Verona', en: 'Verona', es: 'Verona', sv: 'Verona' }, name: 'Corte delle Arti', timeZone: 'Europe/Rome', originalCents: 26000, saleCents: 15000 },
  valencia: { id: 'valencia', city: { it: 'Valencia', en: 'Valencia', es: 'Valencia', sv: 'Valencia' }, name: 'Patio del Sol', timeZone: 'Europe/Madrid', originalCents: 30000, saleCents: 17500 },
  lisbon: { id: 'lisbon', city: { it: 'Lisbona', en: 'Lisbon', es: 'Lisboa', sv: 'Lissabon' }, name: 'Miradouro House', timeZone: 'Europe/Lisbon', originalCents: 34000, saleCents: 20000 },
};

export const AIRPORT_CODES = ['MXP', 'BLQ', 'FCO', 'VCE', 'TSF', 'MAD', 'BCN', 'VLC', 'ARN', 'GOT', 'CPH', 'VIE', 'BUD', 'VRN', 'LIS', 'MUC'] as const;
export type AirportCode = (typeof AIRPORT_CODES)[number];

export const AIRPORTS: Record<AirportCode, Localized> = {
  MXP: { it: 'Milano Malpensa', en: 'Milan Malpensa', es: 'Milán-Malpensa', sv: 'Milano Malpensa' },
  BLQ: { it: 'Bologna Marconi', en: 'Bologna Marconi', es: 'Bolonia Marconi', sv: 'Bologna Marconi' },
  FCO: { it: 'Roma Fiumicino', en: 'Rome Fiumicino', es: 'Roma-Fiumicino', sv: 'Rom Fiumicino' },
  VCE: { it: 'Venezia Marco Polo', en: 'Venice Marco Polo', es: 'Venecia Marco Polo', sv: 'Venedig Marco Polo' },
  TSF: { it: 'Treviso', en: 'Treviso', es: 'Treviso', sv: 'Treviso' },
  MAD: { it: 'Madrid Barajas', en: 'Madrid Barajas', es: 'Madrid-Barajas', sv: 'Madrid Barajas' },
  BCN: { it: 'Barcellona El Prat', en: 'Barcelona El Prat', es: 'Barcelona-El Prat', sv: 'Barcelona El Prat' },
  VLC: { it: 'Valencia', en: 'Valencia', es: 'Valencia', sv: 'Valencia' },
  ARN: { it: 'Stoccolma Arlanda', en: 'Stockholm Arlanda', es: 'Estocolmo-Arlanda', sv: 'Stockholm Arlanda' },
  GOT: { it: 'Göteborg Landvetter', en: 'Gothenburg Landvetter', es: 'Gotemburgo-Landvetter', sv: 'Göteborg Landvetter' },
  CPH: { it: 'Copenaghen', en: 'Copenhagen', es: 'Copenhague', sv: 'Köpenhamn' },
  VIE: { it: 'Vienna', en: 'Vienna', es: 'Viena', sv: 'Wien' },
  BUD: { it: 'Budapest', en: 'Budapest', es: 'Budapest', sv: 'Budapest' },
  VRN: { it: 'Verona Villafranca', en: 'Verona Villafranca', es: 'Verona-Villafranca', sv: 'Verona Villafranca' },
  LIS: { it: 'Lisbona', en: 'Lisbon', es: 'Lisboa', sv: 'Lissabon' },
  MUC: { it: 'Monaco di Baviera', en: 'Munich', es: 'Múnich', sv: 'München' },
};

/** Nomi propri di stazione: restano invariati in tutte le lingue. */
export type Place = { kind: 'airport'; code: AirportCode } | { kind: 'station'; name: string };

export interface Leg {
  /** train = treno; flight = volo (eventuale scalo in via); airport_link = collegamento verso l'aeroporto di partenza */
  mode: 'train' | 'flight' | 'airport_link';
  from: Place;
  to: Place;
  via?: AirportCode;
}

export type TransferKind = 'departure_airport_link' | 'arrival_airport_city';

export interface Route {
  originId: OriginId;
  destinationId: DestinationId;
  legs: Leg[];
  /** P: mezzo principale A/R per due adulti */
  mainCents: number;
  /** X: trasferimenti aggiuntivi A/R per due adulti, conteggiati una sola volta */
  transfersCents: number;
  transferParts: { kind: TransferKind; cents: number }[];
  /** durata orientativa di sola andata [min, max] in minuti */
  durationMinutes: [number, number];
}

const ap = (code: AirportCode): Place => ({ kind: 'airport', code });
const st = (name: string): Place => ({ kind: 'station', name });

/** Quota X di arrivo (aeroporto → centro), A/R per due adulti. */
export const ARRIVAL_AIRPORT_CITY_CENTS: Record<DestinationId, number> = {
  vienna: 3200, budapest: 4000, verona: 3200, valencia: 2400, lisbon: 2400,
};
const ARRIVAL_AIRPORT: Record<DestinationId, AirportCode> = {
  vienna: 'VIE', budapest: 'BUD', verona: 'VRN', valencia: 'VLC', lisbon: 'LIS',
};
const MESTRE_TREVISO_CENTS = 5600;
const MALMO_CPH_CENTS = 8000;

function flight(originId: OriginId, destinationId: DestinationId, from: AirportCode, mainEur: number, dur: [number, number], via?: AirportCode, departureLink?: { from: Place; to: AirportCode; cents: number; mode?: Leg['mode'] }): Route {
  const legs: Leg[] = [];
  const parts: Route['transferParts'] = [];
  if (departureLink) {
    legs.push({ mode: departureLink.mode ?? 'airport_link', from: departureLink.from, to: ap(departureLink.to) });
    parts.push({ kind: 'departure_airport_link', cents: departureLink.cents });
  }
  legs.push({ mode: 'flight', from: ap(from), to: ap(ARRIVAL_AIRPORT[destinationId]), ...(via ? { via } : {}) });
  parts.push({ kind: 'arrival_airport_city', cents: ARRIVAL_AIRPORT_CITY_CENTS[destinationId] });
  return {
    originId, destinationId, legs,
    mainCents: mainEur * 100,
    transfersCents: parts.reduce((s, p) => s + p.cents, 0),
    transferParts: parts,
    durationMinutes: dur,
  };
}

function train(originId: OriginId, destinationId: DestinationId, from: string, to: string, mainEur: number, dur: [number, number]): Route {
  return { originId, destinationId, legs: [{ mode: 'train', from: st(from), to: st(to) }], mainCents: mainEur * 100, transfersCents: 0, transferParts: [], durationMinutes: dur };
}

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const malmoLink = { from: st('Malmö C'), to: 'CPH' as const, cents: MALMO_CPH_CENTS, mode: 'train' as const };

export const ROUTES: Route[] = [
  flight('milan', 'vienna', 'MXP', 240, [h(4), h(5)]),
  flight('milan', 'budapest', 'MXP', 220, [h(4), h(5)]),
  train('milan', 'verona', 'Milano Centrale', 'Verona Porta Nuova', 80, [h(1, 15), h(1, 50)]),
  flight('milan', 'valencia', 'MXP', 260, [h(4, 30), h(5, 30)]),

  flight('bologna', 'vienna', 'BLQ', 240, [h(4), h(5)]),
  flight('bologna', 'budapest', 'BLQ', 200, [h(4), h(5)]),
  train('bologna', 'verona', 'Bologna Centrale', 'Verona Porta Nuova', 60, [h(1), h(1, 45)]),
  flight('bologna', 'valencia', 'BLQ', 280, [h(4, 30), h(5, 30)]),

  flight('rome', 'vienna', 'FCO', 260, [h(4), h(5)]),
  flight('rome', 'budapest', 'FCO', 250, [h(4, 30), h(5, 30)]),
  train('rome', 'verona', 'Roma Termini', 'Verona Porta Nuova', 180, [h(3, 20), h(4)]),
  flight('rome', 'valencia', 'FCO', 300, [h(4, 30), h(5, 30)]),

  flight('venice', 'vienna', 'VCE', 220, [h(4), h(5)]),
  flight('venice', 'budapest', 'VCE', 380, [h(6), h(8)], 'MUC'),
  train('venice', 'verona', 'Venezia Santa Lucia', 'Verona Porta Nuova', 64, [h(1, 15), h(1, 50)]),
  flight('venice', 'valencia', 'TSF', 260, [h(5), h(6)], undefined, { from: st('Venezia Mestre'), to: 'TSF', cents: MESTRE_TREVISO_CENTS }),

  flight('madrid', 'vienna', 'MAD', 340, [h(5, 30), h(6, 30)]),
  flight('madrid', 'budapest', 'MAD', 360, [h(5, 30), h(6, 30)]),
  flight('madrid', 'verona', 'MAD', 440, [h(6, 30), h(8)], 'MUC'),
  train('madrid', 'valencia', 'Madrid Chamartín', 'València Joaquín Sorolla', 100, [h(2), h(2, 30)]),

  flight('barcelona', 'vienna', 'BCN', 300, [h(5), h(6)]),
  flight('barcelona', 'budapest', 'BCN', 320, [h(5), h(6)]),
  flight('barcelona', 'verona', 'BCN', 380, [h(6), h(8)], 'MUC'),
  train('barcelona', 'valencia', 'Barcelona Sants', 'València Joaquín Sorolla', 120, [h(3), h(3, 30)]),

  flight('valencia', 'vienna', 'VLC', 340, [h(5), h(6)]),
  flight('valencia', 'budapest', 'VLC', 420, [h(6, 30), h(8)], 'MUC'),
  flight('valencia', 'verona', 'VLC', 440, [h(6, 30), h(8)], 'MUC'),
  flight('valencia', 'lisbon', 'VLC', 240, [h(4), h(5)]),

  flight('stockholm', 'vienna', 'ARN', 380, [h(4, 30), h(5, 30)]),
  flight('stockholm', 'budapest', 'ARN', 400, [h(6), h(8)], 'VIE'),
  flight('stockholm', 'verona', 'ARN', 520, [h(6), h(8)], 'MUC'),
  flight('stockholm', 'valencia', 'ARN', 540, [h(7), h(9)], 'MUC'),

  flight('gothenburg', 'vienna', 'GOT', 420, [h(6), h(8)], 'MUC'),
  flight('gothenburg', 'budapest', 'GOT', 460, [h(6), h(8)], 'MUC'),
  flight('gothenburg', 'verona', 'GOT', 540, [h(6), h(8)], 'MUC'),
  flight('gothenburg', 'valencia', 'GOT', 560, [h(7), h(9)], 'MUC'),

  flight('malmo', 'vienna', 'CPH', 360, [h(5), h(6)], undefined, malmoLink),
  flight('malmo', 'budapest', 'CPH', 380, [h(5), h(6)], undefined, malmoLink),
  flight('malmo', 'verona', 'CPH', 500, [h(7), h(9)], 'MUC', malmoLink),
  flight('malmo', 'valencia', 'CPH', 480, [h(7), h(9)], 'MUC', malmoLink),
];

/** Le quattro destinazioni mostrate a una partenza: Lisbona sostituisce Valencia solo se si parte da Valencia. */
export function destinationsFor(originId: OriginId): DestinationId[] {
  return BASE_DESTINATIONS.map((d) => (d === 'valencia' && originId === 'valencia' ? 'lisbon' : d));
}

export function findRoute(originId: OriginId, destinationId: DestinationId): Route {
  const r = ROUTES.find((x) => x.originId === originId && x.destinationId === destinationId);
  if (!r) throw new Error(`Missing route ${originId}→${destinationId}`);
  return r;
}

export function isOriginId(v: unknown): v is OriginId {
  return typeof v === 'string' && (ORIGIN_IDS as readonly string[]).includes(v);
}
export function isDestinationId(v: unknown): v is DestinationId {
  return typeof v === 'string' && (DESTINATION_IDS as readonly string[]).includes(v);
}
export function isCountryId(v: unknown): v is CountryId {
  return typeof v === 'string' && (COUNTRY_IDS as readonly string[]).includes(v);
}

/** Tipo sintetico del trasporto principale, per le etichette delle schede. */
export function routeKind(route: Route): 'train' | 'flight' | 'flight_connection' {
  const f = route.legs.find((l) => l.mode === 'flight');
  if (!f) return 'train';
  return f.via ? 'flight_connection' : 'flight';
}

export function placeLabel(p: Place, locale: Locale): string {
  return p.kind === 'station' ? p.name : `${AIRPORTS[p.code][locale]} ${p.code}`;
}
