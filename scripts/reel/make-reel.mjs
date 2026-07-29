/**
 * Genera un Reel de ESPERANZA de Faro VE (máx 15s, 1080×1920) — oración rotativa
 * sobre fondo de Venezuela, con la máscara "glass faro". 100% libre de derechos
 * (fondo propio renderizado; en producción se puede intercambiar por b-roll de stock
 * libre/Adobe). Sin tokens de IA. Misión Art. 3 (gratis) + Art. 4 (automatizable).
 *
 *   MSG_INDEX=4 node scripts/reel/make-reel.mjs       # elige el mensaje N
 *   MSG="texto propio" node scripts/reel/make-reel.mjs # mensaje a medida
 *   REEL_DATE=2026-07-08 node scripts/reel/make-reel.mjs # genera el reel DE ESA FECHA
 *                                                        # (versículo+footage rotan por ese día)
 *   (sin args) → rota por día del año
 *
 * Salidas en ~/Desktop/faro-reels/:
 *   reel-FECHA.mp4         (1080×1920, 15s — para publicar)
 *   reel-FECHA-preview.mp4 (540×960 — para revisar en el chat)
 *   reel-FECHA-poster.png  (405×720 — miniatura)
 */
import { chromium } from '@playwright/test';
import { getFootage } from './footage.mjs';
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

/**
 * ffmpeg escribe TODO su output normal a stderr (banner de versión, configure
 * flags, streams, progreso). Con `stdio:'inherit'` eso caía en `reel.err.log`:
 * 13-16 KB por día que el mantenimiento leía como "el reel registró errores"
 * desde el 13-jul, aunque el reel se programara perfecto.
 *
 * Capturamos la salida y solo la mostramos si ffmpeg FALLA de verdad (exit ≠ 0).
 * Así el err.log queda limpio y un error ahí vuelve a significar algo.
 * @param {string[]} args
 */
function ffmpeg(args) {
  try {
    execFileSync(FFMPEG, args, { stdio: 'pipe' });
  } catch (e) {
    const err = /** @type {any} */ (e);
    process.stderr.write(
      `Error: ffmpeg falló (exit ${err.status ?? '?'}) en: ${args.join(' ')}\n` +
        (err.stderr ? err.stderr.toString() : '')
    );
    throw e;
  }
}

// Fecha objetivo: REEL_DATE permite pre-generar el reel de un día futuro
// (mediodía UTC evita el corrimiento de día por zona horaria).
const target = process.env.REEL_DATE
  ? new Date(process.env.REEL_DATE + 'T12:00:00Z')
  : new Date();

// Mensaje (rotación diaria por defecto)
const messages = JSON.parse(fs.readFileSync(path.join(HERE, 'messages.json'), 'utf8'));
const doy = Math.floor((target.getTime() - Date.UTC(target.getUTCFullYear(), 0, 0)) / 864e5);
const idx = process.env.MSG_INDEX != null ? Number(process.env.MSG_INDEX) : doy % messages.length;
const message = process.env.MSG ? { text: process.env.MSG, ref: process.env.MSG_REF || '' } : messages[idx];

const stamp = target.toISOString().slice(0, 10);
const bgPng = path.join(WORK, 'bg.png');
const ovPng = path.join(WORK, 'overlay.png');
const mp4 = path.join(OUT, `reel-${stamp}.mp4`);
const preview = path.join(OUT, `reel-${stamp}-preview.mp4`);
const poster = path.join(OUT, `reel-${stamp}-poster.png`);

console.log(`Versículo [${idx}]: ${message.text} — ${message.ref}`);

// 1) Render fondo + máscara (Playwright)
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });

await page.goto('file://' + path.join(HERE, 'bg.html'), { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: bgPng, clip: { x: 0, y: 0, width: 1080, height: 1920 } });

await page.goto('file://' + path.join(HERE, 'overlay.html'), { waitUntil: 'networkidle' });
await page.evaluate(async (m) => {
  const v = document.getElementById('verse');
  v.textContent = '“' + m.text + '”';
  document.getElementById('ref').textContent = m.ref ? '— ' + m.ref : '';
  const len = m.text.length; // tamaño adaptativo para que el versículo no se corte
  v.style.fontSize = (len > 100 ? 46 : len > 78 ? 54 : len > 52 ? 60 : 68) + 'px';
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
}, message);
await page.waitForTimeout(300);
await page.screenshot({ path: ovPng, omitBackground: true });
await browser.close();
console.log('frames listos:', bgPng, ovPng);

// 2) Fondo: video real de Pexels (si hay key) o la escena propia; luego ffmpeg
//    compone la máscara + fade in/out, 15s.
const footage = await getFootage(WORK, doy);
let inputs, filter;
if (footage) {
  inputs = ['-y', '-i', footage.path, '-i', ovPng];
  filter =
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920," +
    "trim=0:15,setpts=PTS-STARTPTS[bg];" +
    "[bg][1:v]overlay=0:0[ov];" +
    "[ov]fade=t=in:st=0:d=0.8,fade=t=out:st=14:d=1,format=yuv420p[v]";
  fs.writeFileSync(mp4 + '.credit.txt', footage.credit);
  console.log('fondo: Pexels →', footage.query, '·', footage.credit);
} else {
  inputs = ['-y', '-loop', '1', '-t', '15', '-i', bgPng, '-i', ovPng];
  filter =
    "[0:v]scale=1296:2304,zoompan=z='min(1+0.0009*on,1.14)':d=375:" +
    "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=25[bg];" +
    "[bg][1:v]overlay=0:0[ov];" +
    "[ov]fade=t=in:st=0:d=0.8,fade=t=out:st=14:d=1,format=yuv420p[v]";
  console.log('fondo: escena propia (sin key Pexels)');
}
// Audio: si el footage trae sonido natural (olas/ambiente), lo conservamos
// (sereno y libre de derechos con el clip). La escena propia va en silencio.
const audioArgs = footage ? ['-map', '0:a?', '-c:a', 'aac', '-b:a', '96k'] : [];
ffmpeg([
  ...inputs, '-filter_complex', filter, '-map', '[v]', ...audioArgs,
  '-r', '25', '-t', '15', '-c:v', 'libx264', '-crf', '22', '-preset', 'medium',
  '-movflags', '+faststart', mp4
]);

// 3) Preview 540×960 (para el chat) + póster 405×720
ffmpeg(['-y', '-i', mp4, '-vf', 'scale=540:960', '-c:v', 'libx264', '-crf', '26', '-preset', 'fast', '-an', preview]);
ffmpeg(['-y', '-ss', '3', '-i', mp4, '-frames:v', '1', '-update', '1', '-vf', 'scale=405:720', poster]);

// Caption para publicar (versículo + oración + crédito Pexels + hashtags)
const credit = footage ? `\n\n🎬 ${footage.credit}` : '';
const caption =
  `${message.text} — ${message.ref}\n\n` +
  `Una oración por Venezuela. 🤍${credit}\n\n` +
  `#Terremoto #TerremotoVenezuela #Venezuela #LaGuaira #Caracas #SOSVenezuela #Sismo #Esperanza #FaroVE\n`;
fs.writeFileSync(mp4 + '.caption.txt', caption);

console.log('\n✅ Reel listo:');
console.log('  full   :', mp4);
console.log('  preview:', preview);
console.log('  poster :', poster);
