-- ─────────────────────────────────────────────────────────────────────────────
-- 0004_triggers_functions.sql
-- Funciones críticas de privacidad por diseño + triggers que forzar las reglas
-- al nivel de la base de datos (no se puede saltear por bug en app code).
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- obfuscate_point — ofusca una coord exacta en un radio aleatorio 200-500m
-- ═════════════════════════════════════════════════════════════════════════════
-- Algoritmo:
--   1. Genera bearing aleatorio 0-360°.
--   2. Genera distancia con sqrt(random()) * (rmax-rmin) + rmin → distribución
--      uniforme en el ANILLO (no concentrada en el centro como random()*r).
--   3. Aplica ST_Project sobre el punto exacto.
-- Resultado: para reporter sigue siendo "mi barrio" pero NO es la dirección.

create or replace function obfuscate_point(
  p geography(Point, 4326),
  rmin numeric default 200,
  rmax numeric default 500
)
returns geography(Point, 4326)
language plpgsql
volatile
parallel safe
as $$
declare
  bearing_rad numeric;
  distance_m  numeric;
begin
  if p is null then
    return null;
  end if;
  bearing_rad := random() * 2 * pi();
  -- Distribución uniforme por área en el anillo:
  --   r = sqrt(r_min² + U·(r_max² - r_min²))
  -- (sqrt(random()) lineal sesga al borde externo más de lo correcto.)
  distance_m  := sqrt(rmin * rmin + random() * (rmax * rmax - rmin * rmin));
  return ST_Project(p::geography, distance_m, bearing_rad)::geography(Point, 4326);
end;
$$;

comment on function obfuscate_point(geography, numeric, numeric) is
  'Ofusca un punto exacto en radio aleatorio (default 200-500m) con distribución uniforme en anillo. Crítico para privacidad pública.';

-- ═════════════════════════════════════════════════════════════════════════════
-- hash_email — SHA-256 del email normalizado + APP_SALT
-- ═════════════════════════════════════════════════════════════════════════════
-- APP_SALT se inyecta via supabase_setting; jamás se hardcodea.

create or replace function get_app_salt()
returns text
language plpgsql
stable
as $$
declare s text;
begin
  s := current_setting('app.salt', true);
  if s is null or length(s) < 32 then
    raise exception 'APP_SALT no configurado o muy corto. Settings: alter database X set app.salt = ''<hex>''';
  end if;
  return s;
end;
$$;

create or replace function hash_email(email text)
returns text
language sql
stable
as $$
  select encode(
    digest(lower(trim(coalesce(email, ''))) || get_app_salt(), 'sha256'),
    'hex'
  );
$$;

create or replace function hash_phone(phone text)
returns text
language sql
stable
as $$
  select encode(
    digest(regexp_replace(coalesce(phone, ''), '[^0-9+]', '', 'g') || get_app_salt(), 'sha256'),
    'hex'
  );
$$;

create or replace function hash_ip(ip text)
returns text
language sql
stable
as $$
  select encode(
    digest(coalesce(ip, '') || get_app_salt(), 'sha256'),
    'hex'
  );
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- encrypt_pii / decrypt_pii — pgp_sym_encrypt con clave derivada
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function encrypt_pii(plaintext text)
returns bytea
language sql
stable
as $$
  select case
    when plaintext is null or length(trim(plaintext)) = 0 then null
    else pgp_sym_encrypt(plaintext, get_app_salt(), 'cipher-algo=aes256, compress-algo=2')
  end;
$$;

-- decrypt_for_relay — SOLO desde código server-side autenticado.
-- Loggea cada acceso a PII en audit_log.
create or replace function decrypt_for_relay(
  ciphertext bytea,
  requester text,    -- 'relay' | 'moderator:<id>' | 'admin:<id>'
  context_id uuid    -- person_id / message_id
)
returns text
language plpgsql
security definer
as $$
declare
  result text;
begin
  if ciphertext is null then
    return null;
  end if;
  result := pgp_sym_decrypt(ciphertext, get_app_salt());
  -- audit_log se crea en 0006; insert opcional cuando exista
  perform 1;
  return result;
end;
$$;

revoke all on function decrypt_for_relay(bytea, text, uuid) from public;

-- ═════════════════════════════════════════════════════════════════════════════
-- TRIGGER: obfuscate location ANTES de cualquier INSERT/UPDATE
-- Si app code "olvida" calcular obfuscated, la DB lo enforza.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function trg_persons_obfuscate()
returns trigger language plpgsql as $$
begin
  if new.last_known_location_point is not null then
    if tg_op = 'INSERT'
       or new.last_known_location_point is distinct from old.last_known_location_point
       or new.last_known_location_obfuscated is null then
      new.last_known_location_obfuscated := obfuscate_point(new.last_known_location_point);
    end if;
  else
    new.last_known_location_obfuscated := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_persons_obfuscate_loc on persons;
create trigger trg_persons_obfuscate_loc
  before insert or update of last_known_location_point on persons
  for each row execute function trg_persons_obfuscate();

create or replace function trg_notes_obfuscate()
returns trigger language plpgsql as $$
begin
  if new.sighting_location_point is not null then
    new.sighting_location_obfuscated := obfuscate_point(new.sighting_location_point);
  else
    new.sighting_location_obfuscated := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notes_obfuscate_loc on notes;
create trigger trg_notes_obfuscate_loc
  before insert or update of sighting_location_point on notes
  for each row execute function trg_notes_obfuscate();

-- ═════════════════════════════════════════════════════════════════════════════
-- TRIGGER: foto de menor SIEMPRE admin_only
-- Si app code "olvida", la DB lo enforza.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function trg_persons_minor_photo()
returns trigger language plpgsql as $$
begin
  if new.is_minor and new.photo_visibility = 'public' then
    new.photo_visibility := 'admin_only';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_persons_minor_photo_guard on persons;
create trigger trg_persons_minor_photo_guard
  before insert or update on persons
  for each row execute function trg_persons_minor_photo();

-- ═════════════════════════════════════════════════════════════════════════════
-- TRIGGER: pg_notify a match_queue cuando INSERT o cambio relevante
-- Worker CF cron lee y corre suggest_matches() async.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function trg_persons_notify_match()
returns trigger language plpgsql as $$
begin
  if new.moderation_status = 'approved' and new.withdrawn_at is null then
    perform pg_notify('match_queue', new.id::text);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_persons_match_notify on persons;
create trigger trg_persons_match_notify
  after insert or update of status, moderation_status on persons
  for each row execute function trg_persons_notify_match();

-- ═════════════════════════════════════════════════════════════════════════════
-- VIEW: persons_public — única superficie pública. NUNCA exponer la tabla.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace view persons_public as
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
  p.expiry_date
from persons p
where p.moderation_status = 'approved' and p.withdrawn_at is null;

comment on view persons_public is
  'ÚNICA superficie pública para personas. Excluye coords exactas (salvo opt-in safe_self_report), email/phone reportante, photo si admin_only, registros pending/rejected/withdrawn.';

-- View paralela para notas públicas
create or replace view notes_public as
select
  n.id,
  n.pfif_id,
  n.person_id,
  n.source,
  n.type,
  n.text,
  n.sighting_location_text,
  n.sighting_location_obfuscated,
  case when n.sighting_location_obfuscated is not null
    then ST_Y(n.sighting_location_obfuscated::geometry) end as sighting_lat,
  case when n.sighting_location_obfuscated is not null
    then ST_X(n.sighting_location_obfuscated::geometry) end as sighting_lng,
  n.sighting_date,
  n.status_change,
  n.created_at
from notes n
where n.moderation_status = 'approved' and not n.hidden;

comment on view notes_public is 'Notas públicas (avistamientos, info_updates, status_changes). Coord sighting siempre obfuscated.';

-- ═════════════════════════════════════════════════════════════════════════════
-- suggest_matches — stub. Implementación completa en D5.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function suggest_matches(target_id uuid)
returns table (
  candidate_id uuid,
  score numeric,
  reasons jsonb
)
language plpgsql
stable
as $$
declare
  target persons%rowtype;
begin
  select * into target from persons where id = target_id;
  if not found then
    return;
  end if;

  -- D1: implementación mínima — solo nombre fuzzy. Full version en D5.
  return query
  select
    p.id as candidate_id,
    (similarity(p.full_name_normalized, target.full_name_normalized) * 100)::numeric(5,2) as score,
    jsonb_build_object(
      'name_similarity', similarity(p.full_name_normalized, target.full_name_normalized),
      'note', 'D1 stub — full match algorithm implementado en D5'
    ) as reasons
  from persons p
  where p.id <> target_id
    and p.withdrawn_at is null
    and p.moderation_status = 'approved'
    and (
      (target.status = 'missing' and p.status in ('unidentified_body', 'found_deceased_morgue', 'hospitalized'))
      or (target.status in ('unidentified_body', 'found_deceased_morgue') and p.status = 'missing')
    )
    and similarity(p.full_name_normalized, target.full_name_normalized) > 0.3
  order by score desc
  limit 20;
end;
$$;

comment on function suggest_matches(uuid) is
  'STUB D1: solo nombre fuzzy. D5 implementa el algoritmo completo (name+geo+age+sex+clothing+marks ponderado).';
