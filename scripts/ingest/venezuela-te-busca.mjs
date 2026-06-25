#!/usr/bin/env node
/**
 * Ingesta ÉTICA de venezuelatebusca.com (→ venezuela-te-busca-app.hellogafaro.workers.dev).
 *
 * La fuente es una SPA React Router; los datos salen de /_root.data (turbo-stream,
 * paginado por cursor). Cada persona trae: firstName, lastName, idNumber, age,
 * gender, lastSeen (TEXTO de lugar, no coords), status (missing|found), photoUrl,
 * description, reporter{name,phone,email}.
 *
 * Decisiones del founder:
 *  - Ingerir AMBAS: missing → 'missing'; found ("está bien") → 'found_alive' (verde).
 *  - Auto-aprobadas (moderation_status='approved') con atribución + opt-out.
 *  - Solo las que tengan ubicación geocodificable (la fuente no da coordenadas →
 *    geocodificamos el texto a nivel barrio/ciudad; pin APROXIMADO).
 *
 * Privacidad (CLAUDE):
 *  - NUNCA republicamos la PII del reportante (name/phone/email de la fuente).
 *  - El trigger de obfuscación aplica 300m sobre el punto al insertar.
 *  - Foto: se guarda la URL de la fuente; el trigger 0012 fuerza admin_only si la
 *    edad es <18 o desconocida (fail-safe regla #3) → la vista la oculta.
 *
 * Ética (CLAUDE #12): UA identificada, throttle 1 req/2s, robots.txt ya revisado
 * (sin Disallow). Atribución source + source_url + opt-out.
 *
 * Uso:
 *   node scripts/ingest/venezuela-te-busca.mjs --dry [--pages N]      # no escribe
 *   DATABASE_URL="..." node scripts/ingest/venezuela-te-busca.mjs --apply [--pages N]
 */
import pg from 'pg';
import { geocode } from './geocode.mjs';

const BASE = 'https://venezuela-te-busca-app.hellogafaro.workers.dev';
const SOURCE = 'venezuela-te-busca';
const SOURCE_URL = 'https://venezuelatebusca.com';
const UA = 'FaroVE-IngestBot/1.0 (+contacto@faro-ve.com)';
const THROTTLE_MS = 2000;

const args = process.argv.slice(2);
const DRY = args.includes('--dry') || !args.includes('--apply');
const pagesArg = args.indexOf('--pages');
const MAX_PAGES = pagesArg >= 0 ? parseInt(args[pagesArg + 1], 10) : Infinity;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── turbo-stream decoder (validado contra la fuente) ────────────────────────
function decode(arr) {
  const R = (i, d = 0) => {
    if (d > 10) return null;
    const v = arr[i];
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map((x) => R(x, d + 1));
    const o = {};
    for (const k of Object.keys(v)) {
      const key = k[0] === '_' ? arr[+k.slice(1)] : k;
      o[key] = R(v[k], d + 1);
    }
    return o;
  };
  return R(0);
}

// La fuente pagina por número de página: pagination = { page, hasMore }. (Antes
// exponía nextHref; cambió de formato y dejó la ingesta estancada en la página 1.)
async function fetchPage(page) {
  const url = `${BASE}/_root.data${page > 1 ? `?page=${page}` : ''}`;
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/x-script' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  const text = await res.text();
  const arr = JSON.parse(text.split('\n')[0]);
  const data = decode(arr)['routes/_index'].data;
  const persons = data.persons || [];
  const hasMore = !!data.pagination?.hasMore;
  return { persons, hasMore, totalCount: data.totalCount, stats: data.stats };
}

// geocoding: texto de lugar → [lat,lng]. Tabla determinista nacional + selección
// por aguja más larga (más específica). Ver scripts/ingest/geocode.mjs (testeado).

function classify(status) {
  if (status === 'found') return 'found_alive';
  return 'missing';
}
function sexOf(g) {
  if (g === 'masculino') return 'male';
  if (g === 'femenino') return 'female';
  return 'unknown';
}

function mapRecord(p) {
  const coords = geocode(p.lastSeen);
  if (!coords) return null; // sin ubicación geocodificable → no va al mapa
  const [lat, lng] = coords;
  const age = Number.isFinite(p.age) && p.age > 0 && p.age <= 130 ? p.age : null;
  return {
    source: SOURCE,
    source_id: String(p.id),
    source_url: SOURCE_URL,
    given_name: (p.firstName || '').trim() || null,
    family_name: (p.lastName || '').trim() || null,
    age,
    sex: sexOf(p.gender),
    status: classify(p.status),
    last_known_location_text: String(p.lastSeen).trim().slice(0, 300),
    description: p.description ? String(p.description).trim().slice(0, 2000) : null,
    photo_url: p.photoUrl ? `${BASE}${p.photoUrl}` : null,
    lat,
    lng
  };
}

async function collect() {
  const out = [];
  const seenIds = new Set();
  let pageNum = 1;
  let pagesFetched = 0;
  let totalCount = null;
  let stats = null;
  while (pagesFetched < MAX_PAGES) {
    const { persons, hasMore, totalCount: tc, stats: st } = await fetchPage(pageNum);
    if (totalCount === null) {
      totalCount = tc;
      stats = st;
    }
    for (const p of persons) {
      if (!p.id || seenIds.has(p.id)) continue;
      seenIds.add(p.id);
      const rec = mapRecord(p);
      if (rec) out.push(rec);
    }
    pagesFetched++;
    if (!hasMore || persons.length === 0) break;
    pageNum++;
    await sleep(THROTTLE_MS);
  }
  return { records: out, pages: pagesFetched, totalCount, stats, scanned: seenIds.size };
}

async function insertAll(records) {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  let inserted = 0;
  try {
    for (const r of records) {
      // Inserta solo si no existe ya (source, source_id) → idempotente.
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
      inserted += res.rowCount;
    }
  } finally {
    await client.end();
  }
  return inserted;
}

// ── main ────────────────────────────────────────────────────────────────────
const t0 = Date.now();
console.log(`[ingest] ${SOURCE} — ${DRY ? 'DRY RUN (no escribe)' : 'APPLY (escribe a DB)'}` +
  (MAX_PAGES !== Infinity ? ` · max ${MAX_PAGES} páginas` : ''));

const { records, pages, totalCount, stats, scanned } = await collect();
const byStatus = records.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
const withPhoto = records.filter((r) => r.photo_url).length;

console.log(`\nFuente: totalCount=${totalCount} ${JSON.stringify(stats)}`);
console.log(`Escaneados: ${scanned} en ${pages} páginas`);
console.log(`Geocodificables (irían al mapa): ${records.length}`);
console.log(`  por status: ${JSON.stringify(byStatus)}`);
console.log(`  con foto: ${withPhoto}`);
console.log(`Muestra:`);
for (const r of records.slice(0, 5)) {
  console.log(`  • ${r.given_name || ''} ${r.family_name || ''} [${r.status}] @ ${r.last_known_location_text} → ${r.lat},${r.lng}${r.photo_url ? ' (foto)' : ''}`);
}

if (!DRY) {
  if (!process.env.DATABASE_URL) {
    console.error('\n✖ Falta DATABASE_URL para --apply.');
    process.exit(1);
  }
  console.log(`\nInsertando ${records.length} registros…`);
  const n = await insertAll(records);
  console.log(`✓ Insertados ${n} nuevos (idempotente por source_id).`);
}
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
