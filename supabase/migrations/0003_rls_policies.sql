-- ─────────────────────────────────────────────────────────────────────────────
-- 0003_rls_policies.sql
-- Row Level Security: privacidad por diseño a nivel DB.
-- Si un endpoint olvida filtrar, la DB lo enforza igualmente.
-- ─────────────────────────────────────────────────────────────────────────────

-- Habilitar RLS en tablas sensibles
alter table persons enable row level security;
alter table notes   enable row level security;
alter table links   enable row level security;
alter table messages enable row level security;
alter table searches_active enable row level security;

-- ═════════════════════════════════════════════════════════════════════════════
-- Roles asumidos (provistos por Supabase):
--   anon          → visitante público
--   authenticated → moderadores con magic-link login
--   service_role  → backend (Edge Functions / Workers) — bypass RLS
-- Adicional: claim 'role' en JWT puede ser 'moderator' | 'admin' | 'org'
-- ═════════════════════════════════════════════════════════════════════════════

-- helpers
create or replace function auth_is_moderator()
returns boolean
language sql stable
as $$
  select coalesce(
    auth.jwt() ->> 'role' in ('moderator', 'admin', 'service_role'),
    false
  );
$$;

create or replace function auth_is_admin()
returns boolean
language sql stable
as $$
  select coalesce(auth.jwt() ->> 'role' = 'admin', false);
$$;

-- ─── persons ──────────────────────────────────────────────────────────────────

-- Público lee SÓLO vía persons_public view, no la tabla directa.
-- Eliminamos cualquier policy SELECT permisiva para anon en la tabla persons.
drop policy if exists persons_public_select on persons;

-- Anon NO puede SELECT directo a persons. Toda lectura pública pasa por
-- persons_public view (que internamente filtra approved + non-withdrawn y
-- enmascara campos sensibles).
revoke select on persons from anon;
grant  select on persons_public to anon;
grant  select on notes_public   to anon;

-- Anon puede INSERT solo con moderation_status='pending'.
drop policy if exists persons_anon_insert_pending on persons;
create policy persons_anon_insert_pending
  on persons for insert
  to anon
  with check (moderation_status = 'pending');

-- Anon NO puede UPDATE/DELETE.
-- (edit_token JWT da edición vía RPC server-side, no via row policy directa.)

-- Moderador autenticado: SELECT todo + UPDATE moderation_status y campos.
drop policy if exists persons_mod_select on persons;
create policy persons_mod_select
  on persons for select
  to authenticated
  using (auth_is_moderator());

drop policy if exists persons_mod_update on persons;
create policy persons_mod_update
  on persons for update
  to authenticated
  using (auth_is_moderator())
  with check (auth_is_moderator());

-- Admin: DELETE permitido (purga Habeas Data ejecutada por cron).
drop policy if exists persons_admin_delete on persons;
create policy persons_admin_delete
  on persons for delete
  to authenticated
  using (auth_is_admin());

-- ─── notes ────────────────────────────────────────────────────────────────────

revoke select on notes from anon;
grant  select on notes_public to anon;

drop policy if exists notes_anon_insert on notes;
create policy notes_anon_insert
  on notes for insert
  to anon
  with check (moderation_status = 'pending');

drop policy if exists notes_mod_select on notes;
create policy notes_mod_select
  on notes for select
  to authenticated
  using (auth_is_moderator());

drop policy if exists notes_mod_update on notes;
create policy notes_mod_update
  on notes for update
  to authenticated
  using (auth_is_moderator())
  with check (auth_is_moderator());

-- ─── links ────────────────────────────────────────────────────────────────────

-- Solo moderadores ven/modifican links.
drop policy if exists links_mod_all on links;
create policy links_mod_all
  on links for all
  to authenticated
  using (auth_is_moderator())
  with check (auth_is_moderator());

-- ─── messages ─────────────────────────────────────────────────────────────────

-- Anon puede INSERT (con relay). NO puede SELECT (jamás expone email destinatario).
drop policy if exists messages_anon_insert on messages;
create policy messages_anon_insert
  on messages for insert
  to anon
  with check (true);  -- el server-side handler hace la validación

revoke select, update, delete on messages from anon;

drop policy if exists messages_mod_select on messages;
create policy messages_mod_select
  on messages for select
  to authenticated
  using (auth_is_moderator());

-- ─── searches_active ─────────────────────────────────────────────────────────

grant select on searches_active to anon;
-- Lectura pública OK (polígono de búsqueda activa es info útil al ciudadano).

drop policy if exists searches_anon_select on searches_active;
create policy searches_anon_select
  on searches_active for select
  to anon
  using (
    starts_at <= now()
    and (ends_at is null or ends_at >= now())
  );

drop policy if exists searches_mod_all on searches_active;
create policy searches_mod_all
  on searches_active for all
  to authenticated
  using (auth_is_moderator())
  with check (auth_is_moderator());
