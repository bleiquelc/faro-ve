-- ─────────────────────────────────────────────────────────────────────────────
-- 0031_person_removal.sql · Borrado self-service "inmediato y reversible"
--
-- Pedido del founder (2-jul-2026): que una persona pueda SALIR del mapa, o que
-- una familia pueda RETIRAR a su familiar fallecido. Modelo elegido: inmediato y
-- reversible.
--
--   · request_person_removal(payload) — OCULTA el registro del público AL
--     INSTANTE (setea withdrawn_at → persons_public lo excluye) + programa la
--     purga de PII a los 30 días (purge_pii_at, Habeas Data #6) + registra el
--     motivo + ALERTA al founder (anti-abuso) + audita. Reversible durante 30
--     días con restore_withdrawn_person (por si es un borrado malicioso: alguien
--     podría intentar retirar reportes reales para sabotear la búsqueda).
--   · restore_withdrawn_person(id, reason) — revierte el retiro (des-oculta).
--
-- No exige prueba de identidad (los registros ingestados de fuentes públicas no
-- tienen email del reportante para verificar; la familia del fallecido tampoco
-- reportó por Faro). La red de seguridad es: Turnstile + rate-limit 5/h (en
-- hooks) + reversibilidad + alerta + audit — NO un candado que dejaría fuera a
-- quien tiene derecho a salir. Aplicar en el SQL Editor de Supabase (un pegado).
-- Tras aplicar:  notify pgrst, 'reload schema';  (incluido al final)
-- ─────────────────────────────────────────────────────────────────────────────

-- Aviso al founder cuando alguien pide un retiro (para vigilar abuso).
alter type founder_alert_kind add value if not exists 'person_removal_requested';

-- founder_alerts.person_id ya existe desde 0022; defensivo por si se corre suelto.
alter table founder_alerts add column if not exists person_id uuid references persons(id) on delete set null;

-- Motivo/relación del retiro (para moderación; texto NO obligatorio, sin PII).
alter table persons add column if not exists removed_by text;      -- 'self' | 'family_deceased' | 'other'
alter table persons add column if not exists removal_note text;    -- nota libre opcional (<=500)

-- ─── request_person_removal ──────────────────────────────────────────────────
create or replace function request_person_removal(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid := (payload->>'id')::uuid;
  v_rel  text := lower(coalesce(nullif(payload->>'relationship',''), 'other'));
  v_note text := nullif(left(trim(coalesce(payload->>'note','')), 500), '');
  v_name text;
  v_withdrawn timestamptz;
begin
  if v_id is null then
    raise exception 'request_person_removal: falta id';
  end if;
  if v_rel not in ('self', 'family_deceased', 'other') then
    v_rel := 'other';
  end if;

  select coalesce(nullif(full_name, ''),
                  nullif(trim(coalesce(given_name,'') || ' ' || coalesce(family_name,'')), '')),
         withdrawn_at
    into v_name, v_withdrawn
    from persons
   where id = v_id;

  -- No revelar si el id existe o no (evita enumeración): respuesta idempotente.
  if not found then
    return jsonb_build_object('ok', true, 'already', false);
  end if;
  if v_withdrawn is not null then
    return jsonb_build_object('ok', true, 'already', true); -- ya estaba retirado
  end if;

  update persons
     set withdrawn_at = now(),
         purge_pii_at = now() + interval '30 days',
         removed_by   = v_rel,
         removal_note = v_note,
         updated_at   = now()
   where id = v_id
     and withdrawn_at is null;

  insert into founder_alerts (kind, person_id, summary)
  values (
    'person_removal_requested',
    v_id,
    format('Pedido de retiro (%s) del perfil "%s". Oculto del mapa; reversible 30 días (restore_withdrawn_person). %s',
           v_rel, coalesce(nullif(v_name, ''), '?'),
           case when v_note is not null then 'Nota: ' || v_note else '' end)
  );

  insert into audit_log (actor_type, action, entity_type, entity_id, reason)
  values ('public', 'withdraw_request', 'person', v_id::text,
          format('retiro self-service (%s)', v_rel));

  return jsonb_build_object('ok', true, 'already', false);
end;
$$;

comment on function request_person_removal(jsonb) is
  '0031: retiro self-service (persona sale del mapa / familia retira a un fallecido). Oculta al instante (withdrawn_at), purga PII a 30d, alerta+audita. Reversible con restore_withdrawn_person. Solo service_role.';

-- ─── restore_withdrawn_person (reversa el retiro) ────────────────────────────
create or replace function restore_withdrawn_person(p_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_withdrawn timestamptz;
begin
  select coalesce(nullif(full_name, ''),
                  nullif(trim(coalesce(given_name,'') || ' ' || coalesce(family_name,'')), '')),
         withdrawn_at
    into v_name, v_withdrawn
    from persons
   where id = p_id;
  if not found then
    raise exception 'persona % no existe', p_id;
  end if;
  if v_withdrawn is null then
    return jsonb_build_object('restored', false, 'reason', 'no estaba retirado');
  end if;

  update persons
     set withdrawn_at = null,
         purge_pii_at = null,
         removed_by   = null,
         removal_note = null,
         updated_at   = now()
   where id = p_id;

  insert into founder_alerts (kind, person_id, summary)
  values ('person_restored', p_id,
          format('Retiro revertido: "%s". %s', coalesce(nullif(v_name,''), '?'), coalesce(p_reason, '')));

  insert into audit_log (actor_type, action, entity_type, entity_id, reason)
  values ('system', 'restore', 'person', p_id::text, coalesce(p_reason, 'retiro revertido'));

  return jsonb_build_object('restored', true);
end;
$$;

comment on function restore_withdrawn_person(uuid, text) is
  '0031: revierte un retiro self-service (des-oculta). Para deshacer un borrado malicioso dentro de la ventana de 30 días. Solo service_role.';

-- Permisos: SOLO service_role (el backend); nunca anon/authenticated directo.
revoke all on function request_person_removal(jsonb) from public, anon, authenticated;
grant execute on function request_person_removal(jsonb) to service_role;
revoke all on function restore_withdrawn_person(uuid, text) from public, anon, authenticated;
grant execute on function restore_withdrawn_person(uuid, text) to service_role;

notify pgrst, 'reload schema';
