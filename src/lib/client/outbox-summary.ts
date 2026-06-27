/**
 * Resumen LIGERO de la cola offline en localStorage — SIN PII y SIN Dexie.
 *
 * Por qué: el banner de estado vive en el layout (todas las páginas), pero Dexie
 * (~27KB gz) NO debe entrar al bundle inicial (#21 <150KB). Este resumen sync
 * permite al banner saber, sin cargar nada pesado, si hay reportes en cola; solo
 * entonces se hace lazy-import del módulo completo (outbox.ts/replay.ts).
 *
 * Contenido: SOLO metadatos no sensibles (conteo, antigüedad del más viejo, peor
 * estado). NUNCA nombre/teléfono/email/coords — esos viven cifrados en IndexedDB.
 */

export type OutboxItemStatus = 'pending' | 'sending' | 'failed' | 'needs_attention';

export interface OutboxSummary {
  count: number;
  oldestAt: number | null;
  worst: OutboxItemStatus | null;
}

const KEY = 'faro_outbox_summary';
export const OUTBOX_CHANGED_EVENT = 'faro-outbox-changed';

export const EMPTY_SUMMARY: OutboxSummary = { count: 0, oldestAt: null, worst: null };

export function readSummary(): OutboxSummary {
  if (typeof localStorage === 'undefined') return EMPTY_SUMMARY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_SUMMARY;
    const parsed = JSON.parse(raw) as Partial<OutboxSummary>;
    return {
      count: typeof parsed.count === 'number' ? parsed.count : 0,
      oldestAt: typeof parsed.oldestAt === 'number' ? parsed.oldestAt : null,
      worst: (parsed.worst as OutboxItemStatus) ?? null
    };
  } catch {
    return EMPTY_SUMMARY;
  }
}

export function writeSummary(summary: OutboxSummary): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (summary.count <= 0) {
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, JSON.stringify(summary));
    }
  } catch {
    /* almacenamiento lleno/bloqueado → el banner simplemente no se mostrará */
  }
  // Notifica a la MISMA pestaña (el evento 'storage' solo llega a otras pestañas).
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OUTBOX_CHANGED_EVENT));
  }
}

export function clearSummary(): void {
  writeSummary(EMPTY_SUMMARY);
}
