// Verificación OFFLINE doble: contra `vite preview` (SW real) o pages.dev (BASE=).
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:4173';
const r = {};
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

// 1) ONLINE: carga /auxilio, registra el SW, visita una página estática allowlisted.
await page.goto(BASE + '/auxilio', { waitUntil: 'load' });
await page.waitForTimeout(2500);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1500);
r.controllerControla = await page.evaluate(() => !!navigator.serviceWorker.controller);
r.onlineAuxilioHeader = await page.textContent('header p').catch(() => null);

// 2) OFFLINE /auxilio (precache) → contenido completo.
await ctx.setOffline(true);
await page.goto(BASE + '/auxilio', { waitUntil: 'load' }).catch((e) => (r.offAuxErr = String(e)));
await page.waitForTimeout(600);
const aux = await page.content();
r.offline_auxilio_34 = aux.includes('34 guías');
r.offline_auxilio_guia = /Diarrea|Mordedura|RCP/.test(aux);
r.offline_auxilio_contactos = /911|Cruz Roja/.test(aux);

// 3) OFFLINE /persona/<uuid> (NO allowlist) → /offline, NUNCA HTML con PII.
await page
  .goto(BASE + '/persona/00000000-0000-0000-0000-000000000000', { waitUntil: 'load' })
  .catch((e) => (r.offPersonaErr = String(e)));
await page.waitForTimeout(600);
r.offline_persona_es_offline = (await page.content()).includes('Sin conexión');

// 4) OFFLINE / (home, NO allowlist) → /offline.
await page.goto(BASE + '/', { waitUntil: 'load' }).catch((e) => (r.offHomeErr = String(e)));
await page.waitForTimeout(600);
r.offline_home_es_offline = (await page.content()).includes('Sin conexión');

// 5) Inspección de caché (clave privacidad): faro-paginas NO debe tener /persona ni /.
await ctx.setOffline(false);
await page.goto(BASE + '/auxilio', { waitUntil: 'load' });
const cacheKeys = await page.evaluate(async () => {
  const out = {};
  for (const name of await caches.keys()) {
    const c = await caches.open(name);
    out[name] = (await c.keys()).map((req) => new URL(req.url).pathname);
  }
  return out;
});
r.cache_names = Object.keys(cacheKeys);
const paginas = cacheKeys['faro-paginas'] || [];
r.faro_paginas = paginas;
r.PRIVACIDAD_sin_persona = !paginas.some((p) => p.startsWith('/persona'));
r.PRIVACIDAD_sin_punto = !paginas.some((p) => p.startsWith('/punto'));
r.PRIVACIDAD_sin_home = !paginas.includes('/');

// 6) online de nuevo → sin regresión.
r.online_otra_vez = await page.textContent('header p').catch(() => null);

console.log(JSON.stringify(r, null, 2));
await browser.close();
