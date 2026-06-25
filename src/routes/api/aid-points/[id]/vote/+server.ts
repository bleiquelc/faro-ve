import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { voteAidPointSchema } from '$schemas/aid-point';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/aid-points/[id]/vote — autorregulación comunitaria.
 *
 * Cadena de seguridad en hooks (match por patrón): config-guard (503) →
 * Turnstile (403) → rate-limit por IP (429). Aquí: valida UUID + Zod + RPC
 * vote_aid_point (1 voto por IP hasheada, cambiable). net ≥ 3 → auto-ocultar.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.turnstileVerified) {
    throw error(403, { message: 'Verificación anti-bot requerida.' });
  }
  if (!UUID_RE.test(params.id)) {
    throw error(404, { message: 'Punto no encontrado.' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, { message: 'Cuerpo JSON inválido.' });
  }

  const parsed = voteAidPointSchema.safeParse(body);
  if (!parsed.success) {
    throw error(400, {
      message: 'Voto inválido: ' + parsed.error.issues.map((i) => i.message).join(', ')
    });
  }

  const { data, error: dbError } = await locals.supabaseAdmin.rpc('vote_aid_point', {
    p_id: params.id,
    p_vote: parsed.data.vote,
    p_ip_hashed: locals.ipHashed
  });

  if (dbError) {
    console.error('[POST /api/aid-points/[id]/vote]', dbError.message);
    throw error(502, { message: 'No se pudo registrar tu voto. Intenta de nuevo.' });
  }

  // Devuelve {confirms, reports, net, active, auto_hidden, threshold}.
  return json({ ok: true, ...(data as Record<string, unknown>) });
};
