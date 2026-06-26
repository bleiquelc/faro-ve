#!/usr/bin/env node
/**
 * Historia de Instagram (1080×1920) para Faro VE.
 * Fondo = el "mapa de esperanza" (campo oscuro con puntos de luz de colores, la
 * estética real del home). Encima: logo del faro + lo que ya está en vivo y lo
 * que viene. Franja inferior LIMPIA para el sticker de enlace de Instagram.
 * Render SVG → PNG vía sharp. Tono sereno (contexto humanitario).
 *
 *   node scripts/generate-story.mjs
 * Salidas en ~/Desktop: faro-ve-historia.png (1080×1920) + ...-preview.png (540×960)
 */
import { homedir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const OUT_FULL = join(homedir(), 'Desktop', 'faro-ve-historia.png');
const OUT_PREVIEW = join(homedir(), 'Desktop', 'faro-ve-historia-preview.png');
// También al repo → se hospeda en faro-ve.com/faro-ve-historia.png (descarga móvil).
const OUT_STATIC = join(process.cwd(), 'static', 'faro-ve-historia.png');

const LIVE = [
  'Mapa con 24.546 personas reportadas',
  'Reportar a alguien · «Estoy a salvo»',
  'Buscar por nombre',
  'Puntos de ayuda y refugios',
  'Avistamientos e información',
  'Federación con Cruz Roja / Person Finder'
];
const SOON = [
  'Asistencia con inteligencia artificial',
  'Mensajería segura entre familias',
  'Avistamientos visibles en el mapa',
  'App instalable, también sin internet',
  'Más fuentes y refugios verificados'
];

// PRNG seeded (reproducible).
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260624);

// Paleta de categorías (luces) — versiones algo más brillantes para leer sobre lo
// oscuro, mismos matices que el mapa (menor/médico/desaparecido/avistamiento/salvo/ayuda).
const CATS = [
  { c: '#b07cff', g: 'g0' }, // menor (morado)
  { c: '#ff8a4c', g: 'g1' }, // médico (naranja)
  { c: '#ff6b6b', g: 'g2' }, // desaparecido (rojo)
  { c: '#ffd54a', g: 'g3' }, // avistamiento (amarillo)
  { c: '#3ddc84', g: 'g4' }, // a salvo (verde)
  { c: '#35d0e6', g: 'g5' } // ayuda (cian)
];
const glowDefs = CATS.map(
  (k) =>
    `<radialGradient id="${k.g}" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${k.c}" stop-opacity="0.9"/>
      <stop offset="42%" stop-color="${k.c}" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="${k.c}" stop-opacity="0"/>
    </radialGradient>`
).join('\n');

function lightPoint(x, y, size, ci) {
  const k = CATS[ci];
  const core = Math.max(3.6, size * 0.28);
  return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
    <circle r="${size.toFixed(1)}" fill="url(#${k.g})"/>
    <circle r="${(core * 1.15).toFixed(1)}" fill="${k.c}"/>
    <circle r="${(core * 0.62).toFixed(1)}" fill="#ffffff" opacity="0.92"/>
  </g>`;
}

// Líneas de mapa: cuadrícula tenue (graticule) + trazos orgánicos (costa/vías).
let mapLines = '';
for (let gx = 84; gx < 1080; gx += 132)
  mapLines += `<line x1="${gx}" y1="0" x2="${gx}" y2="1920" stroke="#9fd6e6" stroke-width="1" opacity="0.06"/>`;
for (let gy = 130; gy < 1920; gy += 150)
  mapLines += `<line x1="0" y1="${gy}" x2="1080" y2="${gy}" stroke="#9fd6e6" stroke-width="1" opacity="0.06"/>`;
mapLines += `
  <path d="M -20 360 Q 300 300 540 380 T 1100 340" fill="none" stroke="#6fb6cf" stroke-width="2.5" opacity="0.13"/>
  <path d="M -20 905 Q 360 985 720 880 T 1120 945" fill="none" stroke="#6fb6cf" stroke-width="2.5" opacity="0.12"/>
  <path d="M -20 1460 Q 320 1385 600 1475 T 1120 1425" fill="none" stroke="#6fb6cf" stroke-width="2" opacity="0.10"/>
  <path d="M 250 -20 Q 300 520 215 1010 T 330 1940" fill="none" stroke="#6fb6cf" stroke-width="2" opacity="0.08"/>
  <path d="M 815 -20 Q 765 600 885 1100 T 795 1940" fill="none" stroke="#6fb6cf" stroke-width="2" opacity="0.08"/>`;

const points = [];
// Cúmulo central-norte (Caracas / La Guaira: donde se concentra la data real).
for (let i = 0; i < 30; i++) {
  const a = rnd() * Math.PI * 2;
  const r = Math.pow(rnd(), 0.7) * 250;
  const x = 540 + Math.cos(a) * r * 1.15;
  const y = 720 + Math.sin(a) * r * 0.95;
  points.push(lightPoint(x, y, 18 + rnd() * 30, Math.floor(rnd() * CATS.length)));
}
// Dispersión por todo el lienzo (el resto del país).
for (let i = 0; i < 42; i++) {
  const x = 40 + rnd() * 1000;
  const y = 120 + rnd() * 1740;
  points.push(lightPoint(x, y, 13 + rnd() * 24, Math.floor(rnd() * CATS.length)));
}

// Filas de la lista. Marca = check (vivo) o anillo (pronto).
const TEXT_X = 210;
function row(baselineY, text, kind) {
  const cy = baselineY - 11;
  const mark =
    kind === 'live'
      ? `<g transform="translate(168,${cy})"><circle r="17" fill="#2BB673"/><path d="M -7 0 L -2 6 L 8 -7" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></g>`
      : `<g transform="translate(168,${cy})"><circle r="15" fill="none" stroke="#F2C14E" stroke-width="3"/></g>`;
  const color = kind === 'live' ? '#f1f8fb' : '#d3e2e9';
  return `${mark}<text x="${TEXT_X}" y="${baselineY}" font-size="35" fill="${color}">${text}</text>`;
}

// Faro (paths de static/faro-icon.svg) sin la tarjeta, escalado/centrado arriba.
const S = 0.68;
const TX = (540 - 256 * S).toFixed(1);
const TY = (300 - 158 * S).toFixed(1);
const lighthouse = `<g transform="translate(${TX},${TY}) scale(${S})">
    <path d="M256 158 L150 92 L182 140 Z" fill="url(#ray)"/>
    <path d="M256 158 L362 92 L330 140 Z" fill="url(#ray)"/>
    <circle cx="256" cy="158" r="21" fill="#FFE39C"/>
    <circle cx="256" cy="158" r="10" fill="#FFF7E0"/>
    <path d="M210 180 H302 L294 206 H218 Z" fill="#ffffff"/>
    <path d="M218 206 H294 L312 392 H200 Z" fill="#ffffff"/>
    <path d="M214 300 H298 L303 330 H209 Z" fill="#52A9C9"/>
    <path d="M188 392 H324 L338 424 H174 Z" fill="#ffffff"/>
    <rect x="150" y="424" width="212" height="14" rx="7" fill="#ffffff"/>
  </g>`;

const liveRows = LIVE.map((t, i) => row(770 + i * 58, t, 'live')).join('\n');
const soonRows = SOON.map((t, i) => row(1208 + i * 58, t, 'soon')).join('\n');

const svg = `<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0" stop-color="#0a3346"/>
      <stop offset="0.5" stop-color="#072433"/>
      <stop offset="1" stop-color="#04141d"/>
    </linearGradient>
    <radialGradient id="lampGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#FFF7D6" stop-opacity="0.95"/>
      <stop offset="50%" stop-color="#FFE39C" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#FFE39C" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFF1C2" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#FFF1C2" stop-opacity="0"/>
    </linearGradient>
    <!-- Scrim: oscurece la banda central (texto) y deja respirar el mapa arriba/abajo. -->
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#04141d" stop-opacity="0.22"/>
      <stop offset="0.30" stop-color="#04141d" stop-opacity="0.40"/>
      <stop offset="0.62" stop-color="#04141d" stop-opacity="0.50"/>
      <stop offset="0.82" stop-color="#04141d" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#04141d" stop-opacity="0.16"/>
    </linearGradient>
    ${glowDefs}
    <filter id="ds" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#021019" flood-opacity="0.96"/>
    </filter>
  </defs>

  <rect width="1080" height="1920" fill="url(#bg)"/>
  ${mapLines}
  ${points.join('\n')}
  <rect width="1080" height="1920" fill="url(#scrim)"/>

  <circle cx="540" cy="300" r="160" fill="url(#lampGlow)"/>
  ${lighthouse}

  <g font-family="Helvetica, Arial, sans-serif" text-anchor="middle" filter="url(#ds)">
    <text x="540" y="540" font-size="84" font-weight="700" fill="#ffffff">Faro VE</text>
    <text x="540" y="588" font-size="35" font-weight="600" fill="#A8E0F0">Mapa de Esperanza · Venezuela</text>
    <text x="540" y="625" font-size="24" fill="#9fc3d1">Tras el terremoto del 24-jun-2026</text>
  </g>

  <line x1="160" y1="660" x2="920" y2="660" stroke="#37657a" stroke-width="2" opacity="0.8"/>

  <g font-family="Helvetica, Arial, sans-serif" filter="url(#ds)">
    <g transform="translate(168,716)"><circle r="9" fill="#2BB673"/></g>
    <text x="200" y="727" font-size="42" font-weight="700" fill="#ffffff">Ya disponible</text>
    ${liveRows}
    <g transform="translate(168,1148)"><circle r="8.5" fill="none" stroke="#F2C14E" stroke-width="3"/></g>
    <text x="200" y="1159" font-size="42" font-weight="700" fill="#ffffff">En las próximas horas</text>
    ${soonRows}
  </g>

  <g font-family="Helvetica, Arial, sans-serif" text-anchor="middle" filter="url(#ds)">
    <text x="540" y="1532" font-size="48" font-weight="700" fill="#ffffff">faro-ve.com</text>
    <text x="540" y="1576" font-size="26" fill="#9fc3d1">Gratuito · Sin fines de lucro · Privacidad por diseño</text>
  </g>
  <!-- (Franja inferior y ~1600-1880 a propósito limpia: para el sticker de enlace de IG.) -->
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(OUT_FULL);
await sharp(Buffer.from(svg)).png().toFile(OUT_STATIC);
await sharp(Buffer.from(svg)).resize(540, 960).png().toFile(OUT_PREVIEW);
const m = await sharp(OUT_FULL).metadata();
console.log(`✅ historia: ${m.width}×${m.height}`);
console.log(`   full:    ${OUT_FULL}`);
console.log(`   static:  ${OUT_STATIC}`);
console.log(`   preview: ${OUT_PREVIEW}`);
