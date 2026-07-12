/**
 * Envío de emails del relay anti-estafa vía Resend (REST, sin SDK — bundle
 * mínimo para Workers). Los emails descifrados llegan aquí desde las RPCs y
 * SOLO se usan como destinatario del correo: nunca vuelven al cliente.
 *
 * Sin RESEND_API_KEY el relay está apagado (fail-closed): los endpoints
 * responden 503 ANTES de tocar la DB.
 */

const RESEND_API = 'https://api.resend.com/emails';
const FROM = 'Faro VE <relay@faro-ve.com>';

const SCAM_WARNING_TEXT = `⚠️ Cuidado con estafas: NUNCA envíes dinero, criptomonedas ni datos bancarios a nadie que diga tener información. Faro VE jamás pide pagos. Tu email NO fue compartido: toda la conversación viaja por el relay seguro de Faro.`;

const footerText = `

————————————
${SCAM_WARNING_TEXT}

Faro VE · Mapa de esperanza · https://faro-ve.com
Privacidad: https://faro-ve.com/privacidad · Contacto: contacto@faro-ve.com`;

function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function htmlShell(inner: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1a2332">
${inner}
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
<p style="font-size:13px;color:#8a94a6;line-height:1.5">${esc(SCAM_WARNING_TEXT)}</p>
<p style="font-size:13px;color:#8a94a6">Faro VE · <a href="https://faro-ve.com" style="color:#0e7490">faro-ve.com</a> · <a href="https://faro-ve.com/privacidad" style="color:#0e7490">Privacidad</a></p>
</div>`;
}

export interface RelaySendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

async function send(
  apiKey: string,
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<RelaySendResult> {
  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, text, html })
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, error: `Resend ${res.status}: ${detail.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'fetch failed' };
  }
}

/** Mensaje inicial: remitente anónimo → reportante de la ficha. */
export async function sendRelayMessage(
  apiKey: string,
  args: {
    toEmail: string;
    personName: string;
    senderName?: string;
    subject: string;
    body: string;
    replyToken: string;
  }
): Promise<RelaySendResult> {
  const who = args.senderName?.trim() || 'Una persona';
  const replyUrl = `https://faro-ve.com/mensaje/${args.replyToken}`;
  const subject = `💬 ${args.subject} · Faro VE`;
  const text = `${who} te escribió por el relay seguro de Faro VE sobre la ficha de ${args.personName}:

«${args.body}»

Para responder SIN revelar tu email, usa este enlace (válido 14 días, un solo uso):
${replyUrl}${footerText}`;
  const html = htmlShell(`
<p style="font-size:15px"><strong>${esc(who)}</strong> te escribió por el relay seguro de Faro VE sobre la ficha de <strong>${esc(args.personName)}</strong>:</p>
<blockquote style="border-left:3px solid #0e7490;margin:16px 0;padding:8px 16px;background:#f0f9fa;border-radius:4px;font-size:15px;line-height:1.6">${esc(args.body)}</blockquote>
<p><a href="${replyUrl}" style="display:inline-block;background:#0e7490;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Responder de forma segura</a></p>
<p style="font-size:13px;color:#8a94a6">El enlace vale 14 días y admite una sola respuesta. Tu email no se comparte.</p>`);
  return send(apiKey, args.toEmail, subject, text, html);
}

/** Respuesta del reportante → remitente original. Cierra el hilo (single-use). */
export async function sendRelayReply(
  apiKey: string,
  args: { toEmail: string; subject: string; body: string }
): Promise<RelaySendResult> {
  const subject = `↩️ Respuesta: ${args.subject} · Faro VE`;
  const text = `El reportante respondió a tu mensaje por el relay seguro de Faro VE:

«${args.body}»

Este hilo seguro admitía una sola respuesta y queda cerrado. Si necesitan seguir en contacto, decidan con mucho cuidado qué datos comparten.${footerText}`;
  const html = htmlShell(`
<p style="font-size:15px">El reportante respondió a tu mensaje por el relay seguro de Faro VE:</p>
<blockquote style="border-left:3px solid #0e7490;margin:16px 0;padding:8px 16px;background:#f0f9fa;border-radius:4px;font-size:15px;line-height:1.6">${esc(args.body)}</blockquote>
<p style="font-size:13px;color:#8a94a6">Este hilo seguro admitía una sola respuesta y queda cerrado. Si necesitan seguir en contacto, decidan con mucho cuidado qué datos comparten.</p>`);
  return send(apiKey, args.toEmail, subject, text, html);
}
