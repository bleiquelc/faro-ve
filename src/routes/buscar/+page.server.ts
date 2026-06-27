import type { PageServerLoad } from './$types';
import type { PersonPublic } from '$schemas/person';

/**
 * Búsqueda por NOMBRE — encuentra a TODOS, incluidos los reportes SIN ubicación
 * geocodificable (que en el mapa no tienen pin). Reusa el endpoint endurecido
 * /api/persons?q= (que, con `q`, no filtra por coords) → cero lógica duplicada.
 * SSR: el resultado es compartible/recargable y funciona sin JS.
 */
export const load: PageServerLoad = async ({ url, fetch, setHeaders }) => {
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
  if (!q) return { q: '', results: [] as PersonPublic[], total: 0 };

  const LIMIT = 100;
  let results: PersonPublic[] = [];
  let total = 0;
  try {
    // Lista (cap 100) + conteo EXACTO (incluye sin-localización con q) en paralelo
    // → si hay más de 100 coincidencias avisamos para afinar (nadie queda oculto
    // sin explicación).
    const [listRes, countRes] = await Promise.all([
      fetch(`/api/persons?q=${encodeURIComponent(q)}&limit=${LIMIT}`),
      fetch(`/api/persons?q=${encodeURIComponent(q)}&count=exact`)
    ]);
    if (listRes.ok) {
      const data = (await listRes.json()) as { persons?: PersonPublic[] };
      results = data.persons ?? [];
    }
    if (countRes.ok) {
      const data = (await countRes.json()) as { total?: number };
      total = data.total ?? results.length;
    }
  } catch {
    /* sin resultados: la página muestra el estado vacío */
  }

  setHeaders({ 'cache-control': 'private, max-age=15' });
  return { q, results, total: Math.max(total, results.length) };
};
