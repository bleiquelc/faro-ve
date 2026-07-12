-- ─────────────────────────────────────────────────────────────────────────────
-- 0032_relay_messages.sql · Relay de mensajes anti-estafa (función 4 del plan)
--
-- Activa la mensajería PRIVADA segura diseñada en 0001 (tabla `messages`):
-- cualquiera puede escribirle al reportante de una ficha SIN que ninguna de las
-- dos partes vea el email de la otra. El servidor descifra el email del
-- destinatario (decrypt_for_relay), envía por Resend, y la respuesta viaja por
-- un reply_token de un solo uso. Decisión de diseño (estudio 12-jul): esto ES
-- el "chat privado" de Faro — NUNCA contacto directo entre desconocidos (#2).
--
--   · persons_public + `relay_available` (columna NUEVA AL FINAL, regla de oro
--     de la vista): la UI solo muestra el botón si hay canal real.
--   · create_relay_message(payload) — valida consentimiento/email del
--     reportante, tope in-DB anti-abuso (3/día por remitente·ficha, 20/día por
--     ficha), inserta el mensaje con el email del remitente hasheado+cifrado,
--     genera reply_token (solo su HASH se guarda) y devuelve — SOLO a
--     service_role — el email destino descifrado + el token para el enlace.
--   · relay_reply_peek(token) — datos NO sensibles para pintar /mensaje/[token].
--   · relay_reply(payload) — consume el token (single-use) y devuelve el email
--     del remitente original para enviar la respuesta. Expira a los 14 días.
--
-- El remitente y el destinatario JAMÁS reciben el email del otro en ninguna
-- respuesta HTTP: los emails descifrados solo viajan RPC → endpoint → Resend.
-- Tras aplicar:  notify pgrst, 'reload schema';  (incluido al final)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── persons_public + relay_available (reproduce la def viva EXACTA + 1 col) ──
create or replace view persons_public with (security_barrier) as
 SELECT id,
    pfif_id,
    source,
    source_id,
    source_url,
    given_name,
    family_name,
    full_name,
    alternate_names,
    sex,
    age,
    age_unit,
    home_neighborhood,
    home_city,
    home_state,
    home_country,
    last_known_location_text,
    last_known_location_obfuscated,
    st_y(last_known_location_obfuscated::geometry) AS lat,
    st_x(last_known_location_obfuscated::geometry) AS lng,
    last_seen_at,
    description,
    height_cm,
    weight_kg,
    hair_color,
    eye_color,
    skin_tone,
    clothing_top,
    clothing_bottom,
    clothing_shoes,
    clothing_accessories,
    distinguishing_marks,
        CASE
            WHEN photo_visibility = 'public'::photo_visibility_type THEN photo_url
            ELSE NULL::text
        END AS photo_url,
    photo_visibility,
    status,
    is_minor,
    unaccompanied_minor,
    medical_urgent,
    medical_category,
    medical_notes,
    share_exact_location_with_searchers,
        CASE
            WHEN status = 'safe_self_report'::person_status AND share_exact_location_with_searchers THEN st_y(last_known_location_point::geometry)
            ELSE NULL::double precision
        END AS lat_exact_optional,
        CASE
            WHEN status = 'safe_self_report'::person_status AND share_exact_location_with_searchers THEN st_x(last_known_location_point::geometry)
            ELSE NULL::double precision
        END AS lng_exact_optional,
    created_at,
    updated_at,
    expiry_date,
        CASE
            WHEN status = 'safe_self_report'::person_status THEN NULLIF(TRIM(BOTH FROM COALESCE(contact_phone_public, ''::text)), ''::text)
            ELSE NULL::text
        END AS contact_phone_optional,
    (reporter_email_encrypted IS NOT NULL
     AND NOT COALESCE(reporter_email_invalid, false)
     AND COALESCE(reporter_consent_relay, true)) AS relay_available
   FROM persons p
  WHERE moderation_status = 'approved'::moderation_status_type AND withdrawn_at IS NULL AND NOT COALESCE(auto_hidden, false);

-- ─── create_relay_message ─────────────────────────────────────────────────────
create or replace function create_relay_message(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_person_id uuid := (payload->>'person_id')::uuid;
  v_sender_name  text := nullif(left(trim(coalesce(payload->>'sender_name','')), 120), '');
  v_sender_email text := lower(trim(payload->>'sender_email'));
  v_subject text := nullif(left(trim(coalesce(payload->>'subject','')), 200), '');
  v_body    text := left(trim(coalesce(payload->>'body','')), 2000);
  v_ip_hash text := payload->>'sender_ip_hashed';
  v_p record;
  v_msg_id uuid;
  v_token text;
  v_to text;
  v_name text;
begin
  if v_person_id is null then raise exception 'create_relay_message: falta person_id'; end if;
  if v_sender_email is null or v_sender_email = '' or v_sender_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'create_relay_message: sender_email inválido';
  end if;
  if length(v_body) < 10 then raise exception 'create_relay_message: mensaje muy corto'; end if;
  if v_ip_hash is null or v_ip_hash = '' then raise exception 'create_relay_message: falta ip hash'; end if;

  select reporter_email_encrypted, reporter_email_invalid, reporter_consent_relay,
         withdrawn_at, moderation_status,
         coalesce(nullif(full_name,''), trim(coalesce(given_name,'') || ' ' || coalesce(family_name,''))) as display_name
    into v_p
    from persons where id = v_person_id;

  -- Sin canal: respuesta uniforme, no revela detalles (la UI solo muestra el
  -- botón cuando relay_available; llegar acá directo = probing).
  if not found
     or v_p.withdrawn_at is not null
     or v_p.moderation_status <> 'approved'
     or v_p.reporter_email_encrypted is null
     or coalesce(v_p.reporter_email_invalid, false)
     or not coalesce(v_p.reporter_consent_relay, true) then
    return jsonb_build_object('ok', false, 'reason', 'sin_canal');
  end if;

  -- Tope in-DB (defensa detrás del rate-limit KV): 3/día mismo remitente→ficha,
  -- 20/día por ficha (evita inundar el buzón de un reportante).
  if (select count(*) from messages
       where person_id = v_person_id
         and sender_email_hash = hash_email(v_sender_email)
         and created_at > now() - interval '24 hours') >= 3
     or (select count(*) from messages
          where person_id = v_person_id
            and created_at > now() - interval '24 hours') >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'limite');
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');

  insert into messages (person_id, sender_name, sender_email_hash, sender_email_encrypted,
                        sender_ip_hashed, subject, body,
                        reply_token_hash, reply_token_expires_at)
  values (v_person_id, v_sender_name, hash_email(v_sender_email), encrypt_pii(v_sender_email),
          v_ip_hash, coalesce(v_subject, 'Mensaje sobre ' || coalesce(v_p.display_name, 'una ficha')), v_body,
          encode(digest(v_token || get_app_salt(), 'sha256'), 'hex'), now() + interval '14 days')
  returning id into v_msg_id;

  v_to := decrypt_for_relay(v_p.reporter_email_encrypted, 'relay', v_person_id);

  insert into audit_log (actor_type, actor_id, action, entity_type, entity_id, reason)
  values ('public', 'ip:' || v_ip_hash, 'insert', 'message', v_msg_id::text, 'relay: mensaje al reportante');

  -- to_email y reply_token: SOLO para el endpoint (service_role) → email saliente.
  -- El endpoint NUNCA los incluye en la respuesta HTTP.
  return jsonb_build_object('ok', true, 'id', v_msg_id, 'to_email', v_to,
                            'person_name', v_p.display_name, 'reply_token', v_token);
end;
$$;

-- ─── relay_reply_peek — datos NO sensibles para la página de respuesta ────────
create or replace function relay_reply_peek(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_m record;
begin
  select m.id, m.subject, m.created_at, m.reply_used, m.reply_token_expires_at,
         coalesce(nullif(p.full_name,''), trim(coalesce(p.given_name,'') || ' ' || coalesce(p.family_name,''))) as person_name
    into v_m
    from messages m join persons p on p.id = m.person_id
   where m.reply_token_hash = encode(digest(coalesce(p_token,'') || get_app_salt(), 'sha256'), 'hex');
  if not found or v_m.reply_used or v_m.reply_token_expires_at < now() then
    return jsonb_build_object('valid', false);
  end if;
  return jsonb_build_object('valid', true, 'subject', v_m.subject,
                            'person_name', v_m.person_name, 'sent_at', v_m.created_at);
end;
$$;

-- ─── relay_reply — consume el token (single-use) y da el destino de vuelta ────
create or replace function relay_reply(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text := payload->>'token';
  v_body  text := left(trim(coalesce(payload->>'body','')), 2000);
  v_ip    text := payload->>'ip_hashed';
  v_m record;
  v_to text;
begin
  if length(v_body) < 5 then raise exception 'relay_reply: respuesta muy corta'; end if;

  update messages m
     set reply_used = true
   where m.reply_token_hash = encode(digest(coalesce(v_token,'') || get_app_salt(), 'sha256'), 'hex')
     and not m.reply_used
     and m.reply_token_expires_at > now()
  returning m.id, m.subject, m.sender_name, m.sender_email_encrypted, m.person_id
    into v_m;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'token_invalido');
  end if;
  if v_m.sender_email_encrypted is null then
    return jsonb_build_object('ok', false, 'reason', 'sin_canal');
  end if;

  v_to := decrypt_for_relay(v_m.sender_email_encrypted, 'relay', v_m.id);

  insert into audit_log (actor_type, actor_id, action, entity_type, entity_id, reason)
  values ('public', 'ip:' || coalesce(v_ip, '?'), 'update', 'message', v_m.id::text, 'relay: respuesta del reportante');

  return jsonb_build_object('ok', true, 'id', v_m.id, 'to_email', v_to,
                            'subject', v_m.subject, 'sender_name', v_m.sender_name,
                            'reply_body', v_body);
end;
$$;

-- Permisos: SOLO service_role (los endpoints); nunca anon/authenticated directo.
revoke all on function create_relay_message(jsonb) from public, anon, authenticated;
grant execute on function create_relay_message(jsonb) to service_role;
revoke all on function relay_reply_peek(text) from public, anon, authenticated;
grant execute on function relay_reply_peek(text) to service_role;
revoke all on function relay_reply(jsonb) from public, anon, authenticated;
grant execute on function relay_reply(jsonb) to service_role;

comment on function create_relay_message(jsonb) is
  '0032: relay anti-estafa (función 4). Valida consent+email del reportante, tope in-DB, guarda mensaje cifrado y devuelve (solo a service_role) el email destino + reply_token para el correo saliente.';
comment on function relay_reply(jsonb) is
  '0032: respuesta del reportante vía reply_token single-use (14d). Devuelve (solo a service_role) el email del remitente original.';

notify pgrst, 'reload schema';
