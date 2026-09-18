/**
 * Núcleo compartido de la ingesta de venezuelatebusca.com — SIN dependencias de
 * Node ni de base de datos (solo `fetch` + geocodificación offline). Lo usan:
 *   - scripts/ingest/venezuela-te-busca.mjs  (corre con pg, desde una red IPv6)
 *   - workers/cron-ingest                    (corre en Cloudflare, escribe vía Supabase)
 *
 * Así el PARSEO y el MAPEO viven en UN solo lugar (no se duplican ni divergen).
 * La fuente es una SPA React Router; los datos salen de `${DATA_PATH}` (turbo-stream,
 * paginado por cursor). Geocodificación: tabla determinista offline (geocode.mjs).
 *
 * MUDANZA DE LA FUENTE (5/6-sep-2026, diagnosticada el 18-sep). La app dejó de
 * servirse en `venezuela-te-busca-app.hellogafaro.workers.dev` (hoy responde
 * `404 · error code: 1042` a TODO, igual que un Worker inexistente) y pasó a
 * `app.venezuelateayuda.com`; además movió el buscador de `/` a `/finder`, así que
 * los datos ya no están en `/_root.data` (clave `routes/_index`) sino en
 * `/finder.data` (clave `routes/finder`). Misma forma de registro. Las fotos
 * conservan el path (`/media/photos/<id>`), solo cambia el host.
 * Si vuelve a mudarse: cambiar SOLO estas tres constantes (hay test que las fija).
 */
import { geocode } from './geocode.mjs';

export const BASE = 'https://app.venezuelateayuda.com';
export const DATA_PATH = '/finder.data'; // ruta de datos de React Router del buscador
export const ROUTE_KEY = 'routes/finder'; // clave de esa ruta dentro del turbo-stream
export const SOURCE = 'venezuela-te-busca';
export const SOURCE_URL = 'https://venezuelatebusca.com';
export const UA = 'FaroVE-IngestBot/1.0 (+contacto@faro-ve.com)';
export const THROTTLE_MS = 2000;
export const PAGE_SIZE = 20; // la fuente sirve 20 por página

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── errores: permanente vs transitorio ──────────────────────────────────────
// Mismo contrato que scripts/lib/fetch-json.mjs: lo permanente (4xx salvo 429, o
// una respuesta con OTRA estructura) NO se reintenta. Reintentar un 404 cuatro
// veces con esperas de 4+6+8 s costaba ~20 s por término × 155 términos ≈ 53 min:
// la ingesta moría por ETIMEDOUT a los 15 min sin decir nunca "404".
export function isPermanentError(e) {
  if (!e) return false;
  if (e.permanent === true) return true;
  const st = Number(e.status);
  return st >= 400 && st < 500 && st !== 429;
}

/** Error HTTP que conserva el status para poder clasificarlo. */
function httpError(status, url) {
  const err = new Error(`HTTP ${status} en ${url}`);
  err.status = status;
  return err;
}

/** Extrae los datos de la ruta; si la fuente cambió de estructura lo dice claro. */
function routeData(text, url) {
  let arr;
  try {
    arr = JSON.parse(text.split('\n')[0]);
  } catch {
    // 200 con HTML (challenge, página de error, SPA-fallback). Mismo criterio que
    // lib/fetch-json.mjs: puede ser pasajero → TRANSITORIO (se reintenta). Si resulta
    // permanente, el corte por racha lo frena en MAX_TERM_FAILS términos, no en 155.
    throw new Error(`La respuesta de ${url} no es turbo-stream JSON (¿página HTML/challenge?)`);
  }
  const root = decode(arr);
  const data = root?.[ROUTE_KEY]?.data;
  if (!data || typeof data !== 'object') {
    const err = new Error(
      `La respuesta de ${url} no trae "${ROUTE_KEY}" — ¿la fuente cambió de ruta o de dominio?`
    );
    err.permanent = true;
    throw err;
  }
  return data;
}

// ── corte por fallos consecutivos (regla #12) ───────────────────────────────
// Si N términos SEGUIDOS fallan, la fuente está caída o cambió: se aborta con un
// mensaje claro en vez de recorrer los 155 términos fallando uno por uno.
export const MAX_TERM_FAILS = 5;
export const nextFailStreak = (streak, failed) => (failed ? streak + 1 : 0);
export const shouldAbortIngest = (streak, limit = MAX_TERM_FAILS) => streak >= limit;
/**
 * Cuántos términos se dan por HECHOS al abortar: todos menos la racha fallida, para
 * que la próxima corrida retome en el primer término que falló y no re-escanee los
 * buenos. El término que dispara el corte no llegó a contarse (de ahí el `- 1`).
 */
export const resumeOffset = (termsDone, streak) =>
  Math.max(0, termsDone - Math.max(0, streak - 1));

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
  const url = `${BASE}${DATA_PATH}${page > 1 ? `?page=${page}` : ''}`;
  const res = await fetchImpl(url, { headers: { 'user-agent': UA, accept: 'text/x-script' } });
  if (!res.ok) throw httpError(res.status, url);
  const data = routeData(await res.text(), url);
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
      if (isPermanentError(e)) throw e; // 404/estructura nueva: reintentar es gasto inútil
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
  const url = `${BASE}${DATA_PATH}?query=${encodeURIComponent(query)}${cq}`;
  const res = await fetchImpl(url, { headers: { 'user-agent': UA, accept: 'text/x-script' } });
  if (!res.ok) throw httpError(res.status, url);
  const data = routeData(await res.text(), url);
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
      if (i === tries - 1 || isPermanentError(e)) throw e;
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
