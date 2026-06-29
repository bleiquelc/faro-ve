/**
 * CRON HORARIO — publica UNA ficha de persona buscada en @farovenmap. "Un solo trabajo":
 *   1. UNIFICA datos (Faro duplicados + Venezuela Reporta, match difuso + IA confirma).
 *   2. ENRIQUECE la DB de Faro (best-effort: POST /api/enrich con token; si no, se salta).
 *   3. RECONCILIA: si figura A SALVO en otra plataforma → NO publica (lo deja para el
 *      job de reencuentros) y lo registra.
 *   4. FILTRO IA de foto → SOLO publica CON foto limpia (cédulas/screenshots/grupos/
 *      menores → descartados). Si no hay foto limpia → salta (reintenta en 3 días).
 *   5. Render retrato + host + publica vía Buffer. Marca posteada (no repite).
 *
 * Guardarraíles: kill-switch (env FARO_IG_PAUSED=1 o archivo ~/.faro-ig/paused),
 * 1 post por corrida (ritmo ~1/hora → lejos del límite de baneo), re-chequeo missing.
 *
 *   node scripts/buffer/cron-ig.mjs
 */
import { classifyPhoto } from './photo-filter.mjs';
import { confirmReunification, isFoundStatus, nameOverlap, normName } from './found-detector.mjs';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';

const HOME = os.homedir();
const REPO = HOME + '/Desktop/faro-ve';
const STATE_DIR = HOME + '/.faro-ig';
const STATE_FILE = STATE_DIR + '/state.json';
const CDN_WT = STATE_DIR + '/cdn'; // git worktree de la rama fichas-cdn (no toca el árbol principal)
const CHANNEL_ID = '6a4190975ab6d2f106819d3d';
const BUFFER_KEY = fs.readFileSync(HOME + '/.secrets/faro-ve/buffer-key.txt', 'utf8').trim(); // launchd no hereda env
const ENRICH_TOKEN = (() => {
  const f = HOME + '/.secrets/faro-ve/enrich-token.txt';
  try { return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : (process.env.ENRICH_TOKEN || ''); }
  catch { return process.env.ENRICH_TOKEN || ''; }
})();
const FARO = 'https://faro-ve.com/api/persons';
const VR = 'https://venezuelareporta.org/api/v1/personas';
const TRIES = Number(process.env.TRIES || 14);
const SKIP_TTL = 3 * 24 * 3600 * 1000;
const log = (...a) => console.log(new Date().toISOString(), ...a);

// ── kill-switch ──────────────────────────────────────────────────────────────
fs.mkdirSync(STATE_DIR, { recursive: true });
if (process.env.FARO_IG_PAUSED === '1' || fs.existsSync(STATE_DIR + '/paused')) { log('PAUSADO — salgo.'); process.exit(0); }

const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : { posted: {}, skipped: {}, reencuentros: {} };
const save = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
const now = Date.now();
const recentlySkipped = (id) => state.skipped[id] && now - state.skipped[id].ts < SKIP_TTL;
const tokens = (s) => normName(s).split(' ').filter((w) => w.length >= 4).sort((a, b) => b.length - a.length);

// ── git worktree para hospedar las imágenes (rama fichas-cdn) ─────────────────
function ensureCdn() {
  if (fs.existsSync(CDN_WT + '/.git')) return;
  try { execFileSync('git', ['worktree', 'add', '-B', 'fichas-cdn', CDN_WT], { cwd: REPO, stdio: 'pipe' }); }
  catch { execFileSync('git', ['worktree', 'add', CDN_WT, 'fichas-cdn'], { cwd: REPO, stdio: 'pipe' }); }
}
function hostImage(localJpg, id) {
  ensureCdn();
  fs.mkdirSync(CDN_WT + '/fichas', { recursive: true });
  fs.copyFileSync(localJpg, `${CDN_WT}/fichas/${id}.jpg`);
  execFileSync('git', ['add', '-f', `fichas/${id}.jpg`], { cwd: CDN_WT, stdio: 'pipe' });
  execFileSync('git', ['commit', '-q', '-m', `ficha ${id}`], { cwd: CDN_WT, stdio: 'pipe' });
  execFileSync('git', ['push', '-q', 'origin', 'fichas-cdn'], { cwd: CDN_WT, stdio: 'pipe' });
  return `https://raw.githubusercontent.com/bleiquelc/faro-ve/fichas-cdn/fichas/${id}.jpg`;
}

// ── enriquecer la DB de Faro (best-effort) ────────────────────────────────────
async function enrichDB(payload) {
  if (!ENRICH_TOKEN) return 'skip(no-token)';
  try {
    const r = await fetch('https://faro-ve.com/api/enrich', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-enrich-token': ENRICH_TOKEN }, body: JSON.stringify(payload)
    });
    return r.ok ? 'ok' : `http ${r.status}`;
  } catch (e) { return 'err ' + e.message; }
}

async function vrMatch(name) {
  const t = tokens(name); if (!t.length) return null;
  let list = [];
  try { list = (await (await fetch(`${VR}?q=${encodeURIComponent(t[0])}&limit=50`)).json()).personas || []; } catch { return null; }
  return list.find((v) => nameOverlap(v.nombre, name) >= 0.5) || null;
}

// ── main ──────────────────────────────────────────────────────────────────────
const batch = await (await fetch(`${FARO}?status=missing&limit=400`)).json();
const people = (batch.persons || batch.data || []).filter((p) => !state.posted[p.id] && !recentlySkipped(p.id));
log(`Candidatos: ${people.length} (lote 400, sin posteadas/skip-recientes).`);

let did = false;
let tried = 0;
for (const p of people) {
  if (did || tried >= TRIES) break;
  tried++;
  const name = (p.full_name || `${p.given_name || ''} ${p.family_name || ''}`).trim();
  if (!name) { state.skipped[p.id] = { reason: 'sin-nombre', ts: now }; continue; }

  // (a) Venezuela Reporta: match por nombre (difuso) → la IA CONFIRMA si es la MISMA
  // persona ANTES de usar nada de VR (foto o datos). Evita mezclar homónimos
  // (ej. dos "Maria Marcano" distintas → foto equivocada). Tu regla.
  const vr = await vrMatch(name);
  let useVr = null;
  if (vr) {
    const v = await confirmReunification(
      { nombre: name, ciudad: p.home_city, zona: p.last_known_location_text, edad: p.age },
      { nombre: vr.nombre, ciudad: vr.ciudad, zona: vr.zona, edad: vr.edad, status: vr.status, ultima_vez: vr.ultima_vez, descripcion: vr.descripcion, platform: 'Venezuela Reporta' }
    );
    if (v.same_person && v.confidence !== 'low') {
      useVr = vr; // confirmado misma persona → recién ahora confiamos en su foto/datos
      if (v.is_found && isFoundStatus(vr.status, 'venezuela_reporta')) {
        state.reencuentros[p.id] = { name, source: 'venezuela-reporta', source_url: vr.ficha_url, status: vr.status, quote: v.quote, where: v.where, confidence: v.confidence, ts: now };
        await enrichDB({ id: p.id, found_signal: { source: 'venezuela-reporta', source_url: vr.ficha_url, found_status: vr.status, quote: v.quote, where_text: v.where, confidence: v.confidence } });
        log(`REENCUENTRO (no publico): ${name} — a salvo en VR (${v.confidence}).`);
        state.skipped[p.id] = { reason: 'reencuentro', ts: now };
        continue;
      }
    } else {
      log(`VR homónimo descartado para "${name}" (IA: no es la misma persona).`);
    }
  }

  // (b) unificar SOLO con VR CONFIRMADO (useVr); si no, datos/foto PROPIOS de Faro.
  const sex = (useVr && (useVr.genero === 'femenino' ? 'female' : useVr.genero === 'masculino' ? 'male' : '')) || (p.sex && p.sex !== 'unknown' ? p.sex : '');
  const desc = [useVr && useVr.descripcion, p.description].filter(Boolean).sort((a, b) => b.length - a.length)[0] || '';
  const loc = [useVr && [useVr.ciudad, useVr.zona].filter(Boolean).join(', '), p.last_known_location_text].filter(Boolean).sort((a, b) => b.length - a.length)[0] || p.last_known_location_text || '';
  const age = p.age || (useVr && useVr.edad) || '';
  const photoCands = [p.photo_url, useVr && useVr.foto_url].filter(Boolean);

  // (c) foto: filtro IA → primera limpia
  let chosen = '';
  for (const url of photoCands) {
    const c = await classifyPhoto(url);
    if (c.usable && !c.has_minor) { chosen = url; break; }
  }
  if (!chosen) { state.skipped[p.id] = { reason: 'sin-foto-limpia', ts: now }; log(`Sin foto limpia: ${name} (reintento en 3d).`); continue; }

  // (d) enriquecer DB (best-effort, no bloquea publicación)
  const er = await enrichDB({ id: p.id, source: 'venezuela-reporta', description: desc, age: String(age || ''), sex, last_known_location_text: loc });
  log(`enrichDB ${name}: ${er}`);

  // (e) render → host → publicar
  if (process.env.DRY === '1') { log(`DRY: publicaría → ${name} | loc: ${loc} | edad: ${age} | sexo: ${sex || '?'} | foto: ${chosen}`); did = true; continue; }
  const env = { ...process.env, PERSON_ID: p.id, NAME: name, LOC: loc, AGE: String(age || ''), PHOTO_URL: chosen };
  if (sex) env.SEX = sex;
  if (desc) env.EXTRA_DESC = desc;
  execFileSync('node', ['scripts/buffer/render-ficha.mjs'], { cwd: REPO, env, stdio: 'pipe' });
  const jpg = `${HOME}/Desktop/faro-fichas-test/${p.id}.jpg`;
  const txt = `${HOME}/Desktop/faro-fichas-test/${p.id}.txt`;
  const raw = hostImage(jpg, p.id);
  execFileSync('node', ['scripts/buffer/post.mjs'], {
    cwd: REPO,
    env: { ...process.env, BUFFER_API_KEY: BUFFER_KEY, CHANNEL_ID, IMG_URL: raw, TEXT_FILE: txt, WHEN_MIN: process.env.WHEN_MIN || '3' },
    stdio: 'inherit'
  });
  state.posted[p.id] = { name, ts: now, raw };
  did = true;
  log(`PUBLICADA: ${name}`);
}

save();
log(`Fin. Publicada=${did}. Intentos=${tried}. Posteadas total=${Object.keys(state.posted).length}. Reencuentros=${Object.keys(state.reencuentros).length}.`);
