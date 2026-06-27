/**
 * Tarjeta con TODO el menú del inicio (Ver el mapa, Buscar, Reportar, A salvo,
 * Registrar, Más formas, Instalar) en PNG TRANSPARENTE — estilo "glass faro" como
 * en la app, un poco más opaco para que se lea sobre cualquier video.
 */
import { chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const OUT = path.join(os.homedir(), 'Desktop', 'faro-ve-reel-elementos');
const FONT = `font-family:'Inter',-apple-system,'Segoe UI',Roboto,sans-serif`;

const ic = (p, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const icd = (p, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#0B4F6C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const P = {
  map: '<path d="M9 4 L3.6 6.2 V19.8 L9 17.6 L15 19.8 L20.4 17.6 V4 L15 6.2 L9 4 Z"/><path d="M9 4 V17.6 M15 6.2 V19.8"/><circle cx="12.8" cy="11" r="1.5" fill="#FFE39C" stroke="none"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M20 20 L15.2 15.2"/><circle cx="10.5" cy="10.5" r="2" fill="#FFE39C" stroke="none"/>',
  report: '<circle cx="12" cy="8" r="3.2"/><path d="M5.6 20 a6.4 6.4 0 0 1 12.8 0"/><circle cx="18.6" cy="5.8" r="1.4" fill="#FFE39C" stroke="none"/>',
  safe: '<path d="M12 20.4 C7 17 4.6 13.6 4.6 10.3 A3.7 3.7 0 0 1 12 8.1 A3.7 3.7 0 0 1 19.4 10.3 C19.4 13.6 17 17 12 20.4 Z"/><path d="M9.4 11.4 l1.9 1.9 l3.3 -3.5" stroke="#FFE39C"/>',
  aid: '<path d="M12 21 C16 16.5 18.4 13.3 18.4 10 A6.4 6.4 0 1 0 5.6 10 C5.6 13.3 8 16.5 12 21 Z"/><path d="M12 6.7 V12.4 M9.2 9.55 H14.8" stroke="#FFE39C"/>',
  install: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7.5 V13.5 M9.5 11 L12 13.5 L14.5 11"/>'
};

const glass = (op) =>
  `background:rgba(11,79,108,${op});border:1.5px solid rgba(255,255,255,.24);box-shadow:0 10px 26px rgba(0,0,0,.4);color:#fff`;

const chip = (icon, label) => `
  <div style="${glass(0.62)};border-radius:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:18px 6px">
    ${ic(P[icon], 34)}<span style="font-size:21px;font-weight:600">${label}</span></div>`;

const html = `<!doctype html><html><head><meta charset="utf8"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet"></head>
<body style="margin:0;background:transparent">
<div id="el" style="${FONT};display:inline-block;width:720px;padding:14px">
  <!-- Ver el mapa -->
  <div style="${glass(0.82)};border-radius:26px;display:flex;align-items:center;justify-content:center;gap:16px;padding:24px;font-size:34px;font-weight:800;margin-bottom:16px">
    ${ic(P.map, 38)}<span>Ver el mapa</span><span style="opacity:.75">→</span></div>
  <!-- 4 chips -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px">
    ${chip('search', 'Buscar')}${chip('report', 'Reportar')}${chip('safe', 'A salvo')}${chip('aid', 'Registrar')}
  </div>
  <!-- Más formas -->
  <div style="${glass(0.62)};border-radius:22px;display:flex;align-items:center;justify-content:center;gap:12px;padding:20px;font-size:27px;font-weight:600;margin-bottom:16px">
    <span>Más formas de reportar y ayudar</span><span style="opacity:.75">→</span></div>
  <!-- Instalar (blanco, como en la app) -->
  <div style="background:#fff;border:1.5px solid #d7e6ee;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:16px;padding:20px;box-shadow:0 10px 26px rgba(0,0,0,.25)">
    <span style="flex:none;width:54px;height:54px;border-radius:14px;background:#f0f9fb;display:flex;align-items:center;justify-content:center">${icd(P.install, 28)}</span>
    <span style="font-size:28px;font-weight:700;color:#0B4F6C">Instalar en mi teléfono</span></div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await (await browser.newContext({ deviceScaleFactor: 3 })).newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(350);
await page.locator('#el').screenshot({ path: path.join(OUT, 'menu-inicio-completo.png'), omitBackground: true });
await browser.close();
console.log('menu-inicio-completo.png listo en', OUT);
