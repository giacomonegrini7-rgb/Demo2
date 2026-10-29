# Report dei test

Data: 29 ottobre 2026. Ambiente: Linux, Node 22, PostgreSQL 16, Chromium (Playwright). Tutti i comandi sotto sono stati **eseguiti davvero** e sono passati, salvo dove è indicato «non eseguito».

## Eseguiti automaticamente

| Suite | Comando | Esito |
|---|---|---|
| Typecheck + build di produzione | `npm run build` | ✓ nessun errore |
| Unit (41 test) | `npm test` | ✓ 41/41 |
| Database: migrazioni + RLS/RPC | `npm run test:db` | ✓ tutte le asserzioni (controllato anche che un'asserzione falsa faccia fallire la suite) |
| E2E anteprima locale (15 passi) | `npm run build && npm run test:e2e` | ✓ 15/15, eseguito più volte |
| E2E con backend (9 passi) | `npm run test:backend` | ✓ 9/9, eseguito più volte |

### Copertura rispetto ai criteri di accettazione

- **Dati e calcoli (1–7):**
  - 5 alloggi, 10 origini, 40 coppie uniche, 4 per origine;
  - Lisbona solo per Valencia;
  - etichette in 4 lingue;
  - P+X senza doppi conteggi;
  - esempi 214 / 110 / 42,3% e 662 / 464, con Malmö X = 80+32;
  - prezzi hotel invariati per partenza e budget;
  - percentuali coerenti.

  Le stesse verifiche girano sia in TypeScript sia in SQL: le offerte calcolate dal server coincidono.
- **Date e interazione (8–13):**
  - cambio di mese e di anno, fine e inizio dell'ora legale, anni bisestili;
  - intervallo troppo breve, troppo presto, troppo tardi o invertito, sia nel client sia nel server;
  - cambio Paese che cancella la città;
  - nuova ricerca che invalida la scelta;
  - cambio lingua che conserva tutto;
  - back, forward e refresh;
  - doppio clic e refresh sul pagamento senza duplicati (un solo evento di pagamento e uno di trasferimento);
  - questionario raggiungibile senza acquisto;
  - nessun `input` nel checkout;
  - nessuna richiesta di rete verso host esterni in anteprima.
- **Lingue e design (14–17):**
  - stesse chiavi, numero di opzioni e segnaposto nei 4 dizionari (test automatico);
  - nessun overflow orizzontale a 360, 390, 768 e 1440 px, anche in svedese;
  - contrasti calcolati (vedi sotto);
  - nessun errore in console;
  - nessuna immagine esterna.
- **Questionario e backend (18–29):**
  - numero di opzioni (5,5,7,6,10,7,—,5,9,13);
  - C5 max 3 con opzione 9 esclusiva, C6 con 6 e 7 esclusive, V2 max 2 con opzione 8 esclusiva, nel client (E2E) e nel server (SQL);
  - C7 vuota non blocca, single choice senza risposta blocca;
  - «Altro» non selezionato non viene salvato;
  - invio atomico e idempotente, con risposte conservate dopo un refresh;
  - isolamento tra due identità (A non legge e non modifica B, anche via REST/RPC diretti);
  - un utente anonimo non entra nell'admin, non si auto-promuove (INSERT su `creator_members` negato) e non legge i contatti;
  - il viewer non vede le email;
  - email normalizzata, reinvio senza duplicati, revoca non riattivata da un reinvio, risposta identica (nessuna enumerazione);
  - live bloccato senza informativa, anche a livello di database;
  - nuove partecipazioni non-test dopo il live;
  - export CSV con formule neutralizzate e tutte le righe filtrate;
  - dashboard vuota reale, test esclusi di default, denominatore zero mostrato come «—».

### Test con backend: come funziona

`tests/backend/fake-supabase.mjs` imita gli endpoint usati dall'app: Auth anonima e con password, `/rest/v1/rpc/*` e `/rest/v1/<tabella>`. Ogni chiamata viene eseguita su Postgres con il ruolo `authenticated` o `anon` e con il `sub` del token. **RLS, GRANT e funzioni sono quindi quelli reali delle migrazioni.** L'app viene compilata con `VITE_SUPABASE_URL` puntato a quel server, e Playwright esegue:
- due partecipanti completi;
- attacchi REST diretti;
- login di un account non abilitato, di un viewer e di un owner;
- report, contatti, impostazioni e attivazione del live.

### Contrasti calcolati (WCAG 2.1)

| Coppia | Rapporto |
|---|---:|
| testo secondario su avorio | 5,67 |
| testo secondario su sabbia | 5,11 |
| terracotta (testo) su avorio | 5,23 |
| terracotta su tinta terracotta | 4,72 |
| bianco su petrolio (pulsanti) | 6,33 |
| petrolio scuro su tinta petrolio | 7,64 |
| errore su tinta errore | 6,09 |
| blu notte su avorio | 13,35 |

Tutte le coppie superano il livello AA (4,5:1). Risparmio ed errori non sono comunicati solo con il colore: hanno sempre testo e icone.

## Non eseguiti: da fare prima del lancio

1. **Progetto Supabase reale.** Le migrazioni non sono state applicate a un progetto Supabase vero. Vanno controllati:
   - l'esecuzione dei 4 file nel SQL Editor;
   - l'accesso anonimo abilitato;
   - un giro completo da due browser (README §8).
2. **Deploy Vercel.** Non è stato effettuato. Va verificato il refresh su `/offers/verona` e `/admin/partecipazioni`.
3. **Browser e dispositivi reali:** Safari iOS, Firefox, Android. Sono stati testati solo Chromium desktop e un viewport mobile emulato.
4. **Tecnologie assistive:** verifica manuale con VoiceOver o NVDA. La struttura ha label, fieldset, `aria-live` e focus sul titolo a ogni pagina, ma non è stata provata con uno screen reader.
5. **Tastiera:** il percorso completo con il solo Tab, Spazio e Invio non è coperto da test automatici. Va fatto un controllo manuale veloce.
6. **CAPTCHA / anti-abuso:** non integrato (vedi README, «Limiti noti»).

## Checklist manuale breve (da spuntare sul sito pubblicato)

- [ ] Landing in italiano su telefono; cambio in svedese e ritorno in italiano senza perdere nulla
- [ ] Partenza Bologna, «Sono flessibile», budget 300 → 4 offerte, fuori o dentro budget coerente
- [ ] Dettaglio Verona → acquisto simulato → pratica → esito → questionario completo → email con consenso → grazie
- [ ] Secondo browser: Valencia → Lisbona visibile, «Nessuna proposta fa per me» → questionario → termina senza email
- [ ] `/admin`: login owner, filtro «Solo prove», 2 partecipazioni, report leggibili, CSV aperto in Excel
- [ ] Informativa compilata → attiva live → `/privacy` mostra i riferimenti
