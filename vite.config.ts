import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.ts',
      // 'prompt' (NO autoUpdate): autoUpdate recarga sola la página en cada
      // deploy y haría perder un reporte a medio llenar (datos de un familiar
      // desaparecido). El RefreshButton existente es el ÚNICO disparador de
      // recarga (reg.update() + SKIP_WAITING + controllerchange → recarga única).
      registerType: 'prompt',
      // Registramos a mano en +layout.svelte (import 'virtual:pwa-register').
      // La auto-inyección no aplica a las páginas generadas por SvelteKit.
      injectRegister: false,
      manifest: {
        name: 'Faro VE — Mapa de Esperanza Venezuela',
        short_name: 'Faro VE',
        description:
          'Mapa humanitario para reportar y buscar personas desaparecidas tras el terremoto del 24-jun-2026 en Venezuela.',
        theme_color: '#0B4F6C',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'es-VE',
        categories: ['utilities', 'social', 'navigation', 'health'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/icons/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Precache: assets del cliente + páginas estáticas prerenderizadas
        // (/auxilio, /offline) para que Faro Auxilio funcione SIN conexión.
        globPatterns: [
          'client/**/*.{js,css,ico,png,svg,webp,woff2}',
          'prerendered/**/*.html'
        ],
        maximumFileSizeToCacheInBytes: 5_000_000
      },
      devOptions: {
        enabled: false,
        type: 'module'
      }
    })
  ],
  build: {
    target: 'es2022',
    sourcemap: true
  },
  server: {
    port: 5173,
    strictPort: false
  }
});
