-- ─────────────────────────────────────────────────────────────────────────────
-- 0022_person_self_regulation.sql  ·  EMERGENCIA (Fase 2)
--
-- Autorregulación comunitaria de PERSONAS (red de seguridad del publish-first de
-- 0021). Reusa EXACTO el patrón probado de aid_points (0014): votos 1/IP
-- (confirm/report), net = report − confirm; net ≥ 3 sobre un perfil VISIBLE →
-- auto-ocultar REVERSIBLE + alerta al founder + audit. La comunidad quita los
-- falsos sin que nadie modere. El founder revisa la alerta y restaura si era real.
--
-- A diferencia de aid_points: NO hay reactivación pública (un perfil falsamente
-- ocultado lo restaura el founder/admin desde la alerta). recompute cuenta TODOS
-- los votos. NUNCA des-oculta solo (evita flapping).
--
-- Reusa: audit_log, founder_alerts (0014), persons, encrypt patterns. Idempotente.
-- Tras aplicar:  notify pgrst, 'reload schema';  (incluido al final)
-- ─────────────────────────────────────────────────────────────────────────────

-- (1) Columnas de votación en persons ─────────────────────────────────────────
alter table persons add column if not exists confirm_count int not null default 0;
alter table persons add column if not exists report_count  int not null default 0;
alter table persons add column if not exists net_score      int
  generated always as (report_count - confirm_count) stored;
alter table persons add column if not exists auto_hidden    bool not null default false;
alter table persons add column if not exists hidden_at      timestamptz;

comment on column persons.net_score is
  'report_count − confirm_count. net ≥ 3 → auto-ocultar (reversible, el founder restaura si era real).';

create index if not exists persons_auto_hidden_idx
  on persons (auto_hidden, hidden_at desc) where auto_hidden = true;

-- (2) person_votes — 1 voto por (persona, IP hasheada), cambiable ──────────────
create table if not exists person_votes (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references persons(id) on delete cascade,
  ip_hashed  text not null,
  vote       text not null check (vote in ('confirm', 'report')),
  created_at timestamptz not null default clock_timestamp(),
  unique (person_id, ip_hashed)
);
create index if not exists person_votes_person_idx
  on person_votes (person_id, created_at desc);
alter table person_votes enable row level security;
revoke all on person_votes from anon, authenticated;

-- (3) founder_alerts: soportar personas (columna + valor de enum) ──────────────
alter table founder_alerts add column if not exists person_id uuid references persons(id) on delete set null;
alter type founder_alert_kind add value if not exists 'person_auto_hidden';

-- (4) recompute_person_status — net ≥ 3 sobre perfil VISIBLE → auto-ocultar ─────
create or replace function recompute_person_status(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_conf      int;
  v_rep       int;
  v_net       int;
  v_hidden    bool;
  v_modst     text;
  v_withdrawn timestamptz;
  v_name      text;
  v_threshold constant int := 3;
begin
  select moderation_status::text, withdrawn_at,
         coalesce(nullif(full_name,''), trim(coalesce(given_name,'') || ' ' || coalesce(family_name,'')))
    into v_modst, v_withdrawn, v_name
    from persons where id = p_id;
  if not found then
    raise exception 'persona % no existe', p_id;
  end if;

  select
    count(*) filter (where vote = 'confirm'),
    count(*) filter (where vote = 'report')
    into v_conf, v_rep
    from person_votes where person_id = p_id;

  update persons
     set confirm_count = v_conf, report_count = v_rep
   where id = p_id
  returning net_score, auto_hidden into v_net, v_hidden;

  -- Solo un perfil VISIBLE (aprobado, no retirado, no ya oculto) puede caer por net.
  if v_net >= v_threshold and not v_hidden and v_modst = 'approved' and v_withdrawn is null then
    update persons set auto_hidden = true, hidden_at = now() where id = p_id;
    v_hidden := true;

    insert into founder_alerts (kind, person_id, summary)
    values ('person_auto_hidden', p_id,
            format('Perfil "%s" auto-ocultado por la comunidad (net=%s: %s reportes, %s confirmaciones). Revisar y restaurar si es real.',
                   coalesce(nullif(v_name,''), '?'), v_net, v_rep, v_conf));

    insert into audit_log (actor_type, action, entity_type, entity_id, reason)
    values ('system', 'auto_hide', 'person', p_id::text,
            format('net=%s (%s reportes − %s confirmaciones) ≥ %s', v_net, v_rep, v_conf, v_threshold));
  end if;

  return jsonb_build_object(
    'confirms', v_conf, 'reports', v_rep, 'net', v_net,
    'auto_hidden', v_hidden, 'threshold', v_threshold
  );
end;
$$;
revoke all on function recompute_person_status(uuid) from public, anon, authenticated;
grant execute on function recompute_person_status(uuid) to service_role;

-- (5) vote_person — upsert voto (1/IP, cambiable) + recompute ──────────────────
create or replace function vote_person(p_id uuid, p_vote text, p_ip_hashed text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_vote not in ('confirm', 'report') then
    raise exception 'voto inválido: %', p_vote;
  end if;
  if nullif(trim(coalesce(p_ip_hashed,'')), '') is null then
    raise exception 'ip_hashed requerido';
  end if;
  if not exists (select 1 from persons where id = p_id) then
    raise exception 'persona % no existe', p_id;
  end if;

  insert into person_votes (person_id, ip_hashed, vote)
  values (p_id, p_ip_hashed, p_vote)
  on conflict (person_id, ip_hashed)
  do update set vote = excluded.vote, created_at = clock_timestamp();

  return recompute_person_status(p_id);
end;
$$;
revoke all on function vote_person(uuid, text, text) from public, anon, authenticated;
grant execute on function vote_person(uuid, text, text) to service_role;

-- (6) persons_public — AÑADIR filtro de auto-ocultos (resto idéntico a 0010) ────
create or replace view persons_public
with (security_barrier = true)
as
select
  p.id,
  p.pfif_id,
  p.source,
  p.source_id,
  p.source_url,
  p.given_name,
  p.family_name,
  p.full_name,
  p.alternate_names,
  p.sex,
  p.age,
  p.age_unit,
  p.home_neighborhood,
  p.home_city,
  p.home_state,
  p.home_country,
  p.last_known_location_text,
  p.last_known_location_obfuscated,
  ST_Y(p.last_known_location_obfuscated::geometry) as lat,
  ST_X(p.last_known_location_obfuscated::geometry) as lng,
  p.last_seen_at,
  p.description,
  p.height_cm,
  p.weight_kg,
  p.hair_color,
  p.eye_color,
  p.skin_tone,
  p.clothing_top,
  p.clothing_bottom,
  p.clothing_shoes,
  p.clothing_accessories,
  p.distinguishing_marks,
  case
    when p.photo_visibility = 'public' then p.photo_url
    else null
  end as photo_url,
  p.photo_visibility,
  p.status,
  p.is_minor,
  p.unaccompanied_minor,
  p.medical_urgent,
  p.medical_category,
  p.medical_notes,
  p.share_exact_location_with_searchers,
  case
    when p.status = 'safe_self_report' and p.share_exact_location_with_searchers then
      ST_Y(p.last_known_location_point::geometry)
    else null
  end as lat_exact_optional,
  case
    when p.status = 'safe_self_report' and p.share_exact_location_with_searchers then
      ST_X(p.last_known_location_point::geometry)
    else null
  end as lng_exact_optional,
  p.created_at,
  p.updated_at,
  p.expiry_date,
  case
    when p.status = 'safe_self_report' then nullif(trim(coalesce(p.contact_phone_public, '')), '')
    else null
  end as contact_phone_optional
from persons p
where p.moderation_status = 'approved'
  and p.withdrawn_at is null
  and not coalesce(p.auto_hidden, false);   -- ← Fase 2: oculta perfiles reportados por la comunidad

grant select on persons_public to anon, authenticated;

notify pgrst, 'reload schema';
