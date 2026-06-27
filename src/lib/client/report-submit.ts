/**
 * Wrapper ÚNICO submit-or-queue para los reportes de persona (/api/persons).
 * Los 4 formularios (desaparecido, a-salvo, condición-médica, cuerpo-NN) envían
 * por aquí, NUNCA con fetch directo.
 *
 *  - Genera client_uuid ANTES del primer intento (también online): así el
 *    ACK-perdido más común —red lenta online, el POST insertó pero el 200 se
 *    perdió— queda cubierto por la idempotencia (0027), no solo el caso offline.
 *  - Online: intenta el POST con el token Turnstile del formulario. Si la cadena
 *    dura responde algo transitorio (red, 403 turnstile, 429, 503, 5xx) → encola
 *    para reintentar con un token fresco. Si es permanente (400 Zod) → error al
 *    usuario (lo corrige), NO se encola en loop.
 *  - Offline: encola directo (payload minimizado y cifrado).
 */
import { classifyResponse, minimizeEnqueuablePayload } from '$utils/offline-policy';
import { enqueue } from './outbox';

export type SubmitResult =
  | { outcome: 'sent'; id?: string; duplicate?: boolean }
  | { outcome: 'queued' }
  | { outcome: 'unsupported' } // ni online ni se pudo guardar (sin IndexedDB/crypto)
  | { outcome: 'error'; message: string };

function newClientUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback improbable (navegadores sin randomUUID): aleatorio puro, sin PII.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const GENERIC_NET_ERROR =
  'No se pudo enviar el reporte. Verifica la conexión e intenta de nuevo.';

async function enqueueOrError(
  endpoint: string,
  kind: string,
  payloadWithUuid: Record<string, unknown>
): Promise<SubmitResult> {
  const stored = minimizeEnqueuablePayload(payloadWithUuid);
  const r = await enqueue(endpoint, kind, stored);
  if (r.ok) return { outcome: 'queued' };
  if (r.reason === 'full') {
    return {
      outcome: 'error',
      message:
        'Tienes muchos reportes guardados sin enviar. Reabre Faro VE con señal para enviarlos antes de crear otro.'
    };
  }
  return { outcome: 'unsupported' };
}

/**
 * @param endpoint  siempre '/api/persons' en v1.
 * @param kind      etiqueta de categoría no-PII (p.ej. 'desaparecido').
 * @param body      el cuerpo del reporte tal como lo arman los forms HOY,
 *                  incluido 'cf-turnstile-response' (solo para el intento online).
 */
export async function submitReport(
  endpoint: string,
  kind: string,
  body: Record<string, unknown>
): Promise<SubmitResult> {
  const client_uuid = (body.client_uuid as string) || newClientUuid();
  const onlineBody = { ...body, client_uuid };

  // Offline conocido → encolar sin intentar (evita un fetch que tarda en fallar).
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return enqueueOrError(endpoint, kind, onlineBody);
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(onlineBody)
    });
  } catch {
    // Error de red (señal cayó a mitad del envío) → transitorio → encolar.
    return enqueueOrError(endpoint, kind, onlineBody);
  }

  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    duplicate?: boolean;
    message?: string;
  };
  const outcome = classifyResponse(res.status, data);

  switch (outcome.kind) {
    case 'success':
      return { outcome: 'sent', id: data.id, duplicate: data.duplicate };
    case 'permanent':
      // 400 Zod u otro 4xx inesperado → el usuario debe corregir; no encolar.
      return { outcome: 'error', message: data.message || GENERIC_NET_ERROR };
    default:
      // turnstile / transient / transient-deferred / rate-limited → encolar y
      // reintentar luego con token fresco (no perder el reporte).
      return enqueueOrError(endpoint, kind, onlineBody);
  }
}
