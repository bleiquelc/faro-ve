-- ─────────────────────────────────────────────────────────────────────────────
-- 0019_minor_photo_normalize.sql
--
-- Higiene / defensa en profundidad (regla #3 INVIOLABLE: foto de menor NUNCA
-- pública). Auditoría de datos (2026-06-26) encontró 347 fichas de MENORES con
-- photo_visibility='public'. NO es una fuga: todas tienen photo_url NULL, así que
-- persons_public ya devuelve null para su foto (verificado: 0 fotos de menor
-- expuestas). Son legado PRE-0009, cuando el trigger trg_persons_minor_photo no
-- veía la columna generada is_minor dentro de un BEFORE trigger. Hoy el trigger
-- funciona (probado: un menor nuevo entra admin_only).
--
-- Esta migración deja el flag CONSISTENTE con la regla (admin_only para todo
-- menor), para que si alguna de esas fichas recibiera una foto a futuro, ya parta
-- de un estado correcto. Idempotente. Suprime el audit por-fila y deja una fila
-- resumen honesta.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare v_n int;
begin
  -- Suprimir la fila de audit genérica por-registro (la explícita va abajo).
  perform set_config('faro.skip_persons_audit', '1', true);

  update persons
     set photo_visibility = 'admin_only'
   where is_minor and photo_visibility = 'public';
  get diagnostics v_n = row_count;

  perform set_config('faro.skip_persons_audit', '0', true);

  insert into audit_log (actor_type, action, entity_type, reason)
  values ('system', 'privacy_fix', 'person',
    format('normalizadas %s fichas de menores a photo_visibility=admin_only (regla #3; eran public sin foto, legado pre-0009)', v_n));

  raise notice '0019: % fichas de menores normalizadas a admin_only', v_n;
end $$;
