import { defineConfig } from 'vitest/config';

// Tests de utilidades puras — sin SvelteKit plugin (evita conflicto vitest 2 +
// vite-plugin-svelte 6). Tests de componentes Svelte tendrán su propio
// vitest.svelte.config.ts cuando los agreguemos en D2+.
export default defineConfig({
  test: {
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['tests/e2e/**', 'tests/**/*.svelte.{test,spec}.{js,ts}'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/utils/**', 'src/lib/server/**'],
      exclude: ['src/lib/components/**', 'tests/**']
    }
  },
  resolve: {
    alias: {
      $utils: new URL('./src/lib/utils', import.meta.url).pathname,
      $components: new URL('./src/lib/components', import.meta.url).pathname,
      $schemas: new URL('./src/lib/schemas', import.meta.url).pathname,
      $server: new URL('./src/lib/server', import.meta.url).pathname,
      $client: new URL('./src/lib/client', import.meta.url).pathname
    }
  }
});
