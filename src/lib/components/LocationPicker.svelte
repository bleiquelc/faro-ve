<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import 'leaflet/dist/leaflet.css';

  /**
   * LocationPicker — selector de ubicación EXACTA para lugares de servicio.
   *
   * Patrón "pin central" (estilo Uber/Maps): un pin fijo en el centro de la
   * pantalla; mueves el mapa para colocarlo en el sitio exacto. Robusto cuando el
   * GPS falla o se niega (regla #28: "el GPS en VE falla en zonas mal
   * geocodeadas") — siempre puedes ubicar el punto a mano. Botón "Usar mi
   * ubicación" recentra al GPS. Lectura de coords editable (accesible + pegar).
   *
   * Fuente de verdad: el centro del mapa. moveend → lat/lng (one-way map→datos);
   * editar las coords a mano → recentra el mapa (one-way datos→map en `change`,
   * sin bucle: el set programático del valor no dispara `change`).
   */

  export let lat: number | null = null;
  export let lng: number | null = null;

  const CARACAS: [number, number] = [10.4806, -66.9036];

  let el: HTMLDivElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let map: any = null;
  let geoState: 'idle' | 'loading' | 'ok' | 'denied' = 'idle';

  function syncFromCenter() {
    if (!map) return;
    const c = map.getCenter();
    lat = Number(c.lat.toFixed(6));
    lng = Number(c.lng.toFixed(6));
  }

  function recenterFromInputs() {
    if (!map || lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.setView([lat, lng], Math.max(map.getZoom(), 16));
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      geoState = 'denied';
      return;
    }
    geoState = 'loading';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        geoState = 'ok';
        if (map) map.setView([pos.coords.latitude, pos.coords.longitude], 17);
      },
      () => {
        geoState = 'denied';
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  }

  onMount(async () => {
    const L = (await import('leaflet')).default;
    const start: [number, number] = lat != null && lng != null ? [lat, lng] : CARACAS;
    map = L.map(el, {
      zoomControl: true,
      attributionControl: true,
      // Acota a Venezuela (+ margen) — coherente con el mapa principal.
      maxBounds: [
        [-1, -75],
        [16, -58]
      ],
      maxBoundsViscosity: 1.0,
      minZoom: 6
    }).setView(start, lat != null ? 16 : 11);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      detectRetina: true,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    syncFromCenter(); // inicializa lat/lng al centro
    map.on('moveend', syncFromCenter);

    // Si no traíamos coords, intenta GPS para arrancar cerca del usuario.
    if (lat == null) useMyLocation();
  });

  onDestroy(() => {
    if (map) map.remove();
  });
</script>

<div class="space-y-2">
  <div class="relative h-60 w-full overflow-hidden rounded-xl border border-gray-200">
    <div bind:this={el} class="h-full w-full" aria-label="Mapa para elegir la ubicación exacta"></div>
    <!-- Pin fijo en el centro: la punta marca el centro del mapa -->
    <div
      class="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-[90%] text-3xl drop-shadow"
      aria-hidden="true"
    >
      📍
    </div>
  </div>

  <div class="flex flex-wrap items-center gap-2">
    <button
      type="button"
      on:click={useMyLocation}
      class="min-h-tap inline-flex items-center gap-2 rounded-lg border border-faro-900 px-3 py-2 text-sm font-medium text-faro-900 hover:bg-faro-50"
    >
      <span aria-hidden="true">📍</span>
      {geoState === 'loading' ? 'Buscando…' : 'Usar mi ubicación'}
    </button>
    <p class="text-xs text-gray-500">Mueve el mapa para poner el pin en el lugar exacto.</p>
  </div>

  {#if geoState === 'denied'}
    <p class="text-xs text-amber-700">
      No pudimos usar tu GPS. No importa: arrastra el mapa para colocar el pin a mano.
    </p>
  {/if}

  <!-- Coordenadas (accesible + pegar). Editarlas recentra el mapa. -->
  <div class="grid grid-cols-2 gap-2">
    <label class="block">
      <span class="text-xs font-medium text-gray-600">Latitud</span>
      <input
        bind:value={lat}
        on:change={recenterFromInputs}
        type="number"
        step="any"
        inputmode="decimal"
        class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2 text-sm tabular-nums"
        aria-label="Latitud"
      />
    </label>
    <label class="block">
      <span class="text-xs font-medium text-gray-600">Longitud</span>
      <input
        bind:value={lng}
        on:change={recenterFromInputs}
        type="number"
        step="any"
        inputmode="decimal"
        class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2 text-sm tabular-nums"
        aria-label="Longitud"
      />
    </label>
  </div>
</div>
