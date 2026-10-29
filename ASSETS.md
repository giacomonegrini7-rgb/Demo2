# Asset: provenienza e licenze

| Asset | Provenienza | Licenza |
|---|---|---|
| Illustrazioni delle città (Vienna, Budapest, Verona, Valencia, Lisbona) e della camera | Originali, disegnate in SVG per questo progetto (`src/components/Illustration.tsx`) | Parte del progetto |
| Marchio «Travel Recovery» e favicon | Originali (`src/components/Layout.tsx`, `public/favicon.svg`) | Parte del progetto |
| Font Fraunces (titoli) | Fontsource `@fontsource-variable/fraunces`, incluso nel bundle (nessuna richiesta a Google Fonts) | SIL Open Font License 1.1 |
| Font Inter (testi, prezzi, controlli) | Fontsource `@fontsource-variable/inter`, incluso nel bundle | SIL Open Font License 1.1 |
| Icone | `lucide-react` | ISC |

## Perché non ci sono fotografie

L'ambiente in cui è stato sviluppato il progetto blocca i download da Wikimedia Commons e Unsplash. Invece di usare hotlink non verificati o immagini casuali, la demo usa illustrazioni editoriali originali. Non c'è nessuna immagine rotta: è il fallback previsto dalla specifica. Le illustrazioni sono accompagnate dalla dicitura «Alloggio fittizio · immagini illustrative». Non rappresentano hotel reali.

## Come aggiungere foto con licenza adeguata

1. Scegliete immagini con licenza che ne permetta l'uso, per esempio da Wikimedia Commons (CC BY / CC BY-SA, con attribuzione) o da Unsplash/Pexels (licenze proprie). Per gli alloggi usate solo foto di camere generiche: non attribuite foto di hotel reali agli alloggi fittizi.
2. Ottimizzatele: WebP, circa 1600 px di larghezza, sotto i 250 KB. Mettetele in `public/media/`, per esempio `public/media/vienna.webp`.
3. Registratele in `src/data/media.ts`:
   ```ts
   export const PHOTOS = {
     vienna: { city: { src: '/media/vienna.webp', credit: 'Nome Autore', license: 'CC BY-SA 4.0', sourceUrl: 'https://commons.wikimedia.org/…' } },
   };
   ```
4. Aggiungete qui una riga con autore, licenza e link. Le attribuzioni compaiono automaticamente in fondo alla pagina `/privacy`. Se una foto non si carica, l'app torna automaticamente all'illustrazione.
