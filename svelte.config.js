import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      routes: {
        include: ['/*'],
        exclude: ['<all>']
      }
    }),
    alias: {
      $components: 'src/lib/components',
      $utils: 'src/lib/utils',
      $schemas: 'src/lib/schemas',
      $server: 'src/lib/server',
      $client: 'src/lib/client'
    },
    csrf: {
      trustedOrigins: [
        'https://faro-ve.com',
        'https://www.faro-ve.com',
        'https://faro-ve.pages.dev'
      ]
    },
    serviceWorker: {
      register: false
    }
  }
};

export default config;
