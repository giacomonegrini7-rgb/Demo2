import { describe, expect, it } from 'vitest';
import { applyFilters, buildViews, c3Summary, crosstab, destinationStats, distribution, EMPTY_FILTERS, fmtPct, funnel, kpis, openTexts, type Dataset } from '../../src/admin/stats';
import { participationsCsv, safeCell, toCsv } from '../../src/admin/exports';
import { buildSnapshot } from '../../src/lib/pricing';
import type { AnswerRow, EventRow, SessionRow, SnapshotRow } from '../../src/backend/types';
import type { QuestionId } from '../../src/survey/definition';

let eid = 1;
function session(id: string, over: Partial<SessionRow> = {}): SessionRow {
  return {
    id, owner_id: 'o', version_id: 'v1', is_test: false, reference_date: '2026-10-28', initial_locale: 'it', last_locale: 'it',
    created_at: '2026-10-28T10:00:00Z', updated_at: '2026-10-28T10:00:00Z', current_search_revision: 1, selected_destination_id: null,
    selected_search_revision: null, feedback_entry: null, survey_status: 'not_started', survey_locale: null, completed_at: null,
    email_prompt_seen: false, email_status: 'not_shown', email_status_at: null, ...over,
  };
}
const ev = (sid: string, type: EventRow['event_type'], dest: EventRow['destination_id'] = null): EventRow => ({
  id: eid++, event_id: `e${eid}`, session_id: sid, event_type: type, server_received_at: `2026-10-28T10:0${eid % 10}:00Z`, client_ts: null,
  search_revision: 1, destination_id: dest, position: null, locale: 'it', meta: {},
});
const snap = (sid: string, origin: 'venice' | 'valencia'): SnapshotRow => {
  const s = buildSnapshot({ originId: origin, intervalStart: '2026-10-29', intervalEnd: '2026-11-03', budgetCents: null }, 1);
  return { session_id: sid, search_revision: 1, origin_country: s.originCountry, origin_id: origin, interval_start: s.intervalStart, interval_end: s.intervalEnd, checkin: s.checkIn, checkout: s.checkOut, budget_cents: null, adults: 2, nights: 2, catalog_version: s.catalogVersion, offers: s.offers, locale: 'it', created_at: '' };
};
const ans = (sid: string, q: QuestionId, ids: string[], extra: Partial<AnswerRow> = {}): AnswerRow => ({
  session_id: sid, question_id: q, survey_version: 's', option_ids: ids, other_text: null, text_answer: null, locale: 'it', is_final: true, created_at: '', updated_at: '', finalized_at: '', ...extra,
});

function dataset(): Dataset {
  return {
    sessions: [
      session('a', { survey_status: 'completed', email_prompt_seen: true, email_status: 'submitted', selected_destination_id: 'verona' }),
      session('b', { survey_status: 'completed', email_prompt_seen: true, email_status: 'declined' }),
      session('c'),
      session('t', { is_test: true }),
    ],
    snapshots: [snap('a', 'venice'), snap('b', 'valencia')],
    events: [
      ...['a', 'b', 'c', 't'].map((s) => ev(s, 'session_started')),
      ev('a', 'preferences_submitted'), ev('a', 'offers_viewed'), ev('a', 'offer_opened', 'verona'), ev('a', 'offer_opened', 'verona'),
      ev('a', 'checkout_started', 'verona'), ev('a', 'simulated_payment_completed', 'verona'),
      ev('b', 'preferences_submitted'), ev('b', 'offers_viewed'), ev('b', 'no_offer_selected'),
    ],
    answers: [
      ans('a', 'c1', ['c1_01']), ans('a', 'c3', ['c3_02']), ans('a', 'c5', ['c5_01', 'c5_02']), ans('a', 'v1', ['v1_01']),
      ans('a', 'c7', [], { text_answer: 'Commento' }), ans('a', 'c4', ['c4_06'], { other_text: '=HYPERLINK("x")' }),
      ans('b', 'c1', ['c1_04']), ans('b', 'c3', ['c3_06']), ans('b', 'c5', ['c5_01']), ans('b', 'v1', ['v1_05']),
    ],
    contacts: null, sessionContacts: null, consentEvents: null,
  };
}

describe('statistiche creator', () => {
  const views = buildViews(dataset());
  const live = applyFilters(views, EMPTY_FILTERS);
  it('test esclusi di default', () => {
    expect(live.map((v) => v.s.id).sort()).toEqual(['a', 'b', 'c']);
    expect(applyFilters(views, { ...EMPTY_FILTERS, data: 'all' })).toHaveLength(4);
  });
  it('KPI per sessioni distinte, tasso completamento e adesione email', () => {
    const k = kpis(live, null);
    expect(k.started).toBe(3);
    expect(k.detail).toBe(1);
    expect(k.completed).toBe(2);
    expect(fmtPct(k.completionRate)).toBe('66,7%');
    expect(k.emailAdoption).toEqual({ num: 1, den: 2 });
    expect(fmtPct({ num: 0, den: 0 })).toBe('—');
  });
  it('funnel', () => {
    expect(funnel(live).map((f) => f.sessions)).toEqual([3, 2, 2, 1, 1, 1, 0]);
  });
  it('scelta multipla: percentuale sui rispondenti', () => {
    const d = distribution(live, 'c5');
    expect(d.base).toBe(2);
    expect(d.rows.find((r) => r.optionId === 'c5_01')!.count).toBe(2);
    expect(d.rows.reduce((s, r) => s + r.count, 0)).toBeGreaterThan(d.base);
  });
  it('C3 entro 14 giorni separato da non interessati', () => {
    const c = c3Summary(live);
    expect(c.within14).toEqual({ num: 1, den: 2 });
    expect(c.notInterested).toEqual({ num: 1, den: 2 });
  });
  it('incrocio C1×V1', () => {
    const x = crosstab(live, 'c1', 'v1');
    expect(x.cells[0][0]).toBe(1);
    expect(x.cells[3][4]).toBe(1);
  });
  it('Lisbona con denominatore degli esposti', () => {
    const lis = destinationStats(live).find((d) => d.destination === 'lisbon')!;
    expect(lis.exposed).toBe(1);
    const ver = destinationStats(live).find((d) => d.destination === 'verona')!;
    expect(ver.opened).toEqual({ num: 1, den: 2 });
  });
  it('testi aperti', () => {
    expect(openTexts(live).map((t) => t.kind).sort()).toEqual(['comment', 'other']);
  });
});

describe('CSV', () => {
  it('neutralizza formule ed esegue escaping', () => {
    expect(safeCell('=1+1')).toBe(`"'=1+1"`);
    expect(safeCell('+39')).toBe(`"'+39"`);
    expect(safeCell('@x')).toBe(`"'@x"`);
    expect(safeCell('a "b"')).toBe(`"a ""b"""`);
    expect(toCsv(['a'], [['x;y']])).toBe('﻿"a"\r\n"x;y"\r\n');
  });
  it('export partecipazioni: tutte le righe filtrate, email escluse di default', () => {
    const views = applyFilters(buildViews(dataset()), EMPTY_FILTERS);
    const csv = participationsCsv(views, { includeEmail: false });
    expect(csv.trim().split('\r\n')).toHaveLength(4);
    expect(csv).not.toContain('"email"');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('Sì, sarei disposto a procedere all’acquisto.');
  });
});
