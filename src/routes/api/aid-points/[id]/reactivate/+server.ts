import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reactivateAidPointSchema } from '$schemas/aid-point';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/aid-points/[id]/reactivate — reactivar un punto auto-ocultado.
 *
 * Cadena en hooks (match por patrón): config-guard (503) → Turnstile (403) →
 * rate-limit estricto por IP (3/h, 429). Aquí: valida UUID + Zod + RPC
 * reactivate_aid_point. El WhatsApp se cifra en DB (#2), se avisa al founder y
 * se resetea el net. Solo procede si el punto está auto-ocultado.
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

  const parsed = reactivateAidPointSchema.safeParse(body);
  if (!parsed.success) {
    throw error(400, {
      message: 'Datos inválidos: ' + parsed.error.issues.map((i) => i.message).join(', ')
    });
  }

  const { data, error: dbError } = await locals.supabaseAdmin.rpc('reactivate_aid_point', {
    p_id: params.id,
    p_phone: parsed.data.phone,
    p_ip_hashed: locals.ipHashed
  });

  if (dbError) {
    // La RPC lanza si el punto no está auto-ocultado o el teléfono es inválido.
    // No filtramos el mensaje crudo al cliente (puede revelar estado interno).
    console.error('[POST /api/aid-points/[id]/reactivate]', dbError.message);
    throw error(409, {
      message: 'No se pudo reactivar este punto. Puede que ya esté activo o que falte un dato.'
    });
  }

  return json({ ok: true, ...(data as Record<string, unknown>) }, { status: 200 });
};
