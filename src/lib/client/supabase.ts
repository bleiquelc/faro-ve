import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

/**
 * Cliente Supabase de NAVEGADOR — solo para operaciones públicas (subir foto a
 * una URL firmada). No persiste sesión. La anon key es pública por diseño.
 */
let _client: SupabaseClient | null = null;

export function browserSupabase(): SupabaseClient | null {
  if (_client) return _client;
  const url = env.PUBLIC_SUPABASE_URL;
  const key = env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return _client;
}

export const REPORT_PHOTOS_BUCKET = 'report-photos';
