/**
 * Store reactivo del resumen de la cola — alimentado por el resumen LIGERO de
 * localStorage (sin Dexie), así el banner del layout no arrastra Dexie al bundle
 * inicial (#21). Se actualiza por el evento de la misma pestaña y por 'storage'
 * (otras pestañas).
 */
import { readable } from 'svelte/store';
import {
  readSummary,
  OUTBOX_CHANGED_EVENT,
  EMPTY_SUMMARY,
  type OutboxSummary
} from './outbox-summary';

export const outboxSummary = readable<OutboxSummary>(EMPTY_SUMMARY, (set) => {
  if (typeof window === 'undefined') return;
  const update = () => set(readSummary());
  update();
  window.addEventListener(OUTBOX_CHANGED_EVENT, update);
  window.addEventListener('storage', update);
  return () => {
    window.removeEventListener(OUTBOX_CHANGED_EVENT, update);
    window.removeEventListener('storage', update);
  };
});
