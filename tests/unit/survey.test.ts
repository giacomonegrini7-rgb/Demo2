import { describe, expect, it } from 'vitest';
import { QUESTIONS, QUESTION_BY_ID, SURVEY_STEPS, toggleMulti, validateAll, validateAnswer, normalizeAnswer } from '../../src/survey/definition';

describe('struttura questionario', () => {
  it('numero opzioni per domanda', () => {
    const counts = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.options.length]));
    expect(counts).toEqual({ c1: 5, c2: 5, c3: 7, c4: 6, c5: 10, c6: 7, c7: 0, v1: 5, v2: 9, v3: 13 });
  });
  it('ordine e passo introduzione venditore prima di V1', () => {
    const order = SURVEY_STEPS.map((s) => (s.type === 'seller_intro' ? 'intro' : s.question.id));
    expect(order).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'intro', 'v1', 'v2', 'v3']);
    expect(QUESTIONS.filter((q) => q.required)).toHaveLength(9);
  });
});

describe('regole', () => {
  const c5 = QUESTION_BY_ID.c5, c6 = QUESTION_BY_ID.c6, v2 = QUESTION_BY_ID.v2;
  it('C5 massimo 3 ed esclusiva 9', () => {
    expect(validateAnswer(c5, { optionIds: ['c5_01', 'c5_02', 'c5_03', 'c5_04'] }, { final: true })).toBe('too_many');
    expect(validateAnswer(c5, { optionIds: ['c5_09', 'c5_01'] }, { final: true })).toBe('exclusive');
    expect(validateAnswer(c5, { optionIds: ['c5_09'] }, { final: true })).toBeNull();
    expect(toggleMulti(c5, ['c5_01', 'c5_02', 'c5_03'], 'c5_04')).toEqual({ next: ['c5_01', 'c5_02', 'c5_03'], rejected: true });
    expect(toggleMulti(c5, ['c5_01'], 'c5_09').next).toEqual(['c5_09']);
    expect(toggleMulti(c5, ['c5_09'], 'c5_01').next).toEqual(['c5_01']);
  });
  it('C6 opzioni 6 e 7 esclusive', () => {
    expect(validateAnswer(c6, { optionIds: ['c6_06', 'c6_07'] }, { final: true })).toBe('exclusive');
    expect(validateAnswer(c6, { optionIds: ['c6_01', 'c6_07'] }, { final: true })).toBe('exclusive');
    expect(validateAnswer(c6, { optionIds: ['c6_01', 'c6_02', 'c6_03', 'c6_04', 'c6_05'] }, { final: true })).toBeNull();
    expect(toggleMulti(c6, ['c6_06'], 'c6_07').next).toEqual(['c6_07']);
  });
  it('V2 massimo 2 ed esclusiva 8', () => {
    expect(validateAnswer(v2, { optionIds: ['v2_01', 'v2_02', 'v2_03'] }, { final: true })).toBe('too_many');
    expect(validateAnswer(v2, { optionIds: ['v2_08', 'v2_01'] }, { final: true })).toBe('exclusive');
  });
  it('single choice obbligatoria e C7 facoltativa', () => {
    const errs = validateAll({});
    expect(Object.keys(errs).sort()).toEqual(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'v1', 'v2', 'v3']);
    expect(validateAnswer(QUESTION_BY_ID.c1, { optionIds: ['c1_01', 'c1_02'] }, { final: true })).toBe('single');
    expect(validateAnswer(QUESTION_BY_ID.c1, { optionIds: ['c9_01'] }, { final: true })).toBe('unknown_option');
    expect(validateAnswer(QUESTION_BY_ID.c7, { optionIds: [], text: 'x'.repeat(1501) }, { final: true })).toBe('too_long');
  });
  it('testo Altro non selezionato non viene salvato', () => {
    expect(normalizeAnswer(QUESTION_BY_ID.c4, { optionIds: ['c4_01'], otherText: 'vecchio' })).toEqual({ optionIds: ['c4_01'] });
    expect(normalizeAnswer(QUESTION_BY_ID.c4, { optionIds: ['c4_06'], otherText: ' x ' })).toEqual({ optionIds: ['c4_06'], otherText: 'x' });
  });
});
