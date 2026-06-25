-- ─────────────────────────────────────────────────────────────────────────────
-- 0008_app_salt_config.sql
-- Mecanismo de APP_SALT compatible con Supabase.
--
-- Supabase no permite `ALTER DATABASE ... SET app.salt` con el rol postgres
-- (permission denied to set parameter). En su lugar guardamos el salt en una
-- tabla privada app_config con RLS deny-all, y get_app_salt() la lee como
-- SECURITY DEFINER. El VALOR del salt NO vive en esta migración (el repo es
-- público) — lo inserta scripts/apply-migrations.mjs --salt leyendo de
-- ~/.secrets/faro-ve/APP_SALT.txt.
-- ─────────────────────────────────────────────────────────────────────────────

-- Tabla privada de configuración runtime. Solo service_role (bypass RLS) y el
-- owner la leen. anon/authenticated NO tienen acceso (sin policies + revoke).
create table if not exists app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table app_config enable row level security;
revoke all on app_config from anon, authenticated, public;
-- Sin policies de SELECT para anon/authenticated → no pueden leer el salt.

-- get_app_salt: ahora lee de app_config (no de current_setting). SECURITY
-- DEFINER para poder leer la tabla privada; EXECUTE revocado de anon/authenticated
-- para que nadie público pueda extraer el salt vía RPC; concedido a service_role
-- (backend) y a los roles internos que lo necesitan.
create or replace function get_app_salt()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare s text;
begin
  select value into s from app_config where key = 'app_salt';
  if s is null or length(s) < 32 then
    raise exception 'APP_SALT no configurado (app_config key=app_salt o muy corto). Corre apply-migrations.mjs --salt';
  end if;
  return s;
end;
$$;

revoke all on function get_app_salt() from public, anon, authenticated;
grant execute on function get_app_salt() to service_role;

-- Las funciones que derivan del salt también solo para backend.
revoke all on function hash_email(text) from public, anon, authenticated;
revoke all on function hash_phone(text) from public, anon, authenticated;
revoke all on function hash_ip(text) from public, anon, authenticated;
revoke all on function encrypt_pii(text) from public, anon, authenticated;
grant execute on function hash_email(text) to service_role;
grant execute on function hash_phone(text) to service_role;
grant execute on function hash_ip(text) to service_role;
grant execute on function encrypt_pii(text) to service_role;
