<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { COLOR, COLOR_ON, LABEL_ES, PULSE_CLASS, AID_META, categoryForPerson } from '$utils/colors';
  import type { PersonPublic } from '$schemas/person';
  import type { AidPointPublic, AidType } from '$schemas/aid-point';
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
  // interactive=false → "papel tapiz": el mapa es ambiente, sin controles ni
  // gestos (la home lo usa de fondo; el mapa completo se abre en /mapa).
  export let interactive = true;
  // Capa de lugares de servicio (aid_points) — toggle por el chip "Ayuda" en
  // /mapa. Carga diferida (import dinámico) para no pesar el bundle si no se usa.
  export let showAid = false;
  // dusk = mapa en tono atardecer (home): mismas tiles reales (calles/caminos
  // visibles) pero oscurecidas; el mar sigue azul (se distingue de la tierra).
  export let dusk = false;

  let mapEl: HTMLDivElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let map: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cluster: any = null;
  let loading = true;
  let errorMsg = '';
  let count = 0;
  let total = 0; // TOTAL exacto de reportados (con filtros activos) — el "número grande"
  // Lista accesible (sr-only): los clusters de Leaflet no son tabbables y el
  // lector de pantalla no puede llegar a las fichas. Esta lista da una ruta de
  // teclado/lector a cada /persona/[id] sin depender del mapa (hallazgo a11y).
  let people: PersonPublic[] = [];

  // Carga por viewport (bbox): hay decenas de miles de personas y PostgREST topa
  // en 1000 filas por request. Cargamos la zona visible y acumulamos (deduplicado
  // por id) al mover/zoomear → se ven TODAS explorando, sin recargar lo ya puesto.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Lref: any = null;
  const addedIds = new Set<string>();
  let loadTimer: ReturnType<typeof setTimeout> | null = null;
  let truncated = false; // la última carga topó el límite → hay más en esa zona

  // Modo de visualización (solo /mapa interactivo): a zoom bajo, burbujas por ZONA
  // con conteo REAL (agregación server-side, no la muestra topada a 1000); al
  // acercar se refinan y, pasado ZOOM_POINTS, se ven pines individuales de color.
  // Umbral 12 (no 13): los puntos de color aparecen un nivel de zoom antes.
  const ZOOM_POINTS = 12;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let aggLayer: any = null;
  let aggCount = 0; // suma de conteos de las burbujas visibles ("N en vista")
  let viewMode: 'agg' | 'points' = 'agg';
  // Época: invalida una carga de agregados en vuelo si el modo/zona cambió antes
  // de que resolviera (evita pintar burbujas stale sobre el modo de pines).
  let aggEpoch = 0;

  // Capa de ayuda: se crea/destruye según showAid (import diferido). mounted evita
  // que la reactividad corra antes de que el mapa exista.
  let mounted = false;
  let aidLayer: { attach: () => void; detach: () => void } | null = null;
  // Lista accesible de puntos de ayuda (los markers de Leaflet no son tabbables).
  let aidPoints: AidPointPublic[] = [];
  let aidTruncated = false; // la zona topó el límite → hay más puntos de ayuda

  async function syncAidFor(want: boolean): Promise<void> {
    if (!map || !Lref) return;
    if (want && !aidLayer) {
      const { createAidLayer } = await import('$lib/client/aid-layer');
      // El import es asíncrono: si durante el await el toggle se apagó (showAid
      // ya no coincide) o otra llamada concurrente ya creó la capa, NO adjuntar
      // una capa fantasma ni duplicarla (evita fuga de listeners + estado incoherente).
      if (showAid !== want || aidLayer) return;
      aidLayer = createAidLayer(Lref, map, {
        onPoints: (pts) => (aidPoints = pts),
        onTruncated: (t) => (aidTruncated = t)
      });
      aidLayer.attach();
    } else if (!want && aidLayer) {
      aidLayer.detach();
      aidLayer = null;
      aidPoints = [];
      aidTruncated = false;
    }
  }

  $: if (mounted) syncAidFor(showAid);

  const SUBTITLE: Record<string, string> = {
    minor: 'Prioridad · ayúdanos a encontrarle',
    medical: 'Necesita atención médica',
    missing: 'Alguien lo está buscando',
    sighting: 'Reporte de avistamiento',
    deceased: 'En proceso de identificación · con dignidad',
    safe: 'Apareció con bien'
  };

  function esc(s: string): string {
    return s.replace(
      /[<>&"']/g,
      (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c] || c
    );
  }

  // Solo permite http(s) en hrefs externos (bloquea javascript:/data: de fuentes scrapeadas).
  function safeUrl(u: string | null): string {
    if (!u) return '#';
    return /^https?:\/\//i.test(u) ? u : '#';
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

  // ¿Auto-reporte "a salvo" cuyo sujeto aceptó compartir su ubicación exacta?
  // (CLAUDE #26: navegación SOLO por opt-in del propio sujeto). El detalle con
  // NavigateButton + "Llamar" vive en /persona/[id] — aquí solo cambia el copy.
  function isSafeOptIn(p: PersonPublic): boolean {
    return (
      p.status === 'safe_self_report' &&
      p.share_exact_location_with_searchers === true &&
      p.lat_exact_optional != null &&
      p.lng_exact_optional != null
    );
  }

  function popupHtml(p: PersonPublic): string {
    const cat = categoryForPerson(p);
    const name = p.full_name || 'Sin nombre';
    const age = p.age != null ? `, ${p.age} años` : '';
    const sector = p.home_neighborhood || p.home_city || p.last_known_location_text || 'zona desconocida';
    const clothes = [p.clothing_top, p.clothing_bottom].filter(Boolean).join(', ');
    const sub = SUBTITLE[cat] ?? '';
    const optIn = isSafeOptIn(p);

    const locHtml = optIn
      ? `<p class="faro-popup-loc">📍 Esta persona compartió su ubicación exacta para que la encuentren.<br/><small>${esc(sector)}</small></p>`
      : `<p class="faro-popup-loc">📍 Ubicación aproximada (~300m por privacidad)<br/><small>Última zona conocida: ${esc(sector)}</small></p>`;

    // CTA → siempre la ficha /persona/[id] (allí: NavigateButton si opt-in;
    // "Tengo información" para personas buscadas). Evita el link muerto a /mensaje.
    // El "Llamar" (teléfono opt-in) se activa con la migración 0010 → hasta
    // entonces el copy promete solo "llegar", que sí se cumple.
    const ctaLabel = optIn ? 'Cómo llegar' : 'Ver detalles';

    return `
      <div class="faro-popup">
        <div class="faro-popup-badge" style="background:${COLOR[cat]};color:${COLOR_ON[cat]}">${LABEL_ES[cat]}</div>
        <h3>${esc(name)}${age}</h3>
        ${sub ? `<p class="faro-popup-sub">${sub}</p>` : ''}
        ${clothes ? `<p class="faro-popup-desc">Vestía: ${esc(clothes)}</p>` : ''}
        ${p.distinguishing_marks ? `<p class="faro-popup-desc">Señas: ${esc(p.distinguishing_marks)}</p>` : ''}
        ${locHtml}
        <a class="faro-popup-btn" href="/persona/${encodeURIComponent(p.id)}">${ctaLabel}</a>
        ${p.source && p.source !== 'faro-ve' ? `<a class="faro-popup-src" href="${esc(safeUrl(p.source_url))}" target="_blank" rel="noopener noreferrer">Fuente: ${esc(p.source)}</a>` : ''}
      </div>`;
  }

  const MARKER_CAP = 7000; // techo de marcadores acumulados (evita cuelgue en gama baja)

  // Agrega marcadores NUEVOS (deduplicados por id), en BLOQUE. Devuelve cuántos.
  function addPersons(persons: PersonPublic[]): number {
    // Techo con recarga: si acumulamos demasiado explorando, limpiamos y dejamos
    // solo la zona actual (no degradar el dispositivo).
    if (addedIds.size > MARKER_CAP) {
      cluster.clearLayers();
      addedIds.clear();
      people = [];
      count = 0;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newMarkers: any[] = [];
    for (const p of persons) {
      if (p.lat == null || p.lng == null || addedIds.has(p.id)) continue;
      addedIds.add(p.id);
      people.push(p);
      const icon = Lref.divIcon({
        html: pinHtml(p, addedIds.size),
        className: 'faro-pin-wrap',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -14]
      });
      const m = Lref.marker([p.lat, p.lng], { icon, keyboard: true, title: p.full_name || 'Persona' });
      // Popup encuadrado para celular: auto-pan entre los filtros (arriba) y la nav
      // (abajo) para que la info no quede cortada al tocar un punto.
      m.bindPopup(popupHtml(p), {
        maxWidth: 300,
        autoPanPaddingTopLeft: [12, 64],
        autoPanPaddingBottomRight: [12, 84],
        keepInView: true
      });
      newMarkers.push(m);
    }
    if (newMarkers.length) {
      cluster.addLayers(newMarkers); // una sola operación → sin reflow por marcador
      people = people; // dispara reactividad de la sr-list
      count = addedIds.size;
    }
    return newMarkers.length;
  }

  // bbox "minLng,minLat,maxLng,maxLat" de la vista actual, CLAMPEADO a rangos
  // válidos (Leaflet no normaliza la longitud al panear). null si el rango es
  // inválido tras clampear → en ese caso cargamos sin bbox.
  function bboxParam(): string | null {
    const b = map.getBounds();
    const w = Math.max(-180, b.getWest());
    const e = Math.min(180, b.getEast());
    const s = Math.max(-90, b.getSouth());
    const n = Math.min(90, b.getNorth());
    if (e <= w || n <= s) return null;
    return [w, s, e, n].map((v) => v.toFixed(5)).join(',');
  }

  async function loadData(useBbox: boolean): Promise<void> {
    try {
      const bbox = useBbox ? bboxParam() : null;
      const sep = endpoint.includes('?') ? '&' : '?';
      const url = bbox
        ? `${endpoint}${sep}bbox=${bbox}&limit=2000`
        : `${endpoint}${sep}limit=2000`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { persons: PersonPublic[] };
      // PostgREST topa en 1000: si llegó al tope, hay MÁS personas en esta zona.
      truncated = useBbox && data.persons.length >= 1000;
      addPersons(data.persons);
      errorMsg = '';
    } catch (e) {
      if (interactive) errorMsg = 'No se pudo encender el mapa. Revisa tu conexión.';
      console.error('[Map] loadData', e);
    } finally {
      loading = false;
    }
  }

  function scheduleLoad(): void {
    if (loadTimer) clearTimeout(loadTimer);
    loadTimer = setTimeout(() => loadData(true), 400);
  }

  // ── Modo agregado: burbujas por zona con conteo REAL (zoom bajo) ──────────────
  function bubbleSize(n: number): number {
    return n < 10 ? 38 : n < 100 ? 50 : n < 1000 ? 62 : 74;
  }

  function renderAgg(clusters: { lat: number; lng: number; n: number }[]): void {
    if (!aggLayer) return;
    aggLayer.clearLayers();
    let sum = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markers: any[] = [];
    for (const c of clusters) {
      if (c.lat == null || c.lng == null || !c.n) continue;
      sum += c.n;
      const size = bubbleSize(c.n);
      const icon = Lref.divIcon({
        html: `<span class="faro-aggbubble" style="--s:${size}px"><b>${c.n.toLocaleString('es-VE')}</b></span>`,
        className: 'faro-aggwrap',
        iconSize: [size, size]
      });
      const m = Lref.marker([c.lat, c.lng], {
        icon,
        keyboard: true,
        title: `${c.n.toLocaleString('es-VE')} reportados en esta zona`
      });
      // Tocar una burbuja acerca → la zona se separa en burbujas más finas.
      m.on('click', () => map.flyTo([c.lat, c.lng], Math.min(map.getZoom() + 3, ZOOM_POINTS + 1)));
      markers.push(m);
    }
    for (const m of markers) aggLayer.addLayer(m);
    aggCount = sum;
  }

  async function loadAgg(): Promise<void> {
    const epoch = ++aggEpoch;
    try {
      const bbox = bboxParam();
      if (!bbox) {
        loading = false;
        return;
      }
      const z = Math.round(map.getZoom());
      const base = endpoint.replace('/api/persons', '/api/persons/clusters');
      const sep = base.includes('?') ? '&' : '?';
      const res = await fetch(`${base}${sep}bbox=${bbox}&zoom=${z}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { clusters: { lat: number; lng: number; n: number }[] };
      // Si mientras llegaba la respuesta cambió el modo/zona, descártala.
      if (epoch !== aggEpoch) return;
      renderAgg(data.clusters ?? []);
      errorMsg = '';
    } catch (e) {
      if (interactive) errorMsg = 'No se pudo encender el mapa. Revisa tu conexión.';
      console.error('[Map] loadAgg', e);
    } finally {
      loading = false;
    }
  }

  // Dispatcher por zoom (solo /mapa interactivo): burbujas agregadas vs pines.
  function refresh(): void {
    const z = map.getZoom();
    if (z >= ZOOM_POINTS) {
      aggEpoch++; // invalida cualquier loadAgg en vuelo (no pintar burbujas stale)
      if (viewMode !== 'points') {
        viewMode = 'points';
        if (aggLayer) aggLayer.clearLayers();
        aggCount = 0;
      }
      loadData(true);
    } else {
      if (viewMode !== 'agg') {
        viewMode = 'agg';
        cluster.clearLayers();
        addedIds.clear();
        people = [];
        count = 0;
        truncated = false;
      }
      loadAgg();
    }
  }

  function scheduleRefresh(): void {
    if (loadTimer) clearTimeout(loadTimer);
    loadTimer = setTimeout(refresh, 400);
  }

  // Total EXACTO de reportados (con los filtros activos). Informativo: si falla,
  // no rompe el mapa.
  async function loadTotal(): Promise<void> {
    try {
      const sep = endpoint.includes('?') ? '&' : '?';
      const res = await fetch(`${endpoint}${sep}count=exact`);
      if (!res.ok) return;
      const data = (await res.json()) as { total?: number };
      total = data.total ?? 0;
    } catch {
      /* total informativo */
    }
  }

  // Persistencia de la VISTA (centro+zoom) para que al volver de ver una persona
  // el usuario siga en LA MISMA ZONA donde estaba buscando (no reinicia a Caracas).
  const VIEW_KEY = 'faro:map:view';
  function saveView(): void {
    if (!interactive || !map) return;
    try {
      const c = map.getCenter();
      sessionStorage.setItem(
        VIEW_KEY,
        JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() })
      );
    } catch {
      /* modo privado: sin persistencia, no es crítico */
    }
  }
  function loadSavedView(): { lat: number; lng: number; zoom: number } | null {
    try {
      const raw = sessionStorage.getItem(VIEW_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (
        typeof v?.lat === 'number' &&
        typeof v?.lng === 'number' &&
        typeof v?.zoom === 'number' &&
        Number.isFinite(v.lat) &&
        Number.isFinite(v.lng)
      ) {
        return v;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  // Luces de esperanza (home / papel tapiz): puntos de color que RESPIRAN sobre
  // las ciudades de Venezuela. Son AMBIENTE — no datos clicables (la data real e
  // interactiva vive en /mapa). Refuerzan la metáfora "cada persona, un punto de luz".
  const AMBIENT_LIGHTS: { lat: number; lng: number; cat: string }[] = [
    { lat: 10.49, lng: -66.88, cat: 'missing' }, // Caracas
    { lat: 10.62, lng: -66.93, cat: 'minor' }, // La Guaira
    { lat: 10.64, lng: -71.61, cat: 'medical' }, // Maracaibo
    { lat: 10.16, lng: -67.99, cat: 'sighting' }, // Valencia
    { lat: 10.25, lng: -67.6, cat: 'safe' }, // Maracay
    { lat: 10.07, lng: -69.32, cat: 'missing' }, // Barquisimeto
    { lat: 8.62, lng: -70.24, cat: 'minor' }, // Barinas
    { lat: 8.6, lng: -71.14, cat: 'sighting' }, // Mérida
    { lat: 7.77, lng: -72.22, cat: 'medical' }, // San Cristóbal
    { lat: 8.35, lng: -62.64, cat: 'missing' }, // Ciudad Guayana
    { lat: 9.75, lng: -63.18, cat: 'safe' }, // Maturín
    { lat: 10.13, lng: -64.68, cat: 'sighting' }, // Barcelona
    { lat: 10.45, lng: -64.18, cat: 'minor' }, // Cumaná
    { lat: 11.41, lng: -69.68, cat: 'medical' } // Coro
  ];

  function addAmbientLights(): void {
    AMBIENT_LIGHTS.forEach((p) => {
      const cat = p.cat as keyof typeof COLOR;
      // Parpadeo aleatorio tipo señal de auxilio (igual que los puntos reales).
      const dly = (Math.random() * 5).toFixed(2);
      const dur = (2.2 + Math.random() * 3.6).toFixed(2);
      const html = `
        <span class="faro-pin faro-ambient faro-sos faro-cat-${cat}" style="--pin:${COLOR[cat]};--ring:${COLOR_ON[cat]};animation-delay:${dly}s;animation-duration:${dur}s" role="img" aria-hidden="true">
          <i class="faro-glow"></i>
          <i class="faro-core"></i>
        </span>`;
      const icon = Lref.divIcon({
        html,
        className: 'faro-pin-wrap',
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });
      Lref.marker([p.lat, p.lng], { icon, interactive: false, keyboard: false }).addTo(map);
    });
  }

  // Home: puntos de color REALES (muestra), pequeños, SIN clustering → se
  // concentran solos donde de verdad están las emergencias (Caracas/La Guaira y
  // las demás zonas). Así desde el inicio se ve el panorama real. Si la carga
  // falla, caen las luces de ciudades de respaldo (addAmbientLights).
  async function addHomeRealPoints(): Promise<void> {
    try {
      const sep = endpoint.includes('?') ? '&' : '?';
      const res = await fetch(`${endpoint}${sep}limit=300`);
      if (!res.ok) throw new Error('http');
      const data = (await res.json()) as { persons: PersonPublic[] };
      const pts = (data.persons ?? []).filter((p) => p.lat != null && p.lng != null);
      if (!pts.length) {
        addAmbientLights();
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markers: any[] = [];
      pts.forEach((p) => {
        const cat = categoryForPerson(p);
        // Parpadeo tipo SEÑAL DE AUXILIO: cada punto con su PROPIO desfase y
        // duración aleatorios → unos se encienden mientras otros bajan, nunca a la
        // vez (founder). Math.random aquí es runtime de navegador (ok).
        const dly = (Math.random() * 5).toFixed(2);
        const dur = (2.2 + Math.random() * 3.6).toFixed(2);
        const html = `
          <span class="faro-pin faro-home faro-sos faro-cat-${cat}" style="--pin:${COLOR[cat]};--ring:${COLOR_ON[cat]};animation-delay:${dly}s;animation-duration:${dur}s" aria-hidden="true">
            <i class="faro-glow"></i>
            <i class="faro-core"></i>
          </span>`;
        const icon = Lref.divIcon({
          html,
          className: 'faro-pin-wrap',
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });
        markers.push(
          Lref.marker([p.lat as number, p.lng as number], {
            icon,
            interactive: false,
            keyboard: false
          })
        );
      });
      Lref.layerGroup(markers).addTo(map);
    } catch {
      addAmbientLights();
    }
  }

  onMount(async () => {
    const L = (await import('leaflet')).default;
    await import('leaflet.markercluster');

    // ¿Búsqueda por nombre? (define la vista con fitBounds → no restaura zona).
    const hasQuery = /[?&]q=/.test(endpoint);
    // En navegación interactiva, restaura la última zona vista (volver de una ficha).
    const saved = interactive && !hasQuery ? loadSavedView() : null;

    map = L.map(mapEl, {
      zoomControl: false,
      attributionControl: true,
      // Modo "papel tapiz": sin gestos (la home no debe robar el scroll ni
      // dejar arrastrar; el mapa interactivo completo está en /mapa).
      dragging: interactive,
      scrollWheelZoom: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      // Acota a Venezuela (+ margen) → no se puede panear a "copias del mundo"
      // donde el bbox quedaría fuera de rango y la vista saldría sin luces.
      maxBounds: [
        [-1, -75],
        [16, -58]
      ],
      maxBoundsViscosity: 1.0,
      minZoom: 5
    }).setView(saved ? [saved.lat, saved.lng] : center, saved ? saved.zoom : zoom);
    // Zoom abajo-derecha (alcance del pulgar en mobile, no choca con los filtros).
    if (interactive) L.control.zoom({ position: 'bottomright' }).addTo(map);
    // Guarda la zona al moverse → al volver de una ficha se restaura (seguir buscando).
    if (interactive) map.on('moveend', saveView);

    // Tile "Faro Dawn": CARTO Voyager (gratis, sin key) — tiene color real (agua,
    // parques, vías) para que el mapa tenga vida; un filtro suave lo equilibra.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
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
      // Radio menor → los grupos se separan en pines de color un poco antes al
      // acercar (el founder quiere ver los colores más fácil), sin saturar.
      maxClusterRadius: 38,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      chunkedLoading: true, // agrega lotes grandes sin congelar el hilo (jank)
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
    // Capa de burbujas agregadas (conteo real por zona) — solo en /mapa interactivo
    // (el home usa pines/luces, nunca agrega).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (interactive) aggLayer = (L as any).layerGroup().addTo(map);

    // Pausa la respiración mientras se mueve/zoomea (no compite con el scroll 30fps).
    map.on('movestart zoomstart', () => mapEl.classList.add('faro-still'));
    map.on('moveend zoomend', () => mapEl.classList.remove('faro-still'));

    Lref = L;
    loadTotal(); // el "número grande" del total reportado (independiente del viewport)

    if (hasQuery) {
      // Búsqueda por nombre: carga TODAS las coincidencias (sin bbox) y encuadra
      // el mapa a ellas, aunque estén fuera de la vista inicial.
      await loadData(false);
      if (count > 0 && interactive) {
        try {
          map.fitBounds(cluster.getBounds(), { padding: [40, 40], maxZoom: 14 });
        } catch {
          /* sin bounds válidos: dejamos la vista por defecto */
        }
      }
    } else if (interactive) {
      // /mapa interactivo: a zoom bajo, burbujas por zona con CONTEO REAL; al
      // acercar se refinan y, pasado ZOOM_POINTS, se ven pines individuales.
      map.on('moveend zoomend', scheduleRefresh);
      refresh();
    } else {
      // Home: panorama REAL — muestra de puntos de color concentrados donde están
      // las emergencias (la data interactiva completa vive en /mapa). loadTotal()
      // ya trajo el total. Fallback interno a luces de ciudades si falla la carga.
      await addHomeRealPoints();
    }

    // Habilita la sincronización reactiva de la capa de ayuda (showAid).
    mounted = true;
  });

  onDestroy(() => {
    if (loadTimer) clearTimeout(loadTimer);
    if (aidLayer) aidLayer.detach();
    if (map) map.remove();
  });
</script>

<div class="relative h-full w-full bg-[#0a3a4f]">
  <div
    bind:this={mapEl}
    class="h-full w-full"
    class:faro-dusk={dusk}
    aria-label="Mapa de personas reportadas"
  ></div>

  {#if loading}
    <div class="faro-loading absolute inset-0 flex items-center justify-center" aria-live="polite">
      <span class="relative z-10 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur">
        Encendiendo el mapa…
      </span>
    </div>
  {/if}

  {#if errorMsg && interactive}
    <div
      class="absolute left-1/2 top-4 z-[400] -translate-x-1/2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white shadow"
      role="alert"
    >
      {errorMsg}
    </div>
  {/if}

  {#if total > 0 && !errorMsg && interactive}
    <div class="absolute bottom-2 left-2 z-[400] flex flex-col items-start gap-1">
      <!-- El "número grande": TOTAL exacto de reportados (no topado por el 1000). -->
      <div class="rounded-xl bg-faro-900/92 px-3.5 py-2 text-white shadow-lg backdrop-blur-sm">
        <div class="text-2xl font-bold leading-none tabular-nums">
          {total.toLocaleString('es-VE')}
        </div>
        <div class="text-[10px] font-medium text-white/85">
          personas reportadas{interactive && (viewMode === 'agg' ? aggCount : count)
            ? ` · ${(viewMode === 'agg' ? aggCount : count).toLocaleString('es-VE')} en vista`
            : ''}
        </div>
      </div>
      {#if (truncated || aidTruncated) && interactive}
        <span
          class="rounded-full bg-amber-500/95 px-3 py-1 text-[11px] font-medium text-white shadow"
          role="status"
        >
          Acércate para ver más en esta zona
        </span>
      {/if}
    </div>
  {/if}

  <!-- Ruta accesible no-mapa: teclado y lector de pantalla llegan a cada ficha
       sin depender de los clusters de Leaflet. Visualmente oculta. -->
  {#if people.length && interactive}
    <nav class="sr-only" aria-label="Lista de personas reportadas en el mapa">
      <h2>
        Personas en el mapa: mostrando {Math.min(people.length, 1000)}{people.length > 1000
          ? ` de ${people.length}`
          : ''}
      </h2>
      <ul>
        <!-- Cap a 1000 nodos: con decenas de miles, renderizar todos satura el DOM.
             La búsqueda por nombre llega a cualquier persona específica. -->
        {#each people.slice(0, 1000) as p (p.id)}
          <li>
            <a href="/persona/{p.id}">
              {LABEL_ES[categoryForPerson(p)]}: {p.full_name || 'Sin nombre'}{p.age != null
                ? `, ${p.age} años`
                : ''} — {p.home_neighborhood || p.home_city || 'zona desconocida'}
            </a>
          </li>
        {/each}
      </ul>
    </nav>
  {/if}

  <!-- Ruta accesible para los puntos de ayuda (mismo motivo que la de personas:
       los markers de Leaflet no son tabbables). Cada uno enlaza a su ficha. -->
  {#if aidPoints.length && interactive}
    <nav class="sr-only" aria-label="Lista de puntos de ayuda en el mapa">
      <h2>Puntos de ayuda en el mapa: {Math.min(aidPoints.length, 1000)}</h2>
      <ul>
        {#each aidPoints.slice(0, 1000) as a (a.id)}
          <li>
            <a href="/punto/{a.id}">
              {AID_META[a.type as AidType]?.label ?? 'Punto de ayuda'}: {a.name} — {a.verified
                ? 'verificado'
                : 'sin verificar'} — {a.address_text}
            </a>
          </li>
        {/each}
      </ul>
    </nav>
  {/if}
</div>

<style>
  /* ── Tile "Faro Dawn": color vivo pero equilibrado; las luces siguen brillando ── */
  :global(.faro-tiles) {
    filter: saturate(1.08) brightness(0.97) contrast(1.04);
  }
  /* Dusk (home): atardecer — calles/caminos siguen visibles, el mar azul se
     distingue de la tierra, sin quedar muy oscuro. */
  :global(.faro-dusk .faro-tiles) {
    filter: brightness(0.5) saturate(1.45) contrast(1.08) hue-rotate(-6deg);
  }
  /* Velo azul-atardecer un poco más presente sobre el mapa dusk. */
  :global(.faro-dusk + .faro-veil),
  :global(.faro-dusk .faro-veil) {
    background: radial-gradient(
      130% 100% at 50% 8%,
      rgba(12, 40, 56, 0) 45%,
      rgba(9, 28, 40, 0.35) 100%
    );
  }
  :global(.faro-veil) {
    position: absolute;
    inset: 0;
    z-index: 250;
    pointer-events: none;
    background: radial-gradient(120% 90% at 50% 0%, rgba(11, 79, 108, 0) 55%, rgba(11, 79, 108, 0.08) 100%);
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
    /* Halo más denso → el color del punto se distingue mejor sobre el mapa. */
    background: radial-gradient(
      circle,
      color-mix(in srgb, var(--pin) 82%, transparent) 0%,
      color-mix(in srgb, var(--pin) 46%, transparent) 42%,
      color-mix(in srgb, var(--pin) 0%, transparent) 75%
    );
    filter: blur(0.5px);
  }
  :global(.faro-pin .faro-core) {
    position: relative;
    /* Núcleo un poco mayor (13→15px): más visible sin alarmar. */
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: var(--pin);
    border: 2px solid #ffffff;
    box-shadow:
      0 0 0 1.5px color-mix(in srgb, var(--pin) 60%, transparent),
      0 1px 3px rgba(0, 0, 0, 0.35);
  }
  /* Luces de esperanza del home: más grandes y con halo más fuerte para resaltar
     sobre el mapa claro de fondo. */
  :global(.faro-ambient) {
    width: 38px;
    height: 38px;
  }
  :global(.faro-ambient .faro-glow) {
    width: 38px;
    height: 38px;
    background: radial-gradient(
      circle,
      color-mix(in srgb, var(--pin) 92%, transparent) 0%,
      color-mix(in srgb, var(--pin) 52%, transparent) 42%,
      color-mix(in srgb, var(--pin) 0%, transparent) 76%
    );
  }
  :global(.faro-ambient .faro-core) {
    width: 16px;
    height: 16px;
  }

  /* Home: puntos REALES pequeños (muestra concentrada). Núcleo pequeño + halo tenue
     → muchos juntos se leen como una concentración encendida en la zona real. */
  :global(.faro-home) {
    width: 18px;
    height: 18px;
  }
  :global(.faro-home .faro-glow) {
    width: 18px;
    height: 18px;
  }
  :global(.faro-home .faro-core) {
    width: 8px;
    height: 8px;
    border-width: 1.5px;
  }
  /* Señal de AUXILIO: cada punto del home parpadea con su propio ritmo (delay y
     duration inline aleatorios por punto) → unos se encienden mientras otros bajan,
     nunca todos a la vez. Evoca múltiples pedidos de auxilio. No es estrobo (2-6s). */
  :global(.faro-sos) {
    animation-name: faro-sos-blink;
    animation-iteration-count: infinite;
    animation-timing-function: ease-in-out;
    will-change: opacity;
  }
  @keyframes faro-sos-blink {
    0%,
    100% {
      opacity: 0.2;
    }
    14% {
      opacity: 1;
    }
    30% {
      opacity: 0.45;
    }
    48% {
      opacity: 0.9;
    }
    68% {
      opacity: 0.26;
    }
  }
  /* Respeta "reducir movimiento": las luces quedan quietas y encendidas. */
  @media (prefers-reduced-motion: reduce) {
    :global(.faro-home .faro-glow),
    :global(.faro-ambient .faro-glow),
    :global(.faro-sos) {
      animation: none !important;
      opacity: 1 !important;
    }
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
  /* Cuerpo NN: núcleo ligeramente mayor que el estándar (15px) — presencia digna. */
  :global(.faro-cat-deceased .faro-core) {
    width: 16px;
    height: 16px;
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

  /* ── Burbuja agregada por zona (conteo REAL, zoom bajo) ── */
  :global(.faro-aggwrap) {
    background: transparent;
    border: none;
  }
  :global(.faro-aggbubble) {
    display: grid;
    place-items: center;
    width: var(--s);
    height: var(--s);
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(11, 79, 108, 0.95) 0%,
      rgba(11, 79, 108, 0.82) 60%,
      rgba(11, 79, 108, 0.35) 100%
    );
    box-shadow:
      0 0 14px 3px rgba(11, 79, 108, 0.45),
      0 2px 6px rgba(0, 0, 0, 0.28);
    border: 2px solid rgba(255, 255, 255, 0.9);
    cursor: pointer;
    transition: transform 0.15s ease;
  }
  :global(.faro-aggbubble:hover) {
    transform: scale(1.06);
  }
  :global(.faro-aggbubble b) {
    color: #fff;
    font-weight: 700;
    font-size: 0.82rem;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
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
  /* Haz del faro: gira lento y SUAVE (luz tenue, transición ancha). */
  .faro-loading::before {
    content: '';
    position: absolute;
    inset: 0;
    background: conic-gradient(
      from 0deg at 50% 38%,
      transparent 0deg,
      rgba(255, 247, 214, 0) 24deg,
      rgba(255, 247, 214, 0.22) 48deg,
      rgba(255, 247, 214, 0) 72deg,
      transparent 360deg
    );
    animation: faro-sweep 12s linear infinite;
    will-change: transform;
  }
  @keyframes faro-sweep {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .faro-loading::before {
      animation: none;
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
    display: inline-flex;
    align-items: center;
    min-height: 44px; /* tap target a11y ≥44px */
    margin-top: 0.4rem;
    padding: 10px 16px;
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

  /* ── Control de zoom apto para celular: botones 44px (tap target) y elevado
        sobre la barra de navegación inferior para que el pulgar llegue bien. ── */
  :global(.leaflet-control-zoom) {
    margin-bottom: 5rem !important;
    margin-right: 0.7rem !important;
    border: none !important;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.22) !important;
    border-radius: 12px !important;
    overflow: hidden;
  }
  :global(.leaflet-control-zoom a) {
    width: 44px !important;
    height: 44px !important;
    line-height: 44px !important;
    font-size: 1.45rem !important;
    color: #0b4f6c !important;
  }

  /* Popup legible en celular (no demasiado angosto). */
  :global(.faro-popup) {
    min-width: 12rem;
  }
  :global(.leaflet-popup-content) {
    margin: 0.7rem 0.85rem !important;
  }
</style>
