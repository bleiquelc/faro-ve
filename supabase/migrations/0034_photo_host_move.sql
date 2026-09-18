-- ─────────────────────────────────────────────────────────────────────────────
-- 0034_photo_host_move.sql
--
-- La fuente venezuela-te-busca se mudó de dominio. Diagnóstico (2026-09-18): entre
-- el 5 y el 6-sep la app dejó de servirse en
--   https://venezuela-te-busca-app.hellogafaro.workers.dev   (hoy: 404 · error code
--   1042 a TODO, idéntico a un Worker inexistente)
-- y pasó a
--   https://app.venezuelateayuda.com
-- conservando el PATH de cada imagen (/media/photos/<id>): 9/9 fotos antiguas
-- verificadas vivas en el host nuevo con el mismo path. Faro guarda la foto como
-- hotlink, así que TODAS las photo_url quedaron rotas: fotos caídas en la PWA, en el
-- feed PFIF y en /reencuentros, y el auto-publicador de Instagram en 0 desde el
-- 6-sep ("Sin foto limpia" = fetch 404).
--
-- Solo cambia el host de photo_url. No toca is_minor, photo_visibility, status ni
-- ubicación: trg_persons_match_notify (UPDATE OF status, moderation_status) y
-- trg_persons_obfuscate_loc (UPDATE OF last_known_location_point) NO se disparan;
-- el guardia de foto de menores sí corre y es fail-safe. Auditoría: UNA fila resumen
-- en vez de ~20 mil diffs jsonb (mismo patrón que 0020). Idempotente. Autorizado
-- por el founder el 2026-09-18 (escritura masiva, regla #13).
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_old constant text := 'https://venezuela-te-busca-app.hellogafaro.workers.dev/';
  v_new constant text := 'https://app.venezuelateayuda.com/';
  v_persons int;
  v_signals int;
begin
  perform set_config('faro.skip_persons_audit', '1', true);

  update persons
     set photo_url = v_new || substr(photo_url, length(v_old) + 1)
   where left(photo_url, length(v_old)) = v_old;
  get diagnostics v_persons = row_count;

  perform set_config('faro.skip_persons_audit', '0', true);

  update person_found_signals
     set photo_url = v_new || substr(photo_url, length(v_old) + 1)
   where left(photo_url, length(v_old)) = v_old;
  get diagnostics v_signals = row_count;

  insert into audit_log (actor_type, action, entity_type, reason)
  values ('system', 'photo_host_move', 'person',
    format('photo_url: host %s → %s en %s fichas y %s señales de reencuentro (la fuente cambió de dominio; mismo path)',
           v_old, v_new, v_persons, v_signals));

  raise notice '0034: host de photo_url migrado en % fichas y % señales', v_persons, v_signals;
end $$;
