<script lang="ts">
  import { onMount } from 'svelte';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let MapComp: any = null;

  // El mapa Leaflet se monta SOLO en cliente (import dinámico).
  onMount(async () => {
    MapComp = (await import('$components/Map.svelte')).default;
  });
</script>

<svelte:head>
  <title>Mapa — Faro VE</title>
</svelte:head>

<div class="h-[100dvh] w-full">
  {#if MapComp}
    <svelte:component this={MapComp} />
  {:else}
    <div class="flex h-full items-center justify-center text-faro-900">Cargando mapa…</div>
  {/if}
</div>
