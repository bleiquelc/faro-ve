import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { relayMessageSchema } from '$schemas/message';
import { sendRelayMessage } from '$lib/server/relay-email';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function envOf(platform: App.Platform | undefined, key: string): string {
  return (platform?.env as Record<string, string> | undefined)?.[key] ?? '';
}

/**
 * POST /api/persons/[id]/message — relay de mensajes anti-estafa (0032, función 4).
 *
 * Cualquiera le escribe al reportante de una ficha SIN que ninguna parte vea el
 * email de la otra. La cadena dura de hooks ya corrió: config-guard (503) →
 * Turnstile (403) → rate-limit 5/h por IP (429). Aquí: valida con Zod, llama la
 * RPC create_relay_message (consent + tope in-DB + guarda cifrada) y envía el
 * correo por Resend con el enlace de respuesta (reply_token single-use).
 *
 * Privacidad: `to_email` y `reply_token` que devuelve la RPC van SOLO al correo
 * saliente — la respuesta HTTP nunca los incluye. Sin RESEND_API_KEY → 503
 * fail-closed ANTES de tocar la DB.
 */
export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!UUID_RE.test(params.id)) {
    throw error(404, { message: 'Registro no encontrado.' });
  }
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

  const parsed = relayMessageSchema.safeParse(body);
  if (!parsed.success) {
    throw error(400, {
      message: 'Datos inválidos: ' + parsed.error.issues.map((i) => i.message).join(', ')
    });
  }

  const { data, error: dbError } = await locals.supabaseAdmin.rpc('create_relay_message', {
    payload: {
      person_id: params.id,
      sender_name: parsed.data.sender_name ?? null,
      sender_email: parsed.data.sender_email,
      subject: parsed.data.subject ?? null,
      body: parsed.data.body,
      sender_ip_hashed: locals.ipHashed
    }
  });

  if (dbError) {
    console.error('[POST /api/persons/:id/message]', dbError.message);
    throw error(502, { message: 'No se pudo enviar el mensaje. Intenta de nuevo en unos minutos.' });
  }

  const result = (data ?? {}) as {
    ok?: boolean;
    reason?: string;
    id?: string;
    to_email?: string;
    person_name?: string;
    reply_token?: string;
  };

  if (!result.ok) {
    if (result.reason === 'limite') {
      throw error(429, { message: 'Ya enviaste varios mensajes a esta ficha hoy. Intenta mañana.' });
    }
    // 'sin_canal' y cualquier otro: respuesta uniforme, sin revelar detalles.
    throw error(409, { message: 'Esta ficha no tiene un canal de contacto disponible.' });
  }
  if (!result.to_email || !result.reply_token || !result.id) {
    console.error('[POST /api/persons/:id/message] RPC sin campos esperados');
    throw error(502, { message: 'No se pudo enviar el mensaje. Intenta de nuevo en unos minutos.' });
  }

  const sent = await sendRelayMessage(RESEND_API_KEY, {
    toEmail: result.to_email,
    personName: result.person_name || 'una persona reportada',
    senderName: parsed.data.sender_name,
    subject: parsed.data.subject || `Mensaje sobre ${result.person_name || 'tu reporte'}`,
    body: parsed.data.body,
    replyToken: result.reply_token
  });

  if (!sent.ok) {
    console.error('[POST /api/persons/:id/message] Resend:', sent.error);
    throw error(502, { message: 'El mensaje no pudo entregarse. Intenta de nuevo más tarde.' });
  }

  await locals.supabaseAdmin
    .from('messages')
    .update({ delivered_to_reporter: true, delivered_at: new Date().toISOString(), resend_email_id: sent.id ?? null })
    .eq('id', result.id);

  return json({ ok: true, delivered: true });
};
