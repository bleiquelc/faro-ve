import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loginRequestSchema } from '$schemas/moderation';
import { fixedWindowRateLimit } from '$server/ratelimit';

/**
 * Login del panel por magic-link (Supabase Auth). El enlace se envía SOLO si el
 * correo es un moderador ACTIVO (tabla moderators). La respuesta es SIEMPRE
 * genérica ("si tu correo está autorizado, te llegó un enlace") para no permitir
 * enumerar quiénes son moderadores.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
  if (locals.moderator) throw redirect(303, '/moderar');
  return { error: url.searchParams.get('error') };
};

export const actions: Actions = {
  default: async ({ request, locals, url, platform }) => {
    const form = await request.formData();
    const parsed = loginRequestSchema.safeParse({ email: form.get('email') });
    if (!parsed.success) {
      return fail(400, { error: 'Ingresa un correo válido.' });
    }
    const { email } = parsed.data;

    // Anti email-bombing a un moderador conocido: 5 intentos / 10 min por IP.
    // Fail-closed en producción: si el binding KV falta (misconfig), NO enviamos
    // (alineado con handleConfigGuard de hooks) → un atacante no puede agotar la
    // cuota de correo (Resend 3k/mes) martillando el login de un moderador.
    const kv = platform?.env?.RATE_LIMIT;
    const isProduction = !!platform?.env;
    if (isProduction && !kv) {
      console.error('[moderar/login] PROD sin RATE_LIMIT KV — fail-closed 503');
      return fail(503, { error: 'Servicio no disponible en este momento. Intenta más tarde.' });
    }
    if (kv) {
      const allowed = await fixedWindowRateLimit(kv, `moderar-login:${locals.ipHashed}`, 600, 5);
      if (!allowed) {
        return fail(429, { error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' });
      }
    }

    // Enviar el magic-link SOLO a un moderador activo. Si no lo es, no enviamos
    // nada — pero respondemos igual de genérico (no revelar el resultado).
    const { data: mod } = await locals.supabaseAdmin
      .from('moderators')
      .select('id')
      .eq('email', email)
      .eq('active', true)
      .maybeSingle();

    if (mod) {
      const { error: otpError } = await locals.supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${url.origin}/moderar/auth/callback`,
          shouldCreateUser: true
        }
      });
      if (otpError) {
        // No filtramos el detalle al cliente; lo dejamos en logs server-side.
        console.error('[moderar/login signInWithOtp]', otpError.message);
      }
    }

    return { sent: true };
  }
};
