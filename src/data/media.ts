// Registro delle fotografie con licenza adeguata (vedi ASSETS.md). Finché è vuoto,
// l'app usa le illustrazioni SVG originali di src/components/Illustration.tsx.
// Esempio:
//   vienna: { city: { src: '/media/vienna.webp', credit: 'Nome Autore', license: 'CC BY-SA 4.0', sourceUrl: 'https://…' } },
import type { DestinationId } from './catalog';

export interface Photo {
  src: string;
  credit: string;
  license: string;
  sourceUrl: string;
}

export const PHOTOS: Partial<Record<DestinationId, { city?: Photo; room?: Photo }>> = {};
