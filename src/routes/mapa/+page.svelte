<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import FilterChips from '$components/FilterChips.svelte';
  import RefreshButton from '$components/RefreshButton.svelte';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let MapComp: any = null;

  // El mapa Leaflet se monta SOLO en cliente (import dinámico).
  onMount(async () => {
    MapComp = (await import('$components/Map.svelte')).default;
  });

  // Endpoint reactivo: arrastra los filtros de la URL (?status=…, ?q=…) pero
  // EXCLUYE `aid` (toggle de la capa de ayuda) → alternar esa capa no remonta el
  // mapa de personas; showAid se pasa como prop reactiva.
  $: personSearch = (() => {
    const p = new URLSearchParams($page.url.searchParams);
    p.delete('aid');
    const qs = p.toString();
    return qs ? `?${qs}` : '';
  })();
  $: endpoint = `/api/persons${personSearch}`;
  $: showAid = $page.url.searchParams.get('aid') === '1';

  // Buscador por nombre — preserva los filtros activos y setea ?q=.
  let showSearch = false;
  let query = '';
  $: query = $page.url.searchParams.get('q') ?? '';

  function runSearch() {
    const params = new URLSearchParams($page.url.searchParams);
    const v = query.trim();
    if (v) params.set('q', v);
    else params.delete('q');
    goto(`/mapa${params.toString() ? `?${params}` : ''}`, { keepFocus: true, noScroll: true });
  }
  function toggleSearch() {
    showSearch = !showSearch;
  }
</script>

<svelte:head>
  <title>Mapa — Faro VE</title>
</svelte:head>

<div class="relative h-[100dvh] w-full overflow-hidden bg-[#0a3a4f]">
  <!-- Filtros + buscador flotantes arriba -->
  <div
    class="absolute inset-x-0 top-0 z-[1001] bg-gradient-to-b from-black/20 to-transparent pt-[env(safe-area-inset-top)]"
  >
    <div class="flex items-center gap-2 pr-2">
      <div class="min-w-0 flex-1"><FilterChips /></div>
      <RefreshButton tone="dark" />
    </div>
    {#if showSearch}
      <form class="px-3 pb-2" on:submit|preventDefault={runSearch}>
        <div class="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-lg">
          <span aria-hidden="true">🔎</span>
          <!-- svelte-ignore a11y_autofocus -->
          <input
            bind:value={query}
            type="search"
            inputmode="search"
            autofocus
            placeholder="Buscar por nombre y presiona Enter…"
            aria-label="Buscar persona por nombre"
            class="min-h-tap w-full bg-transparent text-sm outline-none"
          />
        </div>
      </form>
    {/if}
  </div>

  <!-- Mapa (lo más visible) -->
  <div class="h-full w-full">
    {#if MapComp}
      <!-- {#key endpoint}: cambiar un filtro de PERSONAS remonta el mapa (recarga
           limpia). Como efecto, si la capa de ayuda está activa se re-descarga
           desde cero — aceptable por el bajo volumen de aid_points; si crecen,
           hoistear la capa fuera del {#key} o cachear por bbox. -->
      {#key endpoint}
        <svelte:component this={MapComp} {endpoint} {showAid} />
      {/key}
    {:else}
      <div class="flex h-full items-center justify-center text-white/80">Encendiendo el mapa…</div>
    {/if}
  </div>

  <!-- Navegación flotante abajo: compacta para no tapar el mapa -->
  <nav
    class="absolute inset-x-0 bottom-0 z-[1001] flex justify-center pb-[calc(env(safe-area-inset-bottom)+0.6rem)] pt-2"
    aria-label="Acciones del mapa"
  >
    <div
      class="flex items-center gap-1 rounded-full border border-white/20 bg-faro-900/90 p-1 shadow-xl backdrop-blur-md"
    >
      <a
        href="/"
        data-sveltekit-preload-data="hover"
        class="min-h-tap flex flex-col items-center justify-center rounded-full px-4 py-1.5 text-[11px] font-medium text-white/90 transition-all duration-200 ease-out active:scale-[0.95] hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        <span class="text-lg leading-none" aria-hidden="true">🏠</span>
        <span>Inicio</span>
      </a>
      <button
        type="button"
        on:click={toggleSearch}
        aria-pressed={showSearch}
        class="min-h-tap flex flex-col items-center justify-center rounded-full px-4 py-1.5 text-[11px] font-medium text-white transition-all duration-200 ease-out active:scale-[0.95] {showSearch
          ? 'bg-white/20'
          : 'hover:bg-white/15'} focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        <span class="text-lg leading-none" aria-hidden="true">🔎</span>
        <span>Buscar</span>
      </button>
      <a
        href="/reportar/a-salvo"
        data-sveltekit-preload-data="hover"
        class="min-h-tap flex flex-col items-center justify-center rounded-full px-4 py-1.5 text-[11px] font-medium text-white/90 transition-all duration-200 ease-out active:scale-[0.95] hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        <span class="text-lg leading-none" aria-hidden="true">💚</span>
        <span>Estoy bien</span>
      </a>
    </div>
  </nav>
</div>
