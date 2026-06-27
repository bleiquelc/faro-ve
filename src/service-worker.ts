/// <reference lib="webworker" />
/**
 * Faro VE — Service Worker (injectManifest).
 *
 * Meta: la MÁXIMA información útil disponible SIN conexión, sin cambiar el
 * comportamiento online y SIN riesgo de privacidad ni de pérdida de datos.
 *
 *  - Precache del app-shell + páginas estáticas prerenderizadas (/auxilio,
 *    /offline) → Faro Auxilio (primeros auxilios) funciona offline. El precache
 *    se registra ANTES que la ruta de navegación, así que /auxilio y /offline se
 *    sirven del precache (offline garantizado).
 *  - Navegaciones: ALLOWLIST fail-closed. Solo páginas ESTÁTICAS sin datos
 *    por-request se cachean (NetworkFirst). El resto (mapa, /persona, /punto,
 *    /reportar, /mensaje, moderación, /api…) es NetworkOnly: online idéntico a
 *    hoy; offline cae a la página /offline SIN cachear nada. Así jamás se
 *    persiste en el dispositivo HTML con PII/coords exactas (reglas 1 y 2).
 *  - Teselas del mapa (Carto/OSM/MapTiler): CacheFirst con tope y purga por
 *    cuota → zonas ya vistas siguen disponibles si se cae la conexión.
 *  - Actualización CONTROLADA por el usuario: el SW nuevo NO toma control solo.
 *    Espera a que el RefreshButton mande SKIP_WAITING (un solo punto de recarga).
 */
import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, NetworkOnly, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

// Limpia precaches de versiones anteriores (no servir shells viejos).
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Actualización controlada por el usuario: NO hacemos skipWaiting() en install.
// La versión nueva espera; el RefreshButton ("Actualizar") postea SKIP_WAITING
// cuando el usuario decide → activa, toma control y recarga UNA vez. En la
// PRIMERA instalación (no hay SW previo) activa de inmediato sin esperar.
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

const OFFLINE_FALLBACK = '/offline';

// Allowlist (fail-closed): SOLO páginas ESTÁTICAS sin datos por-request.
// Hoy /auxilio y /offline ya van por precache (esta rama casi no se ejecuta);
// se listan por intención y para cubrir futuras páginas estáticas. NUNCA añadir
// aquí rutas con datos del usuario (/persona, /punto, /reportar, /mensaje…).
const CACHE_NAV_ALLOWLIST = [/^\/auxilio(\/|$)/, /^\/offline(\/|$)/];

const navCaching = new NetworkFirst({
  cacheName: 'faro-paginas',
  networkTimeoutSeconds: 4,
  plugins: [new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 7 })]
});
const navNetworkOnly = new NetworkOnly();

async function offlinePage(): Promise<Response> {
  // Robusto ante variaciones de prerender/trailingSlash en el build.
  const hit =
    (await matchPrecache(OFFLINE_FALLBACK)) ||
    (await matchPrecache('/offline.html')) ||
    (await matchPrecache('/offline/'));
  return hit ?? Response.error();
}

// Toda navegación: páginas estáticas → NetworkFirst (cacheadas); el resto →
// NetworkOnly (nunca cacheado). Offline → página /offline. Sin fuga de PII.
registerRoute(
  new NavigationRoute(async (params) => {
    const url = new URL(params.request.url);
    const cacheable = CACHE_NAV_ALLOWLIST.some((re) => re.test(url.pathname));
    try {
      return await (cacheable ? navCaching : navNetworkOnly).handle(params);
    } catch {
      return offlinePage();
    }
  })
);

// Teselas del mapa: CacheFirst acotado y a prueba de cuota.
registerRoute(
  ({ url, request }) =>
    request.destination === 'image' &&
    (/(^|\.)tile\.openstreetmap\.org$/.test(url.hostname) ||
      /(^|\.)basemaps\.cartocdn\.com$/.test(url.hostname) ||
      /(^|\.)maptiler\.com$/.test(url.hostname)),
  new CacheFirst({
    cacheName: 'faro-mapa-teselas',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 350,
        maxAgeSeconds: 60 * 60 * 24 * 14,
        purgeOnQuotaError: true
      })
    ]
  })
);
