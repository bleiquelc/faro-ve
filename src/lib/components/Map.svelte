<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { COLOR, COLOR_ON, LABEL_ES, PULSE_CLASS, categoryForPerson } from '$utils/colors';
  import type { PersonPublic } from '$schemas/person';
  import 'leaflet/dist/leaflet.css';
  import 'leaflet.markercluster/dist/MarkerCluster.css';

  /**
   * Map.svelte — "Mapa de Esperanza": mapa apagado, reportes encendidos.
   *
   * Dirección de diseño (consulta UX): cada persona es un punto de LUZ que
   * respira suavemente sobre un mapa atenuado (CARTO Positron + filtro "Faro
   * Dusk"). Clusters = constelaciones azul-faro (no zonas rojas de alarma).
   * Cargando = amanecer con haz de faro. Cuerpos NN NUNCA laten (dignidad).
   *
   * Privacidad (CLAUDE #26): popup de persona SIN navegación, "ubicación
   * aproximada ~300m". Accesibilidad: núcleo opaco + ring blanco = AAA;
   * prefers-reduced-motion congela; toggle bajo consumo apaga todo.
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

  const SUBTITLE: Record<string, string> = {
    minor: 'Prioridad · ayúdanos a encontrarle',
    medical: 'Necesita atención médica',
    missing: 'Alguien lo está buscando',
    sighting: 'Reporte de avistamiento',
    deceased: 'En proceso de identificación · con dignidad',
    safe: 'Apareció con bien'
  };

  function esc(s: string): string {
    return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] || c);
  }

  function pinHtml(p: PersonPublic, i: number): string {
    const cat = categoryForPerson(p);
    const color = COLOR[cat];
    const ring = COLOR_ON[cat];
    const pulse = PULSE_CLASS[cat] ?? '';
    // Escalonado anti-sincronía: 12 fases → respiran desfasadas, se ve orgánico.
    const delay = pulse ? `animation-delay:${((i % 12) * 0.18).toFixed(2)}s` : '';
    return `
      <span class="faro-pin faro-cat-${cat}" style="--pin:${color};--ring:${ring}" role="img" aria-label="${LABEL_ES[cat]}">
        <i class="faro-glow ${pulse}" style="${delay}"></i>
        <i class="faro-core"></i>
      </span>`;
  }

  function popupHtml(p: PersonPublic): string {
    const cat = categoryForPerson(p);
    const name = p.full_name || 'Sin nombre';
    const age = p.age != null ? `, ${p.age} años` : '';
    const sector = p.home_neighborhood || p.home_city || p.last_known_location_text || 'zona desconocida';
    const clothes = [p.clothing_top, p.clothing_bottom].filter(Boolean).join(', ');
    const sub = SUBTITLE[cat] ?? '';
    return `
      <div class="faro-popup">
        <div class="faro-popup-badge" style="background:${COLOR[cat]};color:${COLOR_ON[cat]}">${LABEL_ES[cat]}</div>
        <h3>${esc(name)}${age}</h3>
        ${sub ? `<p class="faro-popup-sub">${sub}</p>` : ''}
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

    // Tile "Faro Dusk": CARTO Positron (gratis, sin key) + filtro de marca en CSS.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      detectRetina: true,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
      className: 'faro-tiles'
    }).addTo(map);

    // Velo azul-faro entre mapa y luces (no toca contraste de los pines).
    const veil = L.DomUtil.create('div', 'faro-veil', mapEl);
    veil.setAttribute('aria-hidden', 'true');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cluster = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      // Cluster = constelación azul-faro neutra (no color de categoría → no alarma).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      iconCreateFunction: (c: any) => {
        const n = c.getChildCount();
        const size = n < 10 ? 38 : n < 50 ? 46 : 54;
        return L.divIcon({
          html: `<span class="faro-cluster" style="--s:${size}px"><b>${n}</b></span>`,
          className: 'faro-cluster-wrap',
          iconSize: [size, size]
        });
      }
    });
    map.addLayer(cluster);

    // Pausa la respiración mientras se mueve/zoomea (no compite con el scroll 30fps).
    map.on('movestart zoomstart', () => mapEl.classList.add('faro-still'));
    map.on('moveend zoomend', () => mapEl.classList.remove('faro-still'));

    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { persons: PersonPublic[] };
      data.persons.forEach((p, i) => {
        if (p.lat == null || p.lng == null) return;
        const icon = L.divIcon({
          html: pinHtml(p, i),
          className: 'faro-pin-wrap',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -14]
        });
        const m = L.marker([p.lat, p.lng], { icon, keyboard: true, title: p.full_name || 'Persona' });
        m.bindPopup(popupHtml(p), { maxWidth: 280 });
        cluster.addLayer(m);
      });
      count = data.persons.length;
    } catch (e) {
      errorMsg = 'No se pudo encender el mapa. Revisa tu conexión.';
      console.error('[Map] fetch', e);
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    if (map) map.remove();
  });
</script>

<div class="relative h-full w-full bg-[#0a3a4f]">
  <div bind:this={mapEl} class="h-full w-full" aria-label="Mapa de personas reportadas"></div>

  {#if loading}
    <div class="faro-loading absolute inset-0 flex items-center justify-center" aria-live="polite">
      <span class="relative z-10 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur">
        Encendiendo el mapa…
      </span>
    </div>
  {/if}

  {#if errorMsg}
    <div class="absolute left-1/2 top-4 z-[400] -translate-x-1/2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white shadow">
      {errorMsg}
    </div>
  {/if}

  {#if !loading && !errorMsg}
    <div class="absolute bottom-2 left-2 z-[400] rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-faro-900 shadow">
      ✨ {count} {count === 1 ? 'luz encendida' : 'luces encendidas'}
    </div>
  {/if}
</div>

<style>
  /* ── Tile "Faro Dusk": apaga y enfría el mapa para que las luces resalten ── */
  :global(.faro-tiles) {
    filter: saturate(0.55) brightness(0.94) contrast(0.96) sepia(0.06) hue-rotate(178deg);
  }
  :global(.faro-veil) {
    position: absolute;
    inset: 0;
    z-index: 250;
    pointer-events: none;
    background: radial-gradient(120% 90% at 50% 0%, rgba(11, 79, 108, 0) 40%, rgba(11, 79, 108, 0.1) 100%);
    mix-blend-mode: multiply;
  }

  /* ── Pin "punto de luz": halo + núcleo ── */
  :global(.faro-pin-wrap) {
    background: transparent;
    border: none;
  }
  :global(.faro-pin) {
    position: relative;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
  }
  :global(.faro-pin .faro-glow) {
    position: absolute;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      color-mix(in srgb, var(--pin) 70%, transparent) 0%,
      color-mix(in srgb, var(--pin) 38%, transparent) 38%,
      color-mix(in srgb, var(--pin) 0%, transparent) 72%
    );
    filter: blur(0.5px);
  }
  :global(.faro-pin .faro-core) {
    position: relative;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--pin);
    border: 2px solid #ffffff;
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--pin) 55%, transparent),
      0 1px 2px rgba(0, 0, 0, 0.3);
  }
  /* menor: anillo de prioridad fijo (presencia, no animación) */
  :global(.faro-cat-minor .faro-core) {
    box-shadow:
      0 0 0 3px rgba(124, 58, 237, 0.3),
      0 1px 2px rgba(0, 0, 0, 0.3);
  }
  /* cuerpo NN: luz fría tenue y digna, núcleo un poco mayor (no "apagado-roto") */
  :global(.faro-cat-deceased .faro-glow) {
    background: radial-gradient(
      circle,
      rgba(148, 163, 184, 0.45) 0%,
      rgba(148, 163, 184, 0.18) 45%,
      transparent 72%
    );
  }
  :global(.faro-cat-deceased .faro-core) {
    width: 14px;
    height: 14px;
  }

  /* ── Cluster "constelación" azul-faro ── */
  :global(.faro-cluster-wrap) {
    background: transparent;
    border: none;
  }
  :global(.faro-cluster) {
    display: grid;
    place-items: center;
    width: var(--s);
    height: var(--s);
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(11, 79, 108, 0.92) 0%,
      rgba(11, 79, 108, 0.78) 60%,
      rgba(11, 79, 108, 0.3) 100%
    );
    box-shadow:
      0 0 12px 2px rgba(11, 79, 108, 0.4),
      0 2px 6px rgba(0, 0, 0, 0.25);
    border: 2px solid rgba(255, 255, 255, 0.85);
  }
  :global(.faro-cluster b) {
    color: #fff;
    font-weight: 700;
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  }

  /* ── Beacon "apareció a salvo" (se añade .faro-beacon en realtime) ── */
  :global(.faro-beacon::after) {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid #16a34a;
    animation: ripple 1.6s ease-out 2;
  }

  /* ── Cargando: amanecer + haz de faro ── */
  .faro-loading {
    background: linear-gradient(180deg, #0b4f6c 0%, #2c5d7a 55%, #f0f9fb 100%);
    overflow: hidden;
  }
  .faro-loading::before {
    content: '';
    position: absolute;
    inset: 0;
    background: conic-gradient(
      from 0deg at 50% 38%,
      transparent 0deg,
      rgba(255, 247, 214, 0) 30deg,
      rgba(255, 247, 214, 0.35) 45deg,
      transparent 60deg,
      transparent 360deg
    );
    animation: faro-sweep 3.2s linear infinite;
  }
  @keyframes faro-sweep {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── Popup ── */
  :global(.faro-popup h3) {
    margin: 0.25rem 0 0.1rem;
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
  :global(.faro-popup-sub) {
    margin: 0.1rem 0 0.3rem;
    font-size: 0.78rem;
    font-style: italic;
    color: #0b4f6c;
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
