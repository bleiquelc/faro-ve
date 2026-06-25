import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clusterFiltersSchema } from '$schemas/person';

/**
 * GET /api/persons/clusters — agregación espacial para el mapa.
 *
 * Devuelve burbujas por ZONA con conteos REALES (cuenta TODOS los aprobados por
 * celda de grilla, no la muestra topada a 1000). El tamaño de celda sale del zoom
 * → al acercar, las zonas se separan en burbujas más finas. A zoom alto el cliente
 * cambia a pines individuales. Privacidad: la RPC solo devuelve centroides
 * agregados (de coords ya ofuscadas) + conteos, nunca datos individuales (#1).
 */

// Tamaño de celda (grados) por zoom. Halving por nivel: cerca → celdas finas.
function cellForZoom(zoom: number): number {
  const c = 0.3 / Math.pow(2, zoom - 6);
  return Math.min(4, Math.max(0.0008, c));
}

export const GET: RequestHandler = async ({ url, locals, setHeaders }) => {
  const parsed = clusterFiltersSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    throw error(400, {
      message: 'Parámetros inválidos: ' + parsed.error.issues.map((i) => i.message).join(', ')
    });
  }
  const f = parsed.data;

  const [minLng, minLat, maxLng, maxLat] = f.bbox.split(',').map(Number);
  // Ignora bbox inválido/invertido o fuera de rango (defensa: el cliente clampa).
  const valid =
    [minLng, minLat, maxLng, maxLat].every(Number.isFinite) &&
    minLat < maxLat &&
    minLng < maxLng &&
    minLat >= -90 &&
    maxLat <= 90 &&
    minLng >= -180 &&
    maxLng <= 180;
  if (!valid) {
    return json({ ok: true, clusters: [] });
  }

  const { data, error: dbError } = await locals.supabase.rpc('persons_clusters', {
    p_min_lng: minLng,
    p_min_lat: minLat,
    p_max_lng: maxLng,
    p_max_lat: maxLat,
    p_cell: cellForZoom(f.zoom),
    p_status: f.status ?? null,
    p_is_minor: f.is_minor ?? null,
    p_medical: f.medical_urgent ?? null
  });

  if (dbError) {
    console.error('[GET /api/persons/clusters]', dbError.message);
    throw error(502, { message: 'No se pudo agrupar el mapa. Intenta de nuevo.' });
  }

  setHeaders({ 'cache-control': 'public, max-age=20, s-maxage=40' });
  return json({ ok: true, clusters: data ?? [] });
};
