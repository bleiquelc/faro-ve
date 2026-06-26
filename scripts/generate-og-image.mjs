#!/usr/bin/env node
/**
 * Genera static/og-image.png (1200×630) — la tarjeta de previsualización al
 * compartir Faro VE (WhatsApp, X, etc.). Reusa la marca del faro. Sin texto
 * dependiente de fuentes exóticas (usa sans-serif del sistema).
 *
 *   node scripts/generate-og-image.mjs
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'static', 'og-image.png');

// Faro (paths del static/faro-icon.svg) sin la tarjeta de fondo, reposicionado.
const lighthouse = `
  <g transform="translate(150,150) scale(0.92)">
    <circle cx="256" cy="158" r="120" fill="url(#lampGlow)"/>
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

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#0B4F6C"/>
      <stop offset="1" stop-color="#06202b"/>
    </linearGradient>
    <radialGradient id="lampGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#FFF7D6" stop-opacity="0.95"/>
      <stop offset="50%" stop-color="#FFE39C" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#FFE39C" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFF1C2" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#FFF1C2" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  ${lighthouse}

  <g font-family="Helvetica, Arial, sans-serif">
    <text x="610" y="248" font-size="92" font-weight="700" fill="#ffffff">Faro VE</text>
    <text x="612" y="314" font-size="44" font-weight="600" fill="#A8E0F0">Mapa de Esperanza</text>
    <rect x="612" y="344" width="420" height="3" rx="1.5" fill="#52A9C9"/>
    <text x="612" y="402" font-size="31" fill="#e6f0f4">Reporta y busca personas tras el</text>
    <text x="612" y="443" font-size="31" fill="#e6f0f4">terremoto en Venezuela · 2026.</text>
    <text x="612" y="518" font-size="28" font-weight="600" fill="#9fc7d6">faro-ve.com</text>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(OUT);
const meta = await sharp(OUT).metadata();
console.log(`✅ og-image.png generado: ${meta.width}×${meta.height}, ${OUT}`);
