-- ─────────────────────────────────────────────────────────────────────────────
-- 0029_enrich_and_reencuentros.sql · "Un solo trabajo": el cruce de datos
--   (1) ENRIQUECE la base de Faro con la info de otras plataformas (rellena
--       faltantes, no pisa lo bueno), y
--   (2) registra REENCUENTROS: personas buscadas en Faro que otra plataforma
--       reporta A SALVO/ENCONTRADA → para avisar a la familia + lista pública.
--
-- ADITIVA: nueva tabla + columnas + función + vista. NO toca persons_public ni el
-- enum person_status (el monitor de búsquedas de la otra sesión sigue intacto).
-- Aplicar en el SQL Editor de Supabase (un solo pegado).
-- ─────────────────────────────────────────────────────────────────────────────

-- Auditoría de enriquecimiento
alter table persons add column if not exists enriched_at timestamptz;
alter table persons add column if not exists enrich_sources text[] default '{}';

-- (1) Señales de reencuentro: una persona puede tener varias (por fuente).
create table if not exists person_found_signals (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references persons(id) on delete cascade,
  source text not null,                  -- 'venezuela-reporta', 'venezuela-te-busca', ...
  source_url text,                       -- ficha original (vía para contactar a la familia)
  found_status text,                     -- 'a_salvo' | 'encontrado' | ...
  quote text,                            -- frase textual de la fuente
  where_text text,                       -- lugar/hospital si se menciona
  confidence text default 'medium',      -- 'high' | 'medium'
  review_status text default 'pending',  -- 'pending' | 'confirmed' | 'dismissed'
  detected_at timestamptz default now(),
  unique (person_id, source_url)
);
create index if not exists pfs_person_idx on person_found_signals(person_id);
create index if not exists pfs_review_idx on person_found_signals(review_status);

alter table person_found_signals enable row level security;
revoke all on person_found_signals from anon, authenticated; -- anon solo ve la vista filtrada

-- (2) enrich_person: RELLENA faltantes + registra señal. SOLO service_role.
-- NUNCA toca given/family_name (riesgo de mismatch), PII, coords, foto ni estado.
create or replace function enrich_person(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid := (payload->>'id')::uuid;
  v_desc text := nullif(trim(coalesce(payload->>'description','')), '');
  v_age  int  := nullif(payload->>'age','')::int;
  v_sex  sex_type := nullif(payload->>'sex','')::sex_type;
  v_loc  text := nullif(trim(coalesce(payload->>'last_known_location_text','')), '');
  v_src  text := nullif(payload->>'source','');
  v_alts text[];
  v_fs   jsonb := payload->'found_signal';
begin
  if v_id is null then raise exception 'enrich_person: falta id'; end if;
  if jsonb_typeof(payload->'alternate_names') = 'array' then
    v_alts := array(select jsonb_array_elements_text(payload->'alternate_names'));
  end if;

  update persons p set
    description = case
      when v_desc is not null and (p.description is null or length(v_desc) > length(coalesce(p.description,'')))
        then v_desc else p.description end,
    age = coalesce(p.age, v_age),
    sex = case when (p.sex is null or p.sex = 'unknown') and v_sex is not null then v_sex else p.sex end,
    last_known_location_text = case
      when v_loc is not null and (p.last_known_location_text is null or length(v_loc) > length(coalesce(p.last_known_location_text,'')))
        then v_loc else p.last_known_location_text end,
    alternate_names = case
      when v_alts is not null
        then (select array(select distinct e from unnest(coalesce(p.alternate_names,'{}') || v_alts) e where e is not null and e <> ''))
      else p.alternate_names end,
    enriched_at = now(),
    enrich_sources = (select array(select distinct e from unnest(coalesce(p.enrich_sources,'{}') || case when v_src is not null then array[v_src] else '{}'::text[] end) e))
  where p.id = v_id;

  if v_fs is not null and jsonb_typeof(v_fs) = 'object' then
    insert into person_found_signals (person_id, source, source_url, found_status, quote, where_text, confidence)
    values (v_id, coalesce(v_fs->>'source', v_src, 'externa'), nullif(v_fs->>'source_url',''),
            nullif(v_fs->>'found_status',''), nullif(v_fs->>'quote',''), nullif(v_fs->>'where_text',''),
            coalesce(nullif(v_fs->>'confidence',''), 'medium'))
    on conflict (person_id, source_url) do update
      set quote = excluded.quote, where_text = excluded.where_text,
          confidence = excluded.confidence, detected_at = now();
  end if;

  return jsonb_build_object('id', v_id, 'ok', true);
end;
$$;

revoke all on function enrich_person(jsonb) from public, anon, authenticated;
grant execute on function enrich_person(jsonb) to service_role;

-- (3) Vista pública de reencuentros (sin PII). Solo confianza ALTA o confirmadas
-- por un humano → evita darle falsa esperanza a una familia por un match dudoso.
create or replace view reencuentros_public with (security_barrier) as
  select pp.id, pp.full_name, pp.last_known_location_text,
         s.source, s.source_url, s.found_status, s.quote, s.where_text, s.confidence, s.detected_at
  from person_found_signals s
  join persons_public pp on pp.id = s.person_id
  where s.review_status <> 'dismissed'
    and (s.confidence = 'high' or s.review_status = 'confirmed');

grant select on reencuentros_public to anon, authenticated;

comment on function enrich_person(jsonb) is
  '0029: cruce en un solo paso — rellena datos faltantes de una persona (sin pisar lo bueno ni tocar PII/coords/foto/estado) y registra señales de reencuentro (a salvo/encontrada en otra plataforma). Solo service_role.';
