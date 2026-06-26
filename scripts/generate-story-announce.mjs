#!/usr/bin/env node
/**
 * Historia de Instagram (1080×1920) — ANUNCIO: registros habilitados.
 * Fondo = "mapa de esperanza" (campo oscuro con luces de color). Encima: faro +
 * mensaje CORTO: disculpa por la pausa + ya se pueden enviar registros. Tono
 * sereno (contexto humanitario). Franja inferior limpia para el sticker de enlace.
 *
 *   node scripts/generate-story-announce.mjs
 */
import { homedir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const OUT_FULL = join(homedir(), 'Desktop', 'faro-ve-anuncio.png');
const OUT_PREVIEW = join(homedir(), 'Desktop', 'faro-ve-anuncio-preview.png');
const OUT_STATIC = join(process.cwd(), 'static', 'faro-ve-anuncio.png');

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
const rnd = mulberry32(20260626);

const CATS = [
  { c: '#b07cff', g: 'g0' },
  { c: '#ff8a4c', g: 'g1' },
  { c: '#ff6b6b', g: 'g2' },
  { c: '#ffd54a', g: 'g3' },
  { c: '#3ddc84', g: 'g4' },
  { c: '#35d0e6', g: 'g5' }
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

let mapLines = '';
for (let gx = 84; gx < 1080; gx += 132)
  mapLines += `<line x1="${gx}" y1="0" x2="${gx}" y2="1920" stroke="#9fd6e6" stroke-width="1" opacity="0.06"/>`;
for (let gy = 130; gy < 1920; gy += 150)
  mapLines += `<line x1="0" y1="${gy}" x2="1080" y2="${gy}" stroke="#9fd6e6" stroke-width="1" opacity="0.06"/>`;
mapLines += `
  <path d="M -20 360 Q 300 300 540 380 T 1100 340" fill="none" stroke="#6fb6cf" stroke-width="2.5" opacity="0.13"/>
  <path d="M -20 905 Q 360 985 720 880 T 1120 945" fill="none" stroke="#6fb6cf" stroke-width="2.5" opacity="0.12"/>
  <path d="M -20 1460 Q 320 1385 600 1475 T 1120 1425" fill="none" stroke="#6fb6cf" stroke-width="2" opacity="0.10"/>`;

const points = [];
for (let i = 0; i < 26; i++) {
  const a = rnd() * Math.PI * 2;
  const r = Math.pow(rnd(), 0.7) * 250;
  points.push(lightPoint(540 + Math.cos(a) * r * 1.15, 720 + Math.sin(a) * r * 0.95, 18 + rnd() * 30, Math.floor(rnd() * CATS.length)));
}
for (let i = 0; i < 40; i++) {
  points.push(lightPoint(40 + rnd() * 1000, 120 + rnd() * 1740, 13 + rnd() * 24, Math.floor(rnd() * CATS.length)));
}

const S = 0.62;
const TX = (540 - 256 * S).toFixed(1);
const TY = (250 - 158 * S).toFixed(1);
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
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#04141d" stop-opacity="0.18"/>
      <stop offset="0.34" stop-color="#04141d" stop-opacity="0.46"/>
      <stop offset="0.66" stop-color="#04141d" stop-opacity="0.52"/>
      <stop offset="0.85" stop-color="#04141d" stop-opacity="0.32"/>
      <stop offset="1" stop-color="#04141d" stop-opacity="0.14"/>
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

  <circle cx="540" cy="250" r="150" fill="url(#lampGlow)"/>
  ${lighthouse}

  <g font-family="Helvetica, Arial, sans-serif" text-anchor="middle" filter="url(#ds)">
    <text x="540" y="470" font-size="60" font-weight="700" fill="#ffffff">Faro VE</text>
    <text x="540" y="514" font-size="30" font-weight="600" fill="#A8E0F0">Mapa de Esperanza · Venezuela</text>

    <!-- Check + titular -->
    <g transform="translate(540,650)">
      <circle r="50" fill="#2BB673"/>
      <path d="M -22 2 L -7 18 L 24 -18" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <text x="540" y="800" font-size="68" font-weight="700" fill="#ffffff">Registros habilitados</text>

    <!-- Disculpa + mensaje corto -->
    <text x="540" y="900" font-size="38" fill="#e9f3f7">Disculpa la breve interrupción de hoy.</text>
    <text x="540" y="975" font-size="38" fill="#e9f3f7">Los formularios ya funcionan:</text>
    <text x="540" y="1045" font-size="38" font-weight="600" fill="#ffffff">ya puedes reportar a quien buscas</text>
    <text x="540" y="1100" font-size="38" font-weight="600" fill="#ffffff">o avisar que estás a salvo.</text>

    <text x="540" y="1260" font-size="30" fill="#bfe0ec">Cada reporte suma más ojos en la búsqueda.</text>
  </g>

  <g font-family="Helvetica, Arial, sans-serif" text-anchor="middle" filter="url(#ds)">
    <text x="540" y="1520" font-size="52" font-weight="700" fill="#ffffff">faro-ve.com</text>
    <text x="540" y="1564" font-size="26" fill="#9fc3d1">Gratuito · Sin fines de lucro · Privacidad por diseño</text>
  </g>
  <!-- Franja inferior limpia: para el sticker de enlace de IG. -->
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(OUT_FULL);
await sharp(Buffer.from(svg)).png().toFile(OUT_STATIC);
await sharp(Buffer.from(svg)).resize(540, 960).png().toFile(OUT_PREVIEW);
const m = await sharp(OUT_FULL).metadata();
console.log(`✅ anuncio: ${m.width}×${m.height}`);
console.log(`   full:    ${OUT_FULL}`);
console.log(`   static:  ${OUT_STATIC}`);
console.log(`   preview: ${OUT_PREVIEW}`);
