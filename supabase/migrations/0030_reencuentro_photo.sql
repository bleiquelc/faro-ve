-- ─────────────────────────────────────────────────────────────────────────────
-- 0030_reencuentro_photo.sql · Foto (limpia) en la lista de reencuentros.
--
-- Agrega `photo_url` a person_found_signals (la pasa el sembrador SOLO si la foto
-- pasó el filtro IA: nada de flyers/cédulas/menores). enrich_person la guarda y
-- reencuentros_public la expone. ADITIVA, no toca persons ni el resto.
-- Aplicar en el SQL Editor de Supabase (un solo pegado).
-- ─────────────────────────────────────────────────────────────────────────────

alter table person_found_signals add column if not exists photo_url text;

-- enrich_person: igual que 0029 + guarda found_signal.photo_url.
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
    insert into person_found_signals (person_id, source, source_url, found_status, quote, where_text, confidence, photo_url)
    values (v_id, coalesce(v_fs->>'source', v_src, 'externa'), nullif(v_fs->>'source_url',''),
            nullif(v_fs->>'found_status',''), nullif(v_fs->>'quote',''), nullif(v_fs->>'where_text',''),
            coalesce(nullif(v_fs->>'confidence',''), 'medium'), nullif(v_fs->>'photo_url',''))
    on conflict (person_id, source_url) do update
      set quote = excluded.quote, where_text = excluded.where_text, confidence = excluded.confidence,
          photo_url = coalesce(excluded.photo_url, person_found_signals.photo_url), detected_at = now();
  end if;

  return jsonb_build_object('id', v_id, 'ok', true);
end;
$$;

revoke all on function enrich_person(jsonb) from public, anon, authenticated;
grant execute on function enrich_person(jsonb) to service_role;

-- vista con la foto (limpia) incluida
create or replace view reencuentros_public with (security_barrier) as
  select pp.id, pp.full_name, pp.last_known_location_text,
         s.source, s.source_url, s.found_status, s.quote, s.where_text, s.confidence, s.detected_at, s.photo_url
  from person_found_signals s
  join persons_public pp on pp.id = s.person_id
  where s.review_status <> 'dismissed'
    and (s.confidence = 'high' or s.review_status = 'confirmed');

grant select on reencuentros_public to anon, authenticated;
