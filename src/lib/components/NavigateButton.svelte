<script lang="ts">
  import {
    buildMapsUrl,
    detectPlatform,
    getInstalledMapApps,
    getPreferredMapApp,
    setPreferredMapApp,
    MAP_APP_LABEL,
    MAP_APP_EMOJI,
    formatAddressForClipboard,
    copyAddressToClipboard,
    type MapApp
  } from '$utils/navigation';
  import FaroIcon from '$components/FaroIcon.svelte';

  /**
   * NavigateButton — botón único multi-app para "🧭 Llegar aquí".
   *
   * Regla inmutable (CLAUDE.md #26-28): SOLO usar en lugares de servicio
   * (aid_points, refugios, hospitales, morgues). NUNCA en pins de persona /
   * NN / avistamiento.
   *
   * Comportamiento:
   *   - Si hay preferencia LS → abre directo (un tap).
   *   - Si no hay preferencia → modal sheet con apps disponibles.
   *   - Al elegir, persiste en LS para futuras visitas.
   */

  export let lat: number;
  export let lng: number;
  export let name: string | undefined = undefined;
  export let address: string;
  export let landmark: string | null | undefined = undefined;
  export let entrance_notes: string | null | undefined = undefined;
  export let prominent: boolean = true; // primario (true) vs secundario (false)

  let showSelector = false;
  let copied = false;
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  $: platform = typeof window !== 'undefined' ? detectPlatform() : 'desktop';
  $: installed = getInstalledMapApps(platform);

  function open(app: MapApp) {
    setPreferredMapApp(app);
    const url = buildMapsUrl(app, lat, lng, name);
    showSelector = false;
    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  }

  function onNavigateClick() {
    const preferred = getPreferredMapApp();
    if (preferred && installed.includes(preferred)) {
      open(preferred);
    } else if (installed.length === 1) {
      open(installed[0]);
    } else {
      showSelector = true;
    }
  }

  async function onCopy() {
    const text = formatAddressForClipboard({
      name,
      address,
      landmark,
      entrance_notes,
      lat,
      lng
    });
    const ok = await copyAddressToClipboard(text);
    if (ok) {
      copied = true;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 2_400);
    }
  }
</script>

<div class="flex flex-col gap-2 w-full">
  <button
    type="button"
    on:click={onNavigateClick}
    class="min-h-tap inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold transition active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-faro-700 {prominent
      ? 'bg-faro-900 text-white hover:bg-faro-800'
      : 'bg-white border border-faro-900 text-faro-900 hover:bg-faro-50'}"
    aria-label="Iniciar navegación a {name ?? 'este lugar'}"
  >
    <FaroIcon name="navigate" size={20} />
    <span>Llegar aquí</span>
  </button>

  <button
    type="button"
    on:click={onCopy}
    class="min-h-tap inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm text-faro-900 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-faro-700"
    aria-label="Copiar dirección al portapapeles"
    aria-live="polite"
  >
    <FaroIcon name="copy" size={18} />
    <span>{copied ? '¡Copiado!' : 'Copiar dirección'}</span>
  </button>
</div>

{#if showSelector}
  <div
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in"
    role="dialog"
    aria-modal="true"
    aria-labelledby="nav-sheet-title"
    tabindex="-1"
    on:click|self={() => (showSelector = false)}
    on:keydown={(e) => e.key === 'Escape' && (showSelector = false)}
  >
    <div class="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-4 pb-6 space-y-2">
      <h2 id="nav-sheet-title" class="text-lg font-semibold text-gray-900 mb-2 px-2">
        ¿Cómo quieres llegar?
      </h2>
      {#each installed as app}
        <button
          type="button"
          on:click={() => open(app)}
          class="min-h-tap w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left bg-gray-50 hover:bg-faro-50 focus:outline-none focus:ring-2 focus:ring-faro-700 transition"
        >
          <span class="text-2xl" aria-hidden="true">{MAP_APP_EMOJI[app]}</span>
          <span class="font-medium">{MAP_APP_LABEL[app]}</span>
        </button>
      {/each}
      <button
        type="button"
        on:click={() => (showSelector = false)}
        class="min-h-tap w-full mt-2 rounded-lg px-4 py-3 text-gray-700 hover:bg-gray-100"
      >
        Cancelar
      </button>
    </div>
  </div>
{/if}
