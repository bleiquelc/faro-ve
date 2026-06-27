/**
 * Núcleo compartido de la ingesta de venezuelatebusca.com — SIN dependencias de
 * Node ni de base de datos (solo `fetch` + geocodificación offline). Lo usan:
 *   - scripts/ingest/venezuela-te-busca.mjs  (corre con pg, desde una red IPv6)
 *   - workers/cron-ingest                    (corre en Cloudflare, escribe vía Supabase)
 *
 * Así el PARSEO y el MAPEO viven en UN solo lugar (no se duplican ni divergen).
 * La fuente es una SPA React Router; los datos salen de /_root.data (turbo-stream,
 * paginado por página). Geocodificación: tabla determinista offline (geocode.mjs).
 */
import { geocode } from './geocode.mjs';

export const BASE = 'https://venezuela-te-busca-app.hellogafaro.workers.dev';
export const SOURCE = 'venezuela-te-busca';
export const SOURCE_URL = 'https://venezuelatebusca.com';
export const UA = 'FaroVE-IngestBot/1.0 (+contacto@faro-ve.com)';
export const THROTTLE_MS = 2000;
export const PAGE_SIZE = 20; // la fuente sirve 20 por página

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── turbo-stream decoder (validado contra la fuente) ────────────────────────
export function decode(arr) {
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

/** Descarga y decodifica una página. `fetchImpl` permite inyectar fetch (Workers). */
export async function fetchPage(page, fetchImpl = fetch) {
  const url = `${BASE}/_root.data${page > 1 ? `?page=${page}` : ''}`;
  const res = await fetchImpl(url, { headers: { 'user-agent': UA, accept: 'text/x-script' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  const text = await res.text();
  const arr = JSON.parse(text.split('\n')[0]);
  const data = decode(arr)['routes/_index'].data;
  const persons = data.persons || [];
  const hasMore = !!data.pagination?.hasMore;
  return {
    persons,
    hasMore,
    totalCount: data.totalCount,
    stats: data.stats,
    echoPage: data.pagination?.page
  };
}

/**
 * Página con reintentos + detección del "reset" espurio de la fuente (a veces
 * responde vacío con echoPage=1 en una página intermedia: glitch, no el fin).
 */
export async function fetchPageValid(page, { fetchImpl = fetch, tries = 4 } = {}) {
  let last = { persons: [], hasMore: true, echoPage: page };
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetchPage(page, fetchImpl);
      last = r;
      const glitch = r.persons.length === 0 || (page !== 1 && r.echoPage === 1);
      if (!glitch) return r;
    } catch (e) {
      if (i === tries - 1 && last.persons.length === 0) throw e;
    }
    if (i < tries - 1) await sleep(THROTTLE_MS * (i + 2));
  }
  return last;
}

export function classify(status) {
  return status === 'found' ? 'found_alive' : 'missing';
}
export function sexOf(g) {
  if (g === 'masculino') return 'male';
  if (g === 'femenino') return 'female';
  return 'unknown';
}

/** Mapea un registro de la fuente → fila `persons` (o null si no es geocodificable). */
export function mapRecord(p) {
  const coords = geocode(p.lastSeen);
  if (!coords) return null;
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
    // Foto: solo URLs que existen. Las '/migrated/' de la fuente dan 404 → null.
    photo_url: p.photoUrl && !p.photoUrl.includes('/migrated/') ? `${BASE}${p.photoUrl}` : null,
    lat,
    lng
  };
}
