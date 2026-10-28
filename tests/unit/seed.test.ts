import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateSeedSql } from '../../scripts/generate-seed-sql';

describe('seed SQL', () => {
  it('corrisponde al catalogo e al questionario TypeScript (npm run gen:sql)', () => {
    const file = readFileSync(new URL('../../supabase/migrations/20261028000004_seed.sql', import.meta.url), 'utf8');
    expect(file).toBe(generateSeedSql());
  });
});
