import imageCompression from 'browser-image-compression';
import exifr from 'exifr';
import { browserSupabase, REPORT_PHOTOS_BUCKET } from './supabase';

/**
 * Pipeline de foto pensado para ESCALA (miles de fotos, carga alta):
 *
 *  1. COMPRIME en el cliente (máx 1024px, ~150KB, JPEG). La compresión re-encoda
 *     vía canvas → ELIMINA todo el EXIF, incluido GPS (CLAUDE #4). Los bytes
 *     NUNCA pasan por el Worker → el servidor no gasta CPU/ancho de banda.
 *  2. VERIFICA con exifr que no quede GPS (defensa en profundidad).
 *  3. Sube DIRECTO a un bucket privado vía URL firmada (la pide a un endpoint
 *     rate-limited). El path resultante se guarda en el reporte.
 *
 * Devuelve el PATH en storage (no una URL pública). La ficha genera una URL
 * firmada para mostrarla; la foto de un menor nunca se expone (la vista la oculta).
 */

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB de entrada máx (antes de comprimir)

export type PhotoResult = { ok: true; path: string } | { ok: false; error: string };

export async function compressPhoto(file: File): Promise<File> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.15,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.8
    // preserveExif por defecto es false → el canvas re-encode elimina el EXIF.
  });
  return compressed;
}

/** Aborta si, contra todo pronóstico, quedara GPS en el archivo comprimido. */
async function assertNoGps(file: File): Promise<boolean> {
  try {
    const gps = await exifr.gps(file);
    return !gps; // true = sin GPS (ok)
  } catch {
    return true; // sin EXIF parseable = sin GPS
  }
}

export async function uploadPhoto(file: File): Promise<PhotoResult> {
  if (!file.type.startsWith('image/')) return { ok: false, error: 'El archivo no es una imagen.' };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: 'La imagen es muy grande (máx 8MB).' };

  const sb = browserSupabase();
  if (!sb) return { ok: false, error: 'Subida de fotos no disponible en este momento.' };

  let compressed: File;
  try {
    compressed = await compressPhoto(file);
  } catch {
    return { ok: false, error: 'No se pudo procesar la imagen.' };
  }

  if (!(await assertNoGps(compressed))) {
    return { ok: false, error: 'No se pudo limpiar la ubicación de la foto. Intenta con otra.' };
  }

  // Pide una URL de subida firmada al servidor (rate-limited).
  let signed: { path: string; token: string };
  try {
    const res = await fetch('/api/upload-url', { method: 'POST' });
    if (!res.ok) return { ok: false, error: 'No se pudo preparar la subida. Intenta más tarde.' };
    signed = (await res.json()) as { path: string; token: string };
  } catch {
    return { ok: false, error: 'No se pudo preparar la subida. Revisa tu conexión.' };
  }

  const { error } = await sb.storage
    .from(REPORT_PHOTOS_BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, compressed, { contentType: 'image/jpeg' });
  if (error) return { ok: false, error: 'No se pudo subir la foto. Intenta de nuevo.' };

  return { ok: true, path: signed.path };
}
