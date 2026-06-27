/**
 * Faro VE — Política de la cola de reportes OFFLINE (lógica PURA, testeable en
 * node). El estado (Dexie/IndexedDB), el cifrado (Web Crypto) y los disparadores
 * (eventos, navigator.locks, Turnstile) viven en $lib/client/* y se verifican en
 * navegador real. Aquí solo decisiones deterministas:
 *
 *  - classifyResponse: traduce la respuesta de la cadena dura (hooks + endpoint)
 *    a una ACCIÓN de reintento, sin descartar reportes válidos por un 429/503.
 *  - backoff / nextAttemptDelay: reintentos respetuosos (jitter + techo) para no
 *    auto-DoSear el endpoint (cap 10/h) durante un pico.
 *  - minimizeEnqueuablePayload: minimización de PII ANTES de tocar el disco
 *    (reglas #1, #2, #26): nunca persiste el token Turnstile ni el ip_hashed, y
 *    no guarda la coord exacta de un auto-reporte 'a salvo' sin opt-in explícito.
 *  - isExpired / shouldGiveUp: retención local acotada (#6 Habeas Data).
 */

// Retención local: el founder eligió 48h (margen para reabrir con señal antes de
// perder el reporte). Aun así se purga al enviar, al volver la señal y al abrir.
export const OUTBOX_TTL_MS = 48 * 60 * 60 * 1000;
// Tope FIFO de entradas en el dispositivo (defensa de cuota + minimización).
export const OUTBOX_CAP = 50;
// Intentos antes de marcar 'needs_attention' (deja de reintentar solo).
export const MAX_ATTEMPTS = 8;

export const BACKOFF_BASE_MS = 5_000; // 5s
export const BACKOFF_CEIL_MS = 30 * 60 * 1000; // 30 min
export const DEFERRED_FLOOR_MS = 15 * 60 * 1000; // 503 / INSERTS_PAUSED → espera larga

export type ReplayKind =
  | 'success'
  | 'permanent'
  | 'transient'
  | 'transient-deferred'
  | 'rate-limited'
  | 'turnstile';

export interface ReplayOutcome {
  kind: ReplayKind;
  retryAfterSec?: number;
}

type ResponseBody = Record<string, unknown> | null | undefined;

function asPositiveInt(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : undefined;
}

/**
 * Clasifica la respuesta HTTP del reenvío. La cadena dura produce varios 4xx/503
 * que NO son permanentes; tratarlos como tales descartaría un reporte válido
 * (p.ej. durante INSERTS_PAUSED #29 o un pico de rate-limit). 2xx con o sin
 * `duplicate:true` es éxito idempotente (la fila ya existe server-side).
 */
export function classifyResponse(status: number, body?: ResponseBody): ReplayOutcome {
  if (status >= 200 && status < 300) return { kind: 'success' };
  if (status === 400) return { kind: 'permanent' };
  if (status === 403) return { kind: 'turnstile' }; // solo Turnstile devuelve 403 aquí
  if (status === 429) return { kind: 'rate-limited', retryAfterSec: asPositiveInt(body?.retry_after_sec) };
  if (status === 503) return { kind: 'transient-deferred' }; // inserts_paused / misconfig
  if (status >= 500) return { kind: 'transient' }; // 500/502 (error DB) → reintentar
  return { kind: 'permanent' }; // otros 4xx inesperados (404/413/422…) → no martillar
}

/**
 * Backoff exponencial con FULL JITTER y techo. El jitter reparte la presión de
 * múltiples clientes reconectando a la vez. `rng` se inyecta para tests
 * deterministas (default Math.random en runtime de navegador).
 */
export function backoffMs(attempts: number, rng: () => number = Math.random): number {
  const exp = Math.max(0, attempts - 1);
  const capped = Math.min(BACKOFF_CEIL_MS, BACKOFF_BASE_MS * 2 ** exp);
  // Full jitter sobre el valor ya acotado → el resultado nunca supera el techo.
  return capped / 2 + rng() * (capped / 2);
}

/** Espera hasta el próximo intento según la clase de outcome + el backoff. */
export function nextAttemptDelayMs(
  outcome: ReplayOutcome,
  attempts: number,
  rng: () => number = Math.random
): number {
  const b = backoffMs(attempts, rng);
  switch (outcome.kind) {
    case 'rate-limited':
      // Respeta el retry_after del server; si no vino, usa el backoff.
      return Math.max((outcome.retryAfterSec ?? 0) * 1000, b);
    case 'transient-deferred':
      return Math.max(DEFERRED_FLOOR_MS, b);
    case 'turnstile':
      // Token nuevo y reintento pronto (no es culpa del reporte).
      return Math.min(b, 30_000);
    case 'transient':
      return b;
    default:
      return 0; // success / permanent → no se reprograma
  }
}

export function isExpired(createdAt: number, now: number): boolean {
  return now - createdAt > OUTBOX_TTL_MS;
}

export function shouldGiveUp(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS;
}

/**
 * LISTA BLANCA de campos que un reporte de persona puede llevar a la cola (espeja
 * reportPersonSchema en $schemas/person, MENOS los que jamás deben quedar at-rest:
 * `cf-turnstile-response` (token de un solo uso que caduca) y `reporter_ip_hashed`
 * (lo pone el server). Cualquier campo NO listado (flag de debug, campo nuevo
 * añadido sin revisar aquí) NO se cifra ni se guarda en el dispositivo.
 */
export const ENQUEUABLE_FIELDS = [
  'given_name', 'family_name', 'alternate_names',
  'sex', 'age', 'status',
  'last_known_location_text', 'lat', 'lng', 'last_seen_at',
  'home_neighborhood', 'home_city', 'home_state',
  'description', 'height_cm',
  'clothing_top', 'clothing_bottom', 'clothing_shoes', 'distinguishing_marks', 'photo_url',
  'medical_urgent', 'medical_category', 'medical_notes',
  'share_exact_location_with_searchers', 'contact_phone_public',
  'reporter_relation', 'reporter_name', 'reporter_email', 'reporter_phone',
  'reporter_country', 'reporter_consent_relay',
  'client_uuid'
] as const;

/**
 * Minimiza el payload ANTES de cifrarlo y guardarlo en el dispositivo.
 * Inmutable (devuelve copia). ALLOWLIST estricta (arriba) + regla de ubicación:
 *  - Auto-reporte 'a salvo' SIN opt-in de ubicación exacta → no guarda lat/lng
 *    (la coord exacta del propio sujeto no debe quedar at-rest si no la compartió;
 *    el texto de zona se conserva). Para reportes de TERCEROS (desaparecido /
 *    cuerpo-NN / condición médica) lat/lng se conserva: se ofusca server-side y
 *    no es PII del reportante.
 */
export function minimizeEnqueuablePayload(
  body: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ENQUEUABLE_FIELDS) {
    if (k in body && body[k] !== undefined) out[k] = body[k];
  }

  if (out.status === 'safe_self_report' && out.share_exact_location_with_searchers !== true) {
    delete out.lat;
    delete out.lng;
  }
  return out;
}
