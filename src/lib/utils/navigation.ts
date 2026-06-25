/**
 * Faro VE — utilidad de navegación externa.
 *
 * Regla diferenciada (CLAUDE.md inmutable #26-28):
 *  - Lugares de servicio (aid_points, refugios, hospitales, morgues): coords
 *    EXACTAS + selector multi-app habilitado.
 *  - Personas / NN / avistamientos: coords ofuscadas, SIN selector.
 *  - Auto-reporte "a salvo": opt-in toggle del sujeto.
 *
 * Cualquier botón "Llegar aquí" en la UI DEBE pasar por estas funciones —
 * no construir URLs de maps a mano.
 */

export type MapApp = 'apple' | 'google' | 'waze' | 'osmand';
export type Platform = 'ios' | 'android' | 'desktop';

const LS_KEY_PREFERRED = 'preferred_map_app';

/** Detecta plataforma por UA. SSR-safe (default 'desktop'). */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

/** Heurística de apps probables instaladas. No es certero (web limita esto). */
export function getInstalledMapApps(platform: Platform = detectPlatform()): MapApp[] {
  switch (platform) {
    case 'ios':
      // Apple Maps siempre. Google Maps y Waze opcionales (no detectable real).
      return ['apple', 'google', 'waze'];
    case 'android':
      // Google Maps casi siempre. Waze común. OsmAnd nicho offline.
      return ['google', 'waze', 'osmand'];
    case 'desktop':
    default:
      return ['google'];
  }
}

/**
 * Construye URL/scheme de navegación para una app.
 * label se URL-encodea para el nombre del destino.
 */
export function buildMapsUrl(
  provider: MapApp,
  lat: number,
  lng: number,
  label?: string
): string {
  const safeLat = Number(lat).toFixed(6);
  const safeLng = Number(lng).toFixed(6);
  const labelEnc = label ? encodeURIComponent(label) : '';

  switch (provider) {
    case 'apple':
      // maps:// abre Apple Maps en iOS; macOS la abre en Maps app.
      return label
        ? `maps://?daddr=${safeLat},${safeLng}&q=${labelEnc}&dirflg=d`
        : `maps://?daddr=${safeLat},${safeLng}&dirflg=d`;
    case 'google':
      // En iOS abre la app Google Maps si está instalada; si no, abre Apple Maps.
      // En Android/desktop abre Google Maps web/app.
      return `https://www.google.com/maps/dir/?api=1&destination=${safeLat},${safeLng}&travelmode=driving`;
    case 'waze':
      return `https://waze.com/ul?ll=${safeLat},${safeLng}&navigate=yes`;
    case 'osmand':
      // OsmAnd geo: scheme — solo funciona si la app está instalada.
      return `osmand.geo:${safeLat},${safeLng}?z=18`;
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${safeLat},${safeLng}`;
  }
}

/** Recupera/persiste última app elegida (per-device en localStorage). */
export function getPreferredMapApp(): MapApp | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const v = localStorage.getItem(LS_KEY_PREFERRED);
    if (v === 'apple' || v === 'google' || v === 'waze' || v === 'osmand') return v;
  } catch {
    /* ignore privacy mode */
  }
  return null;
}

export function setPreferredMapApp(app: MapApp): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY_PREFERRED, app);
  } catch {
    /* ignore */
  }
}

export function clearPreferredMapApp(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(LS_KEY_PREFERRED);
  } catch {
    /* ignore */
  }
}

/**
 * Abre la app preferida automáticamente.
 * Si no hay preferencia → caller debe mostrar selector (NavigateButton lo hace).
 */
export function openNavigation(
  lat: number,
  lng: number,
  label?: string,
  override?: MapApp
): { opened: boolean; app: MapApp | null } {
  const app = override ?? getPreferredMapApp();
  if (!app) return { opened: false, app: null };
  const url = buildMapsUrl(app, lat, lng, label);
  if (typeof window !== 'undefined') {
    window.location.href = url;
  }
  return { opened: true, app };
}

/**
 * Formato de dirección+landmark para clipboard.
 * Pensado para que el usuario lo pegue en cualquier app de mapas alternativa
 * o se lo mande a alguien por WhatsApp.
 */
export function formatAddressForClipboard(opts: {
  name?: string | null;
  address: string;
  landmark?: string | null;
  entrance_notes?: string | null;
  lat?: number | null;
  lng?: number | null;
}): string {
  const parts: string[] = [];
  if (opts.name) parts.push(opts.name);
  parts.push(opts.address);
  if (opts.landmark) parts.push(`Referencia: ${opts.landmark}`);
  if (opts.entrance_notes) parts.push(`Entrada: ${opts.entrance_notes}`);
  if (opts.lat != null && opts.lng != null) {
    parts.push(`Coords: ${opts.lat.toFixed(6)}, ${opts.lng.toFixed(6)}`);
  }
  return parts.join(' — ');
}

export async function copyAddressToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const MAP_APP_LABEL: Record<MapApp, string> = {
  apple: 'Apple Maps',
  google: 'Google Maps',
  waze: 'Waze',
  osmand: 'OsmAnd (offline)'
};

export const MAP_APP_EMOJI: Record<MapApp, string> = {
  apple: '🗺️',
  google: '🌐',
  waze: '🚗',
  osmand: '📡'
};
