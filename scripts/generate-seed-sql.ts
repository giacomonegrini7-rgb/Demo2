// Genera supabase/migrations/20261028000004_seed.sql dal catalogo e dal questionario TypeScript,
// così frontend e backend usano esattamente gli stessi dati. Uso: npm run gen:sql
import { writeFileSync } from 'node:fs';
import { CATALOG_VERSION, HOTELS, ORIGINS, ORIGIN_IDS, ROUTES, destinationsFor } from '../src/data/catalog.ts';
import { QUESTIONS, SURVEY_VERSION } from '../src/survey/definition.ts';
import { DEMO_VERSION, RESEARCH_VERSION_ID } from '../src/data/versions.ts';

const q = (s: string | null | undefined) => (s == null ? 'null' : `'${s.replace(/'/g, "''")}'`);
const arr = (xs: string[] | undefined) => (xs && xs.length ? `array[${xs.map(q).join(', ')}]::text[]` : `'{}'::text[]`);

export function generateSeedSql(): string {
  const lines: string[] = [];
  lines.push('-- GENERATO da scripts/generate-seed-sql.ts: non modificare a mano.');
  lines.push('-- Dati di scenario del prototipo (non quotazioni di mercato).');
  lines.push('');
  lines.push(`insert into public.research_versions (id, demo_version, survey_version, catalog_version, notes) values (${q(RESEARCH_VERSION_ID)}, ${q(DEMO_VERSION)}, ${q(SURVEY_VERSION)}, ${q(CATALOG_VERSION)}, 'Prima versione della demo acquirente') on conflict (id) do nothing;`);
  lines.push(`insert into public.app_config (id, collection_mode, current_version_id) values (1, 'test', ${q(RESEARCH_VERSION_ID)}) on conflict (id) do nothing;`);
  lines.push(`insert into public.privacy_config (id) values (1) on conflict (id) do nothing;`);
  lines.push('');
  for (const h of Object.values(HOTELS)) {
    lines.push(`insert into public.catalog_hotels (catalog_version, destination_id, original_cents, sale_cents) values (${q(CATALOG_VERSION)}, ${q(h.id)}, ${h.originalCents}, ${h.saleCents}) on conflict do nothing;`);
  }
  for (const o of ORIGIN_IDS) {
    lines.push(`insert into public.catalog_origins (catalog_version, origin_id, country_id) values (${q(CATALOG_VERSION)}, ${q(o)}, ${q(ORIGINS[o].country)}) on conflict do nothing;`);
  }
  for (const r of ROUTES) {
    const position = destinationsFor(r.originId).indexOf(r.destinationId) + 1;
    lines.push(`insert into public.catalog_routes (catalog_version, origin_id, destination_id, position, main_cents, transfers_cents, duration_min_minutes, duration_max_minutes) values (${q(CATALOG_VERSION)}, ${q(r.originId)}, ${q(r.destinationId)}, ${position}, ${r.mainCents}, ${r.transfersCents}, ${r.durationMinutes[0]}, ${r.durationMinutes[1]}) on conflict do nothing;`);
  }
  lines.push('');
  QUESTIONS.forEach((qd, i) => {
    lines.push(`insert into public.survey_questions (survey_version, question_id, position, kind, required, options, min_choices, max_choices, exclusive_options, other_option, max_text_length) values (${q(SURVEY_VERSION)}, ${q(qd.id)}, ${i + 1}, ${q(qd.kind)}, ${qd.required}, ${arr(qd.options)}, ${qd.min ?? 'null'}, ${qd.max ?? 'null'}, ${arr(qd.exclusive)}, ${q(qd.otherOption)}, ${qd.maxTextLength ?? 'null'}) on conflict do nothing;`);
  });
  return lines.join('\n') + '\n';
}

if (process.argv[1]?.endsWith('generate-seed-sql.ts')) {
  const out = new URL('../supabase/migrations/20261028000004_seed.sql', import.meta.url);
  writeFileSync(out, generateSeedSql());
  console.log(`Scritto ${out.pathname}`);
}
