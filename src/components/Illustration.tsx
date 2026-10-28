// Illustrazioni editoriali originali in SVG (nessuna immagine esterna, nessun hotlink).
// Sono il fallback documentato in ASSETS.md: se in src/data/media.ts viene registrata una foto
// con licenza adeguata, viene mostrata la foto e l'illustrazione resta come ripiego in caso di errore.
import { useState, type ReactElement } from 'react';
import type { DestinationId } from '../data/catalog';
import { PHOTOS } from '../data/media';

const C = {
  ink: '#172b3a', inkSoft: '#2c4354', petrol: '#176b63', petrolDark: '#0f524c', terracotta: '#d77a60',
  brick: '#c4795c', brickDark: '#99563f', sand: '#e9e1d0', ivory: '#f7f5ef', gold: '#c9a34e', sea: '#6fa7a0', seaLight: '#a7cbc5',
};

function Sky({ id, top, bottom }: { id: string; top: string; bottom: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill={`url(#sky-${id})`} />
    </>
  );
}

function Vienna({ uid }: { uid: string }) {
  const spokes = Array.from({ length: 16 }, (_, i) => (i * Math.PI) / 8);
  return (
    <>
      <Sky id={uid} top="#eadccb" bottom="#f7f0e5" />
      <circle cx="306" cy="74" r="30" fill={C.terracotta} opacity="0.85" />
      <g stroke={C.inkSoft} strokeWidth="2.2" fill="none">
        <circle cx="112" cy="118" r="70" />
        <circle cx="112" cy="118" r="62" strokeWidth="1" opacity="0.6" />
        {spokes.map((a, i) => <line key={i} x1="112" y1="118" x2={112 + 70 * Math.cos(a)} y2={118 + 70 * Math.sin(a)} strokeWidth="1" opacity="0.7" />)}
        <line x1="112" y1="118" x2="76" y2="218" strokeWidth="3" />
        <line x1="112" y1="118" x2="148" y2="218" strokeWidth="3" />
      </g>
      {spokes.filter((_, i) => i % 2 === 0).map((a, i) => (
        <rect key={i} x={112 + 70 * Math.cos(a) - 6} y={118 + 70 * Math.sin(a) - 4} width="12" height="9" rx="2" fill={C.terracotta} />
      ))}
      <circle cx="112" cy="118" r="7" fill={C.inkSoft} />
      <g fill={C.petrolDark}>
        <rect x="238" y="108" width="26" height="110" />
        <polygon points="236,110 251,26 266,110" />
        <rect x="249" y="18" width="4" height="12" />
      </g>
      <polygon points="264,160 304,126 344,160" fill={C.terracotta} />
      <g stroke={C.ivory} strokeWidth="1.4" opacity="0.7">
        <line x1="276" y1="150" x2="332" y2="150" />
        <line x1="288" y1="140" x2="320" y2="140" />
      </g>
      <rect x="264" y="160" width="80" height="58" fill={C.petrol} />
      <g fill={C.petrol} opacity="0.85">
        <rect x="0" y="176" width="40" height="42" />
        <rect x="160" y="168" width="34" height="50" />
        <path d="M194 218 V182 a18 18 0 0 1 36 0 V218 Z" />
        <rect x="344" y="172" width="56" height="46" />
      </g>
      <g fill={C.ivory} opacity="0.75">
        {[172, 182].map((x) => <rect key={x} x={x} y="180" width="5" height="10" />)}
        {[352, 364, 376, 388].map((x) => <rect key={x} x={x} y="184" width="5" height="10" />)}
        {[274, 288, 302, 316, 330].map((x) => <rect key={x} x={x} y="172" width="5" height="14" rx="2.5" />)}
      </g>
      <rect y="216" width="400" height="44" fill={C.sand} />
      <rect y="216" width="400" height="3" fill={C.inkSoft} opacity="0.15" />
    </>
  );
}

function Budapest({ uid }: { uid: string }) {
  const spires = [130, 146, 162, 178, 194, 256, 272, 288, 304, 320];
  return (
    <>
      <Sky id={uid} top="#e3e6df" bottom="#f5efe4" />
      <circle cx="82" cy="70" r="28" fill={C.gold} opacity="0.75" />
      <g fill={C.inkSoft}>
        <rect x="116" y="140" width="220" height="52" />
        <rect x="200" y="112" width="52" height="30" />
        <path d="M204 114 a22 22 0 0 1 44 0 Z" />
        <rect x="224" y="58" width="4" height="40" />
        <polygon points="218,96 226,62 234,96" />
        {spires.map((x) => <polygon key={x} points={`${x - 5},142 ${x},112 ${x + 5},142`} />)}
        <rect x="112" y="128" width="12" height="16" />
        <rect x="328" y="128" width="12" height="16" />
      </g>
      <g fill={C.ivory} opacity="0.55">
        {Array.from({ length: 18 }, (_, i) => <rect key={i} x={124 + i * 11.5} y="154" width="4" height="22" rx="2" />)}
      </g>
      <g stroke={C.petrolDark} strokeWidth="2" fill="none" opacity="0.75">
        <path d="M0 150 Q40 182 80 150" />
        <line x1="10" y1="140" x2="10" y2="192" strokeWidth="5" />
        <line x1="70" y1="140" x2="70" y2="192" strokeWidth="5" />
        <line x1="0" y1="178" x2="96" y2="178" strokeWidth="3" />
      </g>
      <rect y="192" width="400" height="68" fill={C.sea} />
      <g opacity="0.22" transform="translate(0 384) scale(1 -1)">
        <rect x="116" y="140" width="220" height="52" fill={C.ink} />
        <rect x="200" y="120" width="52" height="22" fill={C.ink} />
      </g>
      <g stroke={C.seaLight} strokeWidth="2" strokeLinecap="round" opacity="0.8">
        <line x1="30" y1="214" x2="90" y2="214" />
        <line x1="150" y1="232" x2="230" y2="232" />
        <line x1="270" y1="210" x2="350" y2="210" />
        <line x1="60" y1="246" x2="120" y2="246" />
      </g>
    </>
  );
}

function Verona({ uid }: { uid: string }) {
  return (
    <>
      <Sky id={uid} top="#f0dac5" bottom="#f8eee2" />
      <circle cx="96" cy="66" r="28" fill={C.terracotta} opacity="0.75" />
      <g fill={C.brickDark}>
        <rect x="302" y="58" width="22" height="122" />
        <rect x="298" y="50" width="30" height="10" />
        <path d="M304 50 a9 9 0 0 1 18 0 Z" />
      </g>
      <rect x="306" y="72" width="4" height="10" fill={C.ivory} opacity="0.6" />
      <rect x="316" y="72" width="4" height="10" fill={C.ivory} opacity="0.6" />
      <rect x="30" y="118" width="258" height="70" rx="6" fill={C.brick} />
      <g fill={C.brickDark}>
        {Array.from({ length: 12 }, (_, i) => <path key={`a${i}`} d={`M${40 + i * 20.5} 148 v-16 a7 7 0 0 1 14 0 v16 Z`} />)}
        {Array.from({ length: 12 }, (_, i) => <path key={`b${i}`} d={`M${40 + i * 20.5} 182 v-18 a7 7 0 0 1 14 0 v18 Z`} />)}
      </g>
      <rect x="30" y="152" width="258" height="4" fill={C.ivory} opacity="0.35" />
      <g fill="#1f4d45">
        <ellipse cx="350" cy="140" rx="11" ry="50" />
        <ellipse cx="374" cy="152" rx="9" ry="38" />
        <ellipse cx="14" cy="150" rx="10" ry="40" />
      </g>
      <rect y="188" width="400" height="72" fill={C.sea} />
      <g fill={C.brick}>
        <path d="M150 210 h120 v12 h-6 a14 14 0 0 0 -28 0 h-12 a14 14 0 0 0 -28 0 h-12 a14 14 0 0 0 -28 0 h-6 Z" />
      </g>
      <g stroke={C.seaLight} strokeWidth="2" strokeLinecap="round" opacity="0.8">
        <line x1="20" y1="238" x2="100" y2="238" />
        <line x1="300" y1="232" x2="370" y2="232" />
      </g>
    </>
  );
}

function Valencia({ uid }: { uid: string }) {
  return (
    <>
      <Sky id={uid} top="#d9e7e3" bottom="#f5eee0" />
      <circle cx="318" cy="66" r="28" fill={C.terracotta} opacity="0.8" />
      <path d="M96 186 Q200 82 304 186 Z" fill="#ffffff" stroke={C.inkSoft} strokeWidth="2" />
      <g stroke={C.inkSoft} strokeWidth="1" opacity="0.5">
        {Array.from({ length: 9 }, (_, i) => <line key={i} x1={200} y1={186} x2={112 + i * 22} y2={186 - Math.sin(((i + 1) / 10) * Math.PI) * 74} />)}
      </g>
      <ellipse cx="200" cy="166" rx="46" ry="18" fill={C.petrol} opacity="0.9" />
      <ellipse cx="200" cy="166" rx="18" ry="10" fill={C.ink} />
      <path d="M300 186 C 316 120 352 104 392 98 C 368 118 352 150 350 186 Z" fill="#ffffff" stroke={C.inkSoft} strokeWidth="2" />
      <rect y="186" width="400" height="74" fill={C.sea} />
      <path d="M96 188 Q200 270 304 188 Z" fill="#ffffff" opacity="0.28" />
      <g stroke={C.petrolDark} strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M44 188 C 46 150 40 120 50 96" />
      </g>
      <g stroke={C.petrol} strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M50 96 C 30 92 18 100 8 112" />
        <path d="M50 96 C 70 88 84 94 96 106" />
        <path d="M50 96 C 44 78 30 72 18 72" />
        <path d="M50 96 C 60 76 76 72 90 76" />
        <path d="M50 96 C 52 112 40 124 34 132" />
      </g>
    </>
  );
}

function Lisbon({ uid }: { uid: string }) {
  const houses = [
    [20, 130, '#f3e7d3'], [52, 122, '#e8d2b0'], [84, 116, '#f7f0e4'], [116, 112, '#dfe8e4'], [148, 110, '#f3e1cf'],
    [180, 112, '#efe2c8'], [212, 118, '#f7f0e4'], [244, 126, '#e6d5bd'], [276, 134, '#dfe8e4'],
  ] as const;
  return (
    <>
      <Sky id={uid} top="#f2dfcf" bottom="#f8f0e6" />
      <circle cx="334" cy="64" r="26" fill={C.terracotta} opacity="0.8" />
      <g stroke="#b4553c" opacity="0.65" fill="none">
        <line x1="250" y1="60" x2="250" y2="120" strokeWidth="5" />
        <line x1="370" y1="60" x2="370" y2="120" strokeWidth="5" />
        <path d="M230 112 Q250 60 250 60 Q310 108 370 60 Q390 100 400 108" strokeWidth="1.8" />
        <line x1="220" y1="112" x2="400" y2="112" strokeWidth="3" />
      </g>
      <path d="M0 150 C 80 104 200 98 320 140 L400 160 L400 260 L0 260 Z" fill="#e4dccb" />
      {houses.map(([x, y, fill], i) => (
        <g key={i}>
          <rect x={x} y={y} width="28" height="34" fill={fill} stroke={C.inkSoft} strokeOpacity="0.12" />
          <polygon points={`${x - 2},${y} ${x + 14},${y - 10} ${x + 30},${y}`} fill={C.terracotta} />
          <rect x={x + 6} y={y + 10} width="5" height="8" fill={C.inkSoft} opacity="0.35" />
          <rect x={x + 17} y={y + 10} width="5" height="8" fill={C.inkSoft} opacity="0.35" />
        </g>
      ))}
      <rect y="214" width="400" height="46" fill="#d8cfbd" />
      <g stroke={C.inkSoft} strokeWidth="1.5" opacity="0.4">
        <line x1="0" y1="236" x2="400" y2="236" />
        <line x1="0" y1="242" x2="400" y2="242" />
      </g>
      <line x1="252" y1="176" x2="284" y2="138" stroke={C.inkSoft} strokeWidth="2" />
      <rect x="196" y="176" width="132" height="52" rx="10" fill={C.gold} />
      <rect x="196" y="208" width="132" height="8" fill="#ffffff" opacity="0.7" />
      {[206, 232, 258, 284, 306].map((x) => <rect key={x} x={x} y="184" width="18" height="18" rx="3" fill={C.inkSoft} opacity="0.75" />)}
      <circle cx="222" cy="230" r="7" fill={C.ink} />
      <circle cx="302" cy="230" r="7" fill={C.ink} />
    </>
  );
}

function Room({ uid, accent }: { uid: string; accent: string }) {
  return (
    <>
      <rect width="400" height="260" fill="#efe8da" />
      <rect x="236" y="34" width="122" height="110" rx="4" fill="#ffffff" />
      <defs>
        <linearGradient id={`win-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dbe8e4" />
          <stop offset="1" stopColor="#f6eee2" />
        </linearGradient>
      </defs>
      <rect x="244" y="42" width="106" height="94" fill={`url(#win-${uid})`} />
      <circle cx="324" cy="70" r="12" fill={accent} opacity="0.7" />
      <path d="M244 136 v-26 h18 v-14 h16 v22 h20 v-12 h22 v30 Z" fill={C.inkSoft} opacity="0.35" />
      <line x1="297" y1="42" x2="297" y2="136" stroke="#ffffff" strokeWidth="4" />
      <rect y="196" width="400" height="64" fill="#d9cfbc" />
      <rect x="40" y="96" width="176" height="62" rx="10" fill={C.inkSoft} />
      <rect x="30" y="150" width="200" height="56" rx="8" fill="#ffffff" />
      <rect x="30" y="170" width="200" height="40" rx="8" fill={accent} />
      <rect x="30" y="170" width="200" height="8" fill="#ffffff" opacity="0.35" />
      <rect x="52" y="132" width="66" height="28" rx="12" fill="#fbfaf7" stroke="#e2dccf" />
      <rect x="128" y="132" width="66" height="28" rx="12" fill="#fbfaf7" stroke="#e2dccf" />
      <rect x="250" y="168" width="44" height="40" rx="4" fill={C.brickDark} opacity="0.8" />
      <rect x="266" y="138" width="4" height="30" fill={C.inkSoft} />
      <path d="M252 140 h36 l-8 -22 h-20 Z" fill={C.terracotta} opacity="0.9" />
    </>
  );
}

const SCENES: Record<DestinationId, (p: { uid: string }) => ReactElement> = { vienna: Vienna, budapest: Budapest, verona: Verona, valencia: Valencia, lisbon: Lisbon };
const ACCENTS: Record<DestinationId, string> = { vienna: C.petrol, budapest: '#3b6a8a', verona: C.brick, valencia: '#4f8f89', lisbon: C.terracotta };

let counter = 0;

export function DestinationArt({ id, label, kind = 'city', className = '' }: { id: DestinationId; label: string; kind?: 'city' | 'room'; className?: string }) {
  const [uid] = useState(() => `${id}-${kind}-${++counter}`);
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = PHOTOS[id]?.[kind];
  if (photo && !photoFailed) {
    return <img src={photo.src} alt={label} loading="lazy" decoding="async" onError={() => setPhotoFailed(true)} className={`h-full w-full object-cover ${className}`} />;
  }
  const Scene = SCENES[id];
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" role="img" aria-label={label} className={`block h-full w-full ${className}`}>
      {kind === 'room' ? <Room uid={uid} accent={ACCENTS[id]} /> : <Scene uid={uid} />}
    </svg>
  );
}
