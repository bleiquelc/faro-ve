-- ─────────────────────────────────────────────────────────────────────────────
-- 0006_moderators_sources_audit.sql
-- Tablas administrativas: moderators, import_sources, audit_log particionado,
-- anchor_places (autocomplete de lugares).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── moderators ───────────────────────────────────────────────────────────────

do $$ begin
  create type moderator_role as enum ('admin', 'moderator');
exception when duplicate_object then null; end $$;

create table if not exists moderators (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  email_hash text generated always as (encode(digest(lower(email), 'sha256'), 'hex')) stored,
  full_name text,
  role moderator_role not null default 'moderator',
  organization text,
  active bool not null default true,
  invited_by uuid references moderators(id),
  invited_at timestamptz default now(),
  last_login_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists moderators_email_idx on moderators (email) where active = true;

comment on table moderators is 'Moderadores autorizados (magic-link auth). El founder es admin. Voluntarios verificados son moderator.';

alter table moderators enable row level security;

drop policy if exists moderators_self_or_admin on moderators;
create policy moderators_self_or_admin
  on moderators for select
  to authenticated
  using (
    email = (auth.jwt() ->> 'email')
    or coalesce(auth.jwt() ->> 'role' = 'admin', false)
  );

drop policy if exists moderators_admin_modify on moderators;
create policy moderators_admin_modify
  on moderators for all
  to authenticated
  using (coalesce(auth.jwt() ->> 'role' = 'admin', false))
  with check (coalesce(auth.jwt() ->> 'role' = 'admin', false));

-- Backfill: moderator_id → persons.moderated_by, etc.
alter table persons
  drop constraint if exists persons_moderated_by_fk,
  add  constraint persons_moderated_by_fk
    foreign key (moderated_by) references moderators(id) on delete set null;

alter table notes
  drop constraint if exists notes_moderated_by_fk,
  add  constraint notes_moderated_by_fk
    foreign key (moderated_by) references moderators(id) on delete set null;

-- ─── import_sources ──────────────────────────────────────────────────────────

do $$ begin
  create type source_trust as enum ('auto_approved', 'pending_review', 'disabled');
exception when duplicate_object then null; end $$;

create table if not exists import_sources (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  base_url text not null,
  robots_url text,
  robots_allowed bool,
  robots_checked_at timestamptz,
  trust source_trust not null default 'pending_review',
  schedule_cron text default '0 */6 * * *',
  contact_email text,
  contact_opt_out_received_at timestamptz,
  last_run_at timestamptz,
  last_run_status text,
  last_run_imported int,
  last_run_duplicates int,
  last_run_errors int,
  total_imported int default 0,
  enabled bool not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists import_sources_enabled_idx on import_sources (enabled, trust);

drop trigger if exists trg_import_sources_touch on import_sources;
create trigger trg_import_sources_touch
  before update on import_sources
  for each row execute function touch_updated_at();

-- Seed inicial — sources del PLAN
insert into import_sources (slug, name, base_url, trust, schedule_cron, enabled, notes) values
  ('desaparecidos-terremoto-ve', 'Desaparecidos Terremoto Venezuela', 'https://desaparecidosterremotovenezuela.com', 'pending_review', '0 */6 * * *', true, 'D-0 outreach federación + check robots primera corrida'),
  ('sos-venezuela-2026', 'SOS Venezuela 2026', 'https://sosvenezuela2026.com', 'pending_review', '0 */6 * * *', true, 'D-0 outreach federación + check robots'),
  ('cruz-roja-ve', 'Cruz Roja Venezolana RFL', 'https://cruzrojavenezolana.org', 'pending_review', '0 */6 * * *', false, 'Activar tras confirmación federación PFIF'),
  ('icrc-trace-the-face', 'ICRC Trace the Face', 'https://familylinks.icrc.org', 'pending_review', '0 */6 * * *', false, 'Activar tras confirmación federación PFIF'),
  ('cicpc-ve', 'CICPC Venezuela', 'https://www.cicpc.gob.ve', 'pending_review', '0 */12 * * *', false, 'Activar tras confirmación pública'),
  ('defensoria-ve', 'Defensoría del Pueblo VE', 'https://www.defensoria.gob.ve', 'pending_review', '0 */12 * * *', false, 'Activar tras confirmación pública'),
  ('medios-ve-rss', 'Medios VE (RSS Efecto Cocuyo / RunRun / La Patilla / El Nacional)', 'rss://multi', 'pending_review', '0 */3 * * *', false, 'Activar D4 cuando adapters listos')
on conflict (slug) do update
  set name = excluded.name,
      base_url = excluded.base_url,
      notes = excluded.notes,
      updated_at = now();

-- ─── audit_log particionado por mes ──────────────────────────────────────────

create table if not exists audit_log (
  id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_type text not null,           -- 'system' | 'moderator' | 'admin' | 'cron' | 'public'
  actor_id text,                       -- moderator_id | source_slug | 'ip:<hash>'
  action text not null,                -- 'insert' | 'update' | 'delete' | 'approve' | 'reject' | 'purge' | 'opt_out' | 'login' | 'export'
  entity_type text not null,           -- 'person' | 'note' | 'link' | 'message' | 'source' | 'moderator'
  entity_id text,
  diff jsonb,
  reason text,
  ip_hashed text,
  user_agent text,
  primary key (id, created_at)
) partition by range (created_at);

comment on table audit_log is 'Append-only audit. Partición mensual para purga selectiva.';

-- Particiones jul-2026 a dic-2026 (suficiente para v0.1; cron crea siguientes)
create table if not exists audit_log_2026_07 partition of audit_log
  for values from ('2026-07-01') to ('2026-08-01');
create table if not exists audit_log_2026_08 partition of audit_log
  for values from ('2026-08-01') to ('2026-09-01');
create table if not exists audit_log_2026_09 partition of audit_log
  for values from ('2026-09-01') to ('2026-10-01');
create table if not exists audit_log_2026_10 partition of audit_log
  for values from ('2026-10-01') to ('2026-11-01');
create table if not exists audit_log_2026_11 partition of audit_log
  for values from ('2026-11-01') to ('2026-12-01');
create table if not exists audit_log_2026_12 partition of audit_log
  for values from ('2026-12-01') to ('2027-01-01');
-- jun-2026 (mes inicial)
create table if not exists audit_log_2026_06 partition of audit_log
  for values from ('2026-06-01') to ('2026-07-01');
-- Partición DEFAULT: red de seguridad para fechas fuera de los rangos anteriores
-- (ej: inserts en 2027 antes de que el cron cree la partición del mes). Evita
-- que un INSERT en audit_log falle por falta de partición y rompa la operación.
create table if not exists audit_log_default partition of audit_log default;

create index if not exists audit_log_entity_idx
  on audit_log (entity_type, entity_id, created_at desc);
create index if not exists audit_log_action_idx
  on audit_log (action, created_at desc);
create index if not exists audit_log_actor_idx
  on audit_log (actor_type, actor_id, created_at desc);

-- Trigger genérico audit
create or replace function trg_audit_persons()
returns trigger language plpgsql security definer as $$
begin
  insert into audit_log (actor_type, actor_id, action, entity_type, entity_id, diff)
  values (
    coalesce(auth.jwt() ->> 'role', 'public'),
    coalesce(auth.jwt() ->> 'sub', null),
    lower(tg_op),
    'person',
    coalesce(new.id, old.id)::text,
    case
      when tg_op = 'INSERT' then jsonb_build_object('new', to_jsonb(new))
      when tg_op = 'UPDATE' then jsonb_build_object(
        'before', to_jsonb(old) - 'reporter_email_encrypted' - 'reporter_phone_encrypted',
        'after',  to_jsonb(new) - 'reporter_email_encrypted' - 'reporter_phone_encrypted'
      )
      when tg_op = 'DELETE' then jsonb_build_object('deleted', jsonb_build_object('id', old.id))
    end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_persons_audit on persons;
create trigger trg_persons_audit
  after insert or update or delete on persons
  for each row execute function trg_audit_persons();

create or replace function trg_audit_notes()
returns trigger language plpgsql security definer as $$
begin
  insert into audit_log (actor_type, actor_id, action, entity_type, entity_id, diff)
  values (
    coalesce(auth.jwt() ->> 'role', 'public'),
    coalesce(auth.jwt() ->> 'sub', null),
    lower(tg_op),
    'note',
    coalesce(new.id, old.id)::text,
    case
      when tg_op = 'INSERT' then jsonb_build_object('new', to_jsonb(new))
      when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
      when tg_op = 'DELETE' then jsonb_build_object('deleted', jsonb_build_object('id', old.id))
    end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_notes_audit on notes;
create trigger trg_notes_audit
  after insert or update or delete on notes
  for each row execute function trg_audit_notes();

-- audit_log es solo escritura para todos los roles excepto admin SELECT
alter table audit_log enable row level security;
revoke all on audit_log from anon, authenticated;
grant insert on audit_log to authenticated;

drop policy if exists audit_log_admin_select on audit_log;
create policy audit_log_admin_select
  on audit_log for select
  to authenticated
  using (coalesce(auth.jwt() ->> 'role' = 'admin', false));

-- ─── anchor_places ───────────────────────────────────────────────────────────
-- Definida en 0005_anchor_places_seed.sql (junto a su seed), porque el seed
-- corre antes que este archivo y necesita la tabla creada.
