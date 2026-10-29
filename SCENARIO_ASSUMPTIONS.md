# Ipotesi di scenario

Tutti i valori qui sotto sono **dati di scenario scelti per il prototipo**: non sono quotazioni di mercato, tariffe di operatori reali o itinerari verificati nelle date dei partecipanti. La fonte unica è `src/data/catalog.ts`. Il seed SQL viene generato da quel file (`npm run gen:sql`) e un test verifica che i due coincidano.

## Configurazione fissa

Due adulti, una camera doppia, due notti. Non esiste un selettore del numero di persone o di notti. Tutti gli importi sono totali per due persone, in euro, salvati in centesimi interi.

## Alloggi (versione catalogo `catalog-2026-10-v1`)

| ID | Città | Nome fittizio | Zona | Originale | Vendita | Risparmio | % |
|---|---|---|---|---:|---:|---:|---:|
| vienna | Vienna | Atelier Stadt — soggiorno demo | Leopoldstadt | 320 | 190 | 130 | 40,6 |
| budapest | Budapest | Duna Courtyard — soggiorno demo | Quartiere VII | 240 | 140 | 100 | 41,7 |
| verona | Verona | Corte delle Arti — soggiorno demo | Area centrale | 260 | 150 | 110 | 42,3 |
| valencia | Valencia | Patio del Sol — soggiorno demo | Russafa | 300 | 175 | 125 | 41,7 |
| lisbon | Lisbona | Miradouro House — soggiorno demo | Arroios | 340 | 200 | 140 | 41,2 |

- **Incluso nello scenario:** bagno privato, Wi-Fi, biancheria.
- **Escluso:** colazione, pasti, attività, bagaglio extra.
- **Orari:** check-in dalle 15:00, check-out entro le 11:00, nel fuso della destinazione.
- **Condizioni fittizie:** date fisse; il fornitore autorizza il cambio intestatario; nessun rimborso o cambio date dopo il trasferimento.

## Destinazioni mostrate

Ordine fisso: Vienna, Budapest, Verona, Valencia. **Solo** con partenza `valencia`, Valencia è sostituita da Lisbona. Nessuna partenza vede cinque offerte. La posizione di ogni scheda è salvata negli eventi e negli snapshot.

## Date

- `referenceDate` è la data locale del dispositivo all'avvio della partecipazione. Resta fissa: passare la mezzanotte durante la prova non sposta le offerte.
- La finestra va da `referenceDate + 1` a `referenceDate + 14`, estremi inclusi. Servono almeno due giorni di differenza tra inizio e fine.
- Check-in = primo giorno dell'intervallo, check-out = check-in + 2. La regola è la stessa per tutte le offerte. Il server ricontrolla queste regole.
- L'aritmetica usa date di calendario in UTC (`src/lib/dates.ts`), senza millisecondi su orari locali, quindi non risente dell'ora legale.

## Calcoli

```
hotelSavings          = hotelOriginal − hotelSale
hotelSavingsPercent   = hotelSavings / hotelOriginal × 100  (1 decimale, formato locale)
transportTotal        = P + X        (P e X sono già A/R per due adulti; X contato una sola volta)
estimatedTripTotal    = hotelSale + transportTotal
```

Il checkout simulato riguarda solo `hotelSale`. Il trasporto è suggerito separatamente come biglietto nuovo e non viene né venduto né trasferito. Il risparmio si riferisce solo al soggiorno. Il budget segnala solo «dentro» o «fuori» e non cambia nessun prezzo.

## Scomposizione di X (A/R per due)

- Aeroporto → centro all'arrivo: Vienna 32, Budapest 40, Verona 32, Valencia 24, Lisbona 24.
- Venezia → Valencia: Mestre–Treviso 56 + Valencia aeroporto–centro 24 = 80. Il punto di partenza è **Venezia Mestre**.
- Partenze da Malmö: Malmö C–CPH 80 + quota della città di arrivo (Vienna 112, Budapest 120, Verona 112, Valencia 104). Il punto di partenza è **Malmö C**.
- Treni con arrivo in stazione cittadina: X = 0, senza promettere taxi o collegamenti all'hotel.

## Ipotesi sul trasporto mostrate nei dettagli

- Classe economica o standard, con un piccolo bagaglio personale.
- Esclusi: bagaglio aggiuntivo, scelta del posto, pasti, attività, spostamenti locali extra e il tragitto da casa al punto di partenza.
- I voli via Monaco o Vienna sono percorsi di esempio con scalo e non vengono mai chiamati «diretti».
- Non compaiono numeri di volo, orari, frequenze, vettori o link di acquisto.
- La durata è indicativa e solo di andata, dal punto iniziale alla città.

## Matrice completa (40 combinazioni, EUR per due adulti)

| Partenza | Meta | Percorso illustrativo (andata) | P | X | P+X | Soggiorno | Totale | Durata |
|---|---|---|---:|---:|---:|---:|---:|---|
| Milano | Vienna | Milano Malpensa MXP → Vienna VIE; collegamento verso il centro | 240 | 32 | 272 | 190 | 462 | 4–5 h |
| Milano | Budapest | Milano Malpensa MXP → Budapest BUD; collegamento verso il centro | 220 | 40 | 260 | 140 | 400 | 4–5 h |
| Milano | Verona | Milano Centrale → Verona Porta Nuova (treno) | 80 | 0 | 80 | 150 | 230 | 1 h 15–1 h 50 |
| Milano | Valencia | Milano Malpensa MXP → Valencia VLC; collegamento verso il centro | 260 | 24 | 284 | 175 | 459 | 4 h 30–5 h 30 |
| Bologna | Vienna | Bologna Marconi BLQ → Vienna VIE; collegamento verso il centro | 240 | 32 | 272 | 190 | 462 | 4–5 h |
| Bologna | Budapest | Bologna Marconi BLQ → Budapest BUD; collegamento verso il centro | 200 | 40 | 240 | 140 | 380 | 4–5 h |
| Bologna | Verona | Bologna Centrale → Verona Porta Nuova (treno) | 60 | 0 | 60 | 150 | 210 | 1–1 h 45 |
| Bologna | Valencia | Bologna Marconi BLQ → Valencia VLC; collegamento verso il centro | 280 | 24 | 304 | 175 | 479 | 4 h 30–5 h 30 |
| Roma | Vienna | Roma Fiumicino FCO → Vienna VIE; collegamento verso il centro | 260 | 32 | 292 | 190 | 482 | 4–5 h |
| Roma | Budapest | Roma Fiumicino FCO → Budapest BUD; collegamento verso il centro | 250 | 40 | 290 | 140 | 430 | 4 h 30–5 h 30 |
| Roma | Verona | Roma Termini → Verona Porta Nuova (treno) | 180 | 0 | 180 | 150 | 330 | 3 h 20–4 h |
| Roma | Valencia | Roma Fiumicino FCO → Valencia VLC; collegamento verso il centro | 300 | 24 | 324 | 175 | 499 | 4 h 30–5 h 30 |
| Venezia | Vienna | Venezia Marco Polo VCE → Vienna VIE; collegamento verso il centro | 220 | 32 | 252 | 190 | 442 | 4–5 h |
| Venezia | Budapest | Venezia Marco Polo VCE → Monaco di Baviera MUC → Budapest BUD; collegamento verso il centro | 380 | 40 | 420 | 140 | 560 | 6–8 h |
| Venezia | Verona | Venezia Santa Lucia → Verona Porta Nuova (treno) | 64 | 0 | 64 | 150 | 214 | 1 h 15–1 h 50 |
| Venezia | Valencia | Venezia Mestre → Treviso TSF; Treviso TSF → Valencia VLC; collegamento verso il centro | 260 | 80 | 340 | 175 | 515 | 5–6 h |
| Madrid | Vienna | Madrid Barajas MAD → Vienna VIE; collegamento verso il centro | 340 | 32 | 372 | 190 | 562 | 5 h 30–6 h 30 |
| Madrid | Budapest | Madrid Barajas MAD → Budapest BUD; collegamento verso il centro | 360 | 40 | 400 | 140 | 540 | 5 h 30–6 h 30 |
| Madrid | Verona | Madrid Barajas MAD → Monaco di Baviera MUC → Verona Villafranca VRN; collegamento verso il centro | 440 | 32 | 472 | 150 | 622 | 6 h 30–8 h |
| Madrid | Valencia | Madrid Chamartín → València Joaquín Sorolla (treno) | 100 | 0 | 100 | 175 | 275 | 2–2 h 30 |
| Barcellona | Vienna | Barcellona El Prat BCN → Vienna VIE; collegamento verso il centro | 300 | 32 | 332 | 190 | 522 | 5–6 h |
| Barcellona | Budapest | Barcellona El Prat BCN → Budapest BUD; collegamento verso il centro | 320 | 40 | 360 | 140 | 500 | 5–6 h |
| Barcellona | Verona | Barcellona El Prat BCN → Monaco di Baviera MUC → Verona Villafranca VRN; collegamento verso il centro | 380 | 32 | 412 | 150 | 562 | 6–8 h |
| Barcellona | Valencia | Barcelona Sants → València Joaquín Sorolla (treno) | 120 | 0 | 120 | 175 | 295 | 3–3 h 30 |
| Valencia | Vienna | Valencia VLC → Vienna VIE; collegamento verso il centro | 340 | 32 | 372 | 190 | 562 | 5–6 h |
| Valencia | Budapest | Valencia VLC → Monaco di Baviera MUC → Budapest BUD; collegamento verso il centro | 420 | 40 | 460 | 140 | 600 | 6 h 30–8 h |
| Valencia | Verona | Valencia VLC → Monaco di Baviera MUC → Verona Villafranca VRN; collegamento verso il centro | 440 | 32 | 472 | 150 | 622 | 6 h 30–8 h |
| Valencia | Lisbona | Valencia VLC → Lisbona LIS; collegamento verso il centro | 240 | 24 | 264 | 200 | 464 | 4–5 h |
| Stoccolma | Vienna | Stoccolma Arlanda ARN → Vienna VIE; collegamento verso il centro | 380 | 32 | 412 | 190 | 602 | 4 h 30–5 h 30 |
| Stoccolma | Budapest | Stoccolma Arlanda ARN → Vienna VIE → Budapest BUD; collegamento verso il centro | 400 | 40 | 440 | 140 | 580 | 6–8 h |
| Stoccolma | Verona | Stoccolma Arlanda ARN → Monaco di Baviera MUC → Verona Villafranca VRN; collegamento verso il centro | 520 | 32 | 552 | 150 | 702 | 6–8 h |
| Stoccolma | Valencia | Stoccolma Arlanda ARN → Monaco di Baviera MUC → Valencia VLC; collegamento verso il centro | 540 | 24 | 564 | 175 | 739 | 7–9 h |
| Göteborg | Vienna | Göteborg Landvetter GOT → Monaco di Baviera MUC → Vienna VIE; collegamento verso il centro | 420 | 32 | 452 | 190 | 642 | 6–8 h |
| Göteborg | Budapest | Göteborg Landvetter GOT → Monaco di Baviera MUC → Budapest BUD; collegamento verso il centro | 460 | 40 | 500 | 140 | 640 | 6–8 h |
| Göteborg | Verona | Göteborg Landvetter GOT → Monaco di Baviera MUC → Verona Villafranca VRN; collegamento verso il centro | 540 | 32 | 572 | 150 | 722 | 6–8 h |
| Göteborg | Valencia | Göteborg Landvetter GOT → Monaco di Baviera MUC → Valencia VLC; collegamento verso il centro | 560 | 24 | 584 | 175 | 759 | 7–9 h |
| Malmö | Vienna | Malmö C → Copenaghen CPH (treno); Copenaghen CPH → Vienna VIE; collegamento verso il centro | 360 | 112 | 472 | 190 | 662 | 5–6 h |
| Malmö | Budapest | Malmö C → Copenaghen CPH (treno); Copenaghen CPH → Budapest BUD; collegamento verso il centro | 380 | 120 | 500 | 140 | 640 | 5–6 h |
| Malmö | Verona | Malmö C → Copenaghen CPH (treno); Copenaghen CPH → Monaco di Baviera MUC → Verona Villafranca VRN; collegamento verso il centro | 500 | 112 | 612 | 150 | 762 | 7–9 h |
| Malmö | Valencia | Malmö C → Copenaghen CPH (treno); Copenaghen CPH → Monaco di Baviera MUC → Valencia VLC; collegamento verso il centro | 480 | 104 | 584 | 175 | 759 | 7–9 h |

Esempi verificati dai test: Venezia–Verona 150 + 64 = **214**, risparmio 110 (42,3%); Malmö–Vienna 190 + 360 + 112 = **662**; Valencia–Lisbona 200 + 240 + 24 = **464**.
