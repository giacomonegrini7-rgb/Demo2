import { describe, expect, it } from 'vitest';
import { AIRPORTS, DESTINATION_IDS, HOTELS, LOCALES, ORIGINS, ORIGIN_IDS, ROUTES, destinationsFor, findRoute, ARRIVAL_AIRPORT_CITY_CENTS } from '../../src/data/catalog';
import { buildOffers, buildSnapshot, parseBudget } from '../../src/lib/pricing';
import { addDays, diffDays, stayDates, validateInterval, windowBounds, windowDays, localToday } from '../../src/lib/dates';
import { formatDuration, formatPercentX10, formatEur } from '../../src/lib/format';

const input = (originId: (typeof ORIGIN_IDS)[number], budgetCents: number | null = null) => ({ originId, intervalStart: '2026-10-30', intervalEnd: '2026-11-04', budgetCents });

describe('catalogo', () => {
  it('5 alloggi, 10 origini, 40 coppie uniche, 4 per origine', () => {
    expect(Object.keys(HOTELS)).toHaveLength(5);
    expect(ORIGIN_IDS).toHaveLength(10);
    expect(ROUTES).toHaveLength(40);
    const keys = new Set(ROUTES.map((r) => `${r.originId}-${r.destinationId}`));
    expect(keys.size).toBe(40);
    for (const o of ORIGIN_IDS) expect(ROUTES.filter((r) => r.originId === o)).toHaveLength(4);
  });

  it('solo Valencia vede Lisbona e non Valencia', () => {
    for (const o of ORIGIN_IDS) {
      const d = destinationsFor(o);
      expect(new Set(d).size).toBe(4);
      if (o === 'valencia') expect(d).toEqual(['vienna', 'budapest', 'verona', 'lisbon']);
      else expect(d).toEqual(['vienna', 'budapest', 'verona', 'valencia']);
      for (const dest of d) expect(() => findRoute(o, dest)).not.toThrow();
    }
  });

  it('ogni rotta ha percorso, durata, P/X coerenti ed etichette in 4 lingue', () => {
    for (const r of ROUTES) {
      expect(r.legs.length).toBeGreaterThan(0);
      expect(r.durationMinutes[0]).toBeLessThan(r.durationMinutes[1]);
      expect(r.mainCents).toBeGreaterThan(0);
      expect(r.transferParts.reduce((s, p) => s + p.cents, 0)).toBe(r.transfersCents);
      for (const l of [ORIGINS[r.originId].name, HOTELS[r.destinationId].city]) for (const loc of LOCALES) expect(l[loc]).toBeTruthy();
      for (const leg of r.legs) for (const p of [leg.from, leg.to]) if (p.kind === 'airport') for (const loc of LOCALES) expect(AIRPORTS[p.code][loc]).toBeTruthy();
      const hasTrainOnly = r.legs.every((l) => l.mode === 'train');
      if (hasTrainOnly) expect(r.transfersCents).toBe(0);
    }
  });

  it('scomposizione X: Venezia→Valencia 56+24, Malmö 80 + quota di arrivo', () => {
    expect(findRoute('venice', 'valencia').transfersCents).toBe(5600 + 2400);
    for (const d of ['vienna', 'budapest', 'verona', 'valencia'] as const) {
      expect(findRoute('malmo', d).transfersCents).toBe(8000 + ARRIVAL_AIRPORT_CITY_CENTS[d]);
    }
    expect(findRoute('malmo', 'vienna').transfersCents).toBe(11200);
  });

  it('prezzi hotel identici per ogni partenza e indipendenti dal budget', () => {
    for (const dest of DESTINATION_IDS) {
      const prices = new Set<string>();
      for (const o of ORIGIN_IDS) for (const b of [null, 100, 999999]) {
        const off = buildOffers(input(o, b)).find((x) => x.destinationId === dest);
        if (off) prices.add(`${off.hotelOriginalCents}/${off.hotelSaleCents}`);
      }
      expect(prices.size).toBe(1);
    }
  });
});

describe('calcoli', () => {
  const get = (o: (typeof ORIGIN_IDS)[number], d: string) => buildOffers(input(o)).find((x) => x.destinationId === d)!;
  it('Venezia–Verona: 214 € totale, 110 € risparmio, 42,3%', () => {
    const o = get('venice', 'verona');
    expect(o.tripTotalCents).toBe(21400);
    expect(o.hotelSavingsCents).toBe(11000);
    expect(formatPercentX10(o.hotelSavingsPercentX10, 'it')).toBe('42,3');
  });
  it('Malmö–Vienna 190+360+112 = 662 €', () => {
    expect(get('malmo', 'vienna').tripTotalCents).toBe(66200);
  });
  it('Valencia–Lisbona 200+240+24 = 464 €', () => {
    expect(get('valencia', 'lisbon').tripTotalCents).toBe(46400);
  });
  it('nessun doppio conteggio X e nessuna moltiplicazione per due', () => {
    for (const r of ROUTES) {
      const o = get(r.originId, r.destinationId);
      expect(o.transportTotalCents).toBe(r.mainCents + r.transfersCents);
      expect(o.tripTotalCents).toBe(HOTELS[r.destinationId].saleCents + r.mainCents + r.transfersCents);
    }
  });
  it('percentuali coerenti con i prezzi', () => {
    for (const h of Object.values(HOTELS)) {
      const o = buildOffers(input(h.id === 'lisbon' ? 'valencia' : 'milan')).find((x) => x.destinationId === h.id)!;
      expect(Math.abs(o.hotelSavingsPercentX10 / 10 - ((h.originalCents - h.saleCents) / h.originalCents) * 100)).toBeLessThan(0.06);
    }
  });
  it('budget segnala dentro/fuori senza togliere offerte', () => {
    const offers = buildOffers(input('venice', 30000));
    expect(offers).toHaveLength(4);
    expect(offers.find((o) => o.destinationId === 'verona')!.withinBudget).toBe(true);
    expect(offers.find((o) => o.destinationId === 'budapest')!.withinBudget).toBe(false);
  });
  it('parseBudget', () => {
    expect(parseBudget('')).toBeNull();
    expect(parseBudget('450')).toBe(45000);
    expect(parseBudget('450,5')).toBe(45050);
    expect(parseBudget('-3')).toBe('invalid');
    expect(parseBudget('0')).toBe('invalid');
    expect(parseBudget('abc')).toBe('invalid');
  });
  it('snapshot coerente', () => {
    const s = buildSnapshot(input('valencia'), 3);
    expect(s.revision).toBe(3);
    expect(s.originCountry).toBe('ES');
    expect(s.offers.map((o) => o.position)).toEqual([1, 2, 3, 4]);
  });
});

describe('date', () => {
  it('somma giorni attraverso cambio mese/anno e ora legale', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26'); // fine ora legale UE 25/10
    expect(addDays('2027-03-27', 2)).toBe('2027-03-29'); // inizio ora legale 28/03
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
  });
  it('finestra di due settimane e validazione intervallo', () => {
    const ref = '2026-10-28';
    expect(windowBounds(ref)).toEqual({ min: '2026-10-29', max: '2026-11-11' });
    expect(windowDays(ref)).toHaveLength(14);
    expect(validateInterval(ref, '2026-10-29', '2026-11-11')).toBeNull();
    expect(validateInterval(ref, '2026-10-29', '2026-10-31')).toBeNull();
    expect(validateInterval(ref, '2026-10-29', '2026-10-30')).toBe('too_short');
    expect(validateInterval(ref, '2026-10-28', '2026-10-31')).toBe('too_early');
    expect(validateInterval(ref, '2026-11-05', '2026-11-12')).toBe('too_late');
    expect(validateInterval(ref, '2026-11-05', '2026-11-01')).toBe('order');
    expect(validateInterval(ref, null, '2026-11-01')).toBe('missing');
  });
  it('check-in = inizio, check-out = +2', () => {
    expect(stayDates('2026-12-31')).toEqual({ checkIn: '2026-12-31', checkOut: '2027-01-02' });
  });
  it('localToday usa i campi locali', () => {
    expect(localToday(new Date(2026, 9, 28, 23, 59))).toBe('2026-10-28');
  });
});

describe('formattazione', () => {
  it('durate come nella matrice', () => {
    expect(formatDuration([240, 300], 'it')).toBe('4–5 h');
    expect(formatDuration([75, 110], 'it')).toBe('1 h 15–1 h 50');
    expect(formatDuration([60, 105], 'it')).toBe('1–1 h 45');
    expect(formatDuration([200, 240], 'it')).toBe('3 h 20–4 h');
    expect(formatDuration([240, 300], 'sv')).toBe('4–5 tim');
  });
  it('euro in tutte le lingue', () => {
    for (const l of LOCALES) expect(formatEur(21400, l)).toMatch(/€/);
  });
});
