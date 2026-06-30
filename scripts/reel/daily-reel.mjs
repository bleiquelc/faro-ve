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

// 1) Generar el reel del día (make-reel rota versículo + footage por día del año).
execFileSync('node', ['scripts/reel/make-reel.mjs'], { cwd: REPO, stdio: 'inherit', env: process.env });

const stamp = new Date().toISOString().slice(0, 10);
const mp4 = path.join(os.homedir(), 'Desktop', 'faro-reels', `reel-${stamp}.mp4`);
const cap = `${mp4}.caption.txt`;
if (!fs.existsSync(mp4) || !fs.existsSync(cap)) { console.error('no se generó el reel/caption'); process.exit(1); }

// 2) dueAt = hoy 16:00 Madrid (el Mac está en Europe/Zurich = mismo huso); si ya pasó → mañana 16:00.
const d = new Date();
d.setHours(16, 0, 0, 0);
if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
const dueAt = d.toISOString();

if (process.env.DRY === '1') { console.log(`DRY: publicaría ${mp4}\n     para ${dueAt}`); process.exit(0); }

// 3) Programar en Buffer como Reel.
execFileSync('node', ['scripts/buffer/reel-post.mjs'], {
  cwd: REPO, stdio: 'inherit',
  env: { ...process.env, VIDEO: mp4, CAPTION_FILE: cap, DUE_AT: dueAt }
});
console.log(`\n✅ Reel diario programado para ${dueAt} (16:00 Madrid).`);
