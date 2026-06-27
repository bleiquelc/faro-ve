-- ─────────────────────────────────────────────────────────────────────────────
-- 0027_offline_idempotency.sql  ·  Idempotencia de reportes OFFLINE (outbox)
--
-- Cierra el hueco del ACK-PERDIDO: el POST insertó la fila pero la respuesta 200
-- no llegó al cliente (red intermitente en zona de desastre) → el cliente
-- reintenta el MISMO client_uuid. Sin esto se DUPLICA el reporte — y se federa
-- dos veces a PFIF (cada copia con pfif_id distinto) → una persona aparece dos
-- veces en el mapa. La cola de reportes offline depende de esta garantía.
--
-- 🔁 LEY DE REUSO (Art.5): NO se re-teclea el INSERT endurecido de 0021
-- (cifrado/hasheo de PII con encrypt_pii/hash_email/hash_phone, whitelist de
-- status, ofuscación por trigger). Se ANTEPONE un guard de idempotencia y se
-- añade un SELECT de respaldo para la carrera. El bloque INSERT es BYTE-IDÉNTICO
-- a 0021 salvo dos líneas justificadas: el valor de client_uuid pasa a usar la
-- variable ya normalizada (lower/trim) y se añade el ON CONFLICT DO NOTHING.
--
-- ⚠️ NOTA POSTGRES: `ON CONFLICT ... DO NOTHING` NO emite fila en RETURNING para
-- el registro en conflicto → NO se puede recuperar el id por esa vía (RETURNING
-- queda vacío). Por eso usamos SELECT previo (caso común: reintento tras éxito)
-- + SELECT de respaldo (caso carrera entre el guard y el INSERT). Así el id
-- devuelto es != null en TODOS los caminos y el cliente puede borrar la entrada
-- de la outbox con confianza.
--
-- Devuelve {id, edit_token, duplicate}. En el camino duplicado edit_token es null
-- (el raw original solo se entrega una vez; los formularios actuales ignoran ese
-- campo, así que no es regresión — ver +server.ts y los 4 forms de reporte).
--
-- ⚠️ APLICAR EN EL SQL EDITOR DE SUPABASE EN DOS PASOS (el founder):
--   PASO 1: ejecutar SOLO el `create unique index concurrently` (statement 1).
--           CONCURRENTLY no puede correr dentro de una transacción.
--   PASO 2: ejecutar el resto (function + grant + comment).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── PASO 1 (ejecutar solo, sin envolver en transacción) ──────────────────────
-- Índice UNIQUE PARCIAL: la ÚNICA barrera dura anti-duplicado a nivel DB.
-- WHERE client_uuid IS NOT NULL excluye las decenas de miles de filas de ingesta
-- (0025 nunca setea client_uuid → todas NULL) del set indexado; los índices
-- parciales de Postgres no indexan las filas que no cumplen el predicado, así que
-- no hay colisión, no requiere backfill, y múltiples filas con client_uuid NULL
-- coexisten sin problema.
create unique index concurrently if not exists persons_client_uuid_uniq
  on persons (client_uuid)
  where client_uuid is not null;

-- (El índice NO-único persons_client_uuid_idx de 0002 queda; es redundante para
--  lookups pero inofensivo. Dropearlo, si se quiere, va en una migración aparte
--  para no mezclar CONCURRENTLY con DDL transaccional.)

-- ── PASO 2 (resto) ───────────────────────────────────────────────────────────
create or replace function create_person_report(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id          uuid;
  v_existing    uuid;
  v_client_uuid text;
  v_edit_token  text;
  v_status      person_status;
  v_lat         double precision;
  v_lng         double precision;
  v_point       geography(Point, 4326);
  v_phone_pub   text;
  v_email       text;
  v_phone       text;
begin
  -- ── GUARD DE IDEMPOTENCIA (nuevo en 0027) ──────────────────────────────────
  -- Normaliza a minúsculas/trim: el unique es sobre `text`, así que sin esto
  -- 'A1B2…' y 'a1b2…' se verían distintos y el unique no atraparía el duplicado.
  -- crypto.randomUUID() del cliente ya emite minúsculas; esto es defensa extra.
  v_client_uuid := lower(nullif(trim(coalesce(payload->>'client_uuid','')), ''));
  if v_client_uuid is not null then
    select id into v_existing from persons where client_uuid = v_client_uuid limit 1;
    if found then
      -- Duplicado por ACK-perdido (reintento tras un éxito cuyo 200 no llegó).
      return jsonb_build_object('id', v_existing, 'edit_token', null, 'duplicate', true);
    end if;
  end if;

  -- ── Resto BYTE-IDÉNTICO a 0021 ─────────────────────────────────────────────
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
    v_client_uuid,                          -- normalizado (lower/trim/null) en el guard
    encode(digest(v_edit_token || get_app_salt(), 'sha256'), 'hex'),
    now() + interval '7 days',
    'approved'
  )
  on conflict (client_uuid) where client_uuid is not null do nothing
  returning id into v_id;

  -- ── SELECT de respaldo (nuevo en 0027) ─────────────────────────────────────
  -- Si v_id quedó NULL hubo CARRERA: otra transacción insertó el mismo
  -- client_uuid entre el guard y este INSERT (DO NOTHING no devolvió fila).
  -- Recuperamos el id existente y devolvemos duplicate:true (id != null seguro).
  if v_id is null then
    select id into v_id from persons where client_uuid = v_client_uuid limit 1;
    return jsonb_build_object('id', v_id, 'edit_token', null, 'duplicate', true);
  end if;

  return jsonb_build_object('id', v_id, 'edit_token', v_edit_token, 'duplicate', false);
end;
$$;

-- CREATE OR REPLACE preserva los grants (misma firma), pero lo reafirmamos por
-- idempotencia defensiva (patrón del repo). Solo service_role ejecuta la RPC.
revoke all on function create_person_report(jsonb) from public, anon, authenticated;
grant execute on function create_person_report(jsonb) to service_role;

comment on function create_person_report(jsonb) is
  'Crea un reporte público (EMERGENCIA: auto-approved). 0027: guard de idempotencia por client_uuid (cierra el ACK-perdido de la cola offline) + unique index parcial persons_client_uuid_uniq. INSERT byte-idéntico a 0021. Devuelve {id, edit_token, duplicate}.';
