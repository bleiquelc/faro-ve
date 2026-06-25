<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { COLOR, COLOR_ON, LABEL_ES, PULSE_CLASS, categoryForPerson } from '$utils/colors';
  import type { PersonPublic } from '$schemas/person';
  import 'leaflet/dist/leaflet.css';
  import 'leaflet.markercluster/dist/MarkerCluster.css';

  /**
   * Map.svelte — mapa Leaflet client-only.
   *
   * - Se monta SOLO en cliente (onMount + import dinámico) para evitar errores
   *   de hidratación / `window is not defined` en SSR.
   * - Tiles OSM (cache SW 7d en prod) con atribución obligatoria.
   * - Pines DivIcon SVG con color por categoría + clase de pulso (menores/médicos).
   * - MarkerCluster para densidad.
   * - Popup de persona: SIN botón de navegación, texto "ubicación aproximada"
   *   (regla CLAUDE #26). Botón "Tengo información" → relay anti-PII.
   */

  export let endpoint = '/api/persons';
  export let center: [number, number] = [10.4806, -66.9036]; // Caracas
  export let zoom = 6;

  let mapEl: HTMLDivElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let map: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cluster: any = null;
  let loading = true;
  let errorMsg = '';
  let count = 0;

  function pinHtml(p: PersonPublic): string {
    const cat = categoryForPerson(p);
    const color = COLOR[cat];
    const ring = COLOR_ON[cat];
    const pulse = PULSE_CLASS[cat] ?? '';
    return `
      <span class="faro-pin ${pulse}" style="--pin:${color};--ring:${ring}" role="img" aria-label="${LABEL_ES[cat]}">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
          <path fill="${color}" stroke="${ring}" stroke-width="1.5"
            d="M12 2C7.6 2 4 5.6 4 10c0 5.4 7 11.5 7.3 11.8.4.3.9.3 1.3 0C13 21.5 20 15.4 20 10c0-4.4-3.6-8-8-8z"/>
          <circle cx="12" cy="10" r="3" fill="${ring}"/>
        </svg>
      </span>`;
  }

  function popupHtml(p: PersonPublic): string {
    const cat = categoryForPerson(p);
    const name = p.full_name || 'Sin nombre';
    const age = p.age != null ? `, ${p.age} años` : '';
    const sector = p.home_neighborhood || p.home_city || p.last_known_location_text || 'zona desconocida';
    const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c));
    const clothes = [p.clothing_top, p.clothing_bottom].filter(Boolean).join(', ');
    return `
      <div class="faro-popup">
        <div class="faro-popup-badge" style="background:${COLOR[cat]};color:${COLOR_ON[cat]}">${LABEL_ES[cat]}</div>
        <h3>${esc(name)}${age}</h3>
        ${clothes ? `<p class="faro-popup-desc">Vestía: ${esc(clothes)}</p>` : ''}
        ${p.distinguishing_marks ? `<p class="faro-popup-desc">Señas: ${esc(p.distinguishing_marks)}</p>` : ''}
        <p class="faro-popup-loc">📍 Ubicación aproximada (~300m por privacidad)<br/><small>Última zona conocida: ${esc(sector)}</small></p>
        <a class="faro-popup-btn" href="/mensaje/${p.id}">Tengo información</a>
        ${p.source && p.source !== 'faro-ve' ? `<a class="faro-popup-src" href="${esc(p.source_url || '#')}" target="_blank" rel="noopener">Fuente: ${esc(p.source)}</a>` : ''}
      </div>`;
  }

  onMount(async () => {
    const L = (await import('leaflet')).default;
    await import('leaflet.markercluster');

    map = L.map(mapEl, { zoomControl: true, attributionControl: true }).setView(center, zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cluster = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true
    });
    map.addLayer(cluster);

    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { persons: PersonPublic[] };
      for (const p of data.persons) {
        if (p.lat == null || p.lng == null) continue;
        const icon = L.divIcon({
          html: pinHtml(p),
          className: 'faro-pin-wrap',
          iconSize: [28, 28],
          iconAnchor: [14, 26],
          popupAnchor: [0, -24]
        });
        const m = L.marker([p.lat, p.lng], { icon, keyboard: true, title: p.full_name || 'Persona' });
        m.bindPopup(popupHtml(p), { maxWidth: 280 });
        cluster.addLayer(m);
      }
      count = data.persons.length;
    } catch (e) {
      errorMsg = 'No se pudo cargar el mapa. Revisa tu conexión.';
      console.error('[Map] fetch', e);
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    if (map) map.remove();
  });
</script>

<div class="relative h-full w-full">
  <div bind:this={mapEl} class="h-full w-full" aria-label="Mapa de personas reportadas"></div>

  {#if loading}
    <div class="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60">
      <div class="rounded-full bg-faro-900 px-4 py-2 text-sm font-medium text-white">Cargando mapa…</div>
    </div>
  {/if}

  {#if errorMsg}
    <div class="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white shadow">
      {errorMsg}
    </div>
  {/if}

  {#if !loading && !errorMsg}
    <div class="absolute bottom-2 left-2 rounded-full bg-white/90 px-3 py-1 text-xs text-gray-700 shadow">
      {count} {count === 1 ? 'reporte' : 'reportes'}
    </div>
  {/if}
</div>

<style>
  :global(.faro-pin-wrap) {
    background: transparent;
    border: none;
  }
  :global(.faro-pin) {
    display: block;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
    transform-origin: center bottom;
  }
  :global(.faro-popup h3) {
    margin: 0.25rem 0;
    font-weight: 700;
    font-size: 1rem;
  }
  :global(.faro-popup-badge) {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 600;
  }
  :global(.faro-popup-desc) {
    margin: 0.2rem 0;
    font-size: 0.8rem;
    color: #374151;
  }
  :global(.faro-popup-loc) {
    margin: 0.4rem 0;
    font-size: 0.78rem;
    color: #6b7280;
  }
  :global(.faro-popup-btn) {
    display: inline-block;
    margin-top: 0.4rem;
    padding: 8px 14px;
    border-radius: 8px;
    background: #0b4f6c;
    color: #fff;
    font-weight: 600;
    font-size: 0.85rem;
    text-decoration: none;
  }
  :global(.faro-popup-src) {
    display: block;
    margin-top: 0.4rem;
    font-size: 0.72rem;
    color: #2c5d7a;
  }
</style>
