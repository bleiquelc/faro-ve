/// <reference lib="webworker" />
/**
 * Faro VE — Service Worker (injectManifest).
 *
 * D1: precache mínimo del app-shell (lo que vite-plugin-pwa inyecta en
 * self.__WB_MANIFEST). Las estrategias completas (tiles CacheFirst 7d,
 * /api GET NetworkFirst, /api POST BackgroundSync con Dexie) llegan en D4.
 */
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

// Activar de inmediato la nueva versión.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
