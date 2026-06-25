import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

/**
 * Faro VE — hooks server-side.
 *
 * Responsabilidades:
 *  1. Inyectar clientes Supabase (anon + service_role) en locals.
 *  2. Resolver sesión moderador con VALIDACIÓN real (getUser + tabla moderators).
 *  3. Verificar Turnstile en POST públicos (anti-bot). Bypass SOLO moderador validado.
 *  4. Rate-limit por IP hasheada vía Cloudflare KV (ventana fija auto-expirante).
 *  5. Hashear IP del request — NUNCA en claro, ni siquiera sin salt.
 *  6. Fail-closed en producción: si falta APP_SALT / Turnstile secret / KV → 503.
 *  7. Leer kill switch INSERTS_PAUSED.
 *
 * Filosofía: en producción, ante misconfig de un control de abuso, FALLAMOS
 * CERRADO (503) en vez de dejar pasar silenciosamente. En dev (sin platform.env)
 * relajamos para poder iterar.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type Event = Parameters<Handle>[0]['event'];

function env(event: Event, key: string): string {
  const fromPlatform = (event.platform?.env as Record<string, string> | undefined)?.[key];
  if (fromPlatform !== undefined) return fromPlatform;
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key]!;
  }
  return '';
}

/**
 * ¿Estamos en runtime de producción/preview de Cloudflare? Sí cuando existe
 * platform.env (Workers). En vite dev local, platform es undefined → dev.
 */
function isProduction(event: Event): boolean {
  return !!event.platform?.env;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomId(): string {
  // Correlation id para trazar errores sin exponer internals al cliente.
  return crypto.randomUUID();
}

const PUBLIC_POST_PATHS = new Set([
  '/api/persons',
  '/api/notes',
  '/api/message',
  '/api/aid-points',
  '/api/offline-sync',
  '/api/ai/ask'
]);

function isPublicMutation(event: Event): boolean {
  if (event.request.method !== 'POST' && event.request.method !== 'PUT') return false;
  return PUBLIC_POST_PATHS.has(event.url.pathname);
}

/** ¿El request trae una cookie de sesión Supabase? Evita getUser() en tráfico anónimo. */
function hasAuthCookie(event: Event): boolean {
  return event.cookies.getAll().some((c) => c.name.includes('auth-token'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Handle: contexto — IP SIEMPRE hasheada (nunca en claro), kill switch
// ─────────────────────────────────────────────────────────────────────────────

const handleContext: Handle = async ({ event, resolve }) => {
  const APP_SALT = env(event, 'APP_SALT');
  const ip = event.getClientAddress();
  // IP siempre hasheada. Sin salt usamos un marcador FIJO (no la IP) para no
  // persistir jamás una IP en claro. La ausencia de salt se bloquea aparte
  // (handleConfigGuard) para mutaciones en prod.
  event.locals.ipHashed = await sha256Hex(`${ip}::${APP_SALT || 'NO_SALT'}`);

  event.locals.insertsPaused = env(event, 'INSERTS_PAUSED').toLowerCase() === 'true';
  event.locals.turnstileVerified = false;
  event.locals.moderator = null;

  return resolve(event);
};

// ─────────────────────────────────────────────────────────────────────────────
// Handle: clientes Supabase
// ─────────────────────────────────────────────────────────────────────────────

const handleSupabase: Handle = async ({ event, resolve }) => {
  const SUPABASE_URL = env(event, 'PUBLIC_SUPABASE_URL');
  const SUPABASE_ANON_KEY = env(event, 'PUBLIC_SUPABASE_ANON_KEY');
  const SUPABASE_SERVICE_ROLE_KEY = env(event, 'SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    if (event.url.pathname.startsWith('/api/')) {
      return new Response(
        JSON.stringify({ error: 'config_missing', message: 'Supabase no configurado.' }),
        { status: 503, headers: { 'content-type': 'application/json' } }
      );
    }
    // Páginas no-API (home, legales): seguir sin Supabase para no crashear el
    // sitio si el env aún no está configurado (createServerClient lanza con URL
    // vacía). Los handlers de mutación pública ya exigen config aparte.
    return resolve(event);
  }

  event.locals.supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) =>
        cookiesToSet.forEach(({ name, value, options }) =>
          event.cookies.set(name, value, { ...options, path: '/' })
        )
    }
  });

  // supabaseAdmin solo si hay service_role. Sin él, fallback al cliente anon
  // (endpoints de solo-lectura como el mapa funcionan; los que necesitan admin
  // —encriptar PII al reportar— fallarán visiblemente, lo cual es correcto).
  event.locals.supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
    : event.locals.supabase;

  event.locals.getSession = async () => {
    const { data } = await event.locals.supabase.auth.getSession();
    return data.session;
  };

  return resolve(event, {
    filterSerializedResponseHeaders: (name) => name === 'content-range'
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Handle: moderador VALIDADO — getUser() (verifica JWT contra Supabase Auth)
// + lookup en tabla moderators. NUNCA confiar en getSession() (cookie sin validar).
// ─────────────────────────────────────────────────────────────────────────────

const handleModerator: Handle = async ({ event, resolve }) => {
  // Solo gastar el round-trip getUser() si hay cookie de sesión.
  if (event.locals.supabase && hasAuthCookie(event)) {
    try {
      const {
        data: { user }
      } = await event.locals.supabase.auth.getUser();
      if (user?.email) {
        const { data: mod } = await event.locals.supabaseAdmin
          .from('moderators')
          .select('id, email, role')
          .eq('email', user.email.toLowerCase())
          .eq('active', true)
          .maybeSingle();
        if (mod) {
          event.locals.moderator = {
            id: mod.id as string,
            email: mod.email as string,
            role: mod.role as 'admin' | 'moderator'
          };
        }
      }
    } catch {
      // getUser falló (cookie inválida/expirada) → seguimos como anónimo.
      event.locals.moderator = null;
    }
  }
  return resolve(event);
};

// ─────────────────────────────────────────────────────────────────────────────
// Handle: config guard — en PROD, mutación pública sin controles → 503 (fail-closed)
// ─────────────────────────────────────────────────────────────────────────────

const handleConfigGuard: Handle = async ({ event, resolve }) => {
  if (!isProduction(event) || !isPublicMutation(event)) return resolve(event);

  const missing: string[] = [];
  if (!env(event, 'APP_SALT')) missing.push('APP_SALT');
  if (!env(event, 'TURNSTILE_SECRET_KEY')) missing.push('TURNSTILE_SECRET_KEY');
  if (!(event.platform?.env as { RATE_LIMIT?: unknown } | undefined)?.RATE_LIMIT) {
    missing.push('RATE_LIMIT');
  }

  if (missing.length > 0) {
    console.error(`[config-guard] PROD sin controles: falta ${missing.join(', ')} — 503`);
    return new Response(
      JSON.stringify({
        error: 'service_misconfigured',
        message: 'El servicio no está disponible en este momento. Intenta más tarde.'
      }),
      { status: 503, headers: { 'content-type': 'application/json' } }
    );
  }
  return resolve(event);
};

// ─────────────────────────────────────────────────────────────────────────────
// Handle: Turnstile (anti-bot). Bypass SOLO con moderador validado.
// ─────────────────────────────────────────────────────────────────────────────

const handleTurnstile: Handle = async ({ event, resolve }) => {
  if (!isPublicMutation(event)) return resolve(event);

  // Bypass únicamente para moderador VALIDADO (getUser + tabla moderators).
  if (event.locals.moderator) {
    event.locals.turnstileVerified = true;
    return resolve(event);
  }

  const TURNSTILE_SECRET_KEY = env(event, 'TURNSTILE_SECRET_KEY');
  if (!TURNSTILE_SECRET_KEY) {
    // En prod este caso ya fue bloqueado por handleConfigGuard (503).
    // En dev, sin secret, permitimos para iterar.
    if (isProduction(event)) {
      return new Response(JSON.stringify({ error: 'turnstile_unavailable' }), {
        status: 503,
        headers: { 'content-type': 'application/json' }
      });
    }
    event.locals.turnstileVerified = false;
    return resolve(event);
  }

  const cloned = event.request.clone();
  let token = '';
  try {
    const ct = event.request.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      const body = (await cloned.json()) as Record<string, unknown>;
      token = (body['cf-turnstile-response'] as string) ?? '';
    } else if (
      ct.includes('multipart/form-data') ||
      ct.includes('application/x-www-form-urlencoded')
    ) {
      const form = await cloned.formData();
      token = (form.get('cf-turnstile-response') as string) ?? '';
    }
    // Cualquier otro content-type (text/plain, etc.) deja token vacío → 403 abajo.
  } catch {
    /* parse falló → token vacío → 403 */
  }

  if (!token) {
    return new Response(JSON.stringify({ error: 'turnstile_required' }), {
      status: 403,
      headers: { 'content-type': 'application/json' }
    });
  }

  const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: event.getClientAddress()
    })
  });
  const result = (await verify.json()) as { success: boolean };

  if (!result.success) {
    return new Response(JSON.stringify({ error: 'turnstile_failed' }), {
      status: 403,
      headers: { 'content-type': 'application/json' }
    });
  }

  event.locals.turnstileVerified = true;
  return resolve(event);
};

// ─────────────────────────────────────────────────────────────────────────────
// Handle: rate-limit por IP hasheada (ventana fija auto-expirante en KV)
// ─────────────────────────────────────────────────────────────────────────────

const RATE_LIMITS: Record<string, { windowSec: number; max: number }> = {
  '/api/persons': { windowSec: 3600, max: 5 },
  '/api/notes': { windowSec: 600, max: 10 },
  '/api/message': { windowSec: 600, max: 6 },
  '/api/aid-points': { windowSec: 3600, max: 10 },
  '/api/offline-sync': { windowSec: 60, max: 20 },
  '/api/ai/ask': { windowSec: 86400, max: 10 }
};

const handleRateLimit: Handle = async ({ event, resolve }) => {
  if (!isPublicMutation(event)) return resolve(event);

  const cfg = RATE_LIMITS[event.url.pathname];
  if (!cfg) return resolve(event);

  const kv = (event.platform?.env as { RATE_LIMIT?: KVNamespace } | undefined)?.RATE_LIMIT;
  if (!kv) {
    // Prod sin KV ya devolvió 503 en handleConfigGuard. Aquí solo dev.
    if (isProduction(event)) {
      return new Response(JSON.stringify({ error: 'rate_limiter_unavailable' }), {
        status: 503,
        headers: { 'content-type': 'application/json' }
      });
    }
    console.warn('[rate-limit] KV no disponible (dev) — saltando');
    return resolve(event);
  }

  // Ventana fija: el bucket va EN la clave, así cada ventana es una clave nueva
  // y siempre ponemos expirationTtl → la clave se auto-expira (no se vuelve
  // permanente nunca, evita DoS a IPs detrás de NAT compartido).
  const windowBucket = Math.floor(Date.now() / 1000 / cfg.windowSec);
  const key = `rl:${event.url.pathname}:${event.locals.ipHashed}:${windowBucket}`;

  const count = parseInt((await kv.get(key)) ?? '0', 10) || 0;
  if (count >= cfg.max) {
    return new Response(JSON.stringify({ error: 'rate_limited', retry_after_sec: cfg.windowSec }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': cfg.windowSec.toString() }
    });
  }

  // Siempre con TTL (≈ lo que resta de la ventana, mínimo 60s para cubrir skew).
  const remaining = cfg.windowSec - (Math.floor(Date.now() / 1000) % cfg.windowSec);
  await kv.put(key, (count + 1).toString(), { expirationTtl: Math.max(60, remaining) });

  return resolve(event);
};

// ─────────────────────────────────────────────────────────────────────────────
// Handle: kill switch INSERTS_PAUSED
// ─────────────────────────────────────────────────────────────────────────────

const handleKillSwitch: Handle = async ({ event, resolve }) => {
  if (!isPublicMutation(event)) return resolve(event);
  if (!event.locals.insertsPaused) return resolve(event);

  return new Response(
    JSON.stringify({
      error: 'inserts_paused',
      message: 'Las nuevas entradas están pausadas temporalmente. Vuelve en unos minutos.'
    }),
    { status: 503, headers: { 'content-type': 'application/json' } }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Export — orden: contexto → supabase → moderador → config-guard → turnstile
//          → rate-limit → kill switch.
// ─────────────────────────────────────────────────────────────────────────────

export const handle = sequence(
  handleContext,
  handleSupabase,
  handleModerator,
  handleConfigGuard,
  handleTurnstile,
  handleRateLimit,
  handleKillSwitch
);

export const handleError: HandleServerError = ({ error, event }) => {
  // Log completo server-side; al cliente SOLO un mensaje genérico + id de
  // correlación. Nunca exponer error.message crudo (filtra schema/PII).
  const errorId = randomId();
  console.error(`[hooks] error ${errorId} en ${event.url.pathname}:`, error);
  return {
    message: 'Ocurrió un error inesperado en Faro VE. Intenta de nuevo.',
    errorId
  };
};
