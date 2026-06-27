/**
 * Pantalla de CIERRE del reel (1080×1920, vertical, opaca) — logo + guía de
 * descarga + servicios principales. Para cerrar el video.
 */
import { chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const OUT = path.join(os.homedir(), 'Desktop', 'faro-ve-reel-elementos');
const FARO = '#0B4F6C';

const lighthouse = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="none"><defs><radialGradient id="lg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FFF7D6" stop-opacity=".95"/><stop offset="45%" stop-color="#FFE9A8" stop-opacity=".5"/><stop offset="100%" stop-color="#FFE9A8" stop-opacity="0"/></radialGradient></defs><circle cx="32" cy="16" r="15" fill="url(#lg)"/><circle cx="32" cy="16" r="4" fill="#FFE9A8" stroke="#FFF7D6" stroke-width="1"/><path d="M26.5 20.5 h11 l-1 3.5 h-9 z" fill="#fff"/><path d="M27.2 24 h9.6 l2.6 23 h-14.8 z" fill="#fff"/><path d="M25.9 33 h12.2 l0.5 5 h-13.2 z" fill="#52A9C9"/><path d="M22.5 47 h19 l2.2 5.5 h-23.4 z" fill="#fff"/><line x1="16" y1="52.5" x2="48" y2="52.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`;
const beacon = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="15" fill="#0B4F6C"/><circle cx="24" cy="24" r="15" fill="none" stroke="#FFE9A8" stroke-width="1.6"/><rect x="21" y="13.5" width="6" height="21" rx="2.4" fill="#fff"/><rect x="13.5" y="21" width="21" height="6" rx="2.4" fill="#fff"/></svg>`;
const ic = (p, s, c = '#fff') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const P = {
  map: '<path d="M9 4 L3.6 6.2 V19.8 L9 17.6 L15 19.8 L20.4 17.6 V4 L15 6.2 L9 4 Z"/><path d="M9 4 V17.6 M15 6.2 V19.8"/><circle cx="12.8" cy="11" r="1.5" fill="#FFE39C" stroke="none"/>',
  phone: '<path d="M6.8 3.6 H9.2 L10.7 7.4 L8.6 8.8 A10.4 10.4 0 0 0 13.4 13.6 L14.8 11.5 L18.6 13 V15.4 A1.8 1.8 0 0 1 16.6 17.1 A14 14 0 0 1 5 5.5 A1.8 1.8 0 0 1 6.8 3.6 Z"/>',
  refresh: '<path d="M4 12 A8 8 0 0 1 17.8 6.5"/><path d="M18.4 3 V6.8 H14.6"/><path d="M20 12 A8 8 0 0 1 6.2 17.5"/><path d="M5.6 21 V17.2 H9.4"/>',
  download: '<path d="M12 3.5 V14"/><path d="M8 10.2 L12 14.2 L16 10.2"/><path d="M5 16.5 V18.5 A1.5 1.5 0 0 0 6.5 20 H17.5 A1.5 1.5 0 0 0 19 18.5 V16.5"/>'
};
const FONT = `font-family:'Inter',-apple-system,'Segoe UI',Roboto,sans-serif`;
const row = (svg, title, sub, hot = false) => `
  <div style="display:flex;align-items:center;gap:26px;background:${hot ? 'rgba(255,227,156,.14)' : 'rgba(255,255,255,.08)'};border:1px solid ${hot ? 'rgba(255,227,156,.4)' : 'rgba(255,255,255,.16)'};border-radius:28px;padding:30px 34px">
    <span style="flex:none;width:88px;height:88px;border-radius:22px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center">${svg}</span>
    <span><span style="display:block;font-size:42px;font-weight:800;color:#fff">${title}</span><span style="display:block;font-size:27px;color:rgba(255,255,255,.8);margin-top:4px">${sub}</span></span></div>`;

const html = `<!doctype html><html><head><meta charset="utf8"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet"></head>
<body style="margin:0">
<div style="width:1080px;height:1920px;${FONT};background:radial-gradient(120% 60% at 50% 8%,#0e3a4f 0%,#06202b 60%,#04161e 100%);display:flex;flex-direction:column;align-items:center;padding:96px 70px;box-sizing:border-box;color:#fff;text-align:center">
  ${lighthouse(150)}
  <div style="font-size:62px;font-weight:900;margin-top:10px">Faro VE</div>
  <div style="font-size:34px;font-weight:600;opacity:.9">Mapa de Esperanza</div>
  <div style="font-size:30px;font-weight:800;color:#FFE39C;letter-spacing:.16em;text-transform:uppercase;margin-top:30px">Servicios gratuitos</div>
  <div style="display:flex;flex-direction:column;gap:24px;width:100%;margin-top:34px">
    ${row(ic(P.download, 44), 'Descarga la guía (PDF)', '34 primeros auxilios · funciona sin internet', true)}
    ${row(beacon(56), 'Faro Auxilio', 'Qué hacer en una emergencia, paso a paso')}
    ${row(ic(P.map, 44), 'Ver el mapa', 'Reporta y busca personas')}
    ${row(ic(P.phone, 44), 'Contactos de emergencia', '911 · Cruz Roja · Bomberos')}
    ${row(ic(P.refresh, 44), 'Actualizar', 'Lo más reciente, de un toque')}
  </div>
  <div style="flex:1"></div>
  <div style="font-size:46px;font-weight:900">faro-ve.com</div>
  <div style="font-size:28px;opacity:.85;margin-top:6px">Gratis · sin cuenta · privado</div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 })).newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'cierre-pantalla-completa.png') });
await browser.close();
console.log('cierre listo');
