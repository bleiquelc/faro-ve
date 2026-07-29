/**
 * Faro VE — MANTENIMIENTO DIARIO automático (1 corrida/día vía launchd com.farove.maintenance).
 *
 * Misión-ley: Art. 4 (liberar el tiempo del founder) + Art. 3 (eficiencia económica).
 * Hace "un solo trabajo" cada día y, sobre todo, ALERTA SOLO SI ALGO ESTÁ MAL
 * (si todo está sano: silencio; el founder no tiene que revisar nada).
 *
 * Qué hace:
 *  1. Salud del sitio: endpoints públicos responden 200.
 *  2. Ingesta: total de personas (tendencia vs ayer; alerta si BAJA).
 *  3. Cron de Instagram: corrió hoy + sin errores (revisa ~/.faro-ig/cron*.log).
 *  4. Buffer key presente/válida (si no, no se puede publicar).
 *  5. Reencuentros del día: corre reconcile + siembra (REUSA reconcile.mjs + seed-reencuentros.mjs).
 *  6. Cache de IA: stats de ahorro.
 *  7. Reporte del día en ~/.faro-ig/maintenance-FECHA.log + recordatorios de pasos founder.
 *
 * Reusa el patrón del cron IG (lee secretos de ~/.secrets/faro-ve/, estado en ~/.faro-ig/,
 * kill-switch por archivo). NO despliega ni hace push (regla: deploy solo con OK founder).
 * Kill-switch: ~/.faro-ig/paused (compartido con el cron IG) o env FARO_MAINT_PAUSED=1.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { cacheStats } from '../buffer/ai-cache.mjs';
import { fetchJson } from '../lib/fetch-json.mjs';
import { looksLikeRealError, firstErrorLine } from '../lib/err-log.mjs';

const HOME = process.env.HOME;
const REPO = '/Users/bleiquelcolina/Desktop/faro-ve';
const STATE_DIR = path.join(HOME, '.faro-ig');
const today = new Date().toISOString().slice(0, 10);
const REPORT = path.join(STATE_DIR, `maintenance-${today}.log`);
const STATE = path.join(STATE_DIR, 'maintenance-state.json');

fs.mkdirSync(STATE_DIR, { recursive: true });
if (fs.existsSync(path.join(STATE_DIR, 'paused')) || process.env.FARO_MAINT_PAUSED === '1') {
  console.log('mantenimiento PAUSADO (kill-switch).');
  process.exit(0);
}

const lines = [];
const problems = [];
const log = (s) => { lines.push(s); console.log(s); };
const problem = (s) => { problems.push(s); lines.push('⚠️  ' + s); };

let state = {};
try { state = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { /* primera corrida */ }

log(`# Faro VE — mantenimiento ${new Date().toISOString()}`);

// 0) Esperar la red local (hasta 5 min): launchd corre al despertar el Mac y la
//    red tarda en levantar — sin esto, el 5-jul reportó 8 falsos "endpoint caído"
//    (HTTP 0 = sin red local, no el sitio). Se sondea un TERCERO (Cloudflare):
//    si el tercero responde y faro-ve.com no, la caída del sitio es REAL.
let networkUp = false;
for (let i = 1; i <= 10; i++) {
  try { await fetch('https://www.cloudflare.com/cdn-cgi/trace'); networkUp = true; break; }
  catch { log(`  sin red local (intento ${i}/10); espero 30s…`); await new Promise((r) => setTimeout(r, 30_000)); }
}
if (!networkUp) {
  problem('SIN RED LOCAL tras 5 min — no se pudo verificar el sitio (no significa que faro-ve.com esté caído).');
}

// 1) Salud del sitio ───────────────────────────────────────────────────────────
const endpoints = [
  'https://faro-ve.com/',
  'https://faro-ve.com/reencuentros',
  'https://faro-ve.com/auxilio',
  'https://faro-ve.com/api/persons?limit=1',
  'https://faro-ve.com/api/aid-points?limit=1',
  'https://faro-ve.com/api/pfif?limit=1'
];
for (const u of networkUp ? endpoints : []) {
  let s = 0;
  try { s = (await fetch(u)).status; } catch { s = 0; }
  log(`  sitio ${s}  ${u}`);
  if (s !== 200) problem(`Endpoint caído (HTTP ${s}): ${u}`);
}
if (!networkUp) log('  sitio: chequeos OMITIDOS (sin red local).');

// 2) Ingesta: total de personas + tendencia ─────────────────────────────────────
let total = null;
try {
  if (!networkUp) throw new Error('sin red');
  const j = await fetchJson('https://faro-ve.com/api/persons/stats');
  total = j.total ?? j.data?.total ?? j.persons_total ?? null;
} catch { /* sin stats */ }
if (total != null) {
  log(`  personas (total): ${total}${state.lastTotal != null ? ` (ayer ${state.lastTotal})` : ''}`);
  if (state.lastTotal != null && total < state.lastTotal) problem(`El total de personas BAJÓ (${state.lastTotal} → ${total}).`);
  state.lastTotal = total;
} else {
  log('  personas (total): no disponible');
}

// 2b) Ingesta incremental de la fuente (venezuela-te-busca) ──────────────────────
//     El cron del Worker de Cloudflare NO se ejecuta (schedule registrado pero la
//     cuenta free no lo dispara — verificado 8-jul: 0 corridas en 6 días). Para que
//     la ingesta siga siendo AUTOMÁTICA corre acá: un bloque ROTANTE de términos por
//     día (cubre los 465 en ~3 días), incremental e idempotente por (source,source_id).
//     Reusa el script probado; el throttle ético 1 req/2s lo hereda del núcleo (#12).
const dbUrlPath = path.join(HOME, '.secrets/faro-ve/db-url.txt');
if (process.env.MAINT_HEALTH_ONLY === '1' || !networkUp) {
  log(`  ingesta: OMITIDA (${networkUp ? 'MAINT_HEALTH_ONLY=1' : 'sin red local'})`);
} else if (!fs.existsSync(dbUrlPath)) {
  problem('Ingesta omitida: falta ~/.secrets/faro-ve/db-url.txt (cadena de conexión a la DB).');
} else {
  const BLOCK = parseInt(process.env.INGEST_TERMS_PER_DAY || '155', 10); // términos/día (465 ≈ 3 días)
  const CAP = parseInt(process.env.INGEST_MAX_REQ || '300', 10);         // tope de requests (ética + tiempo)
  const start = Number.isInteger(state.ingestCursor) ? state.ingestCursor : 0;
  try {
    const out = execFileSync('node', [
      'scripts/ingest/venezuela-te-busca.mjs', '--apply',
      '--start-term', String(start), '--terms', String(BLOCK),
      '--max-req', String(CAP), '--dup-pages', '3'
    ], {
      cwd: REPO, encoding: 'utf8', timeout: 15 * 60 * 1000,
      env: { ...process.env, DATABASE_URL: fs.readFileSync(dbUrlPath, 'utf8').trim() }
    });
    const mNew = out.match(/NUEVOS insertados:\s*(\d+)/);
    const mCur = out.match(/CURSOR_NEXT=(\d+)/);
    if (mCur) state.ingestCursor = parseInt(mCur[1], 10);
    log(`  ingesta: +${mNew ? mNew[1] : '?'} nuevas (bloque desde término ${start}; próximo ${state.ingestCursor ?? '?'})`);
  } catch (e) {
    const tail = (e.stdout ? e.stdout.toString() : '').trim().split('\n').slice(-2).join(' | ');
    problem('Ingesta falló: ' + (e.message || e) + (tail ? ' — ' + tail : ''));
  }
}

// 3) Salud de los crons (IG + reel) ─────────────────────────────────────────────
const cronLog = path.join(STATE_DIR, 'cron.log');
const cronErr = path.join(STATE_DIR, 'cron.err.log');
// Un err.log con contenido se alerta UNA vez y se ARCHIVA a .bak; sin archivar,
// los mismos errores viejos re-alertan todos los días. Se trunca en vez de
// renombrar: launchd re-abre el path en cada corrida y así queda estable.
// Se ARCHIVA siempre, pero se ALERTA solo si el contenido tiene firma de fallo
// real. Motivo (29-jul): ffmpeg escribe su salida NORMAL a stderr (banner,
// streams, progreso) → `reel.err.log` pesaba 13-16 KB todos los días y disparaba
// "el reel registró errores" desde el 13-jul aunque el reel quedara programado
// ✅ en el mismo reporte. El mantenimiento salía exit 1 a diario y el founder
// dejó de distinguir señal de ruido. Ver scripts/lib/err-log.mjs.
const alertAndArchiveErrLog = (label, file) => {
  try {
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) return;
    const content = fs.readFileSync(file, 'utf8');
    const bak = `${file}.${today}.bak`;
    fs.appendFileSync(bak, content);
    fs.truncateSync(file, 0);
    if (!looksLikeRealError(content)) {
      log(`  ${label}: ${(content.length / 1024).toFixed(1)} KB de salida normal en stderr (sin errores) → archivado en ${path.basename(bak)}`);
      return;
    }
    const detail = firstErrorLine(content);
    problem(`El ${label} registró errores: ${detail || 'ver el archivo'} — detalle en ${bak}`);
  } catch { /* sin logs aún */ }
};
alertAndArchiveErrLog('cron de Instagram', cronErr);
alertAndArchiveErrLog('reel diario', path.join(STATE_DIR, 'reel.err.log'));
try {
  const txt = fs.existsSync(cronLog) ? fs.readFileSync(cronLog, 'utf8') : '';
  const ranToday = txt.split('\n').some((l) => l.startsWith(today) && /(Fin\.|PUBLICADA|Publicadas=)/.test(l));
  log(`  cron IG corrió hoy: ${ranToday ? 'sí' : 'NO'}`);
  if (!ranToday) problem('El cron de Instagram no registró corridas hoy (¿el Mac estuvo dormido/apagado?).');
} catch { /* sin logs aún */ }
// El reel de HOY se programa a las 09:00 (misma hora que este job → carrera);
// se verifica que el de AYER haya quedado programado en Buffer.
try {
  const sched = JSON.parse(fs.readFileSync(path.join(STATE_DIR, 'reel-scheduled.json'), 'utf8'));
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (sched[yesterday]) log(`  reel de ayer (${yesterday}): programado ✅`);
  else problem(`El reel de ayer (${yesterday}) no quedó programado en Buffer — revisá ${path.join(STATE_DIR, 'reel.log')}`);
} catch { /* sin estado de reels aún */ }

// 4) Buffer key ─────────────────────────────────────────────────────────────────
const bufKey = path.join(HOME, '.secrets/faro-ve/buffer-key.txt');
try {
  if (!fs.existsSync(bufKey) || fs.readFileSync(bufKey, 'utf8').trim().length < 20) {
    problem('Falta o es inválida la Buffer key (~/.secrets/faro-ve/buffer-key.txt) — no se podrá publicar en IG.');
  }
} catch { problem('No se pudo leer la Buffer key.'); }

// 5) Reencuentros del día: cruce + siembra (REUSO; el cache de IA lo hace barato) ─
if (process.env.MAINT_HEALTH_ONLY === '1' || !networkUp) {
  log(`  reencuentros: OMITIDO (${networkUp ? 'MAINT_HEALTH_ONLY=1' : 'sin red local'})`);
} else {
  try {
    // INCREMENTAL: solo reportes VR de los últimos 3 días (el catch-up completo ya
    // está sembrado). Rápido y barato; evita el timeout del escaneo completo.
    const since = new Date(Date.now() - 3 * 864e5).toISOString();
    const out = execFileSync('node', ['scripts/buffer/reconcile.mjs'], {
      cwd: REPO, encoding: 'utf8', timeout: 45 * 60 * 1000,
      env: { ...process.env, SINCE: process.env.SINCE || since, A_SALVO_MAX: process.env.A_SALVO_MAX || '600', ENCONTRADO_MAX: process.env.ENCONTRADO_MAX || '800' }
    });
    log('  reconcile: ' + out.trim().split('\n').slice(-3).join(' | '));
  } catch (e) { problem('reconcile.mjs falló: ' + (e.message || e)); }

  try {
    const out = execFileSync('node', ['scripts/buffer/seed-reencuentros.mjs'], {
      cwd: REPO, encoding: 'utf8', timeout: 25 * 60 * 1000, env: process.env
    });
    log('  seed: ' + out.trim().split('\n').filter(Boolean).slice(-2).join(' | '));
  } catch (e) { problem('seed-reencuentros.mjs falló (¿ENRICH_TOKEN / 0030?): ' + (e.message || e)); }
}

// 6) Cache de IA (ahorro de tokens) ─────────────────────────────────────────────
log('  cache IA (entradas): ' + JSON.stringify(cacheStats()));

// 7) Recordatorios de pasos founder pendientes (no son alertas push) ────────────
const reminders = [
  'Cloudflare Email Routing: verificar opt-out@/contacto@/federacion@ → bleiquelc@gmail.com (SLA opt-out 24h, regla #8).',
  'Purga PII Habeas Data (reportes withdrawn >30d): falta cron server-side (regla #6) — ver docs/RUNBOOK-mantenimiento.md.',
  'Ingesta automática: ahora corre en ESTE mantenimiento (bloque rotante diario). El cron del Worker cron-ingest en Cloudflare NO dispara (cuenta free: schedule registrado, 0 corridas en 6 días). Para 24/7 opcional: revisar plan Workers en el panel CF o disparar el worker por HTTP.'
];

state.lastRun = new Date().toISOString();
state.lastProblems = problems.length;
fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
fs.writeFileSync(
  REPORT,
  lines.join('\n') +
    '\n\n— Recordatorios (pasos founder, no urgentes):\n' + reminders.map((r) => '  • ' + r).join('\n') +
    `\n\nResultado: ${problems.length ? problems.length + ' PROBLEMA(S)' : 'todo sano ✅'}\n`
);

// Alerta SOLO si hay problemas (notificación macOS + salida de error para el log) ─
if (problems.length) {
  const body = problems.slice(0, 4).join(' · ');
  try {
    execFileSync('osascript', ['-e',
      `display notification ${JSON.stringify(body)} with title "Faro VE — mantenimiento (${problems.length} alerta(s))"`]);
  } catch { /* sin GUI */ }
  console.log(`\n⚠️  ${problems.length} PROBLEMA(S):\n` + problems.map((p) => '  - ' + p).join('\n'));
  console.log(`Reporte: ${REPORT}`);
  process.exit(1);
}
console.log(`\n✅ Todo sano. Reporte: ${REPORT}`);
