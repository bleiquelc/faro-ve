/**
 * Store reactivo de conectividad. Lo usan los formularios para deshabilitar la
 * subida de foto sin señal (la foto va directo a Storage por URL firmada, que
 * requiere red) y para mostrar el aviso correcto en lugar de fallar en silencio.
 */
import { readable } from 'svelte/store';

export const online = readable(true, (set) => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  set(navigator.onLine !== false);
  const on = () => set(true);
  const off = () => set(false);
  window.addEventListener('online', on);
  window.addEventListener('offline', off);
  return () => {
    window.removeEventListener('online', on);
    window.removeEventListener('offline', off);
  };
});
