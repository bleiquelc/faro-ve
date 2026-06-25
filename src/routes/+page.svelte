<script lang="ts">
  // Placeholder D1 — el mapa Leaflet se monta en D2.
</script>

<svelte:head>
  <title>Faro VE — Mapa de Esperanza Venezuela</title>
</svelte:head>

<main class="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center">
  <div class="max-w-md space-y-6">
    <div class="text-6xl" aria-hidden="true">🕯️</div>
    <h1 class="text-3xl font-bold text-faro-900 text-balance">
      Faro VE — Mapa de Esperanza
    </h1>
    <p class="text-gray-700 text-pretty">
      Estamos construyendo el mapa humanitario para reportar y buscar personas desaparecidas
      tras el terremoto del 24-jun-2026. Vuelve en unas horas.
    </p>
    <p class="text-sm text-gray-500">
      Mientras tanto, escríbenos a
      <a href="mailto:contacto@faro-ve.com" class="underline text-faro-900">contacto@faro-ve.com</a>.
    </p>
  </div>

  <footer class="mt-16 text-xs text-gray-500 max-w-md text-center">
    Iniciativa humanitaria sin ánimo de lucro · AGPL-3.0 · Privacidad por diseño · Opt-out
    <a href="mailto:opt-out@faro-ve.com" class="underline">opt-out@faro-ve.com</a>
  </footer>
</main>
