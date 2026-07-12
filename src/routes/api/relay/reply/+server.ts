import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { relayReplySchema } from '$schemas/message';
import { sendRelayReply } from '$lib/server/relay-email';

function envOf(platform: App.Platform | undefined, key: string): string {
  return (platform?.env as Record<string, string> | undefined)?.[key] ?? '';
}

/**
 * POST /api/relay/reply — respuesta del reportante vía reply_token (0032).
 *
 * El reportante recibió el mensaje del relay con un enlace /mensaje/[token]; su
 * respuesta viaja por aquí hacia el email (cifrado) del remitente original.
 * Token single-use con TTL 14 días — lo consume la RPC relay_reply de forma
 * atómica (UPDATE ... AND NOT reply_used). Cadena de hooks: Turnstile +
 * rate-limit 5/h. Sin RESEND_API_KEY → 503 fail-closed ANTES de consumir token.
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
  if (!locals.turnstileVerified) {
    throw error(403, { message: 'Verificación anti-bot requerida.' });
  }
  const RESEND_API_KEY = envOf(platform, 'RESEND_API_KEY');
  if (!RESEND_API_KEY) {
    throw error(503, { message: 'El relay de mensajes aún no está disponible. Intenta más tarde.' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, { message: 'Cuerpo JSON inválido.' });
  }

  const parsed = relayReplySchema.safeParse(body);
  if (!parsed.success) {
    throw error(400, {
      message: 'Datos inválidos: ' + parsed.error.issues.map((i) => i.message).join(', ')
    });
  }

  const { data, error: dbError } = await locals.supabaseAdmin.rpc('relay_reply', {
    payload: { token: parsed.data.token, body: parsed.data.body, ip_hashed: locals.ipHashed }
  });

  if (dbError) {
    console.error('[POST /api/relay/reply]', dbError.message);
    throw error(502, { message: 'No se pudo enviar la respuesta. Intenta de nuevo en unos minutos.' });
  }

  const result = (data ?? {}) as {
    ok?: boolean;
    reason?: string;
    id?: string;
    to_email?: string;
    subject?: string;
    reply_body?: string;
  };

  if (!result.ok) {
    throw error(410, {
      message: 'Este enlace de respuesta ya fue usado o expiró. El hilo seguro está cerrado.'
    });
  }
  if (!result.to_email) {
    console.error('[POST /api/relay/reply] RPC sin destinatario');
    throw error(502, { message: 'No se pudo enviar la respuesta. Intenta de nuevo en unos minutos.' });
  }

  const sent = await sendRelayReply(RESEND_API_KEY, {
    toEmail: result.to_email,
    subject: result.subject || 'tu mensaje por Faro VE',
    body: result.reply_body || parsed.data.body
  });

  if (!sent.ok) {
    // El token ya fue consumido (atómico); si el correo no salió, lo reabrimos
    // para que el reportante pueda reintentar — sin esto la respuesta se pierde.
    if (result.id) {
      await locals.supabaseAdmin.from('messages').update({ reply_used: false }).eq('id', result.id);
    }
    console.error('[POST /api/relay/reply] Resend:', sent.error);
    throw error(502, { message: 'La respuesta no pudo entregarse. Intenta de nuevo más tarde.' });
  }

  return json({ ok: true, delivered: true });
};
