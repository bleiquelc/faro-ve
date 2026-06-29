/**
 * Genera un Reel de ESPERANZA de Faro VE (máx 15s, 1080×1920) — oración rotativa
 * sobre fondo de Venezuela, con la máscara "glass faro". 100% libre de derechos
 * (fondo propio renderizado; en producción se puede intercambiar por b-roll de stock
 * libre/Adobe). Sin tokens de IA. Misión Art. 3 (gratis) + Art. 4 (automatizable).
 *
 *   MSG_INDEX=4 node scripts/reel/make-reel.mjs       # elige el mensaje N
 *   MSG="texto propio" node scripts/reel/make-reel.mjs # mensaje a medida
 *   (sin args) → rota por día del año
 *
 * Salidas en ~/Desktop/faro-reels/:
 *   reel-FECHA.mp4         (1080×1920, 15s — para publicar)
 *   reel-FECHA-preview.mp4 (540×960 — para revisar en el chat)
 *   reel-FECHA-poster.png  (405×720 — miniatura)
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(os.homedir(), 'Desktop', 'faro-reels');
const WORK = path.join(os.homedir(), '.faro-ig', 'reel-work');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(WORK, { recursive: true });

const FFMPEG = fs.existsSync(path.join(os.homedir(), 'bin', 'ffmpeg'))
  ? path.join(os.homedir(), 'bin', 'ffmpeg') : 'ffmpeg';

// Mensaje (rotación diaria por defecto)
const messages = JSON.parse(fs.readFileSync(path.join(HERE, 'messages.json'), 'utf8'));
const doy = Math.floor((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 0)) / 864e5);
const idx = process.env.MSG_INDEX != null ? Number(process.env.MSG_INDEX) : doy % messages.length;
const message = process.env.MSG || messages[idx];

const stamp = new Date().toISOString().slice(0, 10);
const bgPng = path.join(WORK, 'bg.png');
const ovPng = path.join(WORK, 'overlay.png');
const mp4 = path.join(OUT, `reel-${stamp}.mp4`);
const preview = path.join(OUT, `reel-${stamp}-preview.mp4`);
const poster = path.join(OUT, `reel-${stamp}-poster.png`);

console.log(`Mensaje [${idx}]: ${message}`);

// 1) Render fondo + máscara (Playwright)
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });

await page.goto('file://' + path.join(HERE, 'bg.html'), { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: bgPng, clip: { x: 0, y: 0, width: 1080, height: 1920 } });

await page.goto('file://' + path.join(HERE, 'overlay.html'), { waitUntil: 'networkidle' });
await page.evaluate(async (m) => {
  document.getElementById('msg').textContent = m;
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
}, message);
await page.waitForTimeout(300);
await page.screenshot({ path: ovPng, omitBackground: true });
await browser.close();
console.log('frames listos:', bgPng, ovPng);

// 2) Componer con ffmpeg: Ken Burns (zoom lento) + máscara + fade in/out, 15s
const filter =
  "[0:v]scale=1296:2304,zoompan=z='min(1+0.0009*on,1.14)':d=375:" +
  "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=25[bg];" +
  "[bg][1:v]overlay=0:0[ov];" +
  "[ov]fade=t=in:st=0:d=0.8,fade=t=out:st=14:d=1,format=yuv420p[v]";

execFileSync(FFMPEG, [
  '-y', '-loop', '1', '-t', '15', '-i', bgPng, '-i', ovPng,
  '-filter_complex', filter, '-map', '[v]',
  '-r', '25', '-t', '15', '-c:v', 'libx264', '-crf', '22', '-preset', 'medium',
  '-movflags', '+faststart', mp4
], { stdio: 'inherit' });

// 3) Preview 540×960 (para el chat) + póster 405×720
execFileSync(FFMPEG, ['-y', '-i', mp4, '-vf', 'scale=540:960', '-c:v', 'libx264', '-crf', '26', '-preset', 'fast', '-an', preview], { stdio: 'inherit' });
execFileSync(FFMPEG, ['-y', '-ss', '3', '-i', mp4, '-frames:v', '1', '-update', '1', '-vf', 'scale=405:720', poster], { stdio: 'inherit' });

console.log('\n✅ Reel listo:');
console.log('  full   :', mp4);
console.log('  preview:', preview);
console.log('  poster :', poster);
