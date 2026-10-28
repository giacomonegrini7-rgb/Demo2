import { describe, expect, it as test } from 'vitest';
import it from '../../src/i18n/it';
import en from '../../src/i18n/en';
import es from '../../src/i18n/es';
import sv from '../../src/i18n/sv';
import { QUESTIONS } from '../../src/survey/definition';

type Node = unknown;
function shape(n: Node, path = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof n === 'string') out[path] = n;
  else if (Array.isArray(n)) {
    out[`${path}#len`] = String(n.length);
    n.forEach((x, i) => Object.assign(out, shape(x, `${path}[${i}]`)));
  } else if (n && typeof n === 'object') for (const [k, v] of Object.entries(n)) Object.assign(out, shape(v, path ? `${path}.${k}` : k));
  return out;
}
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

describe('dizionari', () => {
  const base = shape(it);
  for (const [name, dict] of Object.entries({ en, es, sv })) {
    test(`${name}: stesse chiavi, lunghezze e segnaposto dell'italiano`, () => {
      const other = shape(dict);
      expect(Object.keys(other).sort()).toEqual(Object.keys(base).sort());
      for (const [k, v] of Object.entries(base)) {
        if (k.endsWith('#len')) expect(other[k], k).toBe(v);
        else {
          expect(other[k].trim().length, k).toBeGreaterThan(0);
          expect(placeholders(other[k]), k).toBe(placeholders(v));
        }
      }
    });
  }
  test('opzioni del questionario coerenti con la definizione in ogni lingua', () => {
    for (const dict of [it, en, es, sv]) for (const q of QUESTIONS) {
      expect(dict.survey.questions[q.id].options.length, `${dict.meta.langName} ${q.id}`).toBe(q.options.length);
    }
  });
});
