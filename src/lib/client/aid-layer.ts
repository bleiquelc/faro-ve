/**
 * aid-layer.ts — capa de lugares de servicio para el mapa Leaflet.
 *
 * Autocontenida: gestiona su propio cluster, carga por viewport (bbox) y popups.
 * Map.svelte la adjunta/desadjunta según el prop `showAid` (chip "Ayuda"), sin
 * tocar la lógica endurecida de personas.
 *
 * Privacidad (#26): los aid_points son LUGARES → coords EXACTAS, navegables. El
 * popup es un resumen + enlace a /punto/[id] (allí viven NavigateButton, votos y
 * reactivación, igual que el patrón persona→ficha). Los pines son cian (ayuda) /
 * azul faro (refugio) para diferenciarlos de las luces de personas.
 *
 * La capa es intencionalmente "todos los tipos": la UI ofrece un único toggle
 * on/off (chip Ayuda, aid=1), no un filtro por tipo. El endpoint SÍ soporta
 * ?type para UI/consumidores futuros — propagarlo aquí si algún día se añade un
 * selector de tipo.
 *
 * a11y: emite la lista de puntos cargados vía `onPoints` para que Map.svelte
 * pinte una <nav class="sr-only"> (los markers de Leaflet no son tabbables).
 */

import { COLOR, AID_META, type AidSubtype } from '$utils/colors';
import type { AidPointPublic } from '$schemas/aid-point';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type L = any;

const SHELTER_TYPES = new Set(['shelter_temporary', 'shelter_permanent']);
const MARKER_CAP = 4000; // muy por encima del nº real esperado de puntos

function esc(s: string): string {
  return s.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c] || c
  );
}

function agoLabel(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return 'hace menos de 1 h';
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} día${d > 1 ? 's' : ''}`;
}

function pinHtml(a: AidPointPublic): string {
  const meta = AID_META[a.type as AidSubtype] ?? AID_META.other;
  const color = SHELTER_TYPES.has(a.type) ? COLOR.shelter : COLOR.aid;
  return `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);font-size:15px;line-height:1" role="img" aria-label="${esc(meta.label)}">${meta.emoji}</span>`;
}

function popupHtml(a: AidPointPublic): string {
  const meta = AID_META[a.type as AidSubtype] ?? AID_META.other;
  const badge = a.verified
    ? '<span style="display:inline-block;margin-left:4px;padding:1px 6px;border-radius:999px;background:#dcfce7;color:#166534;font-size:.66rem;font-weight:600">✓ Verificado</span>'
    : '<span style="display:inline-block;margin-left:4px;padding:1px 6px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:.66rem;font-weight:600">Sin verificar</span>';
  const tags = Array.isArray((a.supplies_available as { tags?: string[] } | null)?.tags)
    ? ((a.supplies_available as { tags?: string[] }).tags as string[])
    : [];
  const tagsHtml = tags.length
    ? `<p class="faro-popup-desc">${esc(tags.slice(0, 6).join(' · '))}</p>`
    : '';
  const ago = agoLabel(a.last_updated_at);
  return `
    <div class="faro-popup">
      <div class="faro-popup-badge" style="background:${COLOR.aid};color:#0e3a4a">${meta.emoji} ${esc(meta.label)}</div>${badge}
      <h3>${esc(a.name)}</h3>
      ${tagsHtml}
      <p class="faro-popup-loc">📍 ${esc(a.address_text)}${ago ? `<br/><small>Actualizado ${ago}</small>` : ''}</p>
      <a class="faro-popup-btn" href="/punto/${encodeURIComponent(a.id)}">Ver y cómo llegar</a>
    </div>`;
}

export interface AidLayer {
  attach: () => void;
  detach: () => void;
}

export function createAidLayer(
  L: L,
  map: L,
  opts: {
    endpoint?: string;
    onPoints?: (pts: AidPointPublic[]) => void;
    onTruncated?: (t: boolean) => void;
  } = {}
): AidLayer {
  const endpoint = opts.endpoint ?? '/api/aid-points';
  const onPoints = opts.onPoints;
  const onTruncated = opts.onTruncated;
  const cluster = L.markerClusterGroup({
    maxClusterRadius: 44,
    showCoverageOnHover: false,
    chunkedLoading: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    iconCreateFunction: (c: any) => {
      const n = c.getChildCount();
      const size = n < 10 ? 36 : n < 50 ? 44 : 52;
      return L.divIcon({
        html: `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle,rgba(6,182,212,.95),rgba(6,182,212,.7));border:2px solid #fff;color:#0e3a4a;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.25)"><b>${n}</b></span>`,
        className: 'aid-cluster-wrap',
        iconSize: [size, size]
      });
    }
  });

  const addedIds = new Set<string>();
  const accum: AidPointPublic[] = []; // acumulado para la lista accesible
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attached = false;

  function bboxParam(): string | null {
    const b = map.getBounds();
    const w = Math.max(-180, b.getWest());
    const e = Math.min(180, b.getEast());
    const s = Math.max(-90, b.getSouth());
    const n = Math.min(90, b.getNorth());
    if (e <= w || n <= s) return null;
    return [w, s, e, n].map((v) => v.toFixed(5)).join(',');
  }

  function addPoints(points: AidPointPublic[]): void {
    if (addedIds.size > MARKER_CAP) {
      cluster.clearLayers();
      addedIds.clear();
      accum.length = 0;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markers: any[] = [];
    for (const a of points) {
      if (a.lat == null || a.lng == null || addedIds.has(a.id)) continue;
      addedIds.add(a.id);
      accum.push(a);
      const icon = L.divIcon({
        html: pinHtml(a),
        className: 'aid-pin-wrap',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -14]
      });
      const m = L.marker([a.lat, a.lng], { icon, keyboard: true, title: a.name });
      m.bindPopup(popupHtml(a), {
        maxWidth: 300,
        autoPanPaddingTopLeft: [12, 64],
        autoPanPaddingBottomRight: [12, 84],
        keepInView: true
      });
      markers.push(m);
    }
    if (markers.length) {
      cluster.addLayers(markers);
      onPoints?.(accum.slice());
    }
  }

  async function load(): Promise<void> {
    try {
      const bbox = bboxParam();
      const sep = endpoint.includes('?') ? '&' : '?';
      const url = bbox ? `${endpoint}${sep}bbox=${bbox}&limit=2000` : `${endpoint}${sep}limit=2000`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = (await res.json()) as { aid_points?: AidPointPublic[] };
      const points = data.aid_points ?? [];
      addPoints(points);
      // PostgREST topa en 1000: comparar contra el tope EFECTIVO (1000), no el
      // limit pedido (2000), igual que el mapa de personas. Honestidad de conteo.
      onTruncated?.(!!bbox && points.length >= 1000);
    } catch {
      /* la capa de ayuda es complementaria: si falla, no rompe el mapa */
    }
  }

  function schedule(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(load, 400);
  }

  return {
    attach() {
      if (attached) return;
      attached = true;
      map.addLayer(cluster);
      map.on('moveend zoomend', schedule);
      load();
    },
    detach() {
      if (!attached) return;
      attached = false;
      if (timer) clearTimeout(timer);
      map.off('moveend zoomend', schedule);
      map.removeLayer(cluster);
      cluster.clearLayers();
      addedIds.clear();
      accum.length = 0;
      onPoints?.([]);
      onTruncated?.(false);
    }
  };
}
