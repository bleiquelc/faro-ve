/**
 * Email Worker — captura de peticiones de opt-out (regla #10).
 *
 * POR QUÉ (29-jul-2026). El Email Routing de Cloudflare está completo desde el
 * 12-jul (opt-out@ / contacto@ / federacion@ → Gmail del founder), pero NADIE
 * leía el buzón: el SLA público de 24h impreso en el footer y en /atribucion era
 * una promesa sin mecanismo.
 *
 * QUÉ HACE — y sobre todo QUÉ NO HACE. Este Worker SOLO registra el correo en la
 * tabla de cuarentena `optout_requests` vía la RPC `record_optout_request`, y
 * después REENVÍA el mensaje al Gmail del founder igual que hoy. NUNCA desactiva
 * una fuente ni borra un registro: separar CAPTURA (evento) de ACCIÓN (el
 * mantenimiento diario) es lo que impide que un correo anónimo dispare el
 * borrado de 47.800 personas del mapa que la gente usa para buscar a los suyos.
 *
 * La decisión de auto-ejecutar (dominio de la fuente + DKIM válido, decisión del
 * founder del 29-jul) la toma la RPC en Postgres, no este Worker.
 *
 * No es un cron: se dispara al RECIBIR. Por eso no le afecta que la cuenta free
 * no ejecute los crons de Workers.
 */

export interface Env {
  PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  FORWARD_TO?: string;
}

/** Mensaje entrante de Email Routing (subset de la API que usamos). */
interface ForwardableEmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream;
  readonly rawSize: number;
  forward(rcptTo: string, headers?: Headers): Promise<void>;
  setReject(reason: string): void;
}

/** Tope de lectura del cuerpo: nos alcanza con el principio y evita OOM. */
const MAX_BYTES = 64 * 1024;

/**
 * Cloudflare valida SPF/DKIM/DMARC ANTES de entregar y deja el resultado en
 * `Authentication-Results`. Es la única parte del correo que no puede falsificar
 * el remitente, y por eso es la que habilita la auto-ejecución.
 */
function authResults(headers: Headers): { dkim: boolean; spf: boolean } {
  const raw = (headers.get('authentication-results') || '').toLowerCase();
  return { dkim: /dkim=pass/.test(raw), spf: /spf=pass/.test(raw) };
}

/** Cuerpo en texto plano, acotado y sin cabeceras. */
async function readBody(msg: ForwardableEmailMessage): Promise<string> {
  try {
    const reader = msg.raw.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    reader.cancel().catch(() => {});
    const all = new Uint8Array(size);
    let off = 0;
    for (const c of chunks) {
      all.set(c.subarray(0, Math.min(c.length, size - off)), off);
      off += c.length;
      if (off >= size) break;
    }
    const text = new TextDecoder('utf-8', { fatal: false }).decode(all);
    // Separar cabeceras del cuerpo (primera línea en blanco).
    const split = text.indexOf('\r\n\r\n');
    return (split >= 0 ? text.slice(split + 4) : text).slice(0, 2000);
  } catch {
    return '';
  }
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const { dkim, spf } = authResults(message.headers);

    // 1) REGISTRAR en cuarentena. Si esto falla, NO se pierde el correo: el
    //    reenvío al Gmail del founder ocurre igual (bloque 2).
    try {
      const res = await fetch(`${env.PUBLIC_SUPABASE_URL}/rest/v1/rpc/record_optout_request`, {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          payload: {
            from_email: message.from,
            message_id: message.headers.get('message-id') || null,
            subject: message.headers.get('subject') || '',
            body: await readBody(message),
            dkim_pass: dkim,
            spf_pass: spf
          }
        })
      });
      if (!res.ok) {
        console.error('record_optout_request HTTP', res.status, (await res.text()).slice(0, 300));
      } else {
        console.log('opt-out registrado:', (await res.text()).slice(0, 300));
      }
    } catch (e) {
      console.error('record_optout_request falló:', e instanceof Error ? e.message : String(e));
    }

    // 2) REENVIAR al founder — el correo tiene que seguir llegando a su bandeja
    //    exactamente como hoy. Un fallo acá no debe rebotarle el correo al
    //    remitente (quedaría como que opt-out@ no existe, rompiendo la regla #8).
    const to = env.FORWARD_TO;
    if (to) {
      try {
        await message.forward(to);
      } catch (e) {
        console.error('forward falló:', e instanceof Error ? e.message : String(e));
      }
    }
  }
};
