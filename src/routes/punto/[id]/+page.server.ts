import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { AidPointDetail, AidPointPublic } from '$schemas/aid-point';

/**
 * Ficha de un lugar de servicio.
 *
 * Estrategia progresiva (igual robustez que persona/[id]):
 *  1. Vista anon aid_points_public → puntos ACTIVOS. Funciona sin service_role
 *     (la capa pública del mapa ya vive de esta vista).
 *  2. Si no aparece (oculto/caducado) → RPC get_aid_point vía admin, para poder
 *     ofrecer la REACTIVACIÓN de un punto auto-ocultado. Si no hay service_role,
 *     cae a anon y la RPC falla → 404 (la reactivación necesita el secret, #1).
 *
 * Nunca se expone el teléfono cifrado ni la IP (la vista/RPC no los devuelven).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLUMNS =
  'id, type, name, organization_name, organization_slug, org_verified, supplies_available, ' +
  'schedule, capacity_current, capacity_max, lat, lng, address_text, landmark, entrance_notes, ' +
  'verified, confirm_count, report_count, net_score, reactivation_count, last_updated_at, ' +
  'expires_at, created_at';

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
  if (!UUID_RE.test(params.id)) {
    throw error(404, { message: 'Punto no encontrado.' });
  }

  // 1) Punto activo desde la vista pública (anon).
  const { data: pub, error: pubErr } = await locals.supabase
    .from('aid_points_public')
    .select(COLUMNS)
    .eq('id', params.id)
    .maybeSingle();

  if (pubErr) {
    console.error('[punto/[id] public]', pubErr.message);
    throw error(502, { message: 'No se pudo cargar el punto. Intenta de nuevo.' });
  }

  if (pub) {
    setHeaders({ 'cache-control': 'public, max-age=15, s-maxage=30' });
    const aid: AidPointDetail = {
      ...(pub as unknown as AidPointPublic),
      active: true,
      auto_hidden: false,
      is_expired: false
    };
    return { aid };
  }

  // 2) Punto oculto/caducado → RPC admin (incluye estado para la reactivación).
  const { data: rpc, error: rpcErr } = await locals.supabaseAdmin.rpc('get_aid_point', {
    p_id: params.id
  });

  if (rpcErr || !rpc) {
    if (rpcErr) console.error('[punto/[id] rpc]', rpcErr.message);
    throw error(404, { message: 'Punto no encontrado o no disponible.' });
  }

  setHeaders({ 'cache-control': 'private, max-age=10' });
  return { aid: rpc as AidPointDetail };
};
