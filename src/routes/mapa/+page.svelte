<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import FilterChips from '$components/FilterChips.svelte';
  import RefreshButton from '$components/RefreshButton.svelte';
  import FaroIcon from '$components/FaroIcon.svelte';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let MapComp: any = null;

  // El mapa Leaflet se monta SOLO en cliente (import dinámico).
  onMount(async () => {
    MapComp = (await import('$components/Map.svelte')).default;
    // Estado inicial del buscador desde la URL, UNA sola vez. A partir de aquí el
    // input lo controla el usuario (no es un espejo reactivo de la URL) → al borrar
    // el nombre NO reaparece solo.
    query = $page.url.searchParams.get('q') ?? '';
    // "Buscar" desde el home (/mapa?buscar=1) o si llega con ?q → abre el buscador.
    if ($page.url.searchParams.get('buscar') === '1' || query) showSearch = true;
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

  function runSearch() {
    const params = new URLSearchParams($page.url.searchParams);
    params.delete('buscar');
    const v = query.trim();
    if (v) params.set('q', v);
    else params.delete('q');
    goto(`/mapa${params.toString() ? `?${params}` : ''}`, { keepFocus: true, noScroll: true });
  }
  // Borrar (✕): limpia el input Y el filtro (quita ?q) → vuelven todos los resultados.
  function clearSearch() {
    query = '';
    runSearch();
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
    <div class="flex items-center gap-2 px-2">
      <!-- Inicio SIEMPRE accesible aquí arriba (la barra inferior puede quedar
           tapada por el teclado en la PWA). Garantiza "volver a inicio". -->
      <a
        href="/"
        data-sveltekit-preload-data="hover"
        aria-label="Volver al inicio"
        class="min-h-tap grid shrink-0 place-items-center rounded-full border border-white/20 bg-faro-900/90 px-3 text-white shadow-lg backdrop-blur-md transition active:scale-95 hover:bg-faro-900 focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        <FaroIcon name="home" size={20} />
      </a>
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
            type="text"
            inputmode="search"
            enterkeyhint="search"
            autofocus
            placeholder="Buscar por nombre y presiona Enter…"
            aria-label="Buscar persona por nombre"
            class="min-h-tap w-full bg-transparent text-sm text-gray-900 outline-none"
          />
          {#if query}
            <button
              type="button"
              on:click={clearSearch}
              aria-label="Borrar búsqueda"
              class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-base text-gray-500 transition hover:bg-gray-100 active:scale-95"
            >
              ✕
            </button>
          {/if}
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
        <FaroIcon name="home" size={20} />
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
        <FaroIcon name="search" size={20} />
        <span>Buscar</span>
      </button>
      <a
        href="/reportar/a-salvo"
        data-sveltekit-preload-data="hover"
        class="min-h-tap flex flex-col items-center justify-center rounded-full px-4 py-1.5 text-[11px] font-medium text-white/90 transition-all duration-200 ease-out active:scale-[0.95] hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        <FaroIcon name="safe" size={20} />
        <span>Estoy bien</span>
      </a>
    </div>
  </nav>
</div>
