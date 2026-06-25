-- ─────────────────────────────────────────────────────────────────────────────
-- 0010_optin_phone_and_report_rpc.sql
--
-- (1) Teléfono PÚBLICO opt-in del sujeto de un auto-reporte "a salvo".
--     NO es PII de reportante de terceros: es un dato que la propia persona elige
--     publicar para que la contacten. Expuesto SOLO si status='safe_self_report'.
-- (2) Recreación de persons_public añadiendo contact_phone_optional (gated).
-- (3) RPC create_person_report: cifra/hashea PII en la DB (la clave nunca sale de
--     Postgres), aplica reglas, inserta como 'pending', devuelve {id, edit_token}.
--
-- Idempotente. Requiere el mecanismo de APP_SALT ya existente (get_app_salt()).
-- Tras aplicar: select 'reload schema'  →  notify pgrst, 'reload schema';
-- ─────────────────────────────────────────────────────────────────────────────

-- (1) Columna teléfono público opt-in ────────────────────────────────────────
alter table persons add column if not exists contact_phone_public text;

comment on column persons.contact_phone_public is
  'Teléfono que el PROPIO sujeto de un safe_self_report eligió publicar para que lo contacten. NO es PII de reportante. persons_public lo expone SOLO cuando status=safe_self_report.';

-- (2) persons_public + contact_phone_optional ────────────────────────────────
-- create or replace: reproduce EXACTAMENTE las columnas existentes (mismo orden
-- y nombres) y AÑADE contact_phone_optional al final. Preserva grants a anon.
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
  p.expiry_date,
  -- Teléfono público SOLO para safe_self_report que lo compartió (opt-in).
  case
    when p.status = 'safe_self_report' then nullif(trim(coalesce(p.contact_phone_public, '')), '')
    else null
  end as contact_phone_optional
from persons p
where p.moderation_status = 'approved' and p.withdrawn_at is null;

comment on view persons_public is
  'ÚNICA superficie pública para personas. Excluye coords exactas (salvo opt-in safe_self_report), email/phone reportante, photo si admin_only, registros pending/rejected/withdrawn. contact_phone_optional solo para safe_self_report opt-in.';

-- Re-asegurar grant de lectura a anon/authenticated (create-or-replace lo conserva,
-- pero lo reafirmamos por idempotencia defensiva).
grant select on persons_public to anon, authenticated;

-- (3) RPC create_person_report ───────────────────────────────────────────────
-- SECURITY DEFINER: cifra/hashea la PII dentro de la DB. Solo service_role la
-- ejecuta (el endpoint server-side). El payload llega ya validado por Zod en el
-- borde; aquí se re-aplican las reglas duras (status permitido, gating teléfono).
create or replace function create_person_report(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id          uuid;
  v_edit_token  text;
  v_status      person_status;
  v_lat         double precision;
  v_lng         double precision;
  v_point       geography(Point, 4326);
  v_phone_pub   text;
  v_email       text;
  v_phone       text;
begin
  -- status: subconjunto permitido para reporte público (no se puede crear
  -- 'withdrawn' ni 'found_*' desde el endpoint público).
  v_status := coalesce(nullif(payload->>'status','')::person_status, 'missing');
  if v_status not in ('missing','safe_self_report','unidentified_body','sheltered','hospitalized') then
    raise exception 'status no permitido para reporte público: %', v_status;
  end if;

  -- Coords opcionales — juntas o ninguna.
  v_lat := nullif(payload->>'lat','')::double precision;
  v_lng := nullif(payload->>'lng','')::double precision;
  if (v_lat is null) <> (v_lng is null) then
    raise exception 'lat y lng deben venir juntas o ninguna';
  end if;
  if v_lat is not null then
    v_point := ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography;
  end if;

  -- Teléfono PÚBLICO solo para safe_self_report (opt-in del sujeto).
  if v_status = 'safe_self_report' then
    v_phone_pub := nullif(trim(coalesce(payload->>'contact_phone_public','')), '');
  else
    v_phone_pub := null;
  end if;

  -- PII reportante (cifrada/hasheada en DB).
  v_email := nullif(trim(coalesce(payload->>'reporter_email','')), '');
  v_phone := nullif(trim(coalesce(payload->>'reporter_phone','')), '');

  -- Edit token: raw devuelto al cliente una sola vez; en DB solo su hash.
  v_edit_token := encode(gen_random_bytes(24), 'hex');

  insert into persons (
    source,
    given_name, family_name, alternate_names,
    sex, age, status,
    last_known_location_text, last_known_location_point, last_seen_at,
    home_neighborhood, home_city, home_state,
    description, height_cm,
    clothing_top, clothing_bottom, clothing_shoes, distinguishing_marks, photo_url,
    medical_urgent, medical_category, medical_notes,
    share_exact_location_with_searchers, contact_phone_public,
    reporter_relation, reporter_name, reporter_country,
    reporter_email_hash, reporter_email_encrypted,
    reporter_phone_hash, reporter_phone_encrypted,
    reporter_consent_relay, reporter_ip_hashed,
    client_uuid,
    edit_token_hash, edit_token_expires_at,
    moderation_status
  ) values (
    'faro-ve',
    nullif(trim(coalesce(payload->>'given_name','')),''),
    nullif(trim(coalesce(payload->>'family_name','')),''),
    case when jsonb_typeof(payload->'alternate_names') = 'array'
      then array(select jsonb_array_elements_text(payload->'alternate_names')) else null end,
    coalesce(nullif(payload->>'sex','')::sex_type, 'unknown'),
    nullif(payload->>'age','')::int,
    v_status,
    nullif(trim(coalesce(payload->>'last_known_location_text','')),''),
    v_point,
    nullif(payload->>'last_seen_at','')::timestamptz,
    nullif(trim(coalesce(payload->>'home_neighborhood','')),''),
    coalesce(nullif(trim(coalesce(payload->>'home_city','')),''), 'Caracas'),
    nullif(trim(coalesce(payload->>'home_state','')),''),
    nullif(trim(coalesce(payload->>'description','')),''),
    nullif(payload->>'height_cm','')::int,
    nullif(trim(coalesce(payload->>'clothing_top','')),''),
    nullif(trim(coalesce(payload->>'clothing_bottom','')),''),
    nullif(trim(coalesce(payload->>'clothing_shoes','')),''),
    nullif(trim(coalesce(payload->>'distinguishing_marks','')),''),
    nullif(trim(coalesce(payload->>'photo_url','')),''),
    coalesce(nullif(payload->>'medical_urgent','')::boolean, false),
    nullif(payload->>'medical_category','')::medical_category_type,
    nullif(trim(coalesce(payload->>'medical_notes','')),''),
    coalesce(nullif(payload->>'share_exact_location_with_searchers','')::boolean, false),
    v_phone_pub,
    coalesce(nullif(payload->>'reporter_relation','')::reporter_relation, 'unknown'),
    nullif(trim(coalesce(payload->>'reporter_name','')),''),
    nullif(trim(coalesce(payload->>'reporter_country','')),''),
    case when v_email is not null then hash_email(v_email) else null end,
    encrypt_pii(v_email),
    case when v_phone is not null then hash_phone(v_phone) else null end,
    encrypt_pii(v_phone),
    coalesce(nullif(payload->>'reporter_consent_relay','')::boolean, true),
    nullif(payload->>'reporter_ip_hashed',''),
    nullif(payload->>'client_uuid',''),
    encode(digest(v_edit_token || get_app_salt(), 'sha256'), 'hex'),
    now() + interval '7 days',
    'pending'
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'edit_token', v_edit_token);
end;
$$;

comment on function create_person_report(jsonb) is
  'Crea un reporte público pending cifrando la PII en DB. Solo service_role. Devuelve {id, edit_token}. El edit_token raw se entrega una vez; en DB solo su hash.';

revoke all on function create_person_report(jsonb) from public, anon, authenticated;
grant execute on function create_person_report(jsonb) to service_role;
