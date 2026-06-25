import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { personFiltersSchema } from '$schemas/person';

/**
 * GET /api/persons — datos públicos para el mapa.
 *
 * Lee SIEMPRE de la vista persons_public (coords ofuscadas, sin PII, solo
 * approved + no-withdrawn). Soporta filtros: status, is_minor, medical_urgent,
 * sector (barrio), bbox (viewport) y limit.
 *
 * POST se implementa aparte (reporte con Zod + EXIF strip + encripta PII).
 */
export const GET: RequestHandler = async ({ url, locals, setHeaders }) => {
  const parsed = personFiltersSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    throw error(400, { message: 'Filtros inválidos: ' + parsed.error.issues.map((i) => i.message).join(', ') });
  }
  const f = parsed.data;

  // persons_public ya filtra approved + non-withdrawn y enmascara columnas.
  // Lectura pública vía cliente anon (la vista es el portal seguro).
  let q = locals.supabase
    .from('persons_public')
    .select(
      'id, pfif_id, source, source_url, given_name, family_name, full_name, sex, age, ' +
        'home_neighborhood, home_city, last_known_location_text, lat, lng, description, ' +
        'clothing_top, clothing_bottom, distinguishing_marks, photo_url, status, is_minor, ' +
        'unaccompanied_minor, medical_urgent, medical_category, share_exact_location_with_searchers, ' +
        'lat_exact_optional, lng_exact_optional, created_at, last_seen_at'
    )
    .not('lat', 'is', null)
    .limit(f.limit);

  if (f.status) q = q.eq('status', f.status);
  if (f.is_minor !== undefined) q = q.eq('is_minor', f.is_minor);
  if (f.medical_urgent !== undefined) q = q.eq('medical_urgent', f.medical_urgent);
  if (f.sector) {
    // Escapa comodines LIKE (% _ \) para que el input no altere el patrón.
    const safe = f.sector.replace(/[\\%_]/g, '\\$&');
    q = q.ilike('home_neighborhood', `%${safe}%`);
  }

  if (f.bbox) {
    const [minLng, minLat, maxLng, maxLat] = f.bbox.split(',').map(Number);
    q = q.gte('lat', minLat).lte('lat', maxLat).gte('lng', minLng).lte('lng', maxLng);
  }

  const { data, error: dbError } = await q;
  if (dbError) {
    console.error('[GET /api/persons]', dbError.message);
    throw error(502, { message: 'No se pudo cargar el mapa. Intenta de nuevo.' });
  }

  // Cache corto en el edge: el mapa tolera ~30s de desfase; baja carga DB.
  setHeaders({ 'cache-control': 'public, max-age=15, s-maxage=30' });

  return json({ ok: true, count: data?.length ?? 0, persons: data ?? [] });
};
