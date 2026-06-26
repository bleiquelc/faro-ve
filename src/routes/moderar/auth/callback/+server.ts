import { redirect } from '@sveltejs/kit';
import type { EmailOtpType } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

/**
 * Callback del magic-link. Soporta el flujo PKCE (?code=) — el que usa el cliente
 * @supabase/ssr server-side — y, como respaldo, el flujo token_hash (?token_hash=
 * &type=) por si la plantilla de correo lo usa. Al verificar, las cookies de
 * sesión quedan seteadas por el adaptador de cookies de hooks.server.ts.
 */

// Tipos OTP de flujo de correo aceptados. Validar el `type` de la URL antes de
// pasarlo a verifyOtp evita un cast no comprobado y acota a los flujos previstos.
const VALID_OTP_TYPES = new Set<EmailOtpType>(['email', 'magiclink', 'recovery', 'invite']);

function asOtpType(t: string | null): EmailOtpType | null {
  return t && (VALID_OTP_TYPES as Set<string>).has(t) ? (t as EmailOtpType) : null;
}

export const GET: RequestHandler = async ({ url, locals }) => {
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = asOtpType(url.searchParams.get('type'));

  let ok = false;
  if (code) {
    const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    if (error) console.error('[moderar/auth/callback exchangeCode]', error.message);
  } else if (tokenHash && type) {
    const { error } = await locals.supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
    if (error) console.error('[moderar/auth/callback verifyOtp]', error.message);
  }

  throw redirect(303, ok ? '/moderar' : '/moderar/login?error=enlace');
};
