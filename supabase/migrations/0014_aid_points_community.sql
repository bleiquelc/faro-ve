-- ─────────────────────────────────────────────────────────────────────────────
-- 0014_aid_points_community.sql
--
-- Autorregulación comunitaria de lugares de servicio (aid_points).
-- Confirmado por el founder en docs/SPEC-aid-points-comunidad.md (2026-06-25).
--
--  (1) Columnas de votación + reactivación en aid_points.
--  (2) aid_point_votes — 1 voto por IP hasheada, cambiable (unique).
--  (3) founder_alerts — cola de avisos al founder (auto-ocultado / reactivación).
--      El notificador (Resend / Telegram) la drena cuando esté disponible (#3).
--  (4) recompute_aid_point_status — net (reports−confirms desde la última
--      reactivación) ≥ 3 → auto-ocultar REVERSIBLE + alerta. Nunca des-oculta.
--  (5) register_aid_point — alta pública, visible al instante, SIN verificar.
--      Siempre sin organización (anti-suplantación). Coords EXACTAS (#26).
--  (6) vote_aid_point — upsert del voto (refresca created_at) + recompute.
--  (7) reactivate_aid_point — solo puntos auto-ocultados; exige WhatsApp →
--      cifrado en DB (#2), NUNCA público; alerta al founder; resetea el net.
--  (8) aid_points_public — superficie pública del mapa (coords EXACTAS, nunca
--      el teléfono ni la IP). Solo active + no caducado.
--  (9) get_aid_point — ficha SSR; incluye ocultos para alcanzar la reactivación.
--
-- Idempotente. Reusa: encrypt_pii(), get_app_salt(), audit_log, aid_points,
-- organizations (todas de migraciones 0004/0006/0007).
-- Tras aplicar:  notify pgrst, 'reload schema';
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── (1) Columnas de votación + reactivación en aid_points ───────────────────
-- confirm_count / report_count son DENORMALIZADOS (recompute los mantiene) y
-- cuentan SOLO votos desde la última reactivación → el net "se contrapesa" al
-- reactivar sin borrar historial. net_score = report − confirm (derivada).
alter table aid_points add column if not exists confirm_count int not null default 0;
alter table aid_points add column if not exists report_count  int not null default 0;
alter table aid_points add column if not exists net_score      int
  generated always as (report_count - confirm_count) stored;
alter table aid_points add column if not exists auto_hidden    bool not null default false;
alter table aid_points add column if not exists hidden_at      timestamptz;
alter table aid_points add column if not exists reactivated_at timestamptz;
alter table aid_points add column if not exists reactivation_count int not null default 0;
-- Teléfono de quien reactiva — cifrado (#2). NUNCA en ninguna vista pública.
alter table aid_points add column if not exists reactivated_by_phone_encrypted bytea;
-- IP hasheada de quien dio de alta el punto (anti-abuso / auditoría). Nunca pública.
alter table aid_points add column if not exists submitted_ip_hashed text;

comment on column aid_points.reactivated_by_phone_encrypted is
  'WhatsApp (cifrado pgp) de quien reactivó un punto auto-ocultado. Rendición de cuentas. NUNCA público — solo admin vía la RPC auditada get_aid_point_reactivator_phone().';
comment on column aid_points.net_score is
  'report_count − confirm_count (votos desde la última reactivación). net ≥ 3 → auto-ocultar.';

-- Índice para la cola de auto-ocultados pendientes de revisión del founder.
create index if not exists aid_points_auto_hidden_idx
  on aid_points (auto_hidden, hidden_at desc) where auto_hidden = true;

-- 🔒 PRIVACIDAD (revisión adversarial — blocker). 0007 hizo
-- `grant select on aid_points to anon`. Al añadir columnas sensibles
-- (reactivated_by_phone_encrypted cifrada, submitted_ip_hashed), ese grant las
-- expondría vía PostgREST (la anon key es PÚBLICA), saltándose aid_points_public.
-- Patrón endurecido de persons: anon/authenticated NO leen la tabla base — solo
-- la vista aid_points_public (corre como owner, expone columnas seguras + filtra)
-- y shelters_view. Las escrituras van por las RPC SECURITY DEFINER (service_role).
revoke select on aid_points from anon, authenticated;
-- La policy anon de 0007 queda inerte sin el grant; la dejamos (idempotencia).

-- ─── (2) aid_point_votes — 1 voto por IP hasheada, cambiable ──────────────────
create table if not exists aid_point_votes (
  id           uuid primary key default gen_random_uuid(),
  aid_point_id uuid not null references aid_points(id) on delete cascade,
  ip_hashed    text not null,
  vote         text not null check (vote in ('confirm', 'report')),
  -- clock_timestamp() (no now()): monótono incluso dentro de una transacción, así
  -- el "net desde la última reactivación" (created_at > reactivated_at) es correcto
  -- aunque dos operaciones compartieran transacción.
  created_at   timestamptz not null default clock_timestamp(),
  unique (aid_point_id, ip_hashed)
);

create index if not exists aid_point_votes_point_idx
  on aid_point_votes (aid_point_id, created_at desc);

comment on table aid_point_votes is
  '1 voto por (punto, IP hasheada), cambiable. created_at se refresca al cambiar el voto → recompute solo cuenta los posteriores a reactivated_at.';

alter table aid_point_votes enable row level security;
-- Solo service_role (vía las RPC SECURITY DEFINER). Nadie lee/escribe directo.
revoke all on aid_point_votes from anon, authenticated;

-- ─── (3) founder_alerts — cola de avisos al founder ──────────────────────────
do $$ begin
  create type founder_alert_kind as enum (
    'aid_auto_hidden', 'aid_reactivated'
  );
exception when duplicate_object then null; end $$;

create table if not exists founder_alerts (
  id           uuid primary key default gen_random_uuid(),
  kind         founder_alert_kind not null,
  aid_point_id uuid references aid_points(id) on delete set null,
  summary      text not null,           -- texto NO sensible (sin teléfono en claro)
  created_at   timestamptz not null default now(),
  notified_at  timestamptz              -- lo setea el notificador (Resend/Telegram)
);

create index if not exists founder_alerts_pending_idx
  on founder_alerts (created_at) where notified_at is null;

comment on table founder_alerts is
  'Cola de avisos al founder (solo). El notificador (Resend/Telegram) la drena y setea notified_at. summary NUNCA contiene PII en claro.';

alter table founder_alerts enable row level security;
revoke all on founder_alerts from anon, authenticated;
grant select on founder_alerts to authenticated;

drop policy if exists founder_alerts_admin_read on founder_alerts;
create policy founder_alerts_admin_read
  on founder_alerts for select
  to authenticated
  using (coalesce(auth.jwt() ->> 'role' = 'admin', false));

-- ─── (4) recompute_aid_point_status ──────────────────────────────────────────
-- Recalcula confirm/report (solo votos posteriores a la última reactivación),
-- y si net ≥ 3 sobre un punto ACTIVO → lo auto-oculta (reversible) + alerta.
-- NUNCA des-oculta (la reactivación es explícita, con WhatsApp).
create or replace function recompute_aid_point_status(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_since   timestamptz;
  v_conf    int;
  v_rep     int;
  v_net     int;
  v_active  bool;
  v_auto    bool;
  v_exp     timestamptz;
  v_name    text;
  v_threshold constant int := 3;  -- net ≥ 3 → ocultar (SPEC confirmado)
begin
  select coalesce(reactivated_at, '-infinity'::timestamptz), name
    into v_since, v_name
    from aid_points where id = p_id;
  if not found then
    raise exception 'aid_point % no existe', p_id;
  end if;

  select
    count(*) filter (where vote = 'confirm' and created_at > v_since),
    count(*) filter (where vote = 'report'  and created_at > v_since)
    into v_conf, v_rep
    from aid_point_votes where aid_point_id = p_id;

  update aid_points
     set confirm_count = v_conf,
         report_count  = v_rep,
         last_updated_at = now()
   where id = p_id
  returning net_score, active, auto_hidden, expires_at into v_net, v_active, v_auto, v_exp;

  -- Auto-ocultar (reversible): solo un punto VISIBLE (activo y no caducado) puede
  -- caer por net. Sin la guarda de expires_at, votar un punto ya caducado (que la
  -- vista pública no muestra) generaría ruido de alerta al founder por nada.
  if v_net >= v_threshold and v_active and not v_auto and v_exp > now() then
    update aid_points
       set active = false, auto_hidden = true, hidden_at = now()
     where id = p_id;
    v_active := false;
    v_auto   := true;

    insert into founder_alerts (kind, aid_point_id, summary)
    values ('aid_auto_hidden', p_id,
            format('Punto "%s" auto-ocultado por la comunidad (net=%s: %s reportes, %s confirmaciones).',
                   coalesce(v_name, '?'), v_net, v_rep, v_conf));

    insert into audit_log (actor_type, action, entity_type, entity_id, reason)
    values ('system', 'auto_hide', 'aid_point', p_id::text,
            format('net=%s (%s reportes − %s confirmaciones) ≥ %s', v_net, v_rep, v_conf, v_threshold));
  end if;

  return jsonb_build_object(
    'confirms', v_conf, 'reports', v_rep, 'net', v_net,
    'active', v_active, 'auto_hidden', v_auto, 'threshold', v_threshold
  );
end;
$$;

revoke all on function recompute_aid_point_status(uuid) from public, anon, authenticated;
grant execute on function recompute_aid_point_status(uuid) to service_role;

-- ─── (5) register_aid_point — alta pública (visible al instante) ──────────────
-- Sin verificar (badge "sin verificar"); SIEMPRE sin organización (un anónimo no
-- puede decir que es Cruz Roja). Coords EXACTAS obligatorias — es un lugar de
-- servicio, la gente debe LLEGAR (#26). Solo service_role la ejecuta.
create or replace function register_aid_point(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id    uuid;
  v_type  aid_type;
  v_lat   double precision;
  v_lng   double precision;
  v_name  text;
  v_addr  text;
  v_supplies jsonb;
begin
  v_type := nullif(payload->>'type','')::aid_type;  -- enum inválido → excepción
  if v_type is null then
    raise exception 'type es obligatorio';
  end if;

  v_name := nullif(trim(coalesce(payload->>'name','')), '');
  v_addr := nullif(trim(coalesce(payload->>'address_text','')), '');
  if v_name is null or v_addr is null then
    raise exception 'name y address_text son obligatorios';
  end if;

  v_lat := nullif(payload->>'lat','')::double precision;
  v_lng := nullif(payload->>'lng','')::double precision;
  if v_lat is null or v_lng is null then
    raise exception 'lat y lng (coords exactas) son obligatorias para un punto de servicio';
  end if;

  -- supplies: array de etiquetas (el borde Zod ya acotó tamaño/contenido).
  v_supplies := case
    when jsonb_typeof(payload->'supplies') = 'array' then payload->'supplies'
    else '[]'::jsonb
  end;

  insert into aid_points (
    type, name, organization_id,
    supplies_available, schedule,
    capacity_current, capacity_max,
    location_point, address_text, landmark, entrance_notes,
    verified, active, notes, submitted_ip_hashed
  ) values (
    v_type, v_name, null,                            -- organization_id: SIEMPRE null
    jsonb_build_object('tags', v_supplies),
    case when jsonb_typeof(payload->'schedule') = 'object' then payload->'schedule' else '{}'::jsonb end,
    nullif(payload->>'capacity_current','')::int,
    nullif(payload->>'capacity_max','')::int,
    ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography,
    v_addr,
    nullif(trim(coalesce(payload->>'landmark','')), ''),
    nullif(trim(coalesce(payload->>'entrance_notes','')), ''),
    false, true,
    nullif(trim(coalesce(payload->>'notes','')), ''),
    nullif(payload->>'submitted_ip_hashed','')
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function register_aid_point(jsonb) from public, anon, authenticated;
grant execute on function register_aid_point(jsonb) to service_role;

-- ─── (6) vote_aid_point — upsert voto (1/IP, cambiable) + recompute ───────────
create or replace function vote_aid_point(p_id uuid, p_vote text, p_ip_hashed text)
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
  if not exists (select 1 from aid_points where id = p_id) then
    raise exception 'aid_point % no existe', p_id;
  end if;

  -- 1 voto por IP, cambiable. Cambiar el voto refresca created_at → recompute
  -- solo cuenta votos posteriores a la última reactivación.
  insert into aid_point_votes (aid_point_id, ip_hashed, vote)
  values (p_id, p_ip_hashed, p_vote)
  on conflict (aid_point_id, ip_hashed)
  do update set vote = excluded.vote, created_at = clock_timestamp();

  return recompute_aid_point_status(p_id);
end;
$$;

revoke all on function vote_aid_point(uuid, text, text) from public, anon, authenticated;
grant execute on function vote_aid_point(uuid, text, text) to service_role;

-- ─── (7) reactivate_aid_point — solo auto-ocultados; exige WhatsApp ───────────
-- Pone active=true, resetea el net (reactivated_at = now() → recompute ignora
-- los votos previos), cifra el WhatsApp (#2, nunca público), incrementa el
-- contador (el ping-pong queda visible y rate-limited), avisa al founder.
create or replace function reactivate_aid_point(p_id uuid, p_phone text, p_ip_hashed text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_auto bool;
  v_name text;
  v_phone text;
begin
  v_phone := nullif(regexp_replace(coalesce(p_phone,''), '\s', '', 'g'), '');
  if v_phone is null or length(v_phone) < 7 then
    raise exception 'WhatsApp válido obligatorio para reactivar';
  end if;

  select auto_hidden, name into v_auto, v_name from aid_points where id = p_id;
  if not found then
    raise exception 'aid_point % no existe', p_id;
  end if;
  if not v_auto then
    raise exception 'solo se reactivan puntos ocultados por la comunidad';
  end if;

  update aid_points
     set active = true,
         auto_hidden = false,
         hidden_at = null,
         reactivated_at = clock_timestamp(),
         reactivation_count = reactivation_count + 1,
         reactivated_by_phone_encrypted = encrypt_pii(p_phone),
         confirm_count = 0,
         report_count = 0,
         expires_at = greatest(expires_at, now() + interval '7 days'),
         last_updated_at = now()
   where id = p_id;

  insert into founder_alerts (kind, aid_point_id, summary)
  values ('aid_reactivated', p_id,
          format('Punto "%s" reactivado (intento #%s). WhatsApp del responsable guardado cifrado — desencriptar como admin para verificar.',
                 coalesce(v_name, '?'),
                 (select reactivation_count from aid_points where id = p_id)));

  insert into audit_log (actor_type, actor_id, action, entity_type, entity_id, reason, ip_hashed)
  values ('public', 'ip:' || p_ip_hashed, 'reactivate', 'aid_point', p_id::text,
          'reactivado con WhatsApp (cifrado en aid_points.reactivated_by_phone_encrypted)', p_ip_hashed);

  return jsonb_build_object('id', p_id, 'active', true);
end;
$$;

revoke all on function reactivate_aid_point(uuid, text, text) from public, anon, authenticated;
grant execute on function reactivate_aid_point(uuid, text, text) to service_role;

-- ─── (8) aid_points_public — superficie pública del mapa ──────────────────────
-- Coords EXACTAS a propósito (lugares de servicio, #26). NUNCA expone el
-- teléfono cifrado ni la IP. Solo puntos visibles y no caducados.
create or replace view aid_points_public
with (security_barrier = true)
as
select
  a.id,
  a.type,
  a.name,
  o.name   as organization_name,
  o.slug   as organization_slug,
  coalesce(o.verified, false) as org_verified,
  a.supplies_available,
  a.schedule,
  a.capacity_current,
  a.capacity_max,
  ST_Y(a.location_point::geometry) as lat,
  ST_X(a.location_point::geometry) as lng,
  a.address_text,
  a.landmark,
  a.entrance_notes,
  a.verified,
  a.confirm_count,
  a.report_count,
  a.net_score,
  a.reactivation_count,
  a.last_updated_at,
  a.expires_at,
  a.created_at
from aid_points a
left join organizations o on o.id = a.organization_id
where a.active = true and a.expires_at > now();

comment on view aid_points_public is
  'Superficie pública de lugares de servicio para el mapa. Coords EXACTAS (#26). NUNCA reactivated_by_phone_encrypted ni submitted_ip_hashed. Solo active + no caducado.';

grant select on aid_points_public to anon, authenticated;

-- ─── (9) get_aid_point — ficha SSR (incluye ocultos para la reactivación) ─────
-- Devuelve la ficha pública-segura de CUALQUIER punto (activo, auto-ocultado o
-- caducado) para que la página /punto/[id] pueda ofrecer la reactivación de uno
-- oculto. NUNCA el teléfono cifrado ni la IP. Solo service_role (SSR admin).
create or replace function get_aid_point(p_id uuid)
returns jsonb
language sql
security definer
set search_path = public, extensions
stable
as $$
  select jsonb_build_object(
    'id', a.id,
    'type', a.type,
    'name', a.name,
    'organization_name', o.name,
    'organization_slug', o.slug,
    'org_verified', coalesce(o.verified, false),
    'supplies_available', a.supplies_available,
    'schedule', a.schedule,
    'capacity_current', a.capacity_current,
    'capacity_max', a.capacity_max,
    'lat', ST_Y(a.location_point::geometry),
    'lng', ST_X(a.location_point::geometry),
    'address_text', a.address_text,
    'landmark', a.landmark,
    'entrance_notes', a.entrance_notes,
    'verified', a.verified,
    'confirm_count', a.confirm_count,
    'report_count', a.report_count,
    'net_score', a.net_score,
    'reactivation_count', a.reactivation_count,
    'active', a.active,
    'auto_hidden', a.auto_hidden,
    'is_expired', (a.expires_at <= now()),
    'last_updated_at', a.last_updated_at,
    'expires_at', a.expires_at,
    'created_at', a.created_at
  )
  from aid_points a
  left join organizations o on o.id = a.organization_id
  where a.id = p_id;
$$;

revoke all on function get_aid_point(uuid) from public, anon, authenticated;
grant execute on function get_aid_point(uuid) to service_role;

-- ─── (10) get_aid_point_reactivator_phone — único canal admin auditado ────────
-- Cierra el lazo de rendición de cuentas (#2): el WhatsApp del reactivador se
-- guarda cifrado y la ÚNICA forma sancionada de leerlo es esta RPC, que registra
-- el acceso en audit_log antes de devolver el texto. Solo service_role la ejecuta
-- y el endpoint que la exponga debe exigir rol admin (defensa en profundidad).
create or replace function get_aid_point_reactivator_phone(p_id uuid, p_admin_id text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_enc   bytea;
  v_phone text;
begin
  -- Sin actor identificable NO se descifra: la razón de existir de esta RPC es
  -- dejar rastro de QUIÉN leyó la PII. Un audit con actor NULL anularía eso.
  if nullif(trim(coalesce(p_admin_id, '')), '') is null then
    raise exception 'admin_id obligatorio para auditar el acceso al WhatsApp del reactivador';
  end if;

  select reactivated_by_phone_encrypted into v_enc from aid_points where id = p_id;
  if v_enc is null then
    return null;
  end if;
  v_phone := pgp_sym_decrypt(v_enc, get_app_salt());

  insert into audit_log (actor_type, actor_id, action, entity_type, entity_id, reason)
  values ('admin', trim(p_admin_id), 'decrypt', 'aid_point', p_id::text,
          'admin leyó el WhatsApp del reactivador (rendición de cuentas)');

  return v_phone;
end;
$$;

revoke all on function get_aid_point_reactivator_phone(uuid, text) from public, anon, authenticated;
grant execute on function get_aid_point_reactivator_phone(uuid, text) to service_role;

-- Recargar el cache de PostgREST tras los cambios de schema.
notify pgrst, 'reload schema';
