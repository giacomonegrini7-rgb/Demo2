# Travel Recovery — Demo acquirente

Web app di ricerca universitaria. Il partecipante prova, dal lato di chi compra, il servizio Travel Recovery:
- sceglie partenza e date;
- vede quattro occasioni simulate;
- prova un acquisto e un trasferimento fittizi;
- risponde a 10 domande, prima come compratore e poi come possibile venditore;
- se vuole, lascia l'email.

Il gruppo consulta i risultati in un'area creator riservata.

- **Simulato:** offerte, alloggi, verifiche, trasferimenti e pagamenti. Non esiste nessun campo di pagamento e nessuna integrazione con gateway.
- **Reale (con backend):** il salvataggio di ricerche, interazioni essenziali, risposte ed email con consenso.
- **Lingue:** italiano, inglese, spagnolo e svedese. I prezzi sono sempre in euro.

Stack: React 19 + TypeScript + Vite 6, Tailwind CSS 4, React Router 7, Supabase (Postgres, Auth anonima, RLS, funzioni RPC) e Vercel.

---

## 1. Avvio locale (anteprima, nessun account necessario)

```bash
npm install
```

```bash
npm run dev
```

Apri http://localhost:5173. Senza variabili Supabase l'app è in **Anteprima locale**:
- il percorso è completo e navigabile;
- i dati restano solo nel browser e sono marcati come prova;
- la raccolta di email è disabilitata;
- `/admin` mostra solo le partecipazioni di prova fatte in quel browser.

## 2. Creare il progetto Supabase

1. Vai su https://supabase.com e crea un progetto nuovo. Consigliamo una regione UE, per esempio Frankfurt.
2. **Authentication → Sign In / Providers**:
   - attiva **Allow anonymous sign-ins**: serve all'identità tecnica dei partecipanti, che non vedono nessuna registrazione;
   - lascia attivo il provider **Email**: serve al login dei creator.
3. **Authentication → Rate Limits**: controlla il limite di accessi anonimi per IP (es. 30/ora) contro gli abusi.
   - Le funzioni hanno già limiti propri: 20 partecipazioni per identità, 500 eventi e 50 ricerche per partecipazione, 3 email per partecipazione.
   - *Nota:* se attivi il CAPTCHA di Supabase, l'accesso anonimo dell'app smette di funzionare. Il CAPTCHA non è integrato (vedi «Limiti noti»).

## 3. Applicare le migrazioni

Applica i file di `supabase/migrations/` **in ordine**:

| File | Contenuto |
|---|---|
| `20261028000001_schema.sql` | tabelle, RLS, privilegi minimi |
| `20261028000002_participant_rpc.sql` | funzioni dei partecipanti |
| `20261028000003_creator_rpc.sql` | funzioni dei creator e permessi EXECUTE |
| `20261028000004_seed.sql` | versioni, catalogo e questionario (generato) |

Hai due modi per farlo.

- **SQL Editor:** apri **SQL Editor → New query**, incolla un file alla volta ed esegui (*Run*).
- **Supabase CLI:**

  ```bash
  npx supabase link --project-ref <ref-del-progetto>
  ```

  ```bash
  npx supabase db push
  ```

## 4. Creare i creator (allowlist)

1. **Authentication → Users → Add user → Create new user**: inserisci email e password del membro del gruppo e spunta *Auto Confirm User*.
2. Copia lo *User UID*.
3. Apri `supabase/bootstrap_creator.sql`, sostituisci l'UUID e il ruolo, poi eseguilo nel SQL Editor.
   - `owner`: vede statistiche, partecipazioni, contatti ed email; può esportare, cancellare e cambiare le impostazioni.
   - `viewer`: vede statistiche e partecipazioni, senza email e senza azioni.

Un utente autenticato che non compare in `creator_members` non entra nell'area creator. Non esiste un «primo utente admin» né una password scritta nel codice.

## 5. Variabili d'ambiente

| Variabile | Dove trovarla | Pubblica? |
|---|---|---|
| `VITE_SUPABASE_URL` | Project Settings → API → Project URL | sì, va nel browser |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API Keys → chiave `anon` / *publishable* | sì, protetta da RLS |

Copia `.env.example` in `.env.local` per lo sviluppo.

**Mai** nel frontend, nel repository o in Vercel come `VITE_*`: la `service_role` / *secret key*, la password del database o qualsiasi altro segreto. L'app non ne ha bisogno.

## 6. Informativa e modalità di raccolta

L'app parte sempre in **modalità test**. Ogni nuova partecipazione viene salvata con `is_test = true` ed è esclusa dalle statistiche di default.

1. Accedi a `/admin/impostazioni` come owner e compila l'informativa:
   - soggetto responsabile;
   - email di contatto;
   - base giuridica (da confermare);
   - mesi di conservazione delle risposte e delle email;
   - versione dell'informativa.

   **Non inventate questi dati:** decideteli nel gruppo, e con il docente se serve.
2. Solo con tutti i campi compilati diventa disponibile **Attiva la raccolta live**. Anche il database lo impone: un vincolo impedisce la modalità live con un'informativa incompleta.
3. La pagina pubblica `/privacy` mostra i riferimenti solo quando sono completi. Prima mostra una nota «in preparazione».

## 7. Pubblicare su Vercel (nuovo progetto, separato dalla prima demo)

1. Su https://vercel.com: **Add New → Project** → importa il repository GitHub. Preset: Vite. Build `npm run build`, output `dist`.
2. **Settings → Environment Variables**: aggiungi `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Production e Preview).
3. Lancia il deploy. Il file `vercel.json` contiene già il fallback SPA, quindi il refresh su `/offers`, `/admin` ecc. funziona. Contiene anche header di sicurezza di base.

Il sito della prima demo non viene toccato.

## 8. Prova da due browser prima del lancio

1. In modalità test, apri il sito in due browser diversi (o uno normale e uno in navigazione privata) e completa due partecipazioni diverse:
   - una con acquisto simulato ed email;
   - una con «Nessuna proposta fa per me» senza email.
2. In `/admin`, con il filtro **Dati: Solo prove (test)**, devi vedere entrambe. Controlla i report individuali, la pagina Contatti e gli export.
3. Quando siete pronti, cancellate le prove (o lasciatele: restano marcate test) e attivate la modalità live.

## 9. Risultati ed export

- **`/admin` – Statistiche**:
  - KPI con definizioni;
  - funnel e ramo del questionario;
  - destinazioni, con denominatore uguale alle partecipazioni a cui la meta è stata mostrata (Lisbona solo da Valencia);
  - distribuzioni C1–C6 e V1–V3;
  - incroci C1×V1, C2×C3, C1×C5;
  - stato email;
  - commenti e testi «Altro».
- **`/admin/partecipazioni`**: elenco filtrabile e CSV di **tutte** le righe filtrate. Le email sono escluse di default; si includono con una spunta, solo per gli owner.
- **`/admin/partecipazioni/:id`**: report leggibile, stampa/PDF, JSON e azioni owner (segna come test/live, cancellazione con motivo).
- **`/admin/contatti`** (owner): revoca, riattivazione solo su nuova richiesta esplicita, CSV.

**Formato CSV:**
- separatore `;`, adatto a Excel in italiano;
- UTF-8 con BOM e campi tra virgolette;
- risposte multiple come `id1 | id2`, con colonne separate per gli ID e per le etichette italiane;
- le celle che iniziano con `= + - @` vengono neutralizzate con un apostrofo;
- il nome del file contiene data e versione.

## 10. Conservazione e cancellazione

Non ci sono cancellazioni automatiche. Applicate voi la durata che avete scritto nell'informativa, per esempio dal SQL Editor:

```sql
-- partecipazioni avviate più di N mesi fa (risposte, eventi e ricerche vanno in cascata)
delete from public.research_sessions where created_at < now() - interval '12 months';
-- contatti più vecchi di M mesi (o revocati) senza altre partecipazioni collegate
delete from public.contacts c where (c.consented_at < now() - interval '24 months' or c.status = 'revoked')
  and not exists (select 1 from public.session_contacts sc where sc.contact_id = c.id);
```

Richieste dei partecipanti:
- **cancellazione:** cercate il codice partecipazione (le prime 8 cifre) in `/admin/partecipazioni` e usate «Cancella partecipazione»;
- **revoca degli aggiornamenti:** usate «Registra revoca» in Contatti.

Revocare l'email non cancella le risposte. Se il partecipante chiede entrambe le cose, fate entrambe le operazioni.

## 11. Nuova iterazione della ricerca

1. Aggiorna `src/data/versions.ts` (e, se cambiano, catalogo o questionario).
2. Rigenera il seed:

   ```bash
   npm run gen:sql
   ```

3. Applica i nuovi `insert` nel SQL Editor.
4. Imposta la nuova versione attiva:

   ```sql
   update public.app_config set current_version_id = '<nuovo-id>';
   ```

Le partecipazioni precedenti conservano i loro snapshot.

## 12. Script e test

| Comando | Cosa fa |
|---|---|
| `npm run dev` / `npm run build` | sviluppo / build di produzione (con typecheck) |
| `npm test` | test unitari: catalogo, calcoli, date, questionario, dizionari, statistiche, CSV, seed SQL |
| `npm run test:db` | Postgres temporaneo + migrazioni + test SQL di RLS, RPC e isolamento (richiede PostgreSQL) |
| `npm run test:e2e` | E2E in anteprima con Playwright (dopo `npm run build`) |
| `npm run test:backend` | E2E con backend: migrazioni reali + server che imita Supabase + app compilata con le variabili |
| `npm run gen:sql` | rigenera `20261028000004_seed.sql` dal catalogo TypeScript |

Dettagli e risultati in [TEST_REPORT.md](TEST_REPORT.md). Dati di scenario in [SCENARIO_ASSUMPTIONS.md](SCENARIO_ASSUMPTIONS.md). Immagini e font in [ASSETS.md](ASSETS.md).

## 13. Struttura

```
src/data/        catalogo, matrice trasporti, versioni, registro foto
src/lib/         date di calendario, prezzi in centesimi, formattazione, storage sicuro
src/survey/      definizione del questionario (ID, limiti, esclusività) e validazione
src/i18n/        dizionari it (canonico), en, es, sv
src/backend/     adapter Anteprima locale e Supabase (RPC)
src/state/       stato del percorso, coda di eventi idempotenti con retry
src/pages/       percorso pubblico
src/admin/       area creator (caricata solo su /admin)
supabase/        migrazioni SQL e bootstrap creator
tests/           unit, db, e2e, backend
```

## 14. Limiti noti

- **Foto:** l'ambiente di sviluppo non poteva scaricare immagini. Sono incluse illustrazioni originali in SVG; per aggiungere foto con licenza vedi ASSETS.md.
- **CAPTCHA:** non integrato. Contro gli abusi restano i limiti di Supabase e quelli delle funzioni.
- **Server Supabase reale:** non è stato possibile testare un vero progetto Supabase e un deploy Vercel da questo ambiente. La logica SQL è testata su Postgres 16 con uno stub di `auth.uid()`, e l'app è testata contro un server che imita le API di Supabase (vedi TEST_REPORT.md).
- **Valori della demo:** prezzi, percorsi e durate sono dati di scenario, non quotazioni.
