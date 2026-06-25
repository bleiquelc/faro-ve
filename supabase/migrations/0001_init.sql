-- ─────────────────────────────────────────────────────────────────────────────
-- 0001_init.sql — Faro VE schema base
-- PFIF v1.4 (http://zesty.ca/pfif/1.4/) + extensiones humanitarias
-- ─────────────────────────────────────────────────────────────────────────────

-- Extensiones requeridas
create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists fuzzystrmatch;
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- ─── unaccent_immutable (helper IMMUTABLE para generated columns) ─────────────
-- DEBE definirse ANTES de la tabla persons: la columna generada
-- full_name_normalized la invoca, y Postgres exige que toda función referenciada
-- por una expresión GENERATED ALWAYS exista en el momento del CREATE TABLE.
-- (No usamos la extensión unaccent porque su función es STABLE, no IMMUTABLE,
-- y por tanto ilegal en columnas generadas.)

create or replace function unaccent_immutable(t text)
returns text
language sql
immutable strict parallel safe
as $$
  select translate(
    coalesce(t, ''),
    'áéíóúÁÉÍÓÚñÑäëïöüÄËÏÖÜâêîôûÂÊÎÔÛçÇ',
    'aeiouAEIOUnNaeiouAEIOUaeiouAEIOUcC'
  );
$$;

-- ─── Enums ────────────────────────────────────────────────────────────────────

do $$ begin
  create type person_status as enum (
    'missing',
    'found_alive',
    'found_deceased_morgue',
    'unidentified_body',
    'safe_self_report',
    'hospitalized',
    'sheltered',
    'withdrawn'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type sex_type as enum ('male', 'female', 'other', 'unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type moderation_status_type as enum (
    'pending',
    'approved',
    'rejected',
    'duplicate',
    'needs_info'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type photo_visibility_type as enum ('public', 'admin_only', 'none');
exception when duplicate_object then null; end $$;

do $$ begin
  create type medical_category_type as enum (
    'chronic_disease',
    'dialysis',
    'oxygen_dependent',
    'insulin_dependent',
    'pregnancy',
    'pediatric_critical',
    'mental_health',
    'mobility_impaired',
    'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type note_type as enum (
    'sighting',
    'info_update',
    'family_message',
    'moderator_note',
    'status_change',
    'media_release'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type link_type as enum (
    'same_group',
    'possible_match',
    'confirmed_match',
    'family',
    'duplicate'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type reporter_relation as enum (
    'self',
    'family',
    'friend',
    'witness',
    'authority',
    'volunteer',
    'media',
    'unknown'
  );
exception when duplicate_object then null; end $$;

-- ─── persons (PFIF v1.4 + Faro VE extensions) ────────────────────────────────

create table if not exists persons (
  -- PFIF v1.4 identificación
  id uuid primary key default gen_random_uuid(),
  pfif_id text unique not null default ('faro-ve.com/' || gen_random_uuid()::text),
  pfif_version text not null default '1.4',
  source text not null default 'faro-ve',
  source_id text,
  source_url text,
  source_record_url text,
  source_date timestamptz default now(),

  -- PFIF nombre
  full_name text generated always as (
    trim(coalesce(given_name, '') || ' ' || coalesce(family_name, ''))
  ) stored,
  given_name text,
  family_name text,
  alternate_names text[],
  full_name_normalized text generated always as (
    lower(unaccent_immutable(trim(coalesce(given_name, '') || ' ' || coalesce(family_name, ''))))
  ) stored,

  -- PFIF demográficos
  sex sex_type default 'unknown',
  date_of_birth date,
  age int check (age is null or (age >= 0 and age <= 130)),
  age_unit text default 'years',

  -- PFIF última ubicación conocida
  home_street text,
  home_neighborhood text,
  home_city text default 'Caracas',
  home_state text default 'Distrito Capital',
  home_postal_code text,
  home_country text default 'VE',
  last_known_location_text text,
  last_known_location_point geography(Point, 4326),      -- EXACTO — sólo moderadores
  last_known_location_obfuscated geography(Point, 4326), -- 200-500m random offset — público
  last_seen_at timestamptz,

  -- Descripción física PFIF + Faro VE
  description text,
  height_cm int,
  weight_kg int,
  hair_color text,
  eye_color text,
  skin_tone text,
  clothing_top text,
  clothing_bottom text,
  clothing_shoes text,
  clothing_accessories text,
  distinguishing_marks text,
  birth_marks text,
  scars text,
  tattoos text,

  -- PFIF foto
  photo_url text,
  photo_visibility photo_visibility_type not null default 'public',

  -- Estado Faro VE
  status person_status not null default 'missing',
  is_minor bool generated always as (
    case when age is null then false else age < 18 end
  ) stored,
  unaccompanied_minor bool default false,

  -- Urgencia médica
  medical_urgent bool not null default false,
  medical_category medical_category_type,
  medical_notes text,

  -- Reportante (PII protegida)
  reporter_relation reporter_relation default 'unknown',
  reporter_country text,
  reporter_name text,
  reporter_email_hash text,        -- sha256(lower(email) || APP_SALT)
  reporter_email_encrypted bytea,  -- pgp_sym_encrypt
  reporter_email_invalid bool default false,
  reporter_phone_hash text,
  reporter_phone_encrypted bytea,
  reporter_ip_hashed text,         -- sha256(ip || APP_SALT) — nunca IP plana
  reporter_consent_relay bool default true,

  -- Auto-reporte "estoy a salvo" — opt-in para mostrar coord exacta
  share_exact_location_with_searchers bool not null default false,

  -- Moderación
  moderation_status moderation_status_type not null default 'pending',
  moderated_by uuid,           -- fk a moderators (en 0006)
  moderated_at timestamptz,
  moderation_notes text,
  ai_priority int check (ai_priority is null or (ai_priority between 0 and 100)),
  ai_reasoning text,
  ai_classified_at timestamptz,

  -- Federación PFIF
  feed_url text,
  expiry_date timestamptz default (now() + interval '60 days'),

  -- Reconocimiento facial (FACE_MATCH_ENABLED=false en v0.1)
  face_embedding text,   -- placeholder; pgvector opcional v0.2 — NO instalado en v0.1
  face_embedding_quality int,

  -- Edit token TTL 7d (sin cuenta)
  edit_token_hash text,
  edit_token_expires_at timestamptz,

  -- Cliente offline idempotencia
  client_uuid text,

  -- Auditoría
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  purge_pii_at timestamptz,    -- =withdrawn_at + 30d; cron purga PII

  -- Constraints PFIF
  constraint persons_pfif_id_format check (pfif_id ~ '^[a-zA-Z0-9.\-_:/]+$'),
  constraint persons_source_required check (length(trim(source)) > 0),
  constraint persons_obfuscation_complete check (
    (last_known_location_point is null and last_known_location_obfuscated is null)
    or (last_known_location_point is not null and last_known_location_obfuscated is not null)
  )
);

comment on table persons is 'Personas reportadas — PFIF v1.4 + extensiones Faro VE. last_known_location_point es EXACTO (solo moderadores). last_known_location_obfuscated es 200-500m random (público vía persons_public view). PII reportante hasheada+encriptada.';

-- ─── notes (PFIF note_record + avistamientos Faro VE) ────────────────────────

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  pfif_id text unique not null default ('faro-ve.com/' || gen_random_uuid()::text),
  person_id uuid not null references persons(id) on delete cascade,

  -- PFIF note fields
  source text not null default 'faro-ve',
  source_date timestamptz default now(),
  author_name text,
  author_email_hash text,
  author_email_encrypted bytea,
  author_phone_hash text,
  author_phone_encrypted bytea,
  author_made_contact bool default false,

  type note_type not null default 'info_update',
  text text not null,

  -- Avistamiento (subtipo type='sighting')
  sighting_location_text text,
  sighting_location_point geography(Point, 4326),       -- EXACTO moderadores
  sighting_location_obfuscated geography(Point, 4326),  -- público
  sighting_date timestamptz,

  -- Status update (subtipo type='status_change')
  status_change person_status,

  -- Moderación independiente
  moderation_status moderation_status_type not null default 'pending',
  moderated_by uuid,
  moderated_at timestamptz,
  hidden bool default false,

  ip_hashed text,
  client_uuid text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table notes is 'PFIF notes + avistamientos. Coords sighting también obfuscated cuando se exponen al público.';

-- ─── links (vínculos persons↔persons) ────────────────────────────────────────

create table if not exists links (
  id uuid primary key default gen_random_uuid(),
  source_person_id uuid not null references persons(id) on delete cascade,
  target_person_id uuid not null references persons(id) on delete cascade,
  type link_type not null,
  confidence numeric(5, 2),   -- 0-100; nulo para family/same_group
  reasons jsonb,              -- {name_score, geo_score, age_score, ...}
  auto_suggested bool not null default false,
  confirmed_by uuid,
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint links_no_self check (source_person_id <> target_person_id),
  constraint links_confidence_range check (
    confidence is null or (confidence >= 0 and confidence <= 100)
  )
);

create unique index if not exists links_unique_pair
  on links (least(source_person_id, target_person_id), greatest(source_person_id, target_person_id), type);

comment on table links is 'Vínculos entre persons: same_group (familia/grupo viaje), possible_match (score 70-85), confirmed_match (moderador), family, duplicate.';

-- ─── messages (relay anti-PII) ───────────────────────────────────────────────

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references persons(id) on delete cascade,

  -- Remitente (anónimo público)
  sender_name text,
  sender_email_hash text not null,
  sender_email_encrypted bytea,    -- nunca exponer al reportante
  sender_country text,
  sender_ip_hashed text not null,

  -- Contenido
  subject text not null,
  body text not null,
  body_language text default 'es',

  -- Relay state
  delivered_to_reporter bool default false,
  delivered_at timestamptz,
  resend_email_id text,
  bounced bool default false,
  reply_token_hash text,
  reply_token_expires_at timestamptz,
  reply_used bool default false,

  -- Moderación opcional
  moderation_status moderation_status_type default 'approved',
  hidden bool default false,

  created_at timestamptz not null default now()
);

comment on table messages is 'Relay anti-PII. El remitente NUNCA ve el email destinatario. La respuesta vía reply_token también pasa por relay.';

-- ─── searches_active (polígonos de búsqueda activa) ──────────────────────────

create table if not exists searches_active (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization text,
  description text,
  area geography(MultiPolygon, 4326) not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  contact_relay_message_id uuid,
  created_at timestamptz not null default now()
);

-- ─── updated_at touch trigger reusable ───────────────────────────────────────

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_persons_touch on persons;
create trigger trg_persons_touch
  before update on persons
  for each row execute function touch_updated_at();

drop trigger if exists trg_notes_touch on notes;
create trigger trg_notes_touch
  before update on notes
  for each row execute function touch_updated_at();

-- ═════════════════════════════════════════════════════════════════════════════
-- VISTAS PÚBLICAS — única superficie de lectura para 'anon'.
--
-- Patrón "security barrier view": en 0003 se REVOCA SELECT directo a las tablas
-- persons/notes para anon, y se concede SELECT solo a estas vistas. La vista
-- corre como su dueño (SECURITY DEFINER por defecto en Postgres) → es el único
-- portal controlado: filtra approved + no-withdrawn y enmascara columnas
-- sensibles (coords exactas, PII reportante, foto de menores).
--
-- Se definen AQUÍ (no en 0004) porque 0003 (RLS + grants) corre antes que 0004
-- y necesita que las vistas ya existan. security_barrier=true evita que el
-- optimizador filtre predicados que infieran filas ocultas.
-- NO usar security_invoker=on: anon no tiene SELECT sobre la tabla base, así que
-- un invoker view devolvería 0 filas — el barrier definer es intencional.
-- ═════════════════════════════════════════════════════════════════════════════

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
  -- ⚠ NUNCA last_known_location_point — solo obfuscated
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
  -- Foto: NULL si menor o admin_only
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
  -- Coord exacta SOLO si el sujeto opt-in explicit (auto-reporte "a salvo")
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
  p.expiry_date
from persons p
where p.moderation_status = 'approved' and p.withdrawn_at is null;

comment on view persons_public is
  'ÚNICA superficie pública para personas. Excluye coords exactas (salvo opt-in safe_self_report), email/phone reportante, photo si admin_only, registros pending/rejected/withdrawn.';

create or replace view notes_public
with (security_barrier = true)
as
select
  n.id,
  n.pfif_id,
  n.person_id,
  n.source,
  n.type,
  n.text,
  n.sighting_location_text,
  n.sighting_location_obfuscated,
  case when n.sighting_location_obfuscated is not null
    then ST_Y(n.sighting_location_obfuscated::geometry) end as sighting_lat,
  case when n.sighting_location_obfuscated is not null
    then ST_X(n.sighting_location_obfuscated::geometry) end as sighting_lng,
  n.sighting_date,
  n.status_change,
  n.created_at
from notes n
where n.moderation_status = 'approved' and not n.hidden;

comment on view notes_public is 'Notas públicas (avistamientos, info_updates, status_changes). Coord sighting siempre obfuscated.';
