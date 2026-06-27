-- ─────────────────────────────────────────────────────────────────────────────
-- 0023_app_flag_geo_switch.sql
-- Geo-interruptor del chat IA (global ⇄ solo-Venezuela) sin redeploy.
--
-- app_config tiene RLS deny-all (0008), así que el backend no puede leer flags
-- por SELECT directo. app_flag() los lee como SECURITY DEFINER (igual patrón que
-- get_app_salt), concedido solo a service_role. El endpoint /api/ai/ask llama
-- rpc('app_flag', {p_key:'ai_ve_only'}).
--
-- NOTA: el chat YA funciona en GLOBAL sin esta migración (si la RPC no existe,
-- el endpoint hace default = global). Esta migración solo HABILITA poder cambiar
-- a solo-Venezuela. Para encender solo-VE luego:
--   update app_config set value='true', updated_at=now() where key='ai_ve_only';
-- Para volver a global:
--   update app_config set value='false', updated_at=now() where key='ai_ve_only';
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function app_flag(p_key text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select value from app_config where key = p_key;
$$;

revoke all on function app_flag(text) from public, anon, authenticated;
grant execute on function app_flag(text) to service_role;

-- Estado inicial = GLOBAL (el founder prueba el chat desde Suiza antes de gatear).
insert into app_config (key, value) values ('ai_ve_only', 'false')
on conflict (key) do nothing;
