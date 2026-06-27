#!/usr/bin/env node
/**
 * Ingesta ÉTICA de venezuelatebusca.com (→ venezuela-te-busca-app.hellogafaro.workers.dev).
 *
 * El PARSEO, geocodificación y mapeo viven en `./venezuela-te-busca-core.mjs`
 * (compartido con el Worker cron-ingest → una sola fuente de verdad). Este script
 * añade solo: conexión pg + insert idempotente + bucle principal con CLI.
 *
 * Decisiones del founder:
 *  - Ingerir AMBAS: missing → 'missing'; found ("está bien") → 'found_alive'.
 *  - Auto-aprobadas (moderation_status='approved') con atribución + opt-out.
 *  - Solo las geocodificables (la fuente no da coords → texto a barrio/ciudad).
 *
 * Privacidad: NUNCA se republica la PII del reportante; el trigger ofusca 300m y
 * fuerza foto admin_only si la edad es <18/desconocida. Ética (#12): UA, 1 req/2s.
 *
 * Uso:
 *   node scripts/ingest/venezuela-te-busca.mjs --dry [--pages N]      # no escribe
 *   DATABASE_URL="..." node scripts/ingest/venezuela-te-busca.mjs --apply [--pages N]
 *
 * NOTA: el host directo de Supabase es IPv6; en redes IPv4 usa la cadena del
 * POOLER (Supabase → Connect → Session pooler) en DATABASE_URL.
 */
import pg from 'pg';
import { SOURCE, THROTTLE_MS, sleep, fetchPageValid, mapRecord } from './venezuela-te-busca-core.mjs';

const args = process.argv.slice(2);
const DRY = args.includes('--dry') || !args.includes('--apply');
const pagesArg = args.indexOf('--pages');
const MAX_PAGES = pagesArg >= 0 ? parseInt(args[pagesArg + 1], 10) : Infinity;

// Inserta un lote — idempotente por (source, source_id). Query EXACTA de siempre.
async function insertBatch(client, records) {
  let n = 0;
  for (const r of records) {
    const res = await client.query(
      `insert into persons
         (source, source_id, source_url, given_name, family_name, age, sex, status,
          last_known_location_text, description, photo_url, last_known_location_point,
          moderation_status)
       select $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
              ST_SetSRID(ST_MakePoint($12,$13),4326)::geography, 'approved'
       where not exists (select 1 from persons where source=$1 and source_id=$2)`,
      [
        r.source, r.source_id, r.source_url, r.given_name, r.family_name, r.age, r.sex,
        r.status, r.last_known_location_text, r.description, r.photo_url, r.lng, r.lat
      ]
    );
    n += res.rowCount;
  }
  return n;
}

// ── main (incremental + resiliente) ──────────────────────────────────────────
const t0 = Date.now();
console.log(`[ingest] ${SOURCE} — ${DRY ? 'DRY RUN (no escribe)' : 'APPLY (escribe a DB)'}` +
  (MAX_PAGES !== Infinity ? ` · max ${MAX_PAGES} páginas` : ''));

let client = null;
if (!DRY) {
  if (!process.env.DATABASE_URL) {
    console.error('✖ Falta DATABASE_URL para --apply.');
    process.exit(1);
  }
  client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
}

const seenIds = new Set();
const byStatus = {};
let pageNum = 1, pagesFetched = 0, geocodable = 0, withPhoto = 0, inserted = 0, skipped = 0;
let totalCount = null, stats = null, maxPages = Infinity, emptyStreak = 0, stopped = '';

try {
  while (pageNum <= maxPages && pagesFetched < MAX_PAGES) {
    let pageData;
    try {
      pageData = await fetchPageValid(pageNum);
    } catch (e) {
      stopped = `página ${pageNum} falló tras reintentos (${e.message}) — corto y conservo lo insertado`;
      console.error('✖ ' + stopped);
      break;
    }
    const { persons, totalCount: tc, stats: st } = pageData;
    if (totalCount === null) {
      totalCount = tc;
      stats = st;
      maxPages = totalCount ? Math.ceil(totalCount / 20) + 3 : Infinity;
      console.log(`Fuente: totalCount=${totalCount} ${JSON.stringify(stats)} (~${maxPages} págs)`);
    }
    if (persons.length === 0) {
      emptyStreak++;
      skipped++;
      if (emptyStreak >= 5) break;
      pageNum++;
      await sleep(THROTTLE_MS);
      continue;
    }
    emptyStreak = 0;
    const batch = [];
    for (const p of persons) {
      if (!p.id || seenIds.has(p.id)) continue;
      seenIds.add(p.id);
      const rec = mapRecord(p);
      if (rec) {
        batch.push(rec);
        geocodable++;
        byStatus[rec.status] = (byStatus[rec.status] || 0) + 1;
        if (rec.photo_url) withPhoto++;
      }
    }
    if (!DRY && batch.length) inserted += await insertBatch(client, batch);
    pagesFetched++;
    if (pagesFetched <= 3 || pagesFetched % 25 === 0) {
      console.log(`[pág ${pageNum}] escaneados ${seenIds.size} · geocodables ${geocodable} · con foto ${withPhoto}` +
        (!DRY ? ` · NUEVOS ${inserted}` : '') + (skipped ? ` · saltadas ${skipped}` : ''));
    }
    pageNum++;
    await sleep(THROTTLE_MS);
  }
} finally {
  if (client) await client.end();
}

console.log(`\n── Resumen ──`);
console.log(`Escaneados: ${seenIds.size} en ${pagesFetched} páginas (fuente total ${totalCount}; ${skipped} vacías saltadas)`);
console.log(`Geocodables: ${geocodable} · por status ${JSON.stringify(byStatus)} · con foto ${withPhoto}`);
if (!DRY) console.log(`✓ NUEVOS insertados: ${inserted} (idempotente por source_id; lo demás ya existía).`);
if (stopped) console.log(`⚠ Cortado: ${stopped}. Re-correr es seguro (idempotente).`);
console.log(`(${((Date.now() - t0) / 1000 / 60).toFixed(1)} min)`);
