-- ─────────────────────────────────────────────────────────────────────────────
-- 0020_clear_broken_photos.sql
--
-- Fotos rotas de la fuente venezuela-te-busca. Diagnóstico (2026-06-26): las URLs
-- con patrón '/migrated/' devuelven 404 (confirmado: 0/20 cargan; las uuid 20/20
-- sí). Eran enlaces a imágenes que la fuente nunca llegó a migrar. La ficha
-- mostraba el ícono de "imagen rota". Limpiamos photo_url para no servir URLs 404;
-- la ficha entonces no intenta cargar nada. Las fotos válidas (uuid.jpg) quedan
-- intactas. Idempotente. No toca is_minor ni el resto. La re-ingesta podría
-- repoblar photo_url con URLs válidas a futuro (upsert).
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare v_n int;
begin
  perform set_config('faro.skip_persons_audit', '1', true);

  update persons
     set photo_url = null
   where photo_url like '%/migrated/%';
  get diagnostics v_n = row_count;

  perform set_config('faro.skip_persons_audit', '0', true);

  insert into audit_log (actor_type, action, entity_type, reason)
  values ('system', 'clean_broken_photo', 'person',
    format('photo_url=null en %s fichas con URL /migrated/ rota (404 confirmado en la fuente)', v_n));

  raise notice '0020: % fotos rotas (404) limpiadas', v_n;
end $$;
