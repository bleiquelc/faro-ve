-- 0025 — Ingesta de venezuela-te-busca vía Worker cron-ingest.
--
-- Por qué: el host directo de Supabase es IPv6 y no se alcanza desde redes IPv4,
-- así que el script local de ingesta no corre en todos lados. El Worker (corre en
-- Cloudflare, que SÍ alcanza la DB) hace la ingesta de forma automática, sin
-- duplicar (idempotente por source_id) y con throttle ético.
--
-- Añade: (1) cursor de página por fuente, (2) la fila import_sources de la fuente,
-- (3) una RPC de insert en lote idempotente con PostGIS server-side.

-- (1) Cursor incremental por fuente (el Worker procesa N páginas por corrida).
alter table import_sources add column if not exists ingest_cursor int not null default 1;

-- (2) Alta/activación de la fuente (auto-aprobada; robots ya revisado: sin Disallow).
insert into import_sources
  (slug, name, base_url, trust, schedule_cron, enabled, robots_allowed, robots_checked_at, notes)
values
  ('venezuela-te-busca', 'Venezuela Te Busca', 'https://venezuelatebusca.com', 'auto_approved',
   '*/15 * * * *', true, true, now(),
   'Fuente pública de personas. Ingesta ética (UA identificada, 1 req/2s). Idempotente por source_id.')
on conflict (slug) do update
  set trust = 'auto_approved', enabled = true, robots_allowed = true, updated_at = now();

-- Índice para que el dedup (source, source_id) sea rápido con decenas de miles.
create index if not exists persons_source_sourceid_idx on persons (source, source_id);

-- (3) Insert en LOTE idempotente desde el Worker. Misma lógica probada del script
-- local (punto PostGIS server-side; el trigger de ofuscación llena el público y la
-- foto de menores queda admin_only). SECURITY DEFINER: el Worker usa service_role,
-- pero encapsulamos la lógica y revocamos el acceso público a la función.
create or replace function ingest_persons_batch(p_records jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  rc int;
  n int := 0;
begin
  for r in select value from jsonb_array_elements(coalesce(p_records, '[]'::jsonb)) loop
    insert into persons
      (source, source_id, source_url, given_name, family_name, age, sex, status,
       last_known_location_text, description, photo_url, last_known_location_point,
       moderation_status)
    select
      r->>'source',
      r->>'source_id',
      nullif(r->>'source_url', ''),
      nullif(r->>'given_name', ''),
      nullif(r->>'family_name', ''),
      nullif(r->>'age', '')::int,
      coalesce(nullif(r->>'sex', ''), 'unknown')::sex_type,
      (r->>'status')::person_status,
      nullif(r->>'last_known_location_text', ''),
      nullif(r->>'description', ''),
      nullif(r->>'photo_url', ''),
      ST_SetSRID(ST_MakePoint((r->>'lng')::float8, (r->>'lat')::float8), 4326)::geography,
      'approved'::moderation_status_type
    where (r->>'source_id') is not null
      and (r->>'source') is not null
      and (r->>'lat') is not null
      and (r->>'lng') is not null
      and not exists (
        select 1 from persons
        where source = r->>'source' and source_id = r->>'source_id'
      );
    get diagnostics rc = row_count;
    n := n + rc;
  end loop;
  return n;
end;
$$;

-- Solo el rol de servicio (Worker) la usa; nunca anon/authenticated.
revoke all on function ingest_persons_batch(jsonb) from public;
revoke all on function ingest_persons_batch(jsonb) from anon;
revoke all on function ingest_persons_batch(jsonb) from authenticated;
