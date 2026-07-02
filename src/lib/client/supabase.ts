import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';
import { looksLikePrivilegedKey } from '$utils/key-guard';

/**
 * Cliente Supabase de NAVEGADOR — solo para operaciones públicas (subir foto a
 * una URL firmada). No persiste sesión. La anon/publishable key es pública por
 * diseño (respeta RLS). La guarda `looksLikePrivilegedKey` ($utils/key-guard)
 * impide usar por error una clave secreta/service_role.
 */
let _client: SupabaseClient | null = null;

export function browserSupabase(): SupabaseClient | null {
  if (_client) return _client;
  const url = env.PUBLIC_SUPABASE_URL;
  const key = env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  // Fail-closed: una clave secreta/service_role JAMÁS debe usarse en el navegador
  // (bypassa RLS → expondría coord exacta + PII). Mejor sin cliente que con uno
  // privilegiado. La subida de foto degradará con aviso; el mapa no lo usa.
  if (looksLikePrivilegedKey(key)) {
    console.error(
      '[supabase] PUBLIC_SUPABASE_ANON_KEY parece una clave SECRETA/service_role. ' +
        'Se ignora en el navegador (bypassaría RLS). Configurá la clave PUBLISHABLE/anon.'
    );
    return null;
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return _client;
}

export const REPORT_PHOTOS_BUCKET = 'report-photos';
