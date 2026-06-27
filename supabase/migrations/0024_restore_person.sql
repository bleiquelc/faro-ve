-- ─────────────────────────────────────────────────────────────────────────────
-- 0024_restore_person.sql  ·  IA-moderación (Fase 3)
--
-- restore_person(p_id): des-oculta un perfil auto-ocultado por la comunidad
-- (0022). Lo llama el worker ai-triage cuando la IA juzga que el reporte es REAL
-- (sesgo fuerte a restaurar), reemplazando la restauración manual del founder.
--
-- Limpia los votos que lo ocultaron (clean slate) para que no vuelva a ocultarse
-- de inmediato con los mismos votos; un troll tendría que acumular net≥3 OTRA vez.
-- Reusa el patrón de reactivate_aid_point (0014) + founder_alerts + audit_log.
-- Tras aplicar:  notify pgrst, 'reload schema';  (incluido al final)
-- ─────────────────────────────────────────────────────────────────────────────

alter type founder_alert_kind add value if not exists 'person_restored';

create or replace function restore_person(p_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_auto bool;
  v_name text;
begin
  select auto_hidden,
         coalesce(nullif(full_name,''), trim(coalesce(given_name,'') || ' ' || coalesce(family_name,'')))
    into v_auto, v_name
    from persons where id = p_id;
  if not found then
    raise exception 'persona % no existe', p_id;
  end if;
  if not coalesce(v_auto, false) then
    -- Ya está visible: nada que hacer (idempotente).
    return jsonb_build_object('restored', false, 'reason', 'no estaba oculto');
  end if;

  update persons
     set auto_hidden = false,
         hidden_at = null,
         confirm_count = 0,
         report_count = 0
   where id = p_id;

  -- Limpia los votos previos (evita re-ocultar inmediato con los mismos votos).
  delete from person_votes where person_id = p_id;

  insert into founder_alerts (kind, person_id, summary)
  values ('person_restored', p_id,
          format('IA-moderadora restauró el perfil "%s" (juzgado real). %s',
                 coalesce(nullif(v_name,''), '?'), coalesce(p_reason, '')));

  insert into audit_log (actor_type, action, entity_type, entity_id, reason)
  values ('system', 'restore', 'person', p_id::text,
          coalesce(p_reason, 'IA juzgó real → restaurar'));

  return jsonb_build_object('restored', true);
end;
$$;

revoke all on function restore_person(uuid, text) from public, anon, authenticated;
grant execute on function restore_person(uuid, text) to service_role;

notify pgrst, 'reload schema';
