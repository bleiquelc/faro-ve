-- ─────────────────────────────────────────────────────────────────────────────
-- 0007_aid_orgs_ai.sql
-- Organizaciones verificadas, puntos de ayuda, refugios, conversaciones IA y
-- budget guard diario. Última migración del bundle D1.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── organizations ────────────────────────────────────────────────────────────

do $$ begin
  create type org_type as enum (
    'red_cross', 'icrc', 'ngo', 'church', 'community_kitchen',
    'government', 'volunteer_group', 'media', 'health_authority',
    'civil_protection', 'fire_dept', 'other'
  );
exception when duplicate_object then null; end $$;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  type org_type not null default 'ngo',
  verified bool not null default false,
  verified_by uuid references moderators(id),
  verified_at timestamptz,
  logo_url text,
  description text,
  contact_email_encrypted bytea,
  contact_email_hash text,
  contact_phone_encrypted bytea,
  website text,
  country text default 'VE',
  state text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_verified_idx
  on organizations (verified, type) where verified = true;

drop trigger if exists trg_orgs_touch on organizations;
create trigger trg_orgs_touch
  before update on organizations
  for each row execute function touch_updated_at();

alter table organizations enable row level security;
grant select on organizations to anon;

drop policy if exists orgs_public_select_verified on organizations;
create policy orgs_public_select_verified
  on organizations for select
  to anon
  using (verified = true);

drop policy if exists orgs_admin_modify on organizations;
create policy orgs_admin_modify
  on organizations for all
  to authenticated
  using (coalesce(auth.jwt() ->> 'role' = 'admin', false))
  with check (coalesce(auth.jwt() ->> 'role' = 'admin', false));

-- Seed organizaciones pre-verificadas (founder = admin verifica D1)
insert into organizations (slug, name, type, verified, verified_at, website, country, description) values
  ('cruz-roja-venezolana',  'Cruz Roja Venezolana',  'red_cross',        true, now(), 'https://cruzrojavenezolana.org', 'VE', 'Sociedad Nacional Cruz Roja Venezolana — programas RFL Restoring Family Links.'),
  ('icrc-ve',               'CICR Venezuela',         'icrc',             true, now(), 'https://www.icrc.org/es',       'VE', 'Comité Internacional de la Cruz Roja — delegación Caracas.'),
  ('caritas-venezuela',     'Caritas Venezuela',      'ngo',              true, now(), 'https://caritasvenezuela.org',  'VE', 'Red Caritas — albergues y distribución de ayuda humanitaria.'),
  ('proteccion-civil-ve',   'Protección Civil',       'civil_protection', true, now(), 'https://www.proteccioncivil.gob.ve','VE','Coordinación Nacional Protección Civil y Administración de Desastres.'),
  ('bomberos-caracas',      'Bomberos Distrital Caracas','fire_dept',     true, now(), null,                             'VE', 'Cuerpo de Bomberos del Distrito Capital.'),
  ('iglesia-catolica-ve',   'Conferencia Episcopal Venezolana','church',  true, now(), 'https://cev.org.ve',             'VE', 'Red parroquial — albergues en parroquias.'),
  ('avesa',                 'AVESA',                  'ngo',              true, now(), null,                             'VE', 'ONG salud sexual y reproductiva — apoyo víctimas.'),
  ('provea',                'PROVEA',                 'ngo',              true, now(), 'https://provea.org',             'VE', 'Programa Venezolano de Educación-Acción en Derechos Humanos.')
on conflict (slug) do update
  set name = excluded.name,
      website = excluded.website,
      description = excluded.description,
      updated_at = now();

-- ─── aid_points ───────────────────────────────────────────────────────────────

do $$ begin
  create type aid_type as enum (
    'food', 'water', 'medical', 'clothing', 'charging', 'wifi',
    'shelter_temporary', 'shelter_permanent', 'distribution',
    'mental_health', 'translation', 'transport', 'document_help', 'other'
  );
exception when duplicate_object then null; end $$;

create table if not exists aid_points (
  id uuid primary key default gen_random_uuid(),
  type aid_type not null,
  name text not null,
  organization_id uuid references organizations(id) on delete set null,

  supplies_available jsonb default '{}'::jsonb,
  schedule jsonb default '{}'::jsonb,
  capacity_current int,
  capacity_max int,

  -- Coords EXACTAS — son lugares de servicio, no personas
  location_point geography(Point, 4326) not null,
  address_text text not null,
  landmark text,
  entrance_notes text,

  contact_relay_message_id uuid,
  verified bool not null default false,
  verified_by uuid references moderators(id),
  verified_at timestamptz,

  last_updated_by uuid references moderators(id),
  last_updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  notes text,
  active bool not null default true,
  created_at timestamptz not null default now()
);

create index if not exists aid_points_location_gist
  on aid_points using gist (location_point);
create index if not exists aid_points_type_idx
  on aid_points (type, active, expires_at);
create index if not exists aid_points_org_idx
  on aid_points (organization_id);

alter table aid_points enable row level security;
grant select on aid_points to anon;

drop policy if exists aid_points_public_select on aid_points;
create policy aid_points_public_select
  on aid_points for select
  to anon
  using (active = true and expires_at > now());

drop policy if exists aid_points_org_modify on aid_points;
create policy aid_points_org_modify
  on aid_points for all
  to authenticated
  using (
    auth_is_moderator()
    or (
      auth.jwt() ->> 'role' = 'org'
      and (auth.jwt() ->> 'organization_id')::uuid = organization_id
    )
  )
  with check (
    auth_is_moderator()
    or (
      auth.jwt() ->> 'role' = 'org'
      and (auth.jwt() ->> 'organization_id')::uuid = organization_id
    )
  );

comment on table aid_points is 'Lugares de servicio (refugios, ayuda, distribución, etc). Coords EXACTAS — navegables públicamente. expires_at default +7d para forzar refresh.';

-- ─── shelters (compat con PLAN — alias estructurado) ─────────────────────────

create or replace view shelters_view as
select
  a.id,
  a.name,
  o.name as organization,
  a.location_point,
  ST_Y(a.location_point::geometry) as lat,
  ST_X(a.location_point::geometry) as lng,
  a.address_text,
  a.landmark,
  a.entrance_notes,
  a.capacity_current,
  a.capacity_max,
  a.supplies_available,
  a.schedule,
  a.verified,
  a.last_updated_at,
  a.expires_at,
  a.active
from aid_points a
left join organizations o on o.id = a.organization_id
where a.type in ('shelter_temporary', 'shelter_permanent') and a.active = true and a.expires_at > now();

grant select on shelters_view to anon;

-- ─── ai_conversations ─────────────────────────────────────────────────────────

do $$ begin
  create type ai_role as enum ('user', 'assistant', 'system');
exception when duplicate_object then null; end $$;

create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  ip_hashed text,
  role ai_role not null,
  content text not null,
  tokens_in int default 0,
  tokens_out int default 0,
  model text,
  cost_usd numeric(10,6) default 0,
  cached bool default false,
  source text default 'faq_chat',  -- 'faq_chat' | 'triage' | 'health' | 'match_review'
  created_at timestamptz not null default now()
);

create index if not exists ai_conv_session_idx
  on ai_conversations (session_id, created_at);
create index if not exists ai_conv_ip_window_idx
  on ai_conversations (ip_hashed, created_at desc) where ip_hashed is not null;
create index if not exists ai_conv_source_date_idx
  on ai_conversations (source, created_at desc);

-- Retención 30d: cron purga contenido viejo dejando solo métricas agregadas.
comment on column ai_conversations.content is 'Purgado a 30d (cron). Solo métricas retenidas para billing y debugging.';

alter table ai_conversations enable row level security;
revoke all on ai_conversations from anon, authenticated;
-- Solo service_role accede via Edge Functions / Workers.

-- ─── ai_budget_daily ──────────────────────────────────────────────────────────

create table if not exists ai_budget_daily (
  id uuid primary key default gen_random_uuid(),
  date date unique not null default current_date,
  spent_usd numeric(10,4) not null default 0,
  queries int not null default 0,
  cached_hits int not null default 0,
  haiku_calls int default 0,
  sonnet_calls int default 0,
  blocked_by_budget int default 0,
  last_updated timestamptz not null default now()
);

create or replace function ai_budget_charge(p_usd numeric, p_model text, p_cached bool)
returns numeric
language plpgsql
as $$
declare
  today_spent numeric;
begin
  insert into ai_budget_daily (date, spent_usd, queries,
                                cached_hits, haiku_calls, sonnet_calls)
  values (
    current_date, p_usd, 1,
    case when p_cached then 1 else 0 end,
    case when p_model like '%haiku%' then 1 else 0 end,
    case when p_model like '%sonnet%' then 1 else 0 end
  )
  on conflict (date) do update
    set spent_usd = ai_budget_daily.spent_usd + excluded.spent_usd,
        queries = ai_budget_daily.queries + 1,
        cached_hits = ai_budget_daily.cached_hits + excluded.cached_hits,
        haiku_calls = ai_budget_daily.haiku_calls + excluded.haiku_calls,
        sonnet_calls = ai_budget_daily.sonnet_calls + excluded.sonnet_calls,
        last_updated = now()
  returning spent_usd into today_spent;
  return today_spent;
end;
$$;

create or replace function ai_budget_blocked()
returns int
language plpgsql
as $$
begin
  insert into ai_budget_daily (date, blocked_by_budget)
  values (current_date, 1)
  on conflict (date) do update
    set blocked_by_budget = ai_budget_daily.blocked_by_budget + 1,
        last_updated = now();
  return 1;
end;
$$;

alter table ai_budget_daily enable row level security;
revoke all on ai_budget_daily from anon, authenticated;
grant select on ai_budget_daily to authenticated;

drop policy if exists ai_budget_admin_read on ai_budget_daily;
create policy ai_budget_admin_read
  on ai_budget_daily for select
  to authenticated
  using (coalesce(auth.jwt() ->> 'role' in ('admin','moderator'), false));
