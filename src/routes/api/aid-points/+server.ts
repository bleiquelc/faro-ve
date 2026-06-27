import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { aidPointFiltersSchema, registerAidPointSchema, isKnownSupply } from '$schemas/aid-point';

/**
 * GET /api/aid-points — lugares de servicio para la capa del mapa.
 *
 * Lee SIEMPRE de aid_points_public (solo active + no caducado; coords EXACTAS —
 * son lugares, la gente debe llegar, #26; nunca el teléfono cifrado ni la IP).
 * Soporta filtros: type, q (nombre), bbox (viewport) y limit.
 */
export const GET: RequestHandler = async ({ url, locals, setHeaders }) => {
  const parsed = aidPointFiltersSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    throw error(400, {
      message: 'Filtros inválidos: ' + parsed.error.issues.map((i) => i.message).join(', ')
    });
  }
  const f = parsed.data;

  let q = locals.supabase
    .from('aid_points_public')
    .select(
      'id, type, name, organization_name, organization_slug, org_verified, supplies_available, ' +
        'schedule, capacity_current, capacity_max, lat, lng, address_text, landmark, entrance_notes, ' +
        'verified, confirm_count, report_count, net_score, reactivation_count, last_updated_at, ' +
        'expires_at, created_at'
    )
    // Orden estable → truncado determinista (igual que persons).
    .order('created_at', { ascending: false })
    .limit(f.limit);

  if (f.type) q = q.eq('type', f.type);
  if (f.q) {
    const safe = f.q.replace(/[\\%_]/g, '\\$&');
    q = q.ilike('name', `%${safe}%`);
  }
  if (f.bbox) {
    const [minLng, minLat, maxLng, maxLat] = f.bbox.split(',').map(Number);
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
    console.error('[GET /api/aid-points]', dbError.message);
    throw error(502, { message: 'No se pudieron cargar los puntos de ayuda. Intenta de nuevo.' });
  }

  const rows = data ?? [];

  // ?format=geojson → FeatureCollection RFC 7946 que Leaflet/Mapbox/QGIS/uMap
  // consumen directo. Coords EXACTAS (son lugares de servicio, #26). Mismos datos
  // públicos que el JSON; reusa la query de arriba (Ley de Reuso).
  if (url.searchParams.get('format') === 'geojson') {
    const fc = {
      type: 'FeatureCollection',
      features: rows.map((a) => {
        const r = a as unknown as Record<string, unknown>;
        const lat = r.lat as number | null;
        const lng = r.lng as number | null;
        return {
          type: 'Feature',
          geometry:
            lat != null && lng != null ? { type: 'Point', coordinates: [lng, lat] } : null,
          properties: {
            id: r.id,
            name: r.name,
            type: r.type,
            organization: r.organization_name,
            verified: r.verified,
            supplies: r.supplies_available,
            schedule: r.schedule,
            capacity_current: r.capacity_current,
            capacity_max: r.capacity_max,
            address: r.address_text,
            landmark: r.landmark,
            entrance_notes: r.entrance_notes,
            last_updated: r.last_updated_at,
            url: `https://faro-ve.com/punto/${r.id}`
          }
        };
      })
    };
    setHeaders({ 'cache-control': 'public, max-age=15, s-maxage=30' });
    return json(fc, { headers: { 'content-type': 'application/geo+json; charset=utf-8' } });
  }

  setHeaders({ 'cache-control': 'public, max-age=15, s-maxage=30' });
  return json({ ok: true, count: rows.length, aid_points: rows });
};

/**
 * POST /api/aid-points — alta pública de un lugar de servicio.
 *
 * Cadena de seguridad en hooks: config-guard (503) → Turnstile (403) →
 * rate-limit 10/h por IP (429) → kill-switch INSERTS_PAUSED (503). Aquí:
 * validación Zod + RPC register_aid_point (visible al instante, SIN verificar,
 * SIEMPRE sin organización → anti-suplantación). Coords EXACTAS obligatorias.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.turnstileVerified) {
    throw error(403, { message: 'Verificación anti-bot requerida.' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, { message: 'Cuerpo JSON inválido.' });
  }

  const parsed = registerAidPointSchema.safeParse(body);
  if (!parsed.success) {
    throw error(400, {
      message: 'Datos inválidos: ' + parsed.error.issues.map((i) => i.message).join(', ')
    });
  }

  const d = parsed.data;
  // Defensa en profundidad: solo etiquetas de insumo conocidas llegan a la DB.
  const supplies = d.supplies.filter(isKnownSupply);

  const payload = {
    type: d.type,
    name: d.name,
    supplies,
    schedule: d.schedule_text ? { text: d.schedule_text } : {},
    capacity_current: d.capacity_current,
    capacity_max: d.capacity_max,
    lat: d.lat,
    lng: d.lng,
    address_text: d.address_text,
    landmark: d.landmark,
    entrance_notes: d.entrance_notes,
    notes: d.notes,
    submitted_ip_hashed: locals.ipHashed
  };

  const { data, error: dbError } = await locals.supabaseAdmin.rpc('register_aid_point', { payload });
  if (dbError) {
    console.error('[POST /api/aid-points]', dbError.message);
    throw error(502, { message: 'No se pudo registrar el punto. Intenta de nuevo en unos minutos.' });
  }

  const result = (data ?? {}) as { id?: string };
  return json({ ok: true, id: result.id }, { status: 201 });
};
