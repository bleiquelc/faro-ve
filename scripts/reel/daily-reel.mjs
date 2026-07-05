/**
 * REEL DIARIO de esperanza (1 corrida/día vía launchd com.farove.reel).
 * Genera el reel del día (versículo + footage de Venezuela rotando por día) y lo
 * PROGRAMA en Buffer para las 16:00 Madrid. Misión Art. 4 (hands-off) + Art. 3 ($0).
 *
 * Kill-switch: ~/.faro-ig/paused (compartido) o FARO_IG_PAUSED=1.
 * DRY=1 → genera pero NO publica (para test).
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const REPO = '/Users/bleiquelcolina/Desktop/faro-ve';
const STATE_DIR = path.join(os.homedir(), '.faro-ig');

if (fs.existsSync(path.join(STATE_DIR, 'paused')) || process.env.FARO_IG_PAUSED === '1') {
  console.log('reel diario PAUSADO (kill-switch).');
  process.exit(0);
}

// 0) Esperar la red: launchd corre al despertar el Mac y la red tarda en levantar
//    (3–5 jul se perdió el reel por ConnectTimeout a Buffer/Pexels). Hasta 5 min.
for (let i = 1; ; i++) {
  try { await fetch('https://api.buffer.com', { method: 'HEAD' }); break; }
  catch {
    if (i >= 10) { console.error('sin red tras 5 min; abandono (reintenta mañana).'); process.exit(1); }
    console.log(`sin red (intento ${i}/10); espero 30s…`);
    await new Promise((r) => setTimeout(r, 30_000));
  }
}

// 1) dueAt = hoy 16:00 Madrid (el Mac está en Europe/Zurich = mismo huso); si ya pasó → mañana 16:00.
const d = new Date();
d.setHours(16, 0, 0, 0);
if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
const dueAt = d.toISOString();
const day = dueAt.slice(0, 10);

// 2) Idempotencia: si ese día ya tiene reel programado (p. ej. semana pre-programada
//    en Buffer), no duplicar. reel-post.mjs escribe este estado al confirmar.
let sched = {};
try { sched = JSON.parse(fs.readFileSync(path.join(STATE_DIR, 'reel-scheduled.json'), 'utf8')); } catch { /* aún sin estado */ }
if (sched[day]) {
  console.log(`reel del ${day} ya programado en Buffer (${sched[day].id}) — nada que hacer.`);
  process.exit(0);
}

// 3) Generar el reel DE ESA FECHA (versículo + footage rotan por día).
execFileSync('node', ['scripts/reel/make-reel.mjs'], {
  cwd: REPO, stdio: 'inherit', env: { ...process.env, REEL_DATE: day }
});

const mp4 = path.join(os.homedir(), 'Desktop', 'faro-reels', `reel-${day}.mp4`);
const cap = `${mp4}.caption.txt`;
if (!fs.existsSync(mp4) || !fs.existsSync(cap)) { console.error('no se generó el reel/caption'); process.exit(1); }

if (process.env.DRY === '1') { console.log(`DRY: publicaría ${mp4}\n     para ${dueAt}`); process.exit(0); }

// 4) Programar en Buffer como Reel.
execFileSync('node', ['scripts/buffer/reel-post.mjs'], {
  cwd: REPO, stdio: 'inherit',
  env: { ...process.env, VIDEO: mp4, CAPTION_FILE: cap, DUE_AT: dueAt }
});
console.log(`\n✅ Reel diario programado para ${dueAt} (16:00 Madrid).`);
