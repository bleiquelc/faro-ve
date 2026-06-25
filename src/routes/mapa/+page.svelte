<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import FilterChips from '$components/FilterChips.svelte';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let MapComp: any = null;

  // El mapa Leaflet se monta SOLO en cliente (import dinámico).
  onMount(async () => {
    MapComp = (await import('$components/Map.svelte')).default;
  });

  // Endpoint reactivo: arrastra los filtros de la URL (?status=…, ?is_minor=…).
  $: endpoint = `/api/persons${$page.url.search}`;
</script>

<svelte:head>
  <title>Mapa — Faro VE</title>
</svelte:head>

<div class="relative h-[100dvh] w-full overflow-hidden bg-[#0a3a4f]">
  <!-- Filtros flotantes arriba -->
  <div class="absolute inset-x-0 top-0 z-[1001] bg-gradient-to-b from-black/15 to-transparent pt-[env(safe-area-inset-top)]">
    <FilterChips />
  </div>

  <div class="h-full w-full">
    {#if MapComp}
      {#key endpoint}
        <svelte:component this={MapComp} {endpoint} />
      {/key}
    {:else}
      <div class="flex h-full items-center justify-center text-white/80">Encendiendo el mapa…</div>
    {/if}
  </div>
</div>
