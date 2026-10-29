// E2E in modalità backend contro il server di test (fake-supabase.mjs) e il Postgres con le migrazioni reali.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.APP_URL;
const API = process.env.API_URL;
const results = [];
async function step(name, fn) {
  try { await fn(); results.push(true); console.log('✓', name); }
  catch (e) { results.push(false); console.log('✗', name, '\n ', String(e.message).split('\n').slice(0, 8).join('\n  ')); throw e; }
}

async function participant(browser, { origin, country, buy, email }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 860 }, locale: 'it-IT' });
  ctx.setDefaultTimeout(10000);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/');
  await page.locator('span:visible', { hasText: 'Ambiente di prova' }).first().waitFor();
  await page.getByRole('button', { name: 'Scopri le occasioni' }).click();
  await page.waitForURL('**/search');
  await page.getByLabel('Paese di partenza').selectOption(country);
  await page.getByLabel('Da quale città ti sarebbe comodo partire?').selectOption(origin);
  await page.getByRole('button', { name: 'Sono flessibile nelle prossime due settimane' }).click();
  await page.getByRole('button', { name: 'Mostra le mie occasioni' }).click();
  await page.waitForURL('**/offers');
  if (buy) {
    await page.locator(`a[href="/offers/${buy}"]`).click();
    await page.getByRole('button', { name: 'Prova l’acquisto simulato' }).click();
    await page.getByRole('button', { name: /Simula il pagamento/ }).click();
    await page.getByRole('button', { name: 'Mostra subito tutti i passaggi' }).click();
    await page.getByRole('button', { name: 'Vedi il riepilogo' }).click();
    await page.getByRole('button', { name: 'Raccontaci cosa ne pensi' }).click();
  } else {
    await page.getByRole('button', { name: 'Nessuna proposta fa per me' }).click();
  }
  await page.waitForURL('**/feedback/1');
  const pick = async (label) => { await page.getByLabel(label, { exact: true }).check(); };
  const next = () => page.getByRole('button', { name: 'Avanti' }).click();
  await pick('Non saprei ancora.'); await next();
  await pick('Abbastanza.'); await next();
  await pick('Avrei bisogno di 4–7 giorni.'); await next();
  await pick('Altro:'); await page.getByLabel('Specifica (facoltativo)').fill('@SUM(1) test'); await next();
  await pick('La condivisione dei miei dati personali.'); await next();
  await pick('2–3 notti.'); await next();
  await page.getByLabel('Il tuo commento').fill('Commento di prova'); await next();
  await page.getByRole('button', { name: 'Continua' }).click();
  await pick('Probabilmente disposto.'); await next();
  await pick('Sapere quanto riceverei al netto di tutti i costi.'); await next();
  await pick('Vorrei recuperare almeno il 40%.');
  await page.getByRole('button', { name: 'Invia le risposte' }).click();
  await page.waitForURL('**/feedback/email');
  if (email) {
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByRole('button', { name: 'Avvisami quando sarà disponibile' }).click();
    await page.getByText('Per registrare l’email è necessario selezionare il consenso.').waitFor();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Avvisami quando sarà disponibile' }).click();
    await page.getByText('Email registrata.').waitFor();
    await page.getByRole('link', { name: 'Continua' }).click();
  } else {
    await page.getByRole('button', { name: 'Termina senza lasciare l’email' }).click();
  }
  await page.waitForURL('**/thanks');
  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('tr-participant-auth')).access_token);
  assert.deepEqual(errors, []);
  return { ctx, page, token };
}

async function main() {
  const browser = await chromium.launch();
  let a;
  await step('partecipante A: acquisto simulato Verona, questionario, email con consenso', async () => {
    a = await participant(browser, { origin: 'venice', country: 'IT', buy: 'verona', email: '  Ricerca.Test@Example.org ' });
  });
  await step('partecipante B: «Nessuna proposta», questionario, senza email', async () => {
    await participant(browser, { origin: 'malmo', country: 'SE', buy: null, email: null });
  });
  await step('chiamate REST/RPC dirette con il token di A sono bloccate', async () => {
    const h = { apikey: 'test-anon', authorization: `Bearer ${a.token}`, 'content-type': 'application/json' };
    const contacts = await (await fetch(`${API}/rest/v1/contacts?select=*`, { headers: h })).json();
    assert.deepEqual(contacts, []);
    const sessions = await (await fetch(`${API}/rest/v1/research_sessions?select=*`, { headers: h })).json();
    assert.equal(sessions.length, 1, 'A vede solo la propria sessione');
    const del = await fetch(`${API}/rest/v1/rpc/tr_admin_delete_session`, { method: 'POST', headers: h, body: JSON.stringify({ p_session_id: sessions[0].id, p_note: 'attacco' }) });
    assert.equal(del.status, 403);
    const anonH = { apikey: 'test-anon', authorization: 'Bearer test-anon', 'content-type': 'application/json' };
    const anonStart = await fetch(`${API}/rest/v1/rpc/tr_start_session`, { method: 'POST', headers: anonH, body: JSON.stringify({ p_locale: 'it', p_reference_date: '2026-10-29', p_resume_id: null }) });
    assert.equal(anonStart.status, 403);
  });

  const admin = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' });
  admin.setDefaultTimeout(10000);
  const p = await admin.newPage();
  await step('login creator: account non abilitato rifiutato, owner ammesso', async () => {
    await p.goto(BASE + '/admin');
    await p.getByLabel('Email').fill('intruso@example.org');
    await p.getByLabel('Password').fill('x');
    await p.getByRole('button', { name: 'Accedi' }).click();
    await p.getByText('Accesso non riuscito').waitFor();
    await p.getByLabel('Email').fill('viewer@example.org');
    await p.getByLabel('Password').fill('viewer-pass');
    await p.getByRole('button', { name: 'Accedi' }).click();
    await p.getByRole('heading', { name: 'Statistiche' }).waitFor();
    assert.equal(await p.getByRole('link', { name: 'Contatti' }).count(), 0, 'il viewer non vede i contatti');
    await p.getByRole('button', { name: 'Esci' }).click();
    await p.getByRole('heading', { name: 'Area creator', level: 1 }).waitFor();
    await p.getByLabel('Email').fill('owner@example.org');
    await p.getByLabel('Password').fill('owner-pass');
    await p.getByRole('button', { name: 'Accedi' }).click();
    await p.getByRole('heading', { name: 'Statistiche' }).waitFor();
  });
  await step('dashboard: test esclusi di default, visibili col filtro', async () => {
    await p.getByText('Nessuna partecipazione', { exact: true }).waitFor();
    await p.getByLabel('Dati').selectOption('test');
    await p.getByText('Funnel della demo').waitFor();
    assert.match(await p.locator('main').innerText(), /2 partecipazioni con i filtri attuali/);
  });
  await step('contatti: email normalizzata, visibile solo a owner', async () => {
    await p.getByRole('link', { name: 'Contatti' }).click();
    await p.getByText('ricerca.test@example.org').waitFor();
  });
  await step('report individuale con risposte leggibili', async () => {
    await p.getByRole('link', { name: 'Partecipazioni' }).click();
    await p.getByRole('heading', { name: 'Partecipazioni', level: 1 }).waitFor();
    assert.equal(await p.locator('tbody tr').count(), 2);
    await p.locator('tbody tr', { hasText: 'Verona' }).locator('a').click();
    await p.getByText('Riepilogo dei fatti').waitFor();
    const t = await p.locator('main').innerText();
    assert.match(t, /ha scelto Verona/);
    assert.match(t, /Non saprei ancora\./);
    assert.match(t, /Commento di prova/);
    assert.match(t, /214 €/);
  });
  await step('impostazioni: live bloccato senza informativa, poi attivato', async () => {
    await p.getByRole('link', { name: 'Impostazioni' }).click();
    await p.getByText('Mancano dati per attivare la raccolta live').waitFor();
    assert.equal(await p.getByRole('button', { name: 'Attiva la raccolta live' }).isDisabled(), true);
    await p.getByLabel(/Soggetto responsabile/).fill('Gruppo di ricerca Travel Recovery (test)');
    await p.getByLabel(/Email di contatto/).fill('team@example.org');
    await p.getByLabel(/Conservazione risposte/).fill('12');
    await p.getByLabel(/Conservazione email/).fill('24');
    await p.getByLabel(/Versione dell’informativa/).fill('test-v1');
    await p.getByLabel(/Base giuridica/).selectOption('consent');
    p.once('dialog', (d) => d.accept());
    await p.getByRole('button', { name: 'Attiva la raccolta live' }).click();
    await p.getByText('Modalità attuale: Ricerca live').waitFor();
  });
  await step('dopo il live: nuova partecipazione non è di test e l’informativa è pubblica', async () => {
    const ctx = await browser.newContext({ locale: 'en-GB' });
    const page = await ctx.newPage();
    await page.goto(BASE + '/privacy');
    await page.getByText('Gruppo di ricerca Travel Recovery (test). Contact: team@example.org.').waitFor();
    await page.goto(BASE + '/');
    assert.equal(await page.getByText('Test environment').count(), 0);
    await page.getByRole('button', { name: 'Discover the opportunities' }).click();
    await page.waitForURL('**/search');
    await p.goto(BASE + '/admin');
    await p.getByLabel('Dati').selectOption('live');
    await p.getByText('1 partecipazioni con i filtri attuali').waitFor();
  });
  await browser.close();
}

main().catch(() => { process.exitCode = 1; }).finally(() => {
  console.log(`${results.filter(Boolean).length}/${results.length} passi superati`);
  process.exit(process.exitCode ?? 0);
});
