import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * POST /api/upload-url — entrega una URL de subida FIRMADA para una foto.
 *
 * El bucket `report-photos` es PRIVADO. El cliente comprime + limpia EXIF, pide
 * aquí un token de subida (de un solo uso) y sube DIRECTO a Storage (los bytes
 * nunca tocan el Worker → escala a miles de fotos). Rate-limit por IP en hooks.
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY (sin él, supabaseAdmin cae a anon y falla
 * aquí, visible y correcto).
 */
const BUCKET = 'report-photos';

export const POST: RequestHandler = async ({ locals }) => {
  const path = `${crypto.randomUUID()}.jpg`;

  const { data, error: e } = await locals.supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (e || !data) {
    console.error('[POST /api/upload-url]', e?.message);
    throw error(502, { message: 'No se pudo preparar la subida de la foto.' });
  }

  return json({ path: data.path, token: data.token });
};
