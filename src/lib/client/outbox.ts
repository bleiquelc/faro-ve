/**
 * Faro VE — Outbox de reportes OFFLINE (IndexedDB vía Dexie, lazy).
 *
 * Guarda los reportes que no se pudieron enviar (sin señal o ACK perdido) y los
 * reenvía al volver la conexión REUSANDO /api/persons con un Turnstile fresco
 * (ver replay.ts). El payload se CIFRA at-rest (AES-GCM, clave NO extraíble en
 * IndexedDB) como defensa-en-profundidad; la protección canónica de la PII es
 * server-side en la RPC. Minimización y retención acotada en offline-policy.ts.
 *
 * Privacidad (dispositivo compartido es el adversario real):
 *  - El payload con PII se cifra y NUNCA se renderiza; la UI solo ve metadatos.
 *  - Purga al enviar, al volver la señal, al abrir, y por TTL (48h).
 *  - wipeAll() borra entradas + la clave (botón "Borrar mis datos de este teléfono").
 *
 * Dexie se importa de forma diferida → no entra al bundle inicial (#21).
 */
import type { Dexie, Table } from 'dexie';
import {
  OUTBOX_CAP,
  OUTBOX_TTL_MS,
  isExpired,
  MAX_ATTEMPTS
} from '$utils/offline-policy';
import {
  writeSummary,
  type OutboxItemStatus,
  type OutboxSummary
} from './outbox-summary';

export interface OutboxEntry {
  client_uuid: string; // PK — también es el client_uuid del payload (idempotencia)
  endpoint: string; // '/api/persons'
  kind: string; // etiqueta de categoría (no-PII), p.ej. 'desaparecido'
  iv: ArrayBuffer; // IV de AES-GCM
  payloadEnc: ArrayBuffer; // JSON del payload minimizado, cifrado
  createdAt: number; // epoch ms — antigüedad real del reporte (se preserva al enviar)
  attempts: number;
  nextAttemptAt: number; // epoch ms — cuándo reintentar
  status: OutboxItemStatus;
  lastError?: string; // corto y SIN PII
}

/** Proyección segura para la UI — jamás incluye el payload ni PII. */
export interface OutboxMeta {
  client_uuid: string;
  kind: string;
  createdAt: number;
  status: OutboxItemStatus;
  attempts: number;
}

interface OutboxDB extends Dexie {
  reports: Table<OutboxEntry, string>;
  vault: Table<{ key: string; value: CryptoKey }, string>;
}

const DB_NAME = 'faro-outbox';
const AES_KEY_ID = 'aes-gcm-key';

let _dbPromise: Promise<OutboxDB> | null = null;

async function getDb(): Promise<OutboxDB> {
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const { default: DexieCtor } = await import('dexie');
      const db = new DexieCtor(DB_NAME) as OutboxDB;
      db.version(1).stores({
        // Índices: PK client_uuid + por estado/fecha para el barrido y el replay.
        reports: 'client_uuid, status, nextAttemptAt, createdAt',
        vault: 'key'
      });
      return db;
    })();
  }
  return _dbPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cifrado at-rest (defensa-en-profundidad). La clave es NO extraíble: no se puede
// exportar ni copiar fuera del origen. No protege contra el propio origen (la app
// descifra para reenviar) — por eso la regla real es NO-render + purga + wipe.
// ─────────────────────────────────────────────────────────────────────────────

function hasCrypto(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}

async function getKey(): Promise<CryptoKey> {
  const db = await getDb();
  const existing = await db.vault.get(AES_KEY_ID);
  if (existing?.value) return existing.value;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt'
  ]);
  await db.vault.put({ key: AES_KEY_ID, value: key });
  return key;
}

async function encryptJSON(obj: unknown): Promise<{ iv: ArrayBuffer; payloadEnc: ArrayBuffer }> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const payloadEnc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv: iv.buffer, payloadEnc };
}

async function decryptJSON(iv: ArrayBuffer, payloadEnc: ArrayBuffer): Promise<Record<string, unknown>> {
  const key = await getKey();
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, payloadEnc);
  return JSON.parse(new TextDecoder().decode(plain)) as Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumen (localStorage, no-PII) — recomputado tras cada mutación.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_RANK: Record<OutboxItemStatus, number> = {
  pending: 0,
  sending: 1,
  failed: 2,
  needs_attention: 3
};

async function refreshSummary(): Promise<OutboxSummary> {
  const db = await getDb();
  const all = await db.reports.toArray();
  let oldestAt: number | null = null;
  let worst: OutboxItemStatus | null = null;
  for (const e of all) {
    if (oldestAt === null || e.createdAt < oldestAt) oldestAt = e.createdAt;
    if (worst === null || STATUS_RANK[e.status] > STATUS_RANK[worst]) worst = e.status;
  }
  const summary: OutboxSummary = { count: all.length, oldestAt, worst };
  writeSummary(summary);
  return summary;
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────────

export function isOutboxSupported(): boolean {
  return typeof indexedDB !== 'undefined' && hasCrypto();
}

export type EnqueueResult =
  | { ok: true; client_uuid: string }
  | { ok: false; reason: 'unsupported' | 'full' | 'error' };

/**
 * Encola un reporte. `payload` YA viene minimizado e incluye su `client_uuid`
 * (lo genera report-submit antes del primer intento, para cubrir también el
 * ACK-perdido ONLINE). Devuelve error si la cola está llena (nunca descarta una
 * entrada existente en silencio).
 */
export async function enqueue(
  endpoint: string,
  kind: string,
  payload: Record<string, unknown>
): Promise<EnqueueResult> {
  if (!isOutboxSupported()) return { ok: false, reason: 'unsupported' };
  const client_uuid = String(payload.client_uuid ?? '');
  if (!client_uuid) return { ok: false, reason: 'error' };
  try {
    const db = await getDb();
    const count = await db.reports.count();
    const exists = await db.reports.get(client_uuid);
    if (!exists && count >= OUTBOX_CAP) return { ok: false, reason: 'full' };

    const { iv, payloadEnc } = await encryptJSON(payload);
    const now = Date.now();
    const entry: OutboxEntry = {
      client_uuid,
      endpoint,
      kind,
      iv,
      payloadEnc,
      createdAt: exists?.createdAt ?? now, // preserva antigüedad si se re-encola
      attempts: 0,
      nextAttemptAt: now,
      status: 'pending'
    };
    await db.reports.put(entry);
    await refreshSummary();
    return { ok: true, client_uuid };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** Entradas listas para reintentar (pending y con nextAttemptAt vencido), FIFO. */
export async function dueEntries(now: number = Date.now()): Promise<OutboxEntry[]> {
  const db = await getDb();
  const all = await db.reports
    .where('status')
    .equals('pending')
    .toArray();
  return all.filter((e) => e.nextAttemptAt <= now).sort((a, b) => a.createdAt - b.createdAt);
}

/** TODAS las entradas pendientes (vencidas o no) — para agendar el próximo drain. */
export async function pendingEntries(): Promise<OutboxEntry[]> {
  const db = await getDb();
  return db.reports.where('status').equals('pending').toArray();
}

/** Difiere una entrada `ms` SIN contar como intento (p.ej. esperando interacción). */
export async function deferEntry(client_uuid: string, ms: number): Promise<void> {
  const db = await getDb();
  await db.transaction('rw', db.reports, async () => {
    const e = await db.reports.get(client_uuid);
    if (!e) return;
    await db.reports.put({ ...e, status: 'pending', nextAttemptAt: Date.now() + ms });
  });
  await refreshSummary();
}

/** Marca 'sending' en transacción (evita que dos pestañas tomen la misma entrada). */
export async function claimForSend(client_uuid: string): Promise<OutboxEntry | null> {
  const db = await getDb();
  return db.transaction('rw', db.reports, async () => {
    const e = await db.reports.get(client_uuid);
    if (!e || e.status !== 'pending') return null;
    const updated: OutboxEntry = { ...e, status: 'sending' };
    await db.reports.put(updated);
    return updated;
  }).then(async (r) => {
    await refreshSummary();
    return r;
  });
}

export async function getDecryptedPayload(entry: OutboxEntry): Promise<Record<string, unknown>> {
  return decryptJSON(entry.iv, entry.payloadEnc);
}

export async function settleSuccess(client_uuid: string): Promise<void> {
  const db = await getDb();
  await db.reports.delete(client_uuid);
  await refreshSummary();
}

export async function settleRetry(
  client_uuid: string,
  patch: { nextAttemptAt: number; lastError?: string }
): Promise<void> {
  const db = await getDb();
  await db.transaction('rw', db.reports, async () => {
    const e = await db.reports.get(client_uuid);
    if (!e) return;
    const attempts = e.attempts + 1;
    const status: OutboxItemStatus = attempts >= MAX_ATTEMPTS ? 'needs_attention' : 'pending';
    await db.reports.put({
      ...e,
      attempts,
      status,
      nextAttemptAt: patch.nextAttemptAt,
      lastError: patch.lastError
    });
  });
  await refreshSummary();
}

export async function settlePermanent(client_uuid: string, lastError?: string): Promise<void> {
  const db = await getDb();
  await db.transaction('rw', db.reports, async () => {
    const e = await db.reports.get(client_uuid);
    if (!e) return;
    await db.reports.put({ ...e, status: 'failed', lastError });
  });
  await refreshSummary();
}

/** Reabre una entrada fallida (tras corregir) o reanuda un 'sending' huérfano. */
export async function resetToPending(client_uuid: string): Promise<void> {
  const db = await getDb();
  await db.transaction('rw', db.reports, async () => {
    const e = await db.reports.get(client_uuid);
    if (!e) return;
    await db.reports.put({ ...e, status: 'pending', nextAttemptAt: Date.now() });
  });
  await refreshSummary();
}

/** En el arranque: 'sending' huérfanos (recarga a media entrega) → 'pending'. */
export async function recoverOrphanedSending(): Promise<void> {
  const db = await getDb();
  await db.transaction('rw', db.reports, async () => {
    const orphans = await db.reports.where('status').equals('sending').toArray();
    for (const e of orphans) {
      await db.reports.put({ ...e, status: 'pending', nextAttemptAt: Date.now() });
    }
  });
  await refreshSummary();
}

/** Purga entradas vencidas (TTL #6). Devuelve cuántas se eliminaron (para avisar). */
export async function purgeExpired(now: number = Date.now()): Promise<number> {
  const db = await getDb();
  let removed = 0;
  await db.transaction('rw', db.reports, async () => {
    const all = await db.reports.toArray();
    for (const e of all) {
      if (isExpired(e.createdAt, now)) {
        await db.reports.delete(e.client_uuid);
        removed++;
      }
    }
  });
  if (removed > 0) await refreshSummary();
  return removed;
}

export async function count(): Promise<number> {
  const db = await getDb();
  return db.reports.count();
}

/** Lista SOLO metadatos (sin descifrar nada) para la UI. */
export async function metadataList(): Promise<OutboxMeta[]> {
  const db = await getDb();
  const all = await db.reports.orderBy('createdAt').toArray();
  return all.map((e) => ({
    client_uuid: e.client_uuid,
    kind: e.kind,
    createdAt: e.createdAt,
    status: e.status,
    attempts: e.attempts
  }));
}

/**
 * El usuario fuerza el reenvío ("Enviar ahora"): revive entradas atascadas en
 * 'needs_attention' (agotaron los reintentos automáticos) a 'pending' con los
 * intentos a cero, para que el drain las vuelva a tomar. NO toca 'failed'
 * (permanentes por datos inválidos: reintentarlas no ayuda).
 */
export async function reviveStuck(): Promise<void> {
  const db = await getDb();
  await db.transaction('rw', db.reports, async () => {
    const stuck = await db.reports.where('status').equals('needs_attention').toArray();
    for (const e of stuck) {
      await db.reports.put({ ...e, status: 'pending', attempts: 0, nextAttemptAt: Date.now() });
    }
  });
  await refreshSummary();
}

/** "Borrar mis datos de este teléfono": elimina TODAS las entradas + la clave. */
export async function wipeAll(): Promise<void> {
  const db = await getDb();
  await db.transaction('rw', db.reports, db.vault, async () => {
    await db.reports.clear();
    await db.vault.clear();
  });
  await refreshSummary();
}

export { OUTBOX_TTL_MS };
