import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/persons/[id]/vote — autorregulación comunitaria de personas.
 *
 * Cadena de seguridad en hooks (match por patrón): config-guard (503) →
 * Turnstile (403) → rate-limit por IP (429). Aquí: valida UUID + voto + RPC
 * vote_person (1 voto por IP hasheada, cambiable). net ≥ 3 → auto-ocultar el
 * perfil (reversible) + alerta al founder. La comunidad limpia los falsos sola.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.turnstileVerified) {
    throw error(403, { message: 'Verificación anti-bot requerida.' });
  }
  if (!UUID_RE.test(params.id)) {
    throw error(404, { message: 'Persona no encontrada.' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, { message: 'Cuerpo JSON inválido.' });
  }

  const vote = (body as { vote?: unknown } | null)?.vote;
  if (vote !== 'confirm' && vote !== 'report') {
    throw error(400, { message: 'Voto inválido.' });
  }

  const { data, error: dbError } = await locals.supabaseAdmin.rpc('vote_person', {
    p_id: params.id,
    p_vote: vote,
    p_ip_hashed: locals.ipHashed
  });

  if (dbError) {
    console.error('[POST /api/persons/[id]/vote]', dbError.message);
    throw error(502, { message: 'No se pudo registrar tu reporte. Intenta de nuevo.' });
  }

  // Devuelve {confirms, reports, net, auto_hidden, threshold}.
  return json({ ok: true, ...(data as Record<string, unknown>) });
};
