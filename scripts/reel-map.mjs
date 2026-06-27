/**
 * Mapa de Venezuela ANIMADO (horizontal, transparente) — silueta + mar +
 * puntos de luz de colores (personas), concentrados en la zona afectada
 * (La Guaira / Caracas / costa). Genera fotogramas PNG transparentes →
 * ffmpeg los junta en MOV (alfa) + WebM (alfa).
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const W = 1920, H = 1080, FRAMES = 40;
const FRAMEDIR = '/tmp/reel-frames';
fs.rmSync(FRAMEDIR, { recursive: true, force: true });
fs.mkdirSync(FRAMEDIR, { recursive: true });

// Silueta de Venezuela (GeoJSON) → polígono proyectado.
const geo = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts', 'venezuela.geo.json'), 'utf8'));
const ring = geo.features[0].geometry.coordinates[0];
let mnx = 9e9, mxx = -9e9, mny = 9e9, mxy = -9e9;
for (const [x, y] of ring) { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); }
const th = 800, tw = th * ((mxx - mnx) / (mxy - mny)), tx = (W - tw) / 2, ty = (H - th) / 2 + 20;
const proj = (lng, lat) => [tx + ((lng - mnx) / (mxx - mnx)) * tw, ty + ((mxy - lat) / (mxy - mny)) * th];
const polyPts = ring.map(([x, y]) => proj(x, y).map((n) => n.toFixed(1)).join(',')).join(' ');

// Ciudades [lng, lat, cantidad de puntos] — peso alto en la zona afectada.
const CITIES = [
  [-66.93, 10.60, 22], [-66.85, 10.61, 14], [-67.02, 10.60, 10], [-66.74, 10.62, 8], // La Guaira/costa
  [-66.90, 10.49, 20], [-66.85, 10.46, 8],                                            // Caracas
  [-67.60, 10.25, 4], [-68.00, 10.17, 5], [-71.64, 10.66, 6], [-69.35, 10.07, 4],
  [-71.14, 8.59, 3], [-72.22, 7.77, 3], [-64.18, 10.45, 3], [-64.69, 10.13, 3],
  [-63.18, 9.75, 3], [-62.65, 8.35, 4], [-63.55, 8.12, 2], [-69.67, 11.40, 2],
  [-70.20, 11.70, 2], [-70.60, 9.32, 2], [-69.75, 9.04, 2], [-67.62, 5.66, 1], [-61.4, 8.6, 2]
];
const COLORS = ['#dc2626', '#dc2626', '#dc2626', '#dc2626', '#16a34a', '#7c3aed', '#ea580c']; // mayoría desaparecidos
const rnd = (() => { let s = 7; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
const dots = [];
for (const [lng, lat, n] of CITIES) {
  const [cx, cy] = proj(lng, lat);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 14 + 2;
    dots.push({
      x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r,
      c: COLORS[Math.floor(rnd() * COLORS.length)],
      ph: rnd(), base: 3 + rnd() * 2
    });
  }
}

const colorSet = [...new Set(dots.map((d) => d.c))];
const grads = colorSet
  .map((c, i) => `<radialGradient id="g${i}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${c}" stop-opacity=".9"/><stop offset="60%" stop-color="${c}" stop-opacity=".25"/><stop offset="100%" stop-color="${c}" stop-opacity="0"/></radialGradient>`)
  .join('');
const gid = (c) => 'g' + colorSet.indexOf(c);

function svg(t) {
  const dotsSvg = dots.map((d) => {
    const pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * (t + d.ph)); // 0..1
    const glowR = d.base * (3.2 + pulse * 2.6);
    const glowO = 0.35 + pulse * 0.45;
    const coreR = d.base * (0.9 + pulse * 0.35);
    return `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${glowR.toFixed(1)}" fill="url(#${gid(d.c)})" opacity="${glowO.toFixed(2)}"/>` +
      `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${coreR.toFixed(1)}" fill="${d.c}" opacity="${(0.85 + pulse * 0.15).toFixed(2)}"/>`;
  }).join('');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="sea" cx="50%" cy="34%" r="55%"><stop offset="0%" stop-color="#1f6f93" stop-opacity=".40"/><stop offset="70%" stop-color="#0e3a4f" stop-opacity=".14"/><stop offset="100%" stop-color="#0e3a4f" stop-opacity="0"/></radialGradient>
      ${grads}
    </defs>
    <ellipse cx="${W / 2}" cy="${ty - 30}" rx="${tw * 0.78}" ry="${th * 0.55}" fill="url(#sea)"/>
    <polygon points="${polyPts}" fill="rgba(6,32,43,0.66)" stroke="${'rgba(255,227,156,0.55)'}" stroke-width="2.5" stroke-linejoin="round"/>
    ${dotsSvg}
  </svg>`;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
for (let i = 0; i < FRAMES; i++) {
  const t = i / FRAMES;
  await page.setContent(`<body style="margin:0;background:transparent">${svg(t)}</body>`, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(FRAMEDIR, `f${String(i).padStart(3, '0')}.png`), omitBackground: true });
}
await browser.close();
console.log(`${FRAMES} fotogramas en ${FRAMEDIR} · ${dots.length} puntos de luz`);
