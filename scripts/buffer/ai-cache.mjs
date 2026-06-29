/**
 * Cache PERSISTENTE y COMPARTIDA de veredictos de IA (Haiku) para los scripts del
 * auto-publicador / reconcile. Objetivo (Misión, Art. 3 — eficiencia económica):
 * NO re-pagar a Anthropic por lo ya resuelto.
 *
 *  - Foto (classifyPhoto): clave = URL. El mismo URL = la misma imagen = el mismo
 *    veredicto → se cachea PARA SIEMPRE (incluidos los rechazos: una foto-flyer no
 *    deja de ser flyer). Si la photo_url cambia, la clave cambia → se re-clasifica.
 *  - Reencuentro (confirmReunification): clave = par (faro+found normalizado). El
 *    veredicto IA del par no cambia → se reusa. NO sustituye a la IA en pares NUEVOS
 *    (ahí está la seguridad anti-homónimo); solo evita re-evaluar los ya vistos.
 *
 * Archivo único compartido por cron-ig, reconcile, seed y carousel:
 *   ~/.faro-ig/ai-cache.json   { "<ns>": { "<key>": { "v": <valor>, "ts": <ms> } } }
 *
 * Robusto a multi-proceso: read-modify-write por cada set (archivo chico, escrituras
 * infrecuentes). Ante cualquier error de IO devuelve undefined / no rompe el llamador.
 */
import fs from 'fs';
import path from 'path';

const FILE = path.join(process.env.HOME, '.faro-ig', 'ai-cache.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

/** Devuelve el valor cacheado (o undefined si no existe). */
export function getCached(ns, key) {
  const db = load();
  return db[ns]?.[key]?.v;
}

/** Guarda un valor bajo (ns, key). No lanza nunca. */
export function setCached(ns, key, value) {
  try {
    const db = load();
    (db[ns] ||= {})[key] = { v: value, ts: Date.now() };
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(db));
  } catch {
    /* IO best-effort: si falla, simplemente no se cachea */
  }
}

/** Stats para el reporte de mantenimiento. */
export function cacheStats() {
  const db = load();
  const out = {};
  for (const ns of Object.keys(db)) out[ns] = Object.keys(db[ns]).length;
  return out;
}
