#!/usr/bin/env node
/**
 * Ingesta ÉTICA de venezuelatebusca.com (→ venezuela-te-busca-app.hellogafaro.workers.dev).
 *
 * El PARSEO, geocodificación y mapeo viven en `./venezuela-te-busca-core.mjs`
 * (compartido con el Worker cron-ingest → una sola fuente de verdad). Este script
 * añade: conexión pg + insert vía RPC + enumeración por búsqueda con CLI.
 *
 * PAGINACIÓN (jul-2026): la fuente dejó de paginar por `?page=N` (esa vista ahora
 * devuelve solo 24 recientes con hasMore:false). SÍ pagina por `query` (≥3 chars,
 * substring de nombre Y ubicación) mediante cursor. Este runner BARRE una lista de
 * términos frecuentes (nombres + apellidos + lugares + trigramas, ver
 * `./search-terms.mjs`), paginando cada uno por cursor y CORTANDO al agotar
 * registros NUEVOS (van primero por created_at desc). La dedup por
 * (source, source_id) hace inofensivo el solape entre términos.
 *
 * Decisiones del founder:
 *  - Ingerir AMBAS: missing → 'missing'; found ("está bien") → 'found_alive'.
 *  - Auto-aprobadas (moderation_status='approved') con atribución + opt-out.
 *  - Todas (0028): las no-geocodificables entran sin pin pero buscables por nombre.
 *
 * Privacidad: NUNCA se republica la PII del reportante; el trigger ofusca 300m y
 * fuerza foto admin_only si la edad es <18/desconocida. Ética (#12): UA, 1 req/2s.
 *
 * Uso:
 *   node scripts/ingest/venezuela-te-busca.mjs --dry [--terms N]       # no escribe
 *   DATABASE_URL="..." node scripts/ingest/venezuela-te-busca.mjs --apply [--terms N] [--max-req N] [--dup-pages K]
 *
 * NOTA: el host directo de Supabase es IPv6; en redes IPv4 usa la cadena del
 * POOLER (Supabase → Connect → Session pooler) en DATABASE_URL.
 */
import pg from 'pg';
import { SOURCE, THROTTLE_MS, sleep, fetchSearchValid, mapRecord } from './venezuela-te-busca-core.mjs';
import { TERMS } from './search-terms.mjs';

const args = process.argv.slice(2);
const DRY = args.includes('--dry') || !args.includes('--apply');
const numArg = (flag, def) => {
  const i = args.indexOf(flag);
  const v = i >= 0 ? parseInt(args[i + 1], 10) : NaN;
  return Number.isFinite(v) ? v : def;
};
const MAX_TERMS = numArg('--terms', Infinity);   // límite de nº de términos (canary)
const MAX_REQ = numArg('--max-req', Infinity);   // tope duro de requests (seguridad/ética)
const DUP_PAGES = numArg('--dup-pages', 2);      // cortar término tras K páginas sin NUEVOS
// Offset rotante de inicio (lo usa el mantenimiento diario para cubrir la lista por
// bloques). Normalizado a [0, TERMS.length). Default 0 → barrido desde el inicio
// (comportamiento intacto para la recuperación manual).
const START = ((numArg('--start-term', 0) % TERMS.length) + TERMS.length) % TERMS.length;

// Inserta un lote vía la RPC idempotente `ingest_persons_batch` (0028) — la MISMA
// ruta endurecida que usa el Worker cron-ingest: castea las coords server-side,
// tolera lat/lng null (persona sin pin pero buscable), fuerza moderation_status
// 'approved' y saltea duplicados por (source, source_id). `mapRecord` ya emite la
// forma exacta que la RPC espera. Devuelve el nº de filas NUEVAS insertadas.
async function insertBatch(client, records) {
  if (!records.length) return 0;
  try {
    const res = await client.query('select ingest_persons_batch($1::jsonb) as n', [
      JSON.stringify(records)
    ]);
    return res.rows[0]?.n ?? 0;
  } catch (e) {
    // Un registro corrupto no debe tumbar el lote entero: reintenta uno por uno,
    // salta el ofensor y conserva los buenos. (cleanText ya evita el caso NUL;
    // esto es red de seguridad para cualquier otro dato inesperado de la fuente.)
    let n = 0;
    for (const r of records) {
      try {
        const res = await client.query('select ingest_persons_batch($1::jsonb) as n', [
          JSON.stringify([r])
        ]);
        n += res.rows[0]?.n ?? 0;
      } catch (e2) {
        console.error(`  registro saltado source_id=${r.source_id}: ${e2.message}`);
      }
    }
    return n;
  }
}

// ── main: enumeración por búsqueda (cursor) con dedup + corte temprano ────────
const t0 = Date.now();
const terms = TERMS.slice(START, MAX_TERMS === Infinity ? undefined : START + MAX_TERMS);
console.log(`[ingest] ${SOURCE} — ${DRY ? 'DRY RUN (no escribe)' : 'APPLY (escribe a DB)'}` +
  ` · ${terms.length} términos desde idx ${START} · dup-pages ${DUP_PAGES}` +
  (MAX_REQ !== Infinity ? ` · max ${MAX_REQ} req` : ''));

let client = null;
if (!DRY) {
  if (!process.env.DATABASE_URL) {
    console.error('✖ Falta DATABASE_URL para --apply.');
    process.exit(1);
  }
  client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
}

const seenIds = new Set(); // dedup en-run por source_id (no reprocesar entre términos)
const byStatus = {};
let requests = 0, inserted = 0, scanned = 0, withPhoto = 0, termsDone = 0, stopped = '';

try {
  outer: for (const term of terms) {
    let cursor = null, dupPages = 0, termNew = 0, termPages = 0;
    while (true) {
      if (requests >= MAX_REQ) { stopped = `tope de requests (${MAX_REQ})`; break outer; }
      let res;
      try {
        res = await fetchSearchValid(term, cursor);
      } catch (e) {
        console.error(`✖ term="${term}" falló (${e.message}) — sigo con el próximo término`);
        break;
      }
      requests++;
      termPages++;
      const batch = [];
      for (const p of res.persons) {
        const sid = p.id != null ? String(p.id).trim() : '';
        if (!sid || seenIds.has(sid)) continue;
        seenIds.add(sid);
        const rec = mapRecord(p);
        if (rec) {
          batch.push(rec);
          scanned++;
          if (rec.photo_url) withPhoto++;
          byStatus[rec.status] = (byStatus[rec.status] || 0) + 1;
        }
      }
      const newHere = batch.length ? (DRY ? batch.length : await insertBatch(client, batch)) : 0;
      inserted += newHere;
      termNew += newHere;
      // Corte temprano: página sin NUEVOS → ya entramos en registros ingestados (los
      // nuevos van primero por created_at desc). Tras K páginas dup, próximo término.
      dupPages = newHere === 0 ? dupPages + 1 : 0;
      if (!res.hasMore || !res.nextCursor || dupPages >= DUP_PAGES) break;
      cursor = res.nextCursor;
      await sleep(THROTTLE_MS);
    }
    termsDone++;
    if (termNew > 0 || termsDone % 25 === 0) {
      console.log(`[${termsDone}/${terms.length}] "${term}" +${termNew} (${termPages}p) · req ${requests} · NUEVOS ${inserted} · únicos ${seenIds.size}`);
    }
    await sleep(THROTTLE_MS);
  }
} finally {
  if (client) await client.end();
}

console.log(`\n── Resumen ──`);
console.log(`Términos: ${termsDone}/${terms.length} · requests ${requests} · personas únicas vistas ${seenIds.size}`);
console.log(`Por status ${JSON.stringify(byStatus)} · con foto ${withPhoto}`);
if (!DRY) console.log(`✓ NUEVOS insertados: ${inserted} (idempotente por source_id; lo demás ya existía).`);
else console.log(`(dry) registros no-vistos-en-run: ${inserted}`);
if (stopped) console.log(`⚠ Cortado: ${stopped}. Re-correr es seguro (idempotente).`);
console.log(`(${((Date.now() - t0) / 1000 / 60).toFixed(1)} min)`);
// Cursor para la próxima corrida incremental (rota sobre TERMS): índice del término
// siguiente al último procesado. Lo parsea el mantenimiento diario para avanzar el bloque.
console.log('CURSOR_NEXT=' + (TERMS.length ? (START + termsDone) % TERMS.length : 0));
