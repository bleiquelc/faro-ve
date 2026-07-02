import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { removalReasonSchema } from '$schemas/person';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/persons/[id]/remove — retiro self-service (0031).
 *
 * Una persona pide salir del mapa, o una familia retira a un familiar fallecido.
 * Modelo (decisión founder): INMEDIATO y REVERSIBLE. La cadena dura de hooks ya
 * corrió antes de llegar aquí: config-guard (503) → Turnstile (403) → rate-limit
 * 5/h por IP (429). Aquí: valida el motivo y llama la RPC request_person_removal
 * (oculta al instante + purga PII a 30d + alerta al founder + audita).
 *
 * Privacidad: no revela si el id existe (la RPC responde ok idempotente); no pide
 * prueba de identidad (los registros de fuentes públicas no tienen email del
 * reportante; la red de seguridad es reversibilidad + alerta + rate-limit).
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!UUID_RE.test(params.id)) {
    throw error(404, { message: 'Registro no encontrado.' });
  }
  // Defensa en profundidad: hooks ya exige Turnstile en esta ruta.
  if (!locals.turnstileVerified) {
    throw error(403, { message: 'Verificación anti-bot requerida.' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, { message: 'Cuerpo JSON inválido.' });
  }

  const parsed = removalReasonSchema.safeParse(body);
  if (!parsed.success) {
    throw error(400, {
      message: 'Datos inválidos: ' + parsed.error.issues.map((i) => i.message).join(', ')
    });
  }

  const { data, error: dbError } = await locals.supabaseAdmin.rpc('request_person_removal', {
    payload: { id: params.id, relationship: parsed.data.relationship, note: parsed.data.note ?? null }
  });

  if (dbError) {
    // Sin service_role, supabaseAdmin cae a anon y la RPC (revocada) falla aquí —
    // visible y correcto: falta configurar el secret / aplicar la migración 0031.
    console.error('[POST /api/persons/:id/remove]', dbError.message);
    throw error(502, { message: 'No se pudo procesar el retiro. Intenta de nuevo en unos minutos.' });
  }

  const result = (data ?? {}) as { ok?: boolean; already?: boolean };
  return json({ ok: true, already: result.already ?? false });
};
