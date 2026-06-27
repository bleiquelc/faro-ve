/**
 * Motor de REPLAY de la cola offline. Drena las entradas pendientes reenviándolas
 * a /api/persons (cadena dura intacta) con un token Turnstile FRESCO por entrada.
 *
 * Garantías (verificadas por revisión adversarial):
 *  - ESTRICTAMENTE secuencial (jamás dos POST en vuelo) + serializado entre
 *    pestañas con navigator.locks → con el unique index (0027) no hay duplicados.
 *  - AUTO-REPROGRAMACIÓN: al cerrar cada lote, agenda el próximo drain por el
 *    menor nextAttemptAt pendiente → el backoff (429/503/5xx/red) se consume solo
 *    en la MISMA sesión, sin depender de eventos del navegador.
 *  - 429 / 503(INSERTS_PAUSED) detienen el LOTE respetando la espera, NUNCA
 *    descartan. 400 → permanente (no loop). Fallo por entrada (Dexie/cuota) →
 *    se aísla y se reprograma, no tumba el resto del lote.
 *  - Token invisible que requiere challenge → difiere la entrada y marca
 *    needsInteraction; el botón "Enviar ahora" (modo visible, ESPERA el lock)
 *    reintenta y NO miente sobre el resultado.
 */
import { classifyResponse, nextAttemptDelayMs, BACKOFF_CEIL_MS } from '$utils/offline-policy';
import {
  dueEntries,
  pendingEntries,
  claimForSend,
  getDecryptedPayload,
  settleSuccess,
  settleRetry,
  settlePermanent,
  deferEntry,
  recoverOrphanedSending,
  purgeExpired,
  type OutboxEntry
} from './outbox';
import { getTurnstileToken } from './turnstile-token';

const LOCK = 'faro-outbox-replay';
const LOCK_BUSY = Symbol('lock-busy');
const NETWORK_RETRY_MS = 30_000;
const NEEDS_INTERACTION_DEFER_MS = 30 * 60 * 1000; // no busy-loop del token invisible

export interface DrainResult {
  ran: boolean;
  lockBusy: boolean;
  needsInteraction: boolean;
}

let _needsInteraction = false;
let _started = false;

export function needsInteraction(): boolean {
  return _needsInteraction;
}

async function withLock<T>(fn: () => Promise<T>, opts: { wait?: boolean } = {}): Promise<T | typeof LOCK_BUSY> {
  const locks = (navigator as unknown as { locks?: LockManager }).locks;
  if (!locks?.request) return fn(); // navegador sin Lock API → un solo hilo igual
  if (opts.wait) {
    // Path interactivo: ESPERA su turno (no descarta) → no le miente al usuario.
    return locks.request(LOCK, async () => fn());
  }
  return locks.request(LOCK, { ifAvailable: true }, async (lock) => (lock ? fn() : LOCK_BUSY));
}

let _scheduled: ReturnType<typeof setTimeout> | null = null;
function scheduleSoon(ms: number): void {
  if (_scheduled) clearTimeout(_scheduled);
  _scheduled = setTimeout(() => {
    _scheduled = null;
    void drain();
  }, ms);
}

/** Agenda el próximo drain por el menor nextAttemptAt de las entradas pendientes. */
async function scheduleNextDrain(): Promise<void> {
  const pend = await pendingEntries();
  if (pend.length === 0) return;
  const minNext = Math.min(...pend.map((e) => e.nextAttemptAt));
  const delay = Math.min(Math.max(minNext - Date.now(), 1_000), BACKOFF_CEIL_MS);
  scheduleSoon(delay);
}

async function postEntry(
  entry: OutboxEntry,
  token: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const payload = await getDecryptedPayload(entry);
  const res = await fetch(entry.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...payload, 'cf-turnstile-response': token })
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body };
}

/** Drena el lote actual. `interactive` usa token visible (botón del banner). */
export async function drain(opts: { interactive?: boolean; container?: HTMLElement } = {}): Promise<DrainResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ran: false, lockBusy: false, needsInteraction: _needsInteraction };
  }

  const r = await withLock(async () => {
    _needsInteraction = false; // se recalcula en este lote
    await purgeExpired();
    const batch = await dueEntries();

    for (const due of batch) {
      let stopBatch = false;
      try {
        const entry = await claimForSend(due.client_uuid);
        if (!entry) continue;

        // Token FRESCO por entrada.
        let token: string;
        try {
          token = await getTurnstileToken({ interactive: opts.interactive, container: opts.container });
        } catch {
          // Sin token sin interacción (challenge/VPN): difiere (sin gastar intento),
          // pide interacción y detiene el lote (el botón del banner lo reintenta).
          await deferEntry(entry.client_uuid, NEEDS_INTERACTION_DEFER_MS);
          _needsInteraction = true;
          break;
        }

        let status: number;
        let body: Record<string, unknown>;
        try {
          ({ status, body } = await postEntry(entry, token));
        } catch {
          // Red cayó a mitad del lote → reprograma esta entrada y corta el lote.
          await settleRetry(entry.client_uuid, {
            nextAttemptAt: Date.now() + NETWORK_RETRY_MS,
            lastError: 'sin conexión'
          });
          break;
        }

        const outcome = classifyResponse(status, body);
        switch (outcome.kind) {
          case 'success':
            await settleSuccess(entry.client_uuid);
            break;
          case 'permanent':
            await settlePermanent(
              entry.client_uuid,
              typeof body.message === 'string' ? body.message : 'dato inválido'
            );
            break;
          case 'rate-limited':
            await settleRetry(entry.client_uuid, {
              nextAttemptAt: Date.now() + nextAttemptDelayMs(outcome, entry.attempts + 1),
              lastError: 'límite por hora alcanzado'
            });
            stopBatch = true; // respeta el 429: detiene TODO el lote
            break;
          case 'transient-deferred':
            await settleRetry(entry.client_uuid, {
              nextAttemptAt: Date.now() + nextAttemptDelayMs(outcome, entry.attempts + 1),
              lastError: 'envíos en pausa'
            });
            stopBatch = true; // pausa global (INSERTS_PAUSED): no martillar el resto
            break;
          case 'transient':
          case 'turnstile':
            await settleRetry(entry.client_uuid, {
              nextAttemptAt: Date.now() + nextAttemptDelayMs(outcome, entry.attempts + 1),
              lastError: outcome.kind === 'turnstile' ? 'verificación pendiente' : 'reintento pendiente'
            });
            break;
        }
      } catch {
        // Fallo inesperado por ENTRADA (cuota IndexedDB, DB cerrada por wipe
        // concurrente): aísla la entrada, no tumba el lote ni la deja en 'sending'.
        await settleRetry(due.client_uuid, {
          nextAttemptAt: Date.now() + NETWORK_RETRY_MS,
          lastError: 'error local'
        }).catch(() => {});
      }
      if (stopBatch) break;
    }
  }, { wait: !!opts.interactive });

  if (r === LOCK_BUSY) {
    // Otra pestaña está drenando → revisar pronto (no asumir éxito).
    scheduleSoon(2_000);
    return { ran: false, lockBusy: true, needsInteraction: _needsInteraction };
  }

  // Agenda el próximo intento por el menor nextAttemptAt pendiente (consume el
  // backoff sin depender de eventos del navegador).
  await scheduleNextDrain();
  return { ran: true, lockBusy: false, needsInteraction: _needsInteraction };
}

/**
 * Arranca el motor: recupera 'sending' huérfanos, drena al volver la señal y al
 * volver visible la pestaña con conexión. Idempotente (una sola vez por carga).
 */
export async function startReplayEngine(): Promise<void> {
  if (_started || typeof window === 'undefined') return;
  _started = true;

  await recoverOrphanedSending();

  window.addEventListener('online', () => scheduleSoon(1_000));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine !== false) scheduleSoon(1_500);
  });

  if (navigator.onLine !== false) scheduleSoon(2_000);
}
