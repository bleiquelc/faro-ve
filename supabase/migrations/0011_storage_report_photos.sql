-- ─────────────────────────────────────────────────────────────────────────────
-- 0011_storage_report_photos.sql
--
-- Bucket PRIVADO para las fotos de reportes. Acceso SOLO por URLs firmadas:
--   - Subida: /api/upload-url (service_role) crea un token de un solo uso →
--     el cliente sube con uploadToSignedUrl (bypassa RLS).
--   - Lectura: la ficha genera una URL firmada de corta vida (service_role).
-- Así la foto de un MENOR nunca es pública (CLAUDE #3): el bucket es privado y
-- persons_public oculta photo_url si photo_visibility='admin_only'.
--
-- Límite 512KB (la foto se comprime a ~150KB en el cliente) y solo image/jpeg.
-- Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', false, 524288, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Sin policies en storage.objects: el acceso es exclusivamente vía tokens/URLs
-- firmadas emitidas por service_role (no anon, no authenticated directos).
