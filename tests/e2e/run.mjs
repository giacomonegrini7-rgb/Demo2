// Test end-to-end in modalità anteprima locale (nessun backend). Uso: npm run build && npm run test:e2e
// Richiede Playwright con Chromium (preinstallato nell'ambiente di sviluppo; altrimenti `npx playwright install chromium`).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = 4174;
const BASE = process.env.E2E_URL ?? `http://localhost:${PORT}`;

let server;
async function startServer() {
  if (process.env.E2E_URL) return;
  server = spawn('node_modules/.bin/vite', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* attesa */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server non avviato');
}

const results = [];
async function step(name, fn) {
  try { await fn(); results.push(['✓', name]); console.log('✓', name); } catch (e) { results.push(['✗', name, e.message]); console.log('✗', name, '\n ', e.message.split('\n').slice(0, 6).join('\n  ')); throw e; }
}

async function noHorizontalOverflow(page, label) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(o <= 1, `overflow orizzontale di ${o}px in ${label}`);
}

async function main() {
  await startServer();
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 860 }, locale: 'it-IT' });
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));

  await step('landing in italiano (lingua del browser) e avvio', async () => {
    await page.goto(BASE + '/');
    await page.getByRole('heading', { name: /Hai qualche giorno libero/ }).waitFor();
    await page.getByRole('button', { name: 'Scopri le occasioni' }).click();
    await page.waitForURL('**/search');
  });

  await step('validazione preferenze ed errore intervallo troppo breve', async () => {
    await page.getByRole('button', { name: 'Mostra le mie occasioni' }).click();
    await page.getByText('Scegli il Paese di partenza.').first().waitFor();
    await page.getByLabel('Paese di partenza').selectOption('ES');
    await page.getByLabel('Da quale città ti sarebbe comodo partire?').selectOption('valencia');
    // cambio Paese: la città incompatibile viene cancellata
    await page.getByLabel('Paese di partenza').selectOption('IT');
    assert.equal(await page.getByLabel('Da quale città ti sarebbe comodo partire?').inputValue(), '');
    await page.getByLabel('Paese di partenza').selectOption('ES');
    await page.getByLabel('Da quale città ti sarebbe comodo partire?').selectOption('valencia');
    const days = page.locator('[role="group"] button');
    await days.nth(2).click();
    await days.nth(3).click();
    await page.getByRole('button', { name: 'Mostra le mie occasioni' }).click();
    await page.getByText(/servono almeno due notti/).first().waitFor();
    await page.getByRole('button', { name: 'Sono flessibile nelle prossime due settimane' }).click();
    await page.getByLabel('Budget complessivo').fill('500');
    await page.getByRole('button', { name: 'Mostra le mie occasioni' }).click();
    await page.waitForURL('**/offers');
  });

  await step('Valencia vede Lisbona (464 €) e non Valencia', async () => {
    const titles = await page.locator('article h2').allTextContents();
    assert.deepEqual(titles, ['Vienna', 'Budapest', 'Verona', 'Lisbona']);
    const lis = page.locator('article', { hasText: 'Lisbona' });
    assert.match(await lis.innerText(), /464\s?€/);
    assert.match(await lis.innerText(), /Rientra nel tuo budget/);
  });

  await step('cambio lingua conserva ricerca e dati', async () => {
    await page.getByLabel('Lingua').selectOption('sv');
    await page.getByRole('heading', { name: 'Dina tillfällen' }).waitFor();
    assert.deepEqual(await page.locator('article h2').allTextContents(), ['Wien', 'Budapest', 'Verona', 'Lissabon']);
    await page.getByLabel('Språk').selectOption('it');
  });

  await step('nuova ricerca (Venezia) invalida la scelta e mostra avviso', async () => {
    await page.getByRole('link', { name: 'Modifica la ricerca' }).click();
    await page.getByLabel('Paese di partenza').selectOption('IT');
    await page.getByLabel('Da quale città ti sarebbe comodo partire?').selectOption('venice');
    await page.getByRole('button', { name: 'Mostra le mie occasioni' }).click();
    await page.waitForURL('**/offers');
    await page.getByText('Offerte aggiornate in base alle nuove preferenze').waitFor();
    const verona = page.locator('article', { hasText: 'Verona' });
    assert.match(await verona.innerText(), /214\s?€/);
    assert.match(await verona.innerText(), /110\s?€ \(42,3%\)/);
    assert.match(await verona.innerText(), /Treno A\/R da Venezia Santa Lucia/);
  });

  await step('dettaglio, refresh e back funzionano', async () => {
    await page.locator('a[href="/offers/verona"]').click();
    await page.waitForURL('**/offers/verona');
    await page.reload();
    await page.getByRole('heading', { name: 'Verona', level: 1 }).waitFor();
    await page.goBack();
    await page.waitForURL('**/offers');
    await page.goForward();
    await page.waitForURL('**/offers/verona');
  });

  await step('checkout: nessun campo di pagamento, importi coerenti', async () => {
    await page.getByRole('button', { name: 'Prova l’acquisto simulato' }).click();
    await page.waitForURL('**/checkout');
    await page.getByText('Modalità demo · Nessun pagamento reale').waitFor();
    assert.equal(await page.locator('input').count(), 0, 'nessun input nel checkout');
    const txt = await page.locator('main').innerText();
    assert.match(txt, /150\s?€/);
    assert.match(txt, /Non incluso nell’acquisto simulato/);
  });

  await step('pagamento simulato: doppio clic e refresh senza duplicati', async () => {
    await page.getByRole('button', { name: /Simula il pagamento/ }).dblclick();
    await page.waitForURL('**/transfer');
    await page.reload();
    await page.getByRole('button', { name: 'Mostra subito tutti i passaggi' }).click();
    await page.getByRole('button', { name: 'Vedi il riepilogo' }).click();
    await page.waitForURL('**/outcome');
    await page.getByRole('heading', { name: 'La tua prossima pausa: Verona!' }).waitFor();
    const db = await page.evaluate(() => JSON.parse(localStorage.getItem('tr-preview-db-v1')));
    assert.equal(db.events.filter((e) => e.event_type === 'simulated_payment_completed').length, 1);
    assert.equal(db.events.filter((e) => e.event_type === 'simulated_transfer_completed').length, 1);
  });

  await step('questionario: regole, limiti, esclusività, C7 facoltativa', async () => {
    await page.getByRole('button', { name: 'Raccontaci cosa ne pensi' }).click();
    await page.waitForURL('**/feedback/1');
    await page.getByRole('button', { name: 'Avanti' }).click();
    await page.getByText('Seleziona una risposta per continuare.').waitFor();
    const pick = (label) => page.getByLabel(label, { exact: true }).check();
    await pick('Potenzialmente sì, ma prima avrei bisogno di ulteriori informazioni o garanzie.');
    await page.getByRole('button', { name: 'Avanti' }).click();
    await pick('Molto.');
    await page.getByRole('button', { name: 'Avanti' }).click();
    await pick('Avrei bisogno di 2–3 giorni.');
    await page.getByRole('button', { name: 'Avanti' }).click();
    await pick('Altro:');
    await page.getByLabel('Specifica (facoltativo)').fill('=1+1 per lavoro');
    await page.getByRole('button', { name: 'Avanti' }).click();
    // C5: massimo tre, «Nessuno» esclusiva
    for (const o of ['Il timore che la prenotazione non sia valida o che il trasferimento non riesca.', 'La condivisione dei miei dati personali.', 'Le condizioni di modifica o cancellazione dopo l’acquisto.']) await pick(o);
    await page.getByLabel('La preferenza per prenotare direttamente con un fornitore che conosco.', { exact: true }).click();
    await page.getByText('Puoi selezionare al massimo 3 risposte.').waitFor();
    assert.equal(await page.locator('input[type=checkbox]:checked').count(), 3);
    await page.getByLabel('Nessuno degli aspetti indicati.', { exact: true }).click();
    assert.equal(await page.locator('input[type=checkbox]:checked').count(), 1);
    await pick('Il timore che la prenotazione non sia valida o che il trasferimento non riesca.');
    assert.equal(await page.getByLabel('Nessuno degli aspetti indicati.', { exact: true }).isChecked(), false);
    await page.getByRole('button', { name: 'Avanti' }).click();
    // C6: 6 e 7 esclusive
    await pick('2–3 notti.');
    await page.getByLabel('Non saprei.', { exact: true }).click();
    assert.equal(await page.locator('input[type=checkbox]:checked').count(), 1);
    await pick('4–5 notti.');
    await page.getByRole('button', { name: 'Avanti' }).click();
    // C7 facoltativa: si può saltare
    await page.getByText('Facoltativa', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Salta questa domanda' }).click();
    await page.getByRole('heading', { name: 'Ora cambia prospettiva.' }).waitFor();
    await page.getByRole('button', { name: 'Continua' }).click();
    await pick('Probabilmente disposto.');
    await page.getByRole('button', { name: 'Avanti' }).click();
    await pick('Sapere quanto riceverei al netto di tutti i costi.');
    await pick('Sapere quando e come riceverei il pagamento.');
    await page.getByLabel('Sapere cosa succederebbe se non si trovasse un acquirente.', { exact: true }).click();
    await page.getByText('Puoi selezionare al massimo 2 risposte.').waitFor();
    await page.getByRole('button', { name: 'Avanti' }).click();
    await page.getByText('V3 — Recupero minimo accettabile').waitFor();
    assert.equal(await page.locator('input[type=radio]').count(), 13, 'V3 ha 13 opzioni');
    await pick('Vorrei recuperare almeno il 50%.');
    await page.reload(); // le risposte restano
    assert.equal(await page.getByLabel('Vorrei recuperare almeno il 50%.', { exact: true }).isChecked(), true);
    await page.getByRole('button', { name: 'Invia le risposte' }).click();
    await page.waitForURL('**/feedback/email');
  });

  await step('email disabilitata in anteprima, nessuna finta iscrizione', async () => {
    await page.getByText('Anteprima locale: i contatti non vengono inviati al team.').waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Email' }).isDisabled(), true);
    await page.getByRole('button', { name: 'Termina senza lasciare l’email' }).click();
    await page.waitForURL('**/thanks');
    await page.getByRole('heading', { name: 'Grazie per il tuo contributo.' }).waitFor();
    await page.goto(BASE + '/feedback/3');
    await page.waitForURL(/\/feedback\/email|\/thanks/);
  });

  await step('seconda partecipazione senza acquisto (Nessuna proposta)', async () => {
    await page.goto(BASE + '/thanks');
    await page.getByRole('button', { name: 'Prova di nuovo la demo' }).click();
    await page.getByRole('button', { name: 'Scopri le occasioni' }).click();
    await page.getByLabel('Paese di partenza').selectOption('SE');
    await page.getByLabel('Da quale città ti sarebbe comodo partire?').selectOption('malmo');
    await page.getByRole('button', { name: 'Sono flessibile nelle prossime due settimane' }).click();
    await page.getByRole('button', { name: 'Mostra le mie occasioni' }).click();
    await page.waitForURL('**/offers');
    const vienna = page.locator('article', { hasText: 'Vienna' });
    assert.match(await vienna.innerText(), /662\s?€/);
    assert.match(await vienna.innerText(), /Punto di partenza: Malmö C/);
    await page.getByRole('button', { name: 'Nessuna proposta fa per me' }).click();
    await page.waitForURL('**/feedback/1');
  });

  await step('larghezze 360/390/768/1440 senza overflow orizzontale', async () => {
    for (const w of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width: w, height: 900 });
      for (const path of ['/', '/privacy', '/feedback/1']) {
        await page.goto(BASE + path);
        await page.waitForLoadState('networkidle');
        await noHorizontalOverflow(page, `${path} @${w}`);
      }
    }
    await page.setViewportSize({ width: 360, height: 900 });
    await page.getByLabel('Lingua').selectOption('sv');
    await noHorizontalOverflow(page, 'svedese @360');
  });

  await step('area creator in anteprima: dati di prova locali', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE + '/admin');
    await page.getByText('Anteprima locale, nessun backend configurato.').waitFor();
    await page.getByRole('heading', { name: 'Statistiche' }).waitFor();
    await page.getByText('Funnel della demo').waitFor();
    await page.getByRole('link', { name: 'Partecipazioni' }).click();
    await page.getByRole('heading', { name: 'Partecipazioni', level: 1 }).waitFor();
    assert.equal(await page.locator('tbody tr').count(), 2);
    await page.locator('tbody tr a').last().click();
    await page.getByText('Riepilogo dei fatti').waitFor();
  });

  await step('nessuna richiesta a servizi esterni o gateway di pagamento', async () => {
    const external = requests.filter((u) => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:'));
    assert.deepEqual(external, []);
  });

  await step('nessun errore in console', async () => {
    assert.deepEqual(errors, []);
  });

  await browser.close();
}

main()
  .catch(() => { process.exitCode = 1; })
  .finally(() => {
    console.log(`${results.filter((r) => r[0] === '✓').length}/${results.length} passi superati`);
    server?.kill();
    process.exit(process.exitCode ?? 0);
  });
