<script lang="ts">
  import { onMount } from 'svelte';
  import { env } from '$env/dynamic/public';

  /**
   * Turnstile — widget anti-bot de Cloudflare (gratis). El token resultante se
   * envía como `cf-turnstile-response` en el POST; hooks.server.ts lo verifica.
   *
   * Sin PUBLIC_TURNSTILE_SITE_KEY (p.ej. dev) no renderiza: en prod hooks ya
   * exige el token (403), así que la ausencia de key se nota en el submit, no
   * en una pantalla rota.
   */

  export let token = '';

  const siteKey = env.PUBLIC_TURNSTILE_SITE_KEY ?? '';
  let el: HTMLDivElement;
  let widgetId: string | undefined;

  type TurnstileApi = {
    render: (el: HTMLElement, opts: Record<string, unknown>) => string;
    remove?: (id?: string) => void;
    reset?: (id?: string) => void;
  };
  function api(): TurnstileApi | undefined {
    return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
  }

  /**
   * Pide un token NUEVO. Los tokens de Turnstile son de un solo uso (el server
   * los consume al verificar); tras una acción exitosa, llamar reset() permite
   * otra acción en la misma página (p.ej. votar y luego reactivar un punto).
   * Aditivo: los formularios de un solo envío no necesitan llamarlo.
   */
  export function reset(): void {
    token = '';
    try {
      api()?.reset?.(widgetId);
    } catch {
      /* noop */
    }
  }

  onMount(() => {
    if (!siteKey) return;

    const render = () => {
      widgetId = api()?.render(el, {
        sitekey: siteKey,
        callback: (t: string) => (token = t),
        'expired-callback': () => (token = ''),
        'error-callback': () => (token = '')
      });
    };

    if (api()) {
      render();
    } else {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.defer = true;
      s.onload = render;
      document.head.appendChild(s);
    }

    return () => {
      try {
        api()?.remove?.(widgetId);
      } catch {
        /* noop */
      }
    };
  });
</script>

{#if siteKey}
  <div bind:this={el} class="min-h-[65px]"></div>
{:else}
  <p class="text-xs text-gray-400">Verificación anti-bot no configurada en este entorno.</p>
{/if}
