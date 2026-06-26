-- ─────────────────────────────────────────────────────────────────────────────
-- 0021_auto_publish.sql  ·  EMERGENCIA (48h post-terremoto)
--
-- PUBLISH-FIRST: los reportes públicos de personas se publican AL INSTANTE
-- ('approved') en vez de quedar 'pending' esperando moderación manual. El founder
-- no puede moderar todo; cada minuto de espera puede costar una vida.
--
-- ÚNICO cambio vs 0010: la última columna del INSERT pasa de 'pending' a
-- 'approved'. Todo lo demás es BYTE-IDÉNTICO a 0010 (re-creado para idempotencia).
--
-- SEGURO porque las protecciones que importan NO dependen de la moderación:
--   · Ofuscación coords 200-500m  → trigger BEFORE INSERT (0017)
--   · Foto de menor → admin_only  → trigger BEFORE INSERT (0012, fail-safe)
--   · PII reportante cifrada/hasheada → aquí mismo (hash_*/encrypt_pii)
-- Red de seguridad: Turnstile + rate-limit 5/h por IP + kill-switch INSERTS_PAUSED
-- + (siguiente migración) "reportar perfil falso" → auto-ocultar comunitario.
--
-- REVERSIBLE: para volver a moderación manual, re-correr 0010 (o cambiar
-- 'approved' → 'pending' aquí) y re-aplicar.
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_status := coalesce(nullif(payload->>'status','')::person_status, 'missing');
  if v_status not in ('missing','safe_self_report','unidentified_body','sheltered','hospitalized') then
    raise exception 'status no permitido para reporte público: %', v_status;
  end if;

  v_lat := nullif(payload->>'lat','')::double precision;
  v_lng := nullif(payload->>'lng','')::double precision;
  if (v_lat is null) <> (v_lng is null) then
    raise exception 'lat y lng deben venir juntas o ninguna';
  end if;
  if v_lat is not null then
    v_point := ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography;
  end if;

  if v_status = 'safe_self_report' then
    v_phone_pub := nullif(trim(coalesce(payload->>'contact_phone_public','')), '');
  else
    v_phone_pub := null;
  end if;

  v_email := nullif(trim(coalesce(payload->>'reporter_email','')), '');
  v_phone := nullif(trim(coalesce(payload->>'reporter_phone','')), '');

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
    'approved'   -- ← EMERGENCIA: publish-first (antes 'pending'). Único cambio vs 0010.
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'edit_token', v_edit_token);
end;
$$;

comment on function create_person_report(jsonb) is
  'Crea un reporte público. EMERGENCIA 2026-06-26: auto-publicado (approved) para no esperar moderación. Protecciones (ofuscación, foto-menor, PII cifrada) son triggers/lógica independientes de la moderación.';
