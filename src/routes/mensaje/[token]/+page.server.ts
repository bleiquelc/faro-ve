import type { PageServerLoad } from './$types';

const TOKEN_RE = /^[0-9a-f]{48}$/i;

/**
 * /mensaje/[token] — página de respuesta del relay anti-estafa (0032).
 *
 * El reportante llega desde el enlace del correo. El peek (RPC solo-lectura,
 * service_role) valida el token SIN consumirlo y devuelve únicamente datos NO
 * sensibles (nombre de la ficha, asunto, fecha) para pintar el contexto.
 */
export const load: PageServerLoad = async ({ params, locals }) => {
  // Sin Supabase configurado (p. ej. preview local) o token malformado: la
  // página degrada a "enlace no activo" en vez de 500.
  if (!TOKEN_RE.test(params.token) || !locals.supabaseAdmin) {
    return { valid: false as const };
  }

  const { data, error } = await locals.supabaseAdmin.rpc('relay_reply_peek', {
    p_token: params.token
  });

  if (error) {
    console.error('[/mensaje/:token] peek:', error.message);
    // Sin RPC (0032 sin aplicar) o sin service_role: la página degrada honesta.
    return { valid: false as const };
  }

  const peek = (data ?? {}) as {
    valid?: boolean;
    subject?: string;
    person_name?: string;
    sent_at?: string;
  };

  if (!peek.valid) return { valid: false as const };
  return {
    valid: true as const,
    subject: peek.subject ?? 'un mensaje',
    personName: peek.person_name ?? 'una persona reportada',
    sentAt: peek.sent_at ?? null
  };
};
