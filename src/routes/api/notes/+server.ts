import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reportNoteSchema } from '$schemas/note';

/**
 * POST /api/notes — nota pública (avistamiento / "tengo información") sobre una
 * persona del mapa.
 *
 * Cadena de seguridad (hooks.server.ts, antes de llegar aquí): config-guard →
 * Turnstile (403) → rate-limit 10/10min por IP (429) → kill-switch (503). Aquí:
 * validación Zod + RPC create_note_report (cifra/hashea la PII del autor DENTRO
 * de la DB, ofusca el avistamiento land-aware) → inserta 'pending' → {id}.
 *
 * La PII del autor (email/phone) NUNCA se persiste en claro ni se devuelve. La
 * nota queda pending hasta que un moderador la apruebe (regla #18).
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  // Defensa en profundidad: hooks ya bloqueó si no verificó Turnstile.
  if (!locals.turnstileVerified) {
    throw error(403, { message: 'Verificación anti-bot requerida.' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, { message: 'Cuerpo JSON inválido.' });
  }

  const parsed = reportNoteSchema.safeParse(body);
  if (!parsed.success) {
    throw error(400, {
      message: 'Datos inválidos: ' + parsed.error.issues.map((i) => i.message).join(', ')
    });
  }

  const { 'cf-turnstile-response': _t, ...clean } = parsed.data;
  void _t;
  const payload = { ...clean, ip_hashed: locals.ipHashed };

  const { data, error: dbError } = await locals.supabaseAdmin.rpc('create_note_report', {
    payload
  });

  if (dbError) {
    console.error('[POST /api/notes]', dbError.message);
    throw error(502, { message: 'No se pudo enviar la información. Intenta de nuevo en unos minutos.' });
  }

  const result = (data ?? {}) as { id?: string };
  return json({ ok: true, id: result.id }, { status: 201 });
};
