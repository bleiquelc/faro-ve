<script lang="ts">
  import { onMount } from 'svelte';
  import InstallPrompt from '$components/InstallPrompt.svelte';
  import FaroLogo from '$components/FaroLogo.svelte';

  /**
   * Home — el MAPA es el fondo (papel tapiz) y una tarjeta de bienvenida flota
   * encima. "Ver el mapa" abre el mapa interactivo completo en /mapa. Así, quien
   * entra a faro-ve.com ya VE el mapa de esperanza detrás, sin perderse.
   *
   * El mapa de fondo es ambiente (interactive=false): no roba el scroll ni se
   * arrastra; toda la interacción real vive en /mapa.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let MapComp: any = null;
  onMount(async () => {
    MapComp = (await import('$components/Map.svelte')).default;
  });
</script>

<svelte:head>
  <title>Faro VE — Mapa de Esperanza Venezuela</title>
  <meta
    name="description"
    content="Mapa humanitario para reportar y buscar personas tras el terremoto del 24-jun-2026 en Venezuela. Gratuito, con privacidad por diseño."
  />
</svelte:head>

<div class="relative h-[100dvh] w-full overflow-hidden bg-[#0a3a4f]">
  <!-- Fondo: el mapa de esperanza (ambiente, no interactivo) -->
  <div class="absolute inset-0" aria-hidden="true">
    {#if MapComp}
      <svelte:component this={MapComp} interactive={false} />
    {/if}
  </div>

  <!-- Velo para legibilidad del panel sin apagar las luces del mapa.
       z-[800] → sobre los panes de Leaflet (max ~700), bajo la tarjeta. -->
  <div
    class="pointer-events-none absolute inset-0 z-[800] bg-gradient-to-b from-[#0a3a4f]/30 via-transparent to-[#0a3a4f]/40"
    aria-hidden="true"
  ></div>

  <!-- Tarjeta de bienvenida — z-[1000] sobre todo el chrome de Leaflet -->
  <main class="absolute inset-0 z-[1000] flex h-full flex-col items-center justify-center px-5 py-8">
    <div
      class="w-full max-w-sm space-y-5 rounded-3xl border border-white/40 bg-white/85 p-6 text-center shadow-2xl backdrop-blur-md"
    >
      <div class="flex flex-col items-center gap-3">
        <FaroLogo size={72} />
        <h1 class="text-2xl font-bold text-balance text-faro-900">Faro VE — Mapa de Esperanza</h1>
        <p class="text-sm text-pretty text-gray-700">
          Reporta y busca personas tras el terremoto del 24-jun-2026 en Venezuela. Gratuito, con
          privacidad por diseño.
        </p>
      </div>

      <!-- Acción dominante: abrir el mapa completo -->
      <a
        href="/mapa"
        data-sveltekit-preload-data="hover"
        class="min-h-tap flex w-full items-center justify-center gap-2.5 rounded-2xl bg-faro-900 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-faro-900/25 transition active:scale-[0.98] hover:bg-faro-800 focus:outline-none focus:ring-2 focus:ring-faro-700 focus:ring-offset-2"
      >
        <span aria-hidden="true">🗺️</span>
        <span>Ver el mapa</span>
        <span aria-hidden="true" class="text-white/80">→</span>
      </a>

      <!-- Acciones secundarias -->
      <div class="grid grid-cols-2 gap-3">
        <a
          href="/reportar/desaparecido"
          data-sveltekit-preload-data="hover"
          class="min-h-tap flex flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white/90 px-3 py-3 text-sm font-medium text-gray-800 transition hover:border-faro-300 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-faro-700"
        >
          <span class="text-xl" aria-hidden="true">🔎</span>
          <span>Reportar a alguien</span>
        </a>
        <a
          href="/reportar/a-salvo"
          data-sveltekit-preload-data="hover"
          class="min-h-tap flex flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white/90 px-3 py-3 text-sm font-medium text-gray-800 transition hover:border-faro-300 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-faro-700"
        >
          <span class="text-xl" aria-hidden="true">💚</span>
          <span>Estoy a salvo</span>
        </a>
      </div>

      <InstallPrompt />

      <p class="text-xs text-gray-500">
        Sin ánimo de lucro · Privacidad por diseño ·
        <a href="mailto:opt-out@faro-ve.com" class="underline">opt-out</a>
      </p>
    </div>
  </main>
</div>
