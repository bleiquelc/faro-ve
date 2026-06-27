/**
 * Genera los elementos del REEL en PNG TRANSPARENTE (para superponer en CapCut),
 * con el branding real de la app. Salida: ~/Desktop/faro-ve-reel-elementos/
 */
import { chromium } from '@playwright/test';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(os.homedir(), 'Desktop', 'faro-ve-reel-elementos');
fs.mkdirSync(OUT, { recursive: true });

const FARO = '#0B4F6C';
const WARM = '#FFE39C';

// ── SVGs de marca (mismos que la app) ───────────────────────────────────────
const lighthouse = (size, stroke) => `
<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="lg" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#FFF7D6" stop-opacity=".95"/><stop offset="45%" stop-color="#FFE9A8" stop-opacity=".5"/><stop offset="100%" stop-color="#FFE9A8" stop-opacity="0"/></radialGradient></defs>
  <circle cx="32" cy="16" r="15" fill="url(#lg)"/>
  <circle cx="32" cy="16" r="4" fill="#FFE9A8" stroke="#FFF7D6" stroke-width="1"/>
  <path d="M26.5 20.5 h11 l-1 3.5 h-9 z" fill="${stroke}"/>
  <path d="M27.2 24 h9.6 l2.6 23 h-14.8 z" fill="${stroke}"/>
  <path d="M25.9 33 h12.2 l0.5 5 h-13.2 z" fill="${stroke === '#ffffff' ? 'rgba(255,255,255,.55)' : '#52A9C9'}"/>
  <path d="M22.5 47 h19 l2.2 5.5 h-23.4 z" fill="${stroke}"/>
  <line x1="16" y1="52.5" x2="48" y2="52.5" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round"/>
</svg>`;

const beacon = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="bg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FFF7D6" stop-opacity=".95"/><stop offset="55%" stop-color="#FFE9A8" stop-opacity=".45"/><stop offset="100%" stop-color="#FFE9A8" stop-opacity="0"/></radialGradient></defs>
  <circle cx="24" cy="24" r="22" fill="url(#bg)"/>
  <circle cx="24" cy="24" r="15" fill="#0B4F6C"/><circle cx="24" cy="24" r="15" fill="none" stroke="#FFE9A8" stroke-width="1.4"/>
  <rect x="21" y="13.5" width="6" height="21" rx="2.4" fill="#fff"/><rect x="13.5" y="21" width="21" height="6" rx="2.4" fill="#fff"/>
</svg>`;

const icon = (paths, size, color) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const IC = {
  refresh: '<path d="M4 12 A8 8 0 0 1 17.8 6.5"/><path d="M18.4 3 V6.8 H14.6"/><path d="M20 12 A8 8 0 0 1 6.2 17.5"/><path d="M5.6 21 V17.2 H9.4"/>',
  map: '<path d="M9 4 L3.6 6.2 V19.8 L9 17.6 L15 19.8 L20.4 17.6 V4 L15 6.2 L9 4 Z"/><path d="M9 4 V17.6 M15 6.2 V19.8"/><circle cx="12.8" cy="11" r="1.5" fill="#FFE39C" stroke="none"/>',
  phone: '<path d="M6.8 3.6 H9.2 L10.7 7.4 L8.6 8.8 A10.4 10.4 0 0 0 13.4 13.6 L14.8 11.5 L18.6 13 V15.4 A1.8 1.8 0 0 1 16.6 17.1 A14 14 0 0 1 5 5.5 A1.8 1.8 0 0 1 6.8 3.6 Z"/>',
  download: '<path d="M12 3.5 V14"/><path d="M8 10.2 L12 14.2 L16 10.2"/><path d="M5 16.5 V18.5 A1.5 1.5 0 0 0 6.5 20 H17.5 A1.5 1.5 0 0 0 19 18.5 V16.5"/>'
};

const FONT = `font-family:'Inter',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
const SHADOW = 'filter:drop-shadow(0 3px 10px rgba(0,0,0,.45))';

// ── Elementos transparentes (cada uno se recorta a su tamaño) ───────────────
const elements = [
  {
    name: 'boton-ver-mapa',
    html: `<div style="${FONT};display:inline-flex;align-items:center;gap:16px;background:${FARO};color:#fff;border-radius:24px;padding:22px 40px;font-size:36px;font-weight:800;box-shadow:0 10px 30px rgba(11,79,108,.45)">
      ${icon(IC.map, 40, '#fff')}<span>Ver el mapa</span><span style="opacity:.85">→</span></div>`
  },
  {
    name: 'boton-actualizar-simbolo',
    html: `<div style="width:130px;height:130px;border-radius:50%;background:${FARO};display:flex;align-items:center;justify-content:center;box-shadow:0 10px 28px rgba(11,79,108,.5)">${icon(IC.refresh, 62, '#fff')}</div>`
  },
  {
    name: 'boton-actualizar-con-texto',
    html: `<div style="${FONT};display:inline-flex;align-items:center;gap:16px;background:${FARO};color:#fff;border-radius:999px;padding:18px 34px 18px 22px;font-size:32px;font-weight:700;box-shadow:0 8px 24px rgba(11,79,108,.45)">
      <span style="display:flex">${icon(IC.refresh, 44, '#fff')}</span><span>Actualizar</span></div>`
  },
  {
    name: 'boton-auxilio',
    html: `<div style="${FONT};display:inline-flex;flex-direction:column;align-items:center;gap:4px;background:rgba(11,79,108,.96);border:2px solid rgba(255,255,255,.28);border-radius:26px;padding:16px 20px;box-shadow:0 12px 30px rgba(0,0,0,.45)">
      ${beacon(64)}<span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:.02em">Auxilio</span></div>`
  },
  {
    name: 'boton-descargar-guia',
    html: `<div style="${FONT};display:inline-flex;align-items:center;gap:18px;background:#fff;border-radius:28px;padding:22px 28px;box-shadow:0 14px 36px rgba(0,0,0,.28);max-width:760px">
      <span style="flex:none;width:66px;height:66px;border-radius:18px;background:${FARO};display:flex;align-items:center;justify-content:center">${icon(IC.download, 34, '#fff')}</span>
      <span style="min-width:0"><span style="display:block;font-size:30px;font-weight:800;color:#1d2b33">Descargar o compartir la guía (PDF)</span>
      <span style="display:block;font-size:21px;color:#5b6b73;margin-top:4px">Las 34 guías de primeros auxilios, con su fuente oficial</span></span></div>`
  },
  {
    name: 'boton-contactos',
    html: `<div style="${FONT};display:inline-flex;align-items:center;gap:18px;background:#fff;border-radius:28px;padding:22px 30px;box-shadow:0 14px 36px rgba(0,0,0,.28)">
      <span style="flex:none;width:66px;height:66px;border-radius:50%;background:#dc2626;display:flex;align-items:center;justify-content:center">${icon(IC.phone, 34, '#fff')}</span>
      <span><span style="display:block;font-size:30px;font-weight:800;color:#1d2b33">Contactos de emergencia</span>
      <span style="display:block;font-size:21px;color:#5b6b73;margin-top:4px">911 · Cruz Roja · Bomberos</span></span></div>`
  },
  {
    name: 'logo-titulo-claro',
    html: `<div style="${FONT};display:inline-flex;flex-direction:column;align-items:center;gap:6px;${SHADOW}">
      ${lighthouse(150, '#ffffff')}
      <div style="font-size:52px;font-weight:900;color:#fff;letter-spacing:-.01em;line-height:1">Faro VE</div>
      <div style="font-size:28px;font-weight:600;color:#fff;opacity:.9">Mapa de Esperanza</div></div>`
  },
  {
    name: 'logo-titulo-oscuro',
    html: `<div style="${FONT};display:inline-flex;flex-direction:column;align-items:center;gap:6px">
      ${lighthouse(150, FARO)}
      <div style="font-size:52px;font-weight:900;color:${FARO};letter-spacing:-.01em;line-height:1">Faro VE</div>
      <div style="font-size:28px;font-weight:600;color:#334e5c">Mapa de Esperanza</div></div>`
  },
  {
    name: 'titulo-nueva-actualizacion-claro',
    html: `<div style="${FONT};display:inline-flex;flex-direction:column;align-items:center;gap:10px;${SHADOW}">
      <div style="display:inline-flex;align-items:center;gap:14px"><span style="display:flex">${icon(IC.refresh, 46, WARM)}</span>
      <span style="font-size:64px;font-weight:900;color:#fff;letter-spacing:-.02em">Nueva actualización</span></div>
      <div style="height:6px;width:200px;border-radius:3px;background:${WARM}"></div></div>`
  },
  {
    name: 'titulo-nueva-actualizacion-pill',
    html: `<div style="${FONT};display:inline-flex;align-items:center;gap:16px;background:${FARO};color:#fff;border-radius:999px;padding:18px 36px;box-shadow:0 10px 28px rgba(11,79,108,.45)">
      ${icon(IC.refresh, 46, WARM)}<span style="font-size:46px;font-weight:800">Nueva actualización</span></div>`
  }
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 3 });
const page = await ctx.newPage();

for (const el of elements) {
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf8">
     <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet"></head>
     <body style="margin:0;background:transparent"><div id="el" style="display:inline-block;padding:8px">${el.html}</div></body></html>`,
    { waitUntil: 'networkidle' }
  );
  await page.waitForTimeout(300);
  await page.locator('#el').screenshot({ path: path.join(OUT, `${el.name}.png`), omitBackground: true });
  console.log('✓', el.name);
}

await browser.close();
console.log('Elementos estáticos en', OUT);
