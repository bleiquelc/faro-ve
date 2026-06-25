import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

/**
 * Faro VE — hooks server-side.
 *
 * Responsabilidades:
 *  1. Inyectar clientes Supabase (anon + service_role) en locals.
 *  2. Verificar Turnstile en cualquier POST público (anti-bot).
 *  3. Rate-limit por IP hasheada vía Cloudflare KV.
 *  4. Hashear IP del request — nunca loguear IP plana.
 *  5. Leer kill switches (INSERTS_PAUSED, FACE_MATCH_ENABLED, LLM_DAILY_BUDGET_USD).
 *  6. Resolver sesión moderador (magic-link).
 *
 * NOTAS:
 *  - El platform.env existe en Cloudflare Workers (prod). En dev viene de
 *    SvelteKit usando .env vía vite-plugin-sveltekit-env. Acceso a través de
 *    helper env() para no romper en dev.
 *  - Turnstile y rate-limit aplican solo a POSTs públicos (/api/persons,
 *    /api/notes, /api/message, /api/aid-points sin sesión, /api/ai/ask).
 *    Endpoints autenticados (moderador) los saltan.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function env(event: Parameters<Handle>[0]['event'], key: string): string {
  const fromPlatform = (event.platform?.env as Record<string, string> | undefined)?.[key];
  if (fromPlatform !== undefined) return fromPlatform;
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key]!;
  }
  return '';
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const PUBLIC_POST_PATHS = new Set([
  '/api/persons',
  '/api/notes',
  '/api/message',
  '/api/aid-points',
  '/api/offline-sync',
  '/api/ai/ask'
]);

function isPublicMutation(event: Parameters<Handle>[0]['event']): boolean {
  if (event.request.method !== 'POST' && event.request.method !== 'PUT') return false;
  return PUBLIC_POST_PATHS.has(event.url.pathname);
}

// ─────────────────────────────────────────────────────────────────────────────
// Handle: supabase clients
// ─────────────────────────────────────────────────────────────────────────────

const handleSupabase: Handle = async ({ event, resolve }) => {
  const SUPABASE_URL = env(event, 'PUBLIC_SUPABASE_URL');
  const SUPABASE_ANON_KEY = env(event, 'PUBLIC_SUPABASE_ANON_KEY');
  const SUPABASE_SERVICE_ROLE_KEY = env(event, 'SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // Dev / preflight sin envs todavía — devolver 503 mejor que 500 silencioso.
    if (event.url.pathname.startsWith('/api/')) {
      return new Response(
        JSON.stringify({
          error: 'config_missing',
          message: 'Supabase no configurado en este entorno.'
        }),
        { status: 503, headers: { 'content-type': 'application/json' } }
      );
    }
  }

  event.locals.supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookies) =>
        cookies.forEach(({ name, value, options }) =>
          event.cookies.set(name, value, { ...options, path: '/' })
        )
    }
  });

  event.locals.supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  event.locals.getSession = async () => {
    const { data } = await event.locals.supabase.auth.getSession();
    return data.session;
  };

  return resolve(event, {
    filterSerializedResponseHeaders: (name) => name === 'content-range'
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Handle: IP hash + kill switches
// ─────────────────────────────────────────────────────────────────────────────

const handleContext: Handle = async ({ event, resolve }) => {
  const APP_SALT = env(event, 'APP_SALT');
  const ip = event.getClientAddress();
  event.locals.ipHashed = APP_SALT ? await sha256Hex(`${ip}${APP_SALT}`) : `unsalted:${ip}`;

  event.locals.insertsPaused = env(event, 'INSERTS_PAUSED').toLowerCase() === 'true';
  event.locals.turnstileVerified = false;
  event.locals.moderator = null;

  return resolve(event);
};

// ─────────────────────────────────────────────────────────────────────────────
// Handle: Turnstile (anti-bot)
// ─────────────────────────────────────────────────────────────────────────────

const handleTurnstile: Handle = async ({ event, resolve }) => {
  if (!isPublicMutation(event)) {
    return resolve(event);
  }

  // Bypass: si hay sesión moderador, no requerir Turnstile.
  const session = await event.locals.getSession();
  if (session) {
    event.locals.turnstileVerified = true;
    return resolve(event);
  }

  const TURNSTILE_SECRET_KEY = env(event, 'TURNSTILE_SECRET_KEY');
  if (!TURNSTILE_SECRET_KEY) {
    // Sin secret configurado, dejar pasar en dev. En prod este branch no aplica.
    event.locals.turnstileVerified = false;
    return resolve(event);
  }

  // Leer token sin consumir el body — usamos clone.
  const cloned = event.request.clone();
  let token = '';
  try {
    const ct = event.request.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      const body = (await cloned.json()) as Record<string, unknown>;
      token = (body['cf-turnstile-response'] as string) ?? '';
    } else if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
      const form = await cloned.formData();
      token = (form.get('cf-turnstile-response') as string) ?? '';
    }
  } catch {
    /* swallow — verificación falla y 403 abajo */
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
// Handle: rate-limit por IP hasheada via Cloudflare KV
// ─────────────────────────────────────────────────────────────────────────────

const RATE_LIMITS: Record<string, { windowSec: number; max: number }> = {
  '/api/persons': { windowSec: 3600, max: 5 },     // 5/hora por IP
  '/api/notes': { windowSec: 600, max: 10 },       // 10/10min por IP
  '/api/message': { windowSec: 600, max: 6 },      // 6/10min por IP
  '/api/aid-points': { windowSec: 3600, max: 10 },
  '/api/offline-sync': { windowSec: 60, max: 20 },
  '/api/ai/ask': { windowSec: 86400, max: 10 }     // 10/día por IP
};

const handleRateLimit: Handle = async ({ event, resolve }) => {
  if (!isPublicMutation(event)) return resolve(event);

  const cfg = RATE_LIMITS[event.url.pathname];
  if (!cfg) return resolve(event);

  const kv = (event.platform?.env as { RATE_LIMIT?: KVNamespace } | undefined)?.RATE_LIMIT;
  if (!kv) {
    // Dev sin KV: log y dejar pasar. En prod este branch no aplica.
    console.warn('[rate-limit] KV no disponible — saltando');
    return resolve(event);
  }

  const key = `rl:${event.url.pathname}:${event.locals.ipHashed}`;
  const stored = (await kv.get(key)) ?? '0';
  const count = parseInt(stored, 10) || 0;

  if (count >= cfg.max) {
    return new Response(JSON.stringify({ error: 'rate_limited', retry_after_sec: cfg.windowSec }), {
      status: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': cfg.windowSec.toString()
      }
    });
  }

  // expirationTtl es per-key — solo se setea la primera vez del ventana.
  await kv.put(key, (count + 1).toString(), {
    expirationTtl: count === 0 ? cfg.windowSec : undefined
  });

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
      message:
        'Las nuevas entradas están pausadas temporalmente. Vuelve en unos minutos.'
    }),
    { status: 503, headers: { 'content-type': 'application/json' } }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Export — el orden importa: contexto → supabase → turnstile → rate-limit → kill.
// ─────────────────────────────────────────────────────────────────────────────

export const handle = sequence(
  handleContext,
  handleSupabase,
  handleTurnstile,
  handleRateLimit,
  handleKillSwitch
);

export const handleError: HandleServerError = ({ error, event }) => {
  console.error(`[hooks] error en ${event.url.pathname}:`, error);
  return {
    message:
      error instanceof Error ? error.message : 'Error inesperado en Faro VE. Intenta de nuevo.'
  };
};
