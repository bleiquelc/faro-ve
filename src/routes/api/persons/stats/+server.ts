import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * GET /api/persons/stats — conteos por categoría para el home (burbujas).
 *
 * Agregados PÚBLICOS sobre persons_public (la vista segura): solo números, sin
 * PII ni coords. Cacheado en el edge (cambian lento). Las categorías que no
 * existen hoy (médicas/fallecidos = 0) salen en 0 y el home no las muestra.
 */
export const GET: RequestHandler = async ({ locals, setHeaders }) => {
  const base = () =>
    locals.supabase
      .from('persons_public')
      .select('id', { count: 'exact', head: true })
      .not('lat', 'is', null);

  try {
    const [totalR, missingR, minorsR, medicalR, deceasedR, safeR, safeSelfR, nnR] = await Promise.all([
      base(),
      base().eq('status', 'missing'),
      base().eq('is_minor', true),
      base().eq('medical_urgent', true),
      base().in('status', ['unidentified_body', 'found_deceased_morgue']),
      base().in('status', ['found_alive', 'safe_self_report']),
      // Conteos EXACTOS por status para que coincidan con lo que filtra cada chip
      // del mapa (FilterChips usa ?status=X single). Sin esto, el chip "A salvo"
      // mostraría la unión (found_alive+safe_self_report) pero filtraría solo
      // safe_self_report → conteo ≠ resultado.
      base().eq('status', 'safe_self_report'),
      base().eq('status', 'unidentified_body')
    ]);

    const n = (r: { count: number | null; error: unknown }) => (r.error ? 0 : (r.count ?? 0));

    setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=120' });
    return json({
      ok: true,
      total: n(totalR),
      missing: n(missingR),
      minors: n(minorsR),
      medical: n(medicalR),
      deceased: n(deceasedR),
      safe: n(safeR),
      // Exactos por chip (coinciden con el filtro ?status=X del mapa):
      safeSelf: n(safeSelfR),
      unidentified: n(nnR)
    });
  } catch (e) {
    console.error('[GET /api/persons/stats]', e);
    throw error(502, { message: 'No se pudieron cargar las estadísticas.' });
  }
};
