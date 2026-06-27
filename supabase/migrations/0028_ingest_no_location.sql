-- 0028 — Ingerir personas SIN ubicación geocodificable (que nadie quede sin
-- posibilidad de ser ubicado).
--
-- Problema: la RPC 0025 EXCLUÍA todo registro sin lat/lng (`where lat is not null
-- and lng is not null`), así que ~15% de la fuente (~5.600 personas cuya última
-- ubicación no geocodifica) NO se guardaban → ni siquiera buscables por nombre.
--
-- Cambio (aditivo, mínimo): se acepta el registro con `last_known_location_point`
-- NULL cuando no hay coords. La persona entra como buscable por nombre y con su
-- ubicación en TEXTO (last_known_location_text); simplemente no tiene pin en el
-- mapa. El resto es BYTE-IDÉNTICO a 0025:
--   · idempotente por (source, source_id),
--   · trigger de ofuscación tolera punto null (0017: `if p is null then return null`),
--   · foto de menores → admin_only por trigger,
--   · solo service_role ejecuta la función.
--
-- persons_public NO filtra por coords (solo approved + no-withdrawn), así que la
-- fila aparece en la vista con lat/lng = null. El mapa la omite (no hay pin); la
-- BÚSQUEDA por nombre y la ficha sí la muestran (con "sin localización").

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
      -- Punto SOLO si hay coords; sin coords → null (persona sin pin, igual buscable).
      case
        when (r->>'lat') is not null and (r->>'lng') is not null
          then ST_SetSRID(ST_MakePoint((r->>'lng')::float8, (r->>'lat')::float8), 4326)::geography
        else null
      end,
      'approved'::moderation_status_type
    where (r->>'source_id') is not null
      and (r->>'source') is not null
      -- (0028: se quitó el filtro lat/lng not null → entran los sin localización)
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

-- Solo el rol de servicio (Worker / script del Mac) la usa; nunca anon/authenticated.
revoke all on function ingest_persons_batch(jsonb) from public;
revoke all on function ingest_persons_batch(jsonb) from anon;
revoke all on function ingest_persons_batch(jsonb) from authenticated;
grant execute on function ingest_persons_batch(jsonb) to service_role;

comment on function ingest_persons_batch(jsonb) is
  'Insert en lote idempotente (source,source_id) de la ingesta. 0028: acepta registros SIN coords (punto null) → buscables por nombre aunque no tengan pin en el mapa. Solo service_role.';
