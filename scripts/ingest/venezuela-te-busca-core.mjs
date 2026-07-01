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

// Busqueda paginada por CURSOR. La fuente dejo de paginar por ?page=N (esa vista
// devuelve solo 24 recientes con hasMore:false); ahora SOLO query (>=3 chars,
// substring de nombre Y ubicacion) pagina, con un token cursor opaco (base64) que
// la respuesta da en pagination.nextCursor. Orden created_at desc (los nuevos
// primero). Primera pagina: sin cursor; siguientes: se reenvia el nextCursor.
export async function fetchSearch(query, cursor = null, fetchImpl = fetch) {
  const cq = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
  const url = `${BASE}/_root.data?query=${encodeURIComponent(query)}${cq}`;
  const res = await fetchImpl(url, { headers: { 'user-agent': UA, accept: 'text/x-script' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  const arr = JSON.parse((await res.text()).split('\n')[0]);
  const data = decode(arr)['routes/_index'].data;
  return {
    persons: data.persons || [],
    nextCursor: data.pagination?.nextCursor ?? null,
    hasMore: !!data.pagination?.hasMore
  };
}

// fetchSearch con reintentos (la fuente a veces responde vacio espurio).
export async function fetchSearchValid(query, cursor = null, { fetchImpl = fetch, tries = 4 } = {}) {
  let last = { persons: [], nextCursor: null, hasMore: false };
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetchSearch(query, cursor, fetchImpl);
      last = r;
      if (r.persons.length > 0 || !r.hasMore) return r;
    } catch (e) {
      if (i === tries - 1) throw e;
    }
    await sleep(THROTTLE_MS * (i + 2));
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

// Limpia texto para jsonb: quita NUL y otros controles C0 (deja tab/nl/cr). La
// fuente a veces filtra binario/EXIF en campos de texto y el NUL rompe ::jsonb.
export function cleanText(s) {
  if (s == null) return null;
  let out = '';
  const str = String(s);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c === 9 || c === 10 || c === 13 || c >= 32) out += str[i];
  }
  out = out.trim();
  return out.length ? out : null;
}

/**
 * Mapea un registro de la fuente → fila `persons`. NUNCA descarta: si la
 * ubicación no es geocodificable, la persona igual entra (lat/lng = null) → es
 * BUSCABLE por nombre y muestra su ubicación en TEXTO, solo SIN pin en el mapa.
 * Así nadie queda sin posibilidad de ser ubicado (meta del founder). Devuelve
 * null SOLO si falta el id (sin id no se puede deduplicar ni referenciar).
 */
export function mapRecord(p) {
  if (p.id == null || String(p.id).trim() === '') return null;
  const coords = geocode(p.lastSeen); // [lat,lng] o null
  const lat = coords ? coords[0] : null;
  const lng = coords ? coords[1] : null;
  const age = Number.isFinite(p.age) && p.age > 0 && p.age <= 130 ? p.age : null;
  const lastSeen = p.lastSeen != null ? String(p.lastSeen).trim().slice(0, 300) : '';
  return {
    source: SOURCE,
    source_id: String(p.id),
    source_url: SOURCE_URL,
    given_name: cleanText(p.firstName),
    family_name: cleanText(p.lastName),
    age,
    sex: sexOf(p.gender),
    status: classify(p.status),
    last_known_location_text: cleanText(lastSeen),
    description: cleanText(p.description != null ? String(p.description).slice(0, 2000) : null),
    // Foto: solo URLs que existen. Las '/migrated/' de la fuente dan 404 → null.
    photo_url: p.photoUrl && !p.photoUrl.includes('/migrated/') ? `${BASE}${p.photoUrl}` : null,
    lat,
    lng
  };
}
