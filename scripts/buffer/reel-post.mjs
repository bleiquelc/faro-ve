/**
 * Publica/programa UN Reel (video) en Instagram (@farovenmap) vía Buffer GraphQL.
 * Hospeda el mp4 en la rama fichas-cdn (raw.githubusercontent) y crea el post como
 * Reel con hora exacta.
 *
 *   VIDEO=~/Desktop/faro-reels/reel-manana-caracas.mp4 \
 *   CAPTION_FILE=~/.faro-ig/reel-caption.txt \
 *   DUE_AT="2026-07-01T16:00:00.000Z" \   # opcional; default: mañana 18:00 local (Mac=Europe/Zurich=Madrid)
 *   node scripts/buffer/reel-post.mjs
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fetchJson } from '../lib/fetch-json.mjs';

const REPO = '/Users/bleiquelcolina/Desktop/faro-ve';
const CDN_WT = path.join(os.homedir(), '.faro-ig', 'cdn');
const KEY = (process.env.BUFFER_API_KEY || fs.readFileSync(os.homedir() + '/.secrets/faro-ve/buffer-key.txt', 'utf8')).trim();
const CH = process.env.CHANNEL_ID || '6a4190975ab6d2f106819d3d';
const VIDEO = (process.env.VIDEO || '').replace(/^~/, os.homedir());
const CAPTION = process.env.CAPTION_FILE
  ? fs.readFileSync(process.env.CAPTION_FILE.replace(/^~/, os.homedir()), 'utf8')
  : (process.env.CAPTION || '');

if (!VIDEO || !fs.existsSync(VIDEO)) { console.error('falta VIDEO (ruta válida al mp4)'); process.exit(1); }
if (!CAPTION) { console.error('falta CAPTION / CAPTION_FILE'); process.exit(1); }

// dueAt: env, o mañana 18:00 local (el Mac está en Europe/Zurich = mismo huso que Madrid).
let dueAt = process.env.DUE_AT;
if (!dueAt) { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); dueAt = d.toISOString(); }

// Hospedar el mp4 en fichas-cdn/reels/
function ensureCdn() {
  if (fs.existsSync(CDN_WT + '/.git')) return;
  try { execFileSync('git', ['worktree', 'add', '-B', 'fichas-cdn', CDN_WT], { cwd: REPO, stdio: 'pipe' }); }
  catch { execFileSync('git', ['worktree', 'add', CDN_WT, 'fichas-cdn'], { cwd: REPO, stdio: 'pipe' }); }
}
ensureCdn();
const name = path.basename(VIDEO);
fs.mkdirSync(CDN_WT + '/reels', { recursive: true });
fs.copyFileSync(VIDEO, `${CDN_WT}/reels/${name}`);
execFileSync('git', ['add', '-f', `reels/${name}`], { cwd: CDN_WT, stdio: 'pipe' });
try { execFileSync('git', ['commit', '-q', '-m', `reel ${name}`], { cwd: CDN_WT, stdio: 'pipe' }); } catch { /* sin cambios */ }
try { execFileSync('git', ['push', '-q', 'origin', 'fichas-cdn'], { cwd: CDN_WT, stdio: 'pipe' }); } catch { /* ya pusheado */ }
const url = `https://raw.githubusercontent.com/bleiquelc/faro-ve/fichas-cdn/reels/${name}`;
const madrid = new Date(dueAt).toLocaleString('es-ES', {
  timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit'
});
console.log('hospedado:', url);
console.log('dueAt   :', dueAt, `(${madrid} Madrid)`);

// Buffer createPost como Reel (video por URL)
const input = `{
  text: ${JSON.stringify(CAPTION)},
  channelId: ${JSON.stringify(CH)},
  schedulingType: automatic, mode: customScheduled, dueAt: ${JSON.stringify(dueAt)},
  assets: [{ video: { url: ${JSON.stringify(url)} } }],
  metadata: { instagram: { type: reel, shouldShareToFeed: true } }
}`;
const query = `mutation { createPost(input: ${input}) {
  ... on PostActionSuccess { post { id dueAt } }
  ... on MutationError { message }
} }`;

// Con REINTENTOS: launchd corre al despertar el Mac y la red puede tardar en
// levantar — sin retry se pierde el reel del día (pasó 3–5 jul). Y con fallo
// DURO: si Buffer no confirma el post, salir con 1 para que el caller lo vea.
const TRIES = Number(process.env.POST_TRIES || 6);
let json = null;
for (let i = 1; i <= TRIES; i++) {
  try {
    // fetchJson con retries=0: el bucle de afuera ya reintenta 6× cada 45s
    // (espera a que levante la red al despertar el Mac). Lo que aporta acá es
    // no dejar escapar un SyntaxError si Buffer devuelve HTML.
    json = await fetchJson('https://api.buffer.com', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      retries: 0
    });
    break;
  } catch (e) {
    console.error(`Buffer intento ${i}/${TRIES} falló (${e.cause?.code || e.message})`);
    if (i < TRIES) await new Promise((res) => setTimeout(res, 45_000));
  }
}
if (!json) { console.error('Buffer inalcanzable tras todos los reintentos.'); process.exit(1); }
console.log(JSON.stringify(json, null, 2));

const postId = json?.data?.createPost?.post?.id;
if (!postId) { console.error('createPost NO devolvió post.id (¿MutationError?).'); process.exit(1); }

// Registrar la fecha programada (daily-reel la lee para no duplicar el día).
const stateFile = path.join(os.homedir(), '.faro-ig', 'reel-scheduled.json');
let sched = {};
try { sched = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { /* primera vez */ }
sched[dueAt.slice(0, 10)] = { id: postId, dueAt, video: name };
fs.writeFileSync(stateFile, JSON.stringify(sched, null, 2));
