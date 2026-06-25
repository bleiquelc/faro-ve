import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { personFiltersSchema, reportPersonSchema } from '$schemas/person';

/**
 * GET /api/persons — datos públicos para el mapa.
 *
 * Lee SIEMPRE de la vista persons_public (coords ofuscadas, sin PII, solo
 * approved + no-withdrawn). Soporta filtros: status, is_minor, medical_urgent,
 * sector (barrio), bbox (viewport) y limit.
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
    // Orden estable → cuando PostgREST trunca a 1000, el subconjunto es
    // determinista entre requests (acumulación por viewport consistente).
    .order('created_at', { ascending: false })
    .limit(f.limit);

  if (f.status) q = q.eq('status', f.status);
  if (f.is_minor !== undefined) q = q.eq('is_minor', f.is_minor);
  if (f.medical_urgent !== undefined) q = q.eq('medical_urgent', f.medical_urgent);
  if (f.sector) {
    // Escapa comodines LIKE (% _ \) para que el input no altere el patrón.
    const safe = f.sector.replace(/[\\%_]/g, '\\$&');
    q = q.ilike('home_neighborhood', `%${safe}%`);
  }
  if (f.q) {
    // Búsqueda por nombre — escapa comodines LIKE.
    const safe = f.q.replace(/[\\%_]/g, '\\$&');
    q = q.ilike('full_name', `%${safe}%`);
  }

  if (f.bbox) {
    const [minLng, minLat, maxLng, maxLat] = f.bbox.split(',').map(Number);
    // Ignora bbox inválido/invertido o fuera de rango terrestre (defensa: el
    // cliente ya clampa, pero no confiamos en el input).
    const valid =
      [minLng, minLat, maxLng, maxLat].every(Number.isFinite) &&
      minLat < maxLat &&
      minLng < maxLng &&
      minLat >= -90 &&
      maxLat <= 90 &&
      minLng >= -180 &&
      maxLng <= 180;
    if (valid) {
      q = q.gte('lat', minLat).lte('lat', maxLat).gte('lng', minLng).lte('lng', maxLng);
    }
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

/**
 * POST /api/persons — reporte público nuevo (desaparecido / a-salvo / etc.).
 *
 * Cadena de seguridad (en hooks.server.ts, antes de llegar aquí): config-guard
 * (503 si faltan controles en prod) → Turnstile (403) → rate-limit 5/h por IP
 * (429) → kill-switch INSERTS_PAUSED (503). Aquí: validación Zod estricta +
 * RPC create_person_report (cifra/hashea la PII DENTRO de la DB; la clave nunca
 * sale de Postgres) → inserta 'pending' → devuelve {id, edit_token}.
 *
 * La PII del reportante (email/phone) NUNCA se persiste en claro ni se devuelve.
 * El edit_token raw se entrega una sola vez para editar/retirar sin login.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  // Defensa en profundidad: hooks ya bloqueó si no verificó Turnstile, pero no
  // confiamos solo en eso.
  if (!locals.turnstileVerified) {
    throw error(403, { message: 'Verificación anti-bot requerida.' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, { message: 'Cuerpo JSON inválido.' });
  }

  const parsed = reportPersonSchema.safeParse(body);
  if (!parsed.success) {
    throw error(400, {
      message: 'Datos inválidos: ' + parsed.error.issues.map((i) => i.message).join(', ')
    });
  }

  // Payload para la RPC: datos validados + IP ya hasheada (nunca en claro).
  // Quitamos el token Turnstile (no va a la DB).
  const { 'cf-turnstile-response': _t, ...clean } = parsed.data;
  void _t;
  const payload = { ...clean, reporter_ip_hashed: locals.ipHashed };

  const { data, error: dbError } = await locals.supabaseAdmin.rpc('create_person_report', {
    payload
  });

  if (dbError) {
    // Sin service_role, supabaseAdmin cae al cliente anon y la RPC (revocada a
    // anon) falla aquí — visible y correcto: falta configurar el secret.
    console.error('[POST /api/persons]', dbError.message);
    throw error(502, { message: 'No se pudo registrar el reporte. Intenta de nuevo en unos minutos.' });
  }

  const result = (data ?? {}) as { id?: string; edit_token?: string };
  return json({ ok: true, id: result.id, edit_token: result.edit_token }, { status: 201 });
};
