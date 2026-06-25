import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { PersonPublic } from '$schemas/person';

/**
 * Ficha pública de una persona — lee SIEMPRE de persons_public (coords
 * ofuscadas, sin PII, solo approved + no-withdrawn). La coord EXACTA y el
 * teléfono solo llegan si el sujeto hizo opt-in (safe_self_report); la vista
 * los enmascara en cualquier otro caso.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Columnas públicas. contact_phone_optional se añade cuando la migración 0010
// exista en persons_public; hasta entonces no se selecciona (evita 42703).
const COLUMNS =
  'id, pfif_id, source, source_url, given_name, family_name, full_name, sex, age, ' +
  'home_neighborhood, home_city, last_known_location_text, lat, lng, description, ' +
  'clothing_top, clothing_bottom, distinguishing_marks, photo_url, status, is_minor, ' +
  'unaccompanied_minor, medical_urgent, medical_category, share_exact_location_with_searchers, ' +
  'lat_exact_optional, lng_exact_optional, created_at, last_seen_at';

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
  if (!UUID_RE.test(params.id)) {
    throw error(404, { message: 'Persona no encontrada.' });
  }

  const { data, error: dbError } = await locals.supabase
    .from('persons_public')
    .select(COLUMNS)
    .eq('id', params.id)
    .maybeSingle();

  if (dbError) {
    console.error('[persona/[id]]', dbError.message);
    throw error(502, { message: 'No se pudo cargar la ficha. Intenta de nuevo.' });
  }
  if (!data) {
    throw error(404, { message: 'Persona no encontrada o no disponible públicamente.' });
  }

  setHeaders({ 'cache-control': 'public, max-age=15, s-maxage=30' });

  return { person: data as unknown as PersonPublic };
};
