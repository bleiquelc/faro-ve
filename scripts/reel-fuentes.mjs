/**
 * Tarjeta de FUENTES OFICIALES de la guía (PNG transparente, estilo glass faro).
 * Organizaciones consolidadas de las 95 referencias citadas. Para el reel.
 */
import { chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const OUT = path.join(os.homedir(), 'Desktop', 'faro-ve-reel-elementos');
const FONT = `font-family:'Inter',-apple-system,'Segoe UI',Roboto,sans-serif`;

// Organizaciones marquee (las más reconocibles) + secundarias.
const PRIMARY = [
  'OMS (WHO)', 'OPS · PAHO', 'UNICEF', 'Cruz Roja · IFRC', 'CICR',
  'Cruz Roja Venezolana', 'American Heart Association', 'CDC (EE.UU.)',
  'Mayo Clinic', 'Protección Civil VE · FUNVISIS'
];
const SECONDARY = [
  'Cleveland Clinic', 'MedlinePlus (NIH)', 'Manual MSD', 'Stop the Bleed (ACS)',
  'St John Ambulance', 'Poison Control', 'Epilepsy Foundation', 'ESFI',
  'Sphere · WASH', 'FEMA · Ready.gov', 'FoodSafety.gov', 'Great ShakeOut', 'AAO-HNS'
];

const shield = `<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 3 L19 6 V11 C19 16 15.5 19.5 12 21 C8.5 19.5 5 16 5 11 V6 Z"/><path d="M9 12 l2 2 l4 -4" stroke="#FFE39C"/></svg>`;

const chip = (t) =>
  `<span style="background:rgba(11,79,108,.72);border:1.5px solid rgba(255,255,255,.26);border-radius:999px;padding:12px 22px;font-size:25px;font-weight:600;color:#fff;white-space:nowrap">${t}</span>`;

const html = `<!doctype html><html><head><meta charset="utf8"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet"></head>
<body style="margin:0;background:transparent">
<div id="el" style="${FONT};display:inline-block;width:980px;padding:16px">
  <div style="background:rgba(6,32,43,.58);border:1.5px solid rgba(255,255,255,.16);border-radius:34px;padding:44px 46px;box-shadow:0 18px 50px rgba(0,0,0,.45);text-align:center;color:#fff">
    <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:8px">
      ${shield}<span style="font-size:46px;font-weight:900;letter-spacing:-.01em">Fuentes oficiales</span></div>
    <div style="font-size:25px;color:rgba(255,255,255,.85);margin-bottom:26px">Cada guía cita su fuente · información verificada · cero invención</div>
    <div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center">${PRIMARY.map(chip).join('')}</div>
    <div style="font-size:22px;line-height:1.7;color:rgba(255,255,255,.78);margin-top:24px;padding:0 10px">
      ${SECONDARY.join('  ·  ')}
    </div>
    <div style="height:1px;background:rgba(255,255,255,.16);margin:26px 0 18px"></div>
    <div style="font-size:26px;font-weight:800;color:#FFE39C">34 guías · 95 referencias oficiales · faro-ve.com</div>
  </div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await (await browser.newContext({ deviceScaleFactor: 3 })).newPage();
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(350);
await page.locator('#el').screenshot({ path: path.join(OUT, 'fuentes-oficiales.png'), omitBackground: true });
await browser.close();
console.log('fuentes-oficiales.png listo en', OUT);
