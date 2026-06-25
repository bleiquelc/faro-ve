<script lang="ts">
  import { onMount } from 'svelte';

  /**
   * InstallPrompt — botón "Instalar app" + instrucciones simples por plataforma.
   *
   * - Android/Chrome/Edge: captura `beforeinstallprompt` → botón dispara el
   *   diálogo nativo de instalación.
   * - iOS Safari: no soporta beforeinstallprompt → muestra instrucciones
   *   "Compartir → Añadir a pantalla de inicio".
   * - Ya instalada (display-mode standalone): no se muestra.
   * - Desktop: botón con instrucciones de instalar desde la barra de direcciones.
   *
   * Lenguaje claro, sin tecnicismos (regla CLAUDE #24).
   */

  type Platform = 'ios' | 'android' | 'desktop' | 'installed';

  let platform: Platform = 'desktop';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let deferredPrompt: any = null;
  let canInstallNative = false;
  let showHelp = false;
  let ready = false;

  onMount(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).standalone === true;

    if (standalone) {
      platform = 'installed';
      ready = true;
      return;
    }

    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) platform = 'ios';
    else if (/android/.test(ua)) platform = 'android';
    else platform = 'desktop';
    ready = true;

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      canInstallNative = true;
    });
    window.addEventListener('appinstalled', () => {
      platform = 'installed';
      canInstallNative = false;
      showHelp = false;
    });
  });

  async function onInstallClick() {
    if (canInstallNative && deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === 'accepted') platform = 'installed';
      deferredPrompt = null;
      canInstallNative = false;
    } else {
      // iOS o navegador sin prompt nativo → instrucciones manuales.
      showHelp = true;
    }
  }
</script>

{#if ready && platform !== 'installed'}
  <button
    type="button"
    on:click={onInstallClick}
    class="min-h-tap inline-flex items-center justify-center gap-2 rounded-full bg-faro-900 px-6 py-3 font-semibold text-white shadow-lg transition active:scale-[0.98] hover:bg-faro-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-faro-700"
    aria-label="Instalar Faro VE en tu teléfono"
  >
    <span aria-hidden="true">📲</span>
    <span>Instalar app en mi teléfono</span>
  </button>
{/if}

{#if showHelp}
  <div
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 animate-fade-in"
    role="dialog"
    aria-modal="true"
    aria-labelledby="install-help-title"
    on:click|self={() => (showHelp = false)}
    on:keydown={(e) => e.key === 'Escape' && (showHelp = false)}
  >
    <div class="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-2xl">
      <h2 id="install-help-title" class="mb-1 text-xl font-bold text-faro-900">
        Instalar Faro VE
      </h2>
      <p class="mb-4 text-sm text-gray-600">
        Tener la app en tu pantalla de inicio te deja abrirla de un toque y usarla
        incluso con poca señal.
      </p>

      {#if platform === 'ios'}
        <ol class="space-y-3 text-gray-800">
          <li class="flex gap-3">
            <span class="text-2xl" aria-hidden="true">①</span>
            <span>Toca el botón <strong>Compartir</strong>
              <span aria-hidden="true">⬆️</span> (abajo en Safari, el cuadrado con la flecha).</span>
          </li>
          <li class="flex gap-3">
            <span class="text-2xl" aria-hidden="true">②</span>
            <span>Desliza y toca <strong>«Añadir a pantalla de inicio»</strong>
              <span aria-hidden="true">➕</span>.</span>
          </li>
          <li class="flex gap-3">
            <span class="text-2xl" aria-hidden="true">③</span>
            <span>Toca <strong>«Añadir»</strong> arriba a la derecha. ¡Listo!</span>
          </li>
        </ol>
        <p class="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          ⚠️ En iPhone esto solo funciona desde <strong>Safari</strong>. Si abriste
          el enlace en Instagram o Chrome, ábrelo en Safari primero.
        </p>
      {:else if platform === 'android'}
        <ol class="space-y-3 text-gray-800">
          <li class="flex gap-3">
            <span class="text-2xl" aria-hidden="true">①</span>
            <span>Toca el menú <strong>⋮</strong> (tres puntos, arriba a la derecha).</span>
          </li>
          <li class="flex gap-3">
            <span class="text-2xl" aria-hidden="true">②</span>
            <span>Toca <strong>«Instalar app»</strong> o
              <strong>«Añadir a pantalla de inicio»</strong>.</span>
          </li>
          <li class="flex gap-3">
            <span class="text-2xl" aria-hidden="true">③</span>
            <span>Confirma <strong>«Instalar»</strong>. ¡Listo!</span>
          </li>
        </ol>
      {:else}
        <ol class="space-y-3 text-gray-800">
          <li class="flex gap-3">
            <span class="text-2xl" aria-hidden="true">①</span>
            <span>En la barra de direcciones, busca el ícono
              <strong>Instalar</strong> <span aria-hidden="true">⊕</span>.</span>
          </li>
          <li class="flex gap-3">
            <span class="text-2xl" aria-hidden="true">②</span>
            <span>Haz clic en <strong>«Instalar»</strong>.</span>
          </li>
        </ol>
      {/if}

      <button
        type="button"
        on:click={() => (showHelp = false)}
        class="min-h-tap mt-6 w-full rounded-lg bg-gray-100 px-4 py-3 font-medium text-gray-700 hover:bg-gray-200"
      >
        Entendido
      </button>
    </div>
  </div>
{/if}
